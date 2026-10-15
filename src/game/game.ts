import * as THREE from 'three';
import type { Input } from '../core/input';
import { Rng, randomSeed } from '../core/rng';
import { SpatialHash, StaticBoxGrid } from '../core/spatialHash';
import { ENEMIES, type EnemyDef } from '../data/enemies';
import { ACHIEVEMENTS } from '../data/meta';
import { MOD_BY_ID, MODS, MOD_RARITY_WEIGHT } from '../data/mods';
import { PASSIVES } from '../data/passives';
import type { Tag } from '../data/tags';
import { WEAPONS } from '../data/weapons';
import { sfx } from '../audio/sfx';
import { disposeObject } from '../render/dispose';
import { DamageNumbers } from '../ui/damageNumbers';
import { Hud, type LoadoutItem } from '../ui/hud';
import { Screens, type Offer, type RunSummary, type ShopView } from '../ui/screens';
import { createFieldArena, type Arena } from '../world/fieldArena';
import { BULLET_Y, Bullets, Team } from './bullets';
import { CameraRig, cameraTuning } from './cameraRig';
import { Director } from './director';
import { Enemies, type Enemy, type EnemyCtx, type SpawnOpts } from './enemies';
import { Fx } from './fx';
import { loadHighScores, submitScore } from './highscores';
import { Juice } from './juice';
import { Particles } from './particles';
import { PickupType, Pickups } from './pickups';
import { Player } from './player';
import { Portal } from './portal';
import { grantAchievement, persist, save, unlockedWeapons } from './save';
import { settings, saveSettings } from './settings';
import { computeStats, type Stats } from './stats';
import type { ModDef } from './modTypes';
import { MAX_MOD_SLOTS, Synergy, type SynergyHost } from './synergy';
import { createWeapon, type Buster, type DamageOpts, type Weapon, type WeaponCtx } from './weapons';

export const scoreTuning = {
  comboWindow: 2.0, // seconds a combo survives without a kill
  tiers: [0, 25, 75, 150, 300, 500, 800, 1200], // combo needed for x1..x8
  noHitBonus: 2000, // x stage, for clearing a stage without damage
};

export const bombTuning = {
  chargePerXp: 0.004, // bomb meter gained per XP point of enemies killed
  damage: 80,
  radius: 10,
  duration: 0.35,
  knockback: 18,
};

export const dropTuning = {
  goldChance: 0.006,
  heartChance: 0.004,
  magnetChance: 0.0015,
};

/** Run economy (gold), Balatro-style: earn, hold for interest, or spend in the shop. */
export const economyTuning = {
  clearGold: 5, // flat gold for clearing a stage
  interestPer: 5, // +1 gold per this much held at stage clear
  interestCap: 5, // max interest per stage (Piggy Bank raises it)
  rerollBase: 2, // first paid reroll; +1 each reroll in the same shop
  healCost: 3,
  shopOffers: 4,
};

/** Status effects and their combos. */
export const statusTuning = {
  burnTime: 3,
  shockTime: 2,
  shockMult: 0.2, // shocked enemies take +20% damage
  shatterDamage: 18,
  overloadDamage: 30,
  napalmDps: 8,
};

export const cheats = { god: false };

export type Mode = 'title' | 'fight' | 'levelup' | 'shop' | 'cleared' | 'portal' | 'transition' | 'dead';

const MAX_WEAPONS = 6;
const MAX_PASSIVES = 6;
const AIM_HEIGHT = BULLET_Y;
const TITLE_SEED = 1234;
const RECYCLE_DIST = 36;

/** XP needed to go from `level` to `level + 1`. */
export function xpForLevel(level: number): number {
  const l = level - 1;
  return Math.round(5 + 6 * l + 0.6 * Math.pow(l, 1.8));
}

/**
 * Owns the whole session: menus, the current run and every gameplay system.
 *   title -> fight (timer, level-ups) -> boss -> cleared -> portal -> transition -> fight ...
 *   any -> dead -> (retry | title)
 */
export class Game implements SynergyHost {
  readonly scene = new THREE.Scene();
  arena: Arena;
  readonly player: Player;
  readonly enemies: Enemies;
  readonly bullets: Bullets;
  readonly particles: Particles;
  readonly fx: Fx;
  readonly portal: Portal;
  readonly pickups: Pickups;
  readonly juice = new Juice();
  readonly cam: CameraRig;
  readonly director = new Director();

  mode: Mode = 'title';
  paused = false;

  // --- Run state ---
  seed = 0;
  stage = 1;
  score = 0;
  kills = 0;
  combo = 0;
  maxCombo = 0;
  runTime = 0;
  bombCharge = 0;
  level = 1;
  xp = 0;
  xpNext = xpForLevel(1);
  weapons: Weapon[] = [];
  passives: Record<string, number> = {};
  /** Live stats (static stats + per-step Mod effects). Weapons and the player read this object. */
  readonly stats: Stats = computeStats({}, {});
  private statBase: Stats = computeStats({}, {});
  gold = 0;
  readonly synergy: Synergy;
  private shopOffers: (ModDef | null)[] = [];
  private shopRerolls = 0;
  private shopHealed = false;
  private overloads = 0;
  private pendingLevels = 0;
  private chestsPending = 0;
  private resumeMode: Mode = 'fight';
  private rerollsLeft = 0;
  private revivesLeft = 0;
  private dashes = 0;
  private elitesRun = 0;
  private bossesRun = 0;
  private damageBy: Record<string, number> = {};
  private newAchievements: string[] = [];
  private boss: Enemy | null = null;
  private offers: Offer[] = [];
  private comboT = 0;
  private damagedThisStage = false;
  rng = new Rng(randomSeed());
  private modeT = 0;
  private gameOverShown = false;
  private stageLoaded = false;
  private bombT = -1;
  private bombId = 0;
  private bombX = 0;
  private bombZ = 0;
  private footT = 0;
  private animTime = 0;
  private recycleT = 0;
  private loadoutDirty = true;

  private walls: StaticBoxGrid;
  private hash = new SpatialHash<Enemy>(2);
  private dmg: DamageNumbers;
  private hud: Hud;
  readonly screens: Screens;
  private muzzleFlash: THREE.Mesh;
  private ctx: WeaponCtx;
  private enemyCtx: EnemyCtx;

  // Scratch objects (no per-frame allocation)
  private raycaster = new THREE.Raycaster();
  private aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -AIM_HEIGHT);
  private ndc = new THREE.Vector2();
  readonly aimHit = new THREE.Vector3();
  private playerPos = new THREE.Vector3();
  private lead = new THREE.Vector3();
  private shake = { x: 0, z: 0 };
  private mz = { x: 0, z: 0 };
  private tmp = new THREE.Vector3();
  private targets: Enemy[] = [];

  constructor(
    private input: Input,
    aspect: number,
    hudRoot: HTMLElement,
    private reticle: HTMLElement,
  ) {
    this.arena = createFieldArena(TITLE_SEED);
    this.scene.add(this.arena.group);
    this.walls = new StaticBoxGrid(this.arena.colliders);
    this.player = new Player(this.scene);
    this.enemies = new Enemies(this.scene);
    this.bullets = new Bullets(this.scene);
    this.particles = new Particles(this.scene);
    this.fx = new Fx(this.scene);
    this.portal = new Portal(this.scene);
    this.pickups = new Pickups(this.scene);
    this.cam = new CameraRig(aspect);
    this.dmg = new DamageNumbers(hudRoot);
    this.hud = new Hud(hudRoot);
    this.synergy = new Synergy(this);
    this.screens = new Screens(hudRoot, {
      start: () => this.startRun(),
      resume: () => this.resume(),
      quit: () => this.endRun(true),
      retry: () => this.startRun(),
      title: () => this.goTitle(),
      pick: (i) => this.pickOffer(i),
      reroll: () => this.reroll(),
      skip: () => this.skipLevel(),
      buy: (i) => this.buyMod(i),
      sell: (i) => this.sellMod(i),
      moveMod: (i, d) => this.moveMod(i, d),
      shopReroll: () => this.shopReroll(),
      shopHeal: () => this.shopHeal(),
      shopDone: () => this.shopDone(),
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyF' && this.isCombatMode && !this.paused) {
        settings.autoFire = !settings.autoFire;
        saveSettings();
        this.hud.toast(settings.autoFire ? 'AUTO-FIRE ON' : 'AUTO-FIRE OFF');
      }
    });

    this.muzzleFlash = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), new THREE.MeshBasicMaterial({ color: '#fffbe0' }));
    this.muzzleFlash.visible = false;
    this.scene.add(this.muzzleFlash);

    this.ctx = this.makeWeaponCtx();
    this.enemyCtx = this.makeEnemyCtx();
    this.goTitle();
  }

  get autoFire(): boolean {
    return settings.autoFire;
  }
  set autoFire(v: boolean) {
    settings.autoFire = v;
    saveSettings();
  }

  private get isCombatMode(): boolean {
    return this.mode === 'fight' || this.mode === 'cleared' || this.mode === 'portal';
  }

  get multiplier(): number {
    const t = scoreTuning.tiers;
    let m = 1;
    for (let i = 1; i < t.length; i++) if (this.combo >= t[i]) m = i + 1;
    return m;
  }

  private get pitch(): number {
    return 1 + Math.min(this.combo, 200) * 0.003;
  }

  // ------------------------------------------------------------------ contexts

  private makeWeaponCtx(): WeaponCtx {
    const game = this;
    return {
      scene: this.scene,
      get player() {
        return game.player;
      },
      get stats() {
        return game.stats;
      },
      get rng() {
        return game.rng;
      },
      get time() {
        return game.runTime;
      },
      get flags() {
        return game.synergy.flags;
      },
      enemies: this.enemies,
      hash: this.hash,
      bullets: this.bullets,
      particles: this.particles,
      fx: this.fx,
      firing: false,
      damage: (e, base, o) => this.damage(e, base, o),
      nearest: (x, z, r, skip) => this.nearestEnemy(x, z, r, skip),
      inRadius: (x, z, r, out) => this.enemiesInRadius(x, z, r, out),
      blast: (x, z, r, base, color, source) => this.blast(x, z, r, base, color, source, WEAPONS[source]?.tags ?? ['explosive']),
      sound: (name) => sfx.weapon(name),
    };
  }

  private makeEnemyCtx(): EnemyCtx {
    return {
      target: this.player,
      targetAlive: true,
      hash: this.hash,
      colliders: this.arena.colliders,
      onWindup: (e) => {
        if (e.def.behavior === 'boss') sfx.bossWindup();
        else if (e.def.behavior !== 'spawner') sfx.telegraph();
      },
      fireBullet: (e, dx, dz, speed, damage) => {
        this.bullets.spawn({
          x: e.x + dx * (e.radius + 0.2),
          z: e.z + dz * (e.radius + 0.2),
          dirX: dx,
          dirZ: dz,
          speed,
          life: 4,
          radius: 0.26,
          damage: damage * e.dmgMul,
          knockback: 6,
          team: Team.Enemy,
          color: '#ff3df0',
          width: 0.5,
          length: 0.5,
        });
        sfx.enemyShoot();
      },
      spawnChild: (id, x, z) => {
        if (this.enemies.activeCount >= 480) return;
        if (this.walls.hitCircle(x, z, 0.5)) return;
        this.enemies.spawn(ENEMIES[id], x, z, this.spawnOpts());
      },
      detonate: (e) => this.detonate(e),
      slam: (e) => this.bossSlam(e),
    };
  }

  private spawnOpts(extra: SpawnOpts = {}): SpawnOpts {
    const hpMul = (extra.hpMul ?? this.director.hpMul) * (1 + this.synergy.flags.enemyHp);
    return { dmgMul: this.director.dmgMul, speedMul: this.director.speedMul, ...extra, hpMul };
  }

  // ------------------------------------------------------------------ flow

  private clearWorld(): void {
    this.enemies.clear();
    this.bullets.clear();
    this.particles.clear();
    this.fx.clear();
    this.dmg.clear();
    this.pickups.clear();
    this.portal.close();
    this.juice.reset();
    this.bombT = -1;
    this.boss = null;
  }

  private loadArena(seed: number): void {
    this.scene.remove(this.arena.group);
    disposeObject(this.arena.group);
    this.arena = createFieldArena(seed);
    this.scene.add(this.arena.group);
    this.walls = new StaticBoxGrid(this.arena.colliders);
    this.enemyCtx.colliders = this.arena.colliders;
  }

  /** Rebuild static stats (passives + Workshop + Mods) and the live copy. */
  private recomputeStats(): void {
    this.statBase = computeStats(this.passives, save.workshop);
    this.synergy.applyStatic(this.statBase);
    this.refreshLive();
    this.player.stats = this.stats;
    this.player.hp = Math.min(this.player.hp, this.stats.maxHp);
  }

  /** Live stats = static stats + per-step Mod effects (moving, timers). */
  private refreshLive(): void {
    Object.assign(this.stats, this.statBase);
    this.synergy.applyLive(this.stats);
  }

  private disposeWeapons(): void {
    for (const w of this.weapons) w.dispose();
    this.weapons = [];
  }

  goTitle(): void {
    this.paused = false;
    this.mode = 'title';
    this.clearWorld();
    this.disposeWeapons();
    this.player.reset(computeStats({}, save.workshop));
    this.hud.setVisible(false);
    this.hud.setFade(0);
    this.screens.setHighScores(loadHighScores());
    this.screens.show('title');
  }

  startRun(): void {
    this.paused = false;
    this.seed = randomSeed();
    this.rng = new Rng(this.seed);
    this.stage = 1;
    this.score = this.kills = this.combo = this.maxCombo = 0;
    this.runTime = this.comboT = this.bombCharge = 0;
    this.level = 1;
    this.xp = 0;
    this.xpNext = xpForLevel(1);
    this.pendingLevels = this.chestsPending = 0;
    this.gold = this.dashes = this.elitesRun = this.bossesRun = this.overloads = 0;
    this.damageBy = {};
    this.newAchievements = [];
    this.passives = {};
    this.disposeWeapons();
    this.weapons = [createWeapon('buster', this.scene)];
    this.synergy.reset();
    this.recomputeStats();
    this.rerollsLeft = this.stats.rerolls;
    this.revivesLeft = this.stats.revives;
    this.clearWorld();
    this.player.reset(this.stats);
    this.hud.resetScore();
    this.hud.setVisible(true);
    this.hud.setFade(0);
    this.loadoutDirty = true;
    this.screens.show('none');
    this.loadStage(1);
  }

  /** Alias used by the debug panel. */
  restart(): void {
    this.startRun();
  }

  private loadStage(stage: number): void {
    this.stage = stage;
    this.loadArena((this.seed ^ Math.imul(stage, 0x9e3779b1)) >>> 0);
    this.clearWorld();
    this.player.teleport(0, 0);
    this.director.start(stage);
    this.damagedThisStage = false;
    this.mode = 'fight';
    this.modeT = 0;
    this.hud.showBanner(`STAGE ${stage}`, `SURVIVE ${Math.round(this.director.duration / 60)} MINUTES`, 1.8);
    sfx.wave();
    this.checkAchievements();
  }

  pause(): void {
    if (!this.isCombatMode || this.paused) return;
    this.paused = true;
    this.screens.setPauseBuild(this.loadout(), this.synergy.slots.map((sl) => sl.def));
    this.screens.show('pause');
  }

  // ------------------------------------------------------------------ debug helpers (debug panel)

  debugLevelUp(): void {
    if (this.isCombatMode) this.gainXp(this.xpNext - this.xp);
  }

  debugGiveWeapon(id: string): void {
    if (!this.isCombatMode) return;
    const w = this.weapons.find((x) => x.def.id === id);
    if (w) w.levelUp();
    else this.weapons.push(createWeapon(id, this.scene));
    this.loadoutDirty = true;
  }

  debugSkipToBoss(): void {
    if (this.mode === 'fight') this.director.time = Math.max(this.director.time, this.director.duration - 3);
  }

  debugGiveMod(id: string): void {
    const m = MOD_BY_ID[id];
    if (!m || this.synergy.owns(id) || this.synergy.full) return;
    this.synergy.add(m);
    this.recomputeStats();
  }

  debugAddGold(n: number): void {
    this.gold += n;
  }

  debugAddBolts(n: number): void {
    save.bolts += n;
    persist();
  }

  resume(): void {
    this.paused = false;
    this.screens.show('none');
  }

  private stageClear(): void {
    this.mode = 'cleared';
    this.modeT = 0;
    this.bossesRun++;
    // Everything left on the field pops (dropping its XP).
    for (const e of this.enemies.list) {
      if (!e.active) continue;
      this.pickups.spawn(PickupType.Gem, e.x, e.z, e.def.xp);
      this.particles.burst(e.x, 0.6, e.z, { count: 2, color: e.def.bodyColor, speed: [2, 5], size: [0.15, 0.3], life: [0.3, 0.5], up: 4, gravity: 12 });
      this.enemies.kill(e);
    }
    this.bullets.clear();
    this.pickups.vacuum = true;
    const noHit = this.damagedThisStage ? 0 : scoreTuning.noHitBonus * this.stage;
    this.score += noHit;
    // Gold: flat reward plus interest on what you're holding (capped).
    const cap = economyTuning.interestCap + this.synergy.flags.interestCap;
    const interest = Math.min(cap, Math.floor(this.gold / economyTuning.interestPer));
    this.gold += economyTuning.clearGold + interest;
    this.player.heal(this.player.maxHp * 0.3);
    let sub = `+${economyTuning.clearGold} GOLD &middot; INTEREST +${interest}`;
    if (noHit) sub += `<br>NO-HIT BONUS +${noHit.toLocaleString('en-US')}`;
    this.hud.showBanner('STAGE CLEAR!', sub, 2.4);
    sfx.stageClear();
    this.hud.flash(0.5);
    this.checkAchievements();
  }

  // ------------------------------------------------------------------ shop

  private openShop(): void {
    this.mode = 'shop';
    this.shopRerolls = 0;
    this.shopHealed = false;
    this.rollShop();
    sfx.chest();
    this.showShop();
  }

  private rollShop(): void {
    const pool = MODS.filter((m) => !this.synergy.owns(m.id));
    this.shopOffers = [];
    for (let k = 0; k < economyTuning.shopOffers && pool.length; k++) {
      let r = this.rng.next() * pool.reduce((a, m) => a + MOD_RARITY_WEIGHT[m.rarity], 0);
      let i = 0;
      while (i < pool.length - 1 && (r -= MOD_RARITY_WEIGHT[pool[i].rarity]) > 0) i++;
      this.shopOffers.push(pool.splice(i, 1)[0]);
    }
  }

  private price(m: ModDef): number {
    return Math.max(1, Math.round(m.price * (1 - this.synergy.flags.shopDiscount)));
  }

  private get rerollCost(): number {
    if (this.shopRerolls < this.synergy.flags.freeRerolls) return 0;
    return economyTuning.rerollBase + this.shopRerolls - this.synergy.flags.freeRerolls;
  }

  private showShop(focus?: number): void {
    const cap = economyTuning.interestCap + this.synergy.flags.interestCap;
    const view: ShopView = {
      gold: this.gold,
      interest: Math.min(cap, Math.floor(this.gold / economyTuning.interestPer)),
      interestCap: cap,
      offers: this.shopOffers.map((m) => (m ? { def: m, price: this.price(m), hint: this.synergyHint(m) } : null)),
      owned: this.synergy.slots.map((sl, i) => ({ def: sl.def, sell: Math.floor(this.price(sl.def) / 2), readout: this.synergy.readout(i) })),
      slots: MAX_MOD_SLOTS,
      rerollCost: this.rerollCost,
      healCost: economyTuning.healCost,
      healed: this.shopHealed || this.player.hp >= this.player.maxHp,
      loadout: this.loadout(),
      stage: this.stage,
    };
    this.screens.showShop(view, focus);
    this.loadoutDirty = true;
  }

  /** Why a Mod fits the current build, shown on its shop card. */
  private synergyHint(m: ModDef): string {
    if (!m.synergy) return '';
    const parts = m.synergy
      .map((t) => [t, this.synergy.tagCount(t)] as const)
      .filter(([, n]) => n > 0)
      .map(([t, n]) => `${n} ${t}`);
    return parts.length ? `You have: ${parts.join(', ')}` : '';
  }

  private buyMod(i: number): void {
    const m = this.shopOffers[i];
    if (this.mode !== 'shop' || !m) return;
    const cost = this.price(m);
    if (this.gold < cost || this.synergy.full) {
      sfx.menuMove();
      this.hud.toast(this.synergy.full ? 'MOD SLOTS FULL: SELL ONE FIRST' : 'NOT ENOUGH GOLD');
      return;
    }
    this.gold -= cost;
    this.synergy.add(m);
    this.shopOffers[i] = null;
    this.recomputeStats();
    sfx.powerUp();
    this.showShop(i);
  }

  private sellMod(i: number): void {
    if (this.mode !== 'shop') return;
    const sl = this.synergy.slots[i];
    if (!sl) return;
    this.gold += Math.floor(this.price(sl.def) / 2);
    this.synergy.remove(i);
    this.recomputeStats();
    sfx.coin();
    this.showShop();
  }

  private moveMod(i: number, dir: -1 | 1): void {
    if (this.mode !== 'shop') return;
    this.synergy.move(i, dir);
    this.recomputeStats();
    sfx.menuMove();
    this.showShop();
  }

  private shopReroll(): void {
    if (this.mode !== 'shop') return;
    const cost = this.rerollCost;
    if (this.gold < cost) {
      this.hud.toast('NOT ENOUGH GOLD');
      return;
    }
    this.gold -= cost;
    this.shopRerolls++;
    this.rollShop();
    sfx.menuSelect();
    this.showShop();
  }

  private shopHeal(): void {
    if (this.mode !== 'shop' || this.shopHealed || this.gold < economyTuning.healCost) return;
    this.gold -= economyTuning.healCost;
    this.shopHealed = true;
    this.player.heal(this.player.maxHp * 0.4);
    sfx.heal();
    this.showShop();
  }

  private shopDone(): void {
    if (this.mode !== 'shop') return;
    this.screens.show('none');
    this.openPortal();
  }

  private openPortal(): void {
    const p = this.player;
    const lim = this.arena.halfSize - 4;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const x = p.x + Math.cos(a) * 6;
      const z = p.z + Math.sin(a) * 6;
      if (Math.abs(x) < lim && Math.abs(z) < lim && !this.walls.hitCircle(x, z, 1.8)) {
        this.portal.open(x, z);
        break;
      }
    }
    if (!this.portal.active) this.portal.open(p.x + 3, p.z);
    this.fx.ring(this.portal.x, this.portal.z, 1, 6, '#ff3df0', 0.5);
    this.hud.showBanner('ENTER THE PORTAL', `STAGE ${this.stage + 1} AWAITS`, 1.6);
    this.mode = 'portal';
    this.modeT = 0;
  }

  /** End the run: bank Bolts and lifetime stats, then show game over (or go to title on quit). */
  private endRun(quit = false): void {
    // Every run pays something: pickups, plus kills, stages and minutes survived.
    const earned = Math.round(
      (this.gold + Math.floor(this.kills / 25) + (this.stage - 1) * 25 + Math.floor(this.runTime / 60) * 5) * this.stats.boltMul,
    );
    save.bolts += earned;
    const L = save.lifetime;
    L.runs++;
    L.kills += this.kills;
    L.elites += this.elitesRun;
    L.bosses += this.bossesRun;
    L.bestStage = Math.max(L.bestStage, this.stage);
    L.bestLevel = Math.max(L.bestLevel, this.level);
    L.boltsEarned += earned;
    L.playTime += this.runTime;
    persist();
    this.paused = false;
    if (quit) {
      this.goTitle();
      this.hud.toast(`+${earned} BOLTS BANKED`);
      return;
    }
    const rank = submitScore({ score: this.score, stage: this.stage, kills: this.kills, date: new Date().toISOString().slice(0, 10) });
    this.screens.showGameOver(this.summary(earned), rank, loadHighScores());
  }

  private summary(earned: number): RunSummary {
    return {
      score: this.score,
      stage: this.stage,
      kills: this.kills,
      time: this.runTime,
      level: this.level,
      maxCombo: this.maxCombo,
      bolts: earned,
      loadout: this.loadout(),
      mods: this.synergy.slots.map((sl) => sl.def.name),
      damage: Object.entries(this.damageBy)
        .sort((a, b) => b[1] - a[1])
        .map(([id, dmg]) => ({ name: this.sourceName(id), color: WEAPONS[id]?.color ?? MOD_BY_ID[id]?.color ?? '#ff3df0', dmg })),
      achievements: this.newAchievements.map((id) => ACHIEVEMENTS.find((a) => a.id === id)!.name),
    };
  }

  private loadout(): LoadoutItem[] {
    return [
      ...this.weapons.map((w) => ({ icon: w.def.icon, color: w.def.color, level: w.level, max: w.maxed, name: w.def.name, kind: 'weapon' as const })),
      ...Object.entries(this.passives).map(([id, lv]) => {
        const d = PASSIVES[id];
        return { icon: d.icon, color: d.color, level: lv, max: lv >= d.maxLevel, name: d.name, kind: 'passive' as const };
      }),
    ];
  }

  // ------------------------------------------------------------------ level-ups

  private gainXp(v: number): void {
    this.xp += v * this.stats.xpMul;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.xpNext = xpForLevel(this.level);
      this.pendingLevels++;
      this.synergy.levelUp();
    }
  }

  private buildOffers(): Offer[] {
    type Cand = Offer & { w: number };
    const cands: Cand[] = [];
    for (const w of this.weapons) {
      if (w.maxed) continue;
      const next = w.def.levels[w.level];
      cands.push({ kind: 'weapon', id: w.def.id, name: w.def.name, icon: w.def.icon, color: w.def.color, tag: `LV ${w.level + 1}`, text: next.text, tags: w.def.tags, w: 3 });
    }
    if (this.weapons.length < MAX_WEAPONS) {
      for (const id of unlockedWeapons()) {
        if (this.weapons.some((w) => w.def.id === id)) continue;
        const d = WEAPONS[id];
        cands.push({ kind: 'weapon', id, name: d.name, icon: d.icon, color: d.color, tag: 'NEW!', text: d.desc, tags: d.tags, w: 2.4 });
      }
    }
    const owned = Object.keys(this.passives).length;
    for (const [id, d] of Object.entries(PASSIVES)) {
      const lv = this.passives[id] ?? 0;
      if (lv >= d.maxLevel || (lv === 0 && owned >= MAX_PASSIVES)) continue;
      cands.push({ kind: 'passive', id, name: d.name, icon: d.icon, color: d.color, tag: lv ? `LV ${lv + 1}` : 'NEW!', text: d.desc, w: lv ? 1.8 : 1.1 });
    }
    const out: Offer[] = [];
    while (out.length < 3 && cands.length) {
      let r = this.rng.next() * cands.reduce((a, c) => a + c.w, 0);
      let i = 0;
      while (i < cands.length - 1 && (r -= cands[i].w) > 0) i++;
      out.push(cands.splice(i, 1)[0]);
    }
    if (out.length === 0) {
      out.push(
        { kind: 'bolts', id: 'bolts', name: 'Gold Bag', icon: '\u25CF', color: '#ffb627', tag: 'BONUS', text: '+5 gold' },
        { kind: 'heal', id: 'heal', name: 'Snack', icon: '♥', color: '#ff5e7a', tag: 'BONUS', text: 'Heal 40 life' },
      );
    }
    return out;
  }

  private levelUpTitle(): string {
    return this.chestsPending > 0 ? 'TREASURE!' : `LEVEL ${this.level - this.pendingLevels + 1}!`;
  }

  private openLevelUp(): void {
    if (this.mode !== 'levelup') this.resumeMode = this.mode;
    this.mode = 'levelup';
    this.offers = this.buildOffers();
    sfx.levelUp();
    this.screens.showLevelUp(this.offers, this.levelUpTitle(), this.rerollsLeft, this.loadout(), this.skipGold);
  }

  private pickOffer(i: number): void {
    if (this.mode !== 'levelup') return;
    const o = this.offers[i];
    if (!o) return;
    if (o.kind === 'weapon') {
      const w = this.weapons.find((x) => x.def.id === o.id);
      if (w) w.levelUp();
      else this.weapons.push(createWeapon(o.id, this.scene));
    } else if (o.kind === 'passive') {
      this.passives[o.id] = (this.passives[o.id] ?? 0) + 1;
      this.recomputeStats();
      const heal = PASSIVES[o.id].healOnPick;
      if (heal) this.player.heal(heal);
    } else if (o.kind === 'bolts') this.gold += 5;
    else if (o.kind === 'heal') this.player.heal(40);
    this.player.hp = Math.min(this.player.hp, this.player.maxHp);
    this.loadoutDirty = true;
    sfx.powerUp();

    this.finishPick(o.color);
  }

  /** Skip this level-up for gold (economy decision: power now vs. shop later). */
  private skipLevel(): void {
    if (this.mode !== 'levelup') return;
    const g = this.skipGold;
    this.gold += g;
    sfx.coin();
    this.dmg.spawn(this.player.x, 2.6, this.player.z, `+${g}\u25CF`, 'score');
    this.finishPick('#ffb627');
  }

  get skipGold(): number {
    return 2 + Math.floor(this.level / 8);
  }

  private finishPick(color: string): void {
    if (this.chestsPending > 0) this.chestsPending--;
    else this.pendingLevels--;
    const p = this.player;
    this.particles.burst(p.x, 1, p.z, { count: 20, color, color2: '#ffffff', speed: [3, 8], size: [0.12, 0.3], life: [0.4, 0.8], up: 6, gravity: 10 });
    this.checkAchievements();

    if (this.pendingLevels > 0 || this.chestsPending > 0) {
      this.openLevelUp();
      return;
    }
    // Back to the action with a short grace: shove nearby enemies away.
    this.screens.show('none');
    this.mode = this.resumeMode;
    p.invuln = Math.max(p.invuln, 0.6);
    this.fx.ring(p.x, p.z, 1, 8, color, 0.35);
    for (const e of this.enemiesInRadius(p.x, p.z, 4, this.targets)) {
      const d = Math.hypot(e.x - p.x, e.z - p.z) || 1;
      e.kx += ((e.x - p.x) / d) * 14 * (1 - e.def.knockbackResist);
      e.kz += ((e.z - p.z) / d) * 14 * (1 - e.def.knockbackResist);
    }
  }

  private reroll(): void {
    if (this.mode !== 'levelup' || this.rerollsLeft <= 0) return;
    this.rerollsLeft--;
    this.offers = this.buildOffers();
    sfx.menuSelect();
    this.screens.showLevelUp(this.offers, this.levelUpTitle(), this.rerollsLeft, this.loadout(), this.skipGold);
  }

  // ------------------------------------------------------------------ achievements

  private checkAchievements(): void {
    const L = save.lifetime;
    const kills = L.kills + this.kills;
    const want: [string, boolean][] = [
      ['first_steps', kills >= 300],
      ['boss_slayer', this.bossesRun > 0],
      ['elite_hunter', L.elites + this.elitesRun >= 5],
      ['exterminator', kills >= 3000],
      ['speedster', this.dashes >= 60],
      ['arsenal', this.weapons.length >= 6],
      ['maxed', this.weapons.some((w) => w.maxed)],
      ['stage_3', this.stage >= 3],
    ];
    for (const [id, ok] of want) {
      if (!ok) continue;
      const def = grantAchievement(id);
      if (!def) continue;
      this.newAchievements.push(id);
      const unlock = def.unlockWeapon ? ` - ${WEAPONS[def.unlockWeapon].name} unlocked!` : '';
      this.hud.toast(`★ ${def.name}${unlock} (+${def.bolts} Bolts)`, 4);
      sfx.powerUp();
    }
  }

  // ------------------------------------------------------------------ update

  update(dt: number): void {
    const input = this.input;

    if (
      !this.paused &&
      this.isCombatMode &&
      this.screens.current === 'none' &&
      (input.keyPressed('Escape') || input.keyPressed('KeyP') || input.padButtonPressed(9))
    ) {
      this.pause();
      input.endStep();
      return;
    }
    // Menus get the input first; if one switched screens, swallow this step's presses.
    const before = this.screens.current;
    this.screens.update(input, dt);
    if (this.screens.current !== before) {
      input.endStep();
      return;
    }
    if (this.paused) {
      if (input.padButtonPressed(9)) this.resume();
      input.endStep();
      return;
    }
    if (this.mode === 'levelup') {
      for (let k = 0; k < 3; k++) if (input.keyPressed(`Digit${k + 1}`)) this.pickOffer(k);
      if (input.keyPressed('KeyR') || input.padButtonPressed(3)) this.reroll();
      input.endStep();
      return;
    }
    if (this.mode === 'shop') {
      input.endStep();
      return;
    }
    if (this.mode === 'title') {
      input.endStep();
      return;
    }

    if (this.juice.hitStop > 0) {
      this.juice.hitStop -= dt;
      return;
    }

    this.modeT += dt;
    if (this.mode === 'transition') {
      this.updateTransition();
      input.endStep();
      return;
    }

    const p = this.player;
    if (!p.dead) {
      this.runTime += dt;
      if (this.stats.regen > 0) p.heal(this.stats.regen * dt);
    }

    // --- Aim ---
    if (input.device === 'pad') {
      if (input.padAim.x !== 0 || input.padAim.y !== 0) p.setAimDir(input.padAim.x, input.padAim.y);
      else if (input.move.x !== 0 || input.move.y !== 0) p.setAimDir(input.move.x, input.move.y);
    } else if (this.mouseAimPoint()) {
      p.setAimPoint(this.aimHit.x, this.aimHit.z);
    }

    // --- Move / dash ---
    const wantDash =
      input.keyPressed('Space') ||
      input.keyPressed('ShiftLeft') ||
      input.mousePressed(2) ||
      input.padButtonPressed(4) ||
      input.padButtonPressed(6) ||
      input.padButtonPressed(0);
    if (p.update(dt, p.dead ? null : input, this.arena.colliders, wantDash && !p.dead)) this.onDash();
    this.updateFootsteps(dt);

    // --- Mods: timers and live stats (moving, adrenaline...) ---
    this.synergy.moving = p.speed > 1.2;
    this.synergy.tick(dt);
    this.refreshLive();

    // --- Spatial hash first: weapons and enemies query it ---
    this.hash.clear();
    for (const e of this.enemies.list) if (e.alive) this.hash.insert(e, e.x, e.z, e.radius);

    // --- Weapons ---
    const padFiring = input.padAim.x !== 0 || input.padAim.y !== 0 || input.padButton(7);
    this.ctx.firing = input.mouseDown(0) || padFiring || (settings.autoFire && input.device === 'kbm');
    if (!p.dead) for (const w of this.weapons) w.update(dt, this.ctx);
    const buster = this.weapons[0] as Buster;
    if (buster.muzzleT > 0.045) this.juice.kick(-p.aim.x, -p.aim.z, 2);

    // --- Bomb ---
    const wantBomb =
      input.keyPressed('KeyQ') || input.keyPressed('KeyE') || input.mousePressed(1) || input.padButtonPressed(3) || input.padButtonPressed(5);
    if (wantBomb && !p.dead) this.tryBomb();
    this.updateBomb(dt);

    // --- Enemies ---
    this.enemyCtx.targetAlive = !p.dead;
    this.enemies.update(dt, this.enemyCtx);
    if (!p.dead) this.contactDamage();
    this.updateStatuses(dt);
    this.recycleFarEnemies(dt);

    // --- Projectiles, pickups, effects ---
    this.updateBullets(dt);
    this.pickups.update(dt, p.x, p.z, this.stats.magnet, (t, v) => this.collect(t, v));
    this.particles.update(dt);
    this.fx.update(dt);

    if (this.mode === 'fight' && this.combo > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) this.combo = 0;
    }

    // --- Stage flow ---
    if (this.mode === 'fight' && !p.dead) {
      const reqs = this.director.update(dt, this.enemies.activeCount, (id) => this.enemies.countOf(id), this.rng);
      let anchor: { x: number; z: number; def: EnemyDef } | null = null;
      for (const r of reqs) {
        if (r.kind === 'boss') this.spawnBoss(r.def);
        else if (r.kind === 'ring') this.spawnRing(r.def, r.count);
        else {
          // Pack members (same def in a row) spawn clustered together.
          const near = anchor && anchor.def === r.def ? anchor : null;
          const pos = this.spawnEnemy(r.def, r.elite, near);
          if (pos) anchor = { x: pos.x, z: pos.z, def: r.def };
        }
      }
      if (this.boss && !this.boss.active) this.boss = null;
      if (this.director.bossSpawned && !this.boss) this.stageClear();
    } else if (this.mode === 'cleared') {
      if (this.modeT > 2.2) this.openShop();
    } else if (this.mode === 'portal') {
      if (this.portal.age > 0.5 && Math.hypot(p.x - this.portal.x, p.z - this.portal.z) < 1.3) {
        this.mode = 'transition';
        this.modeT = 0;
        this.stageLoaded = false;
        sfx.portal();
        this.hud.flash(0.6);
      } else if (this.modeT % 0.25 < dt) {
        this.particles.burst(this.portal.x, 0.3, this.portal.z, { count: 3, color: '#ff3df0', color2: '#4fc3ff', speed: [0.5, 2], size: [0.1, 0.22], life: [0.6, 1.0], up: 4, drag: 1 });
      }
    } else if (this.mode === 'dead' && this.modeT > 1.2 && !this.gameOverShown) {
      this.gameOverShown = true;
      this.endRun();
    }

    // Level-ups interrupt the action (after the step so this frame's effects land).
    if ((this.pendingLevels > 0 || this.chestsPending > 0) && this.isCombatMode && !p.dead) this.openLevelUp();

    input.endStep();
  }

  private updateTransition(): void {
    const t = this.modeT;
    if (t < 0.35) this.hud.setFade(t / 0.35);
    else if (!this.stageLoaded) {
      this.stageLoaded = true;
      this.hud.setFade(1);
      this.loadStage(this.stage + 1);
      this.mode = 'transition';
      this.modeT = 0.35;
    } else if (t < 0.8) this.hud.setFade(1 - (t - 0.35) / 0.45);
    else {
      this.hud.setFade(0);
      this.mode = 'fight';
    }
  }

  private mouseAimPoint(): THREE.Vector3 | null {
    this.ndc.set(this.input.mouse.ndcX, this.input.mouse.ndcY);
    this.raycaster.setFromCamera(this.ndc, this.cam.camera);
    return this.raycaster.ray.intersectPlane(this.aimPlane, this.aimHit);
  }

  private onDash(): void {
    const p = this.player;
    this.dashes++;
    this.synergy.dash();
    sfx.dash();
    this.juice.shake(0.05);
    this.fx.ring(p.x, p.z, 1, 3, '#4fc3ff', 0.25);
    this.particles.burst(p.x, 0.15, p.z, { count: 10, color: '#ffffff', color2: '#e8f4ff', speed: [2, 5], size: [0.12, 0.25], life: [0.2, 0.4], up: 1.5, gravity: 6 });
    if (this.dashes === 60) this.checkAchievements();
  }

  private updateFootsteps(dt: number): void {
    const p = this.player;
    if (p.dead) return;
    if (p.dashing) {
      this.particles.burst(p.x, 0.9, p.z, { count: 2, color: '#4fc3ff', color2: '#2f7bff', speed: [0.2, 1], size: [0.25, 0.4], life: [0.15, 0.3], drag: 6 });
      return;
    }
    if (p.speed < 2.5) return;
    this.footT -= dt;
    if (this.footT > 0) return;
    this.footT = 0.21;
    this.particles.burst(p.x - p.vel.x * 0.04, 0.1, p.z - p.vel.z * 0.04, { count: 2, color: '#f2e2b8', color2: '#ffffff', speed: [0.3, 1.2], size: [0.12, 0.2], life: [0.25, 0.4], up: 1.2, gravity: 3 });
  }

  // ------------------------------------------------------------------ spawning

  /** A point on a ring just off-screen around the player, inside the arena and not in a wall. */
  private ringPoint(rMin: number, rMax: number, r = 0.6): { x: number; z: number } | null {
    const p = this.player;
    const lim = this.arena.halfSize - 3;
    // Bias spawns toward where the player is heading so running away isn't free.
    const heading = Math.atan2(p.vel.z, p.vel.x);
    const moving = p.speed > 1;
    for (let i = 0; i < 10; i++) {
      const a = moving && this.rng.chance(0.5) ? heading + this.rng.range(-1, 1) : this.rng.range(0, Math.PI * 2);
      const d = this.rng.range(rMin, rMax);
      const x = p.x + Math.cos(a) * d;
      const z = p.z + Math.sin(a) * d;
      if (Math.abs(x) > lim || Math.abs(z) > lim) continue;
      if (this.walls.hitCircle(x, z, r)) continue;
      return { x, z };
    }
    return null;
  }

  private spawnEnemy(def: EnemyDef, elite = false, near: { x: number; z: number } | null = null) {
    let pos: { x: number; z: number } | null = null;
    if (near) {
      const x = near.x + this.rng.range(-1.6, 1.6);
      const z = near.z + this.rng.range(-1.6, 1.6);
      if (!this.walls.hitCircle(x, z, def.radius)) pos = { x, z };
    }
    pos ??= this.ringPoint(18, 24, def.radius * (elite ? 1.6 : 1) + 0.2);
    if (!pos) return null;
    this.enemies.spawn(def, pos.x, pos.z, this.spawnOpts({ elite }));
    if (elite) {
      this.hud.toast(`ELITE ${def.name.toUpperCase()} INCOMING!`);
      sfx.elite();
    }
    return pos;
  }

  private spawnRing(def: EnemyDef, count: number): void {
    const p = this.player;
    const lim = this.arena.halfSize - 2;
    const R = 15;
    let placed = 0;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const x = p.x + Math.cos(a) * R;
      const z = p.z + Math.sin(a) * R;
      if (Math.abs(x) > lim || Math.abs(z) > lim || this.walls.hitCircle(x, z, def.radius)) continue;
      this.enemies.spawn(def, x, z, this.spawnOpts());
      placed++;
    }
    if (placed > 0) {
      this.hud.toast('SURROUNDED!');
      sfx.wave();
    }
  }

  private spawnBoss(def: EnemyDef): void {
    const pos = this.ringPoint(13, 16, def.radius + 0.5) ?? { x: this.player.x + 12, z: this.player.z };
    this.boss = this.enemies.spawn(def, pos.x, pos.z, this.spawnOpts({ hpMul: this.director.bossHpMul }));
    this.hud.showBanner('WARNING!', `${def.name.toUpperCase()} APPROACHES`, 2.2);
    sfx.boss();
    this.juice.shake(0.6);
  }

  /** Keep the action near the player: enemies left far behind re-enter ahead. */
  private recycleFarEnemies(dt: number): void {
    this.recycleT -= dt;
    if (this.recycleT > 0 || this.mode !== 'fight') return;
    this.recycleT = 0.5;
    const p = this.player;
    for (const e of this.enemies.list) {
      if (!e.alive || e.elite || e.def.behavior === 'boss' || e.def.behavior === 'spawner') continue;
      if (Math.hypot(e.x - p.x, e.z - p.z) < RECYCLE_DIST) continue;
      const pos = this.ringPoint(18, 24, e.radius + 0.2);
      if (!pos) continue;
      e.x = e.px = pos.x;
      e.z = e.pz = pos.z;
      e.kx = e.kz = 0;
    }
  }

  // ------------------------------------------------------------------ combat

  private nearestEnemy(x: number, z: number, r: number, skip?: (e: Enemy) => boolean): Enemy | null {
    let best: Enemy | null = null;
    let bd = r * r;
    this.hash.query(x, z, r, (e) => {
      if (!e.alive || e.hp <= 0 || (skip && skip(e))) return;
      const d = (e.x - x) ** 2 + (e.z - z) ** 2;
      if (d < bd) {
        bd = d;
        best = e;
      }
    });
    return best;
  }

  private enemiesInRadius(x: number, z: number, r: number, out: Enemy[]): Enemy[] {
    out.length = 0;
    this.hash.query(x, z, r + 1, (e) => {
      if (!e.alive || e.hp <= 0) return;
      const rr = r + e.radius;
      if ((e.x - x) ** 2 + (e.z - z) ** 2 < rr * rr && !out.includes(e)) out.push(e);
    });
    return out;
  }

  private damage(e: Enemy, base: number, o: DamageOpts): number {
    if (!e.active || e.hp <= 0) return 0;
    const tags: readonly Tag[] = o.tags ?? WEAPONS[o.source]?.tags ?? [];
    const crit = !!o.canCrit && this.rng.chance(this.stats.critChance);
    const ev = { e, source: o.source, tags, dist: Math.hypot(e.x - this.player.x, e.z - this.player.z), crit };
    // Stats first, then Mods left to right, then statuses and crit.
    let amount = this.synergy.damage(ev, base * this.stats.damageMul);
    if (e.frozen > 0 && e.shatter > 0) amount *= 1 + e.shatter;
    if (e.shockT > 0) amount *= 1 + statusTuning.shockMult + this.synergy.flags.shockMult;
    if (crit) amount *= this.stats.critMult;
    amount = Math.max(1, Math.round(amount));
    e.hp -= amount;
    this.damageBy[o.source] = (this.damageBy[o.source] ?? 0) + amount;
    e.flash = 0.07;
    const k = (o.knockback ?? 0) * this.stats.knockbackMul * (1 - e.def.knockbackResist) * (crit ? 1.5 : 1);
    if (k > 0) {
      e.kx += (o.dirX ?? 0) * k;
      e.kz += (o.dirZ ?? 0) * k;
    }
    e.squash(crit ? -6 : -3);
    const hx = o.hx ?? e.x;
    const hz = o.hz ?? e.z;
    if (crit) {
      this.dmg.spawn(e.x, 1.9 * e.scale, e.z, `${amount}!`, 'crit');
      sfx.crit();
      this.fx.star(hx, BULLET_Y, hz, 1.5, '#fff35c', 0.12);
    } else if (o.loud) {
      this.dmg.spawn(e.x, 1.7 * e.scale, e.z, amount);
      sfx.hit(this.pitch);
      this.fx.star(hx, BULLET_Y, hz, 0.85, '#ffffff', 0.08);
    }
    if (o.loud || crit) {
      this.particles.burst(hx, BULLET_Y, hz, { count: 3, color: '#ffffff', color2: e.def.bodyColor, speed: [3, 7], size: [0.1, 0.18], life: [0.12, 0.25], dir: { x: -(o.dirX ?? 0), z: -(o.dirZ ?? 0), spread: 2.4 } });
    }
    // Statuses from the weapon's own tags, then Mod triggers.
    if (!o.noStatus && e.hp > 0) {
      if (tags.includes('fire')) this.ignite(e, Math.max(3, amount * 0.15));
      if (tags.includes('shock')) this.shock(e);
    }
    if (!o.noStatus) {
      this.synergy.hit(ev);
      if (crit) this.synergy.crit(ev);
    }
    if (e.hp <= 0 && e.active) this.killEnemy(e, o.source);
    return amount;
  }

  // ------------------------------------------------------------------ statuses and combos

  ignite(e: Enemy, dps: number): void {
    if (!e.active || e.hp <= 0) return;
    e.burnT = statusTuning.burnTime;
    e.burnDps = Math.max(e.burnDps, dps);
    if (e.shockT > 0) this.overload(e);
  }

  shock(e: Enemy): void {
    if (!e.active || e.hp <= 0) return;
    e.shockT = statusTuning.shockTime + this.synergy.flags.shockTime;
    if (e.burnT > 0) this.overload(e);
  }

  /** Burn + Shock on the same enemy: consume both for a blast. */
  private overload(e: Enemy): void {
    e.burnT = e.shockT = 0;
    e.burnDps = 0;
    this.overloads++;
    const m = 1 + this.synergy.flags.overloadMult;
    if (this.overloads % 3 === 1) this.dmg.spawn(e.x, 2.2, e.z, 'OVERLOAD!', 'crit');
    this.blast(e.x, e.z, 1.8 * Math.sqrt(m), statusTuning.overloadDamage * m, '#ffe14d', 'overload', ['explosive'], true);
  }

  /** Frozen enemy killed: ice shards burst out. */
  private shatter(e: Enemy): void {
    const m = 1 + this.synergy.flags.shatterMult;
    this.particles.burst(e.x, 0.8, e.z, { count: 10, color: '#ffffff', color2: '#9fe8ff', speed: [5, 10], size: [0.1, 0.25], life: [0.2, 0.4], up: 3, gravity: 10 });
    this.fx.ring(e.x, e.z, 1, 4, '#9fe8ff', 0.2);
    for (const o of this.enemiesInRadius(e.x, e.z, 2, this.targets).slice()) {
      if (o === e) continue;
      const d = Math.hypot(o.x - e.x, o.z - e.z) || 1;
      this.damage(o, statusTuning.shatterDamage * m, { source: 'shatter', tags: ['frost'], dirX: (o.x - e.x) / d, dirZ: (o.z - e.z) / d, knockback: 4, noStatus: true });
    }
  }

  /** Lightning arc from an enemy through nearby ones (Mods: Crit Cascade). */
  zap(from: Enemy, hops: number, dmg: number): void {
    const hit = new Set<number>([from.uid]);
    let cur: Enemy = from;
    for (let i = 0; i < hops; i++) {
      const next = this.nearestEnemy(cur.x, cur.z, 5, (o) => hit.has(o.uid));
      if (!next) break;
      hit.add(next.uid);
      const steps = 5;
      for (let k = 1; k < steps; k++) {
        const t = k / steps;
        this.particles.burst(cur.x + (next.x - cur.x) * t, 1, cur.z + (next.z - cur.z) * t, { count: 1, color: '#fff35c', color2: '#ffffff', speed: [0, 0.5], size: [0.12, 0.2], life: [0.08, 0.14] });
      }
      this.fx.star(next.x, 1, next.z, 1, '#fff35c', 0.1);
      this.damage(next, dmg, { source: 'zap', tags: ['chain', 'shock'], canCrit: false, noStatus: false });
      cur = next;
    }
  }

  /** Burn damage ticks and status timers. */
  private updateStatuses(dt: number): void {
    for (const e of this.enemies.list) {
      if (!e.active) continue;
      if (e.shockT > 0) e.shockT -= dt;
      if (e.burnT <= 0) continue;
      e.burnT -= dt;
      e.burnAcc += dt;
      if (e.burnAcc < 0.5) continue;
      e.burnAcc = 0;
      if (this.rng.chance(0.5)) this.particles.burst(e.x, 0.6 + e.radius, e.z, { count: 1, color: '#ff7a2f', color2: '#ffd23f', speed: [0.2, 1], size: [0.15, 0.3], life: [0.3, 0.5], up: 2, drag: 2 });
      this.damage(e, e.burnDps * 0.5, { source: 'burn', tags: ['fire'], noStatus: true });
      if (e.burnT <= 0) e.burnDps = 0;
    }
  }

  private sourceName(id: string): string {
    const named: Record<string, string> = { bomb: 'Bomb', burn: 'Burning', shatter: 'Shatter', overload: 'Overload', zap: 'Crit Zaps', exploder: 'Enemy blasts' };
    return WEAPONS[id]?.name ?? MOD_BY_ID[id]?.name ?? named[id] ?? 'Other';
  }

  private killEnemy(e: Enemy, source = ''): void {
    const def = e.def;
    const wasFrozen = e.frozen > 0;
    this.kills++;
    this.combo++;
    this.comboT = scoreTuning.comboWindow;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.score += def.score * this.multiplier * (e.elite ? 5 : 1);
    const xp = def.xp * (e.elite ? 10 : 1);
    this.bombCharge = Math.min(1, this.bombCharge + bombTuning.chargePerXp * xp);

    // Drops
    this.pickups.spawn(PickupType.Gem, e.x, e.z, xp);
    const isBoss = def.behavior === 'boss';
    const big = e.elite || isBoss;
    if (big) {
      this.pickups.spawn(PickupType.Chest, e.x, e.z);
      for (let i = 0; i < (isBoss ? 6 : 2); i++) this.pickups.spawn(PickupType.Bolt, e.x, e.z, 1);
      if (e.elite) this.elitesRun++;
    } else {
      if (this.rng.chance(dropTuning.goldChance)) this.pickups.spawn(PickupType.Bolt, e.x, e.z, 1);
      if (this.rng.chance(dropTuning.heartChance)) this.pickups.spawn(PickupType.Heart, e.x, e.z);
      if (this.rng.chance(dropTuning.magnetChance)) this.pickups.spawn(PickupType.Magnet, e.x, e.z);
    }

    // Feedback scales with importance; swarm kills stay light so hundreds don't stutter.
    const r = e.radius;
    const y = r + 0.1 + e.hopY;
    sfx.enemyDie(this.pitch);
    this.particles.burst(e.x, y, e.z, { count: big ? 40 : def.xp >= 3 ? 12 : 6, color: def.bodyColor, color2: def.accentColor, speed: [3, 9], size: [0.15, 0.3 + r * 0.15], life: [0.3, 0.6], up: 5, gravity: 18, drag: 2 });
    if (def.xp >= 3 || big || this.rng.chance(0.25)) this.fx.ring(e.x, e.z, r * 2, 3, def.bodyColor, 0.25);
    if (big) {
      this.juice.freeze(isBoss ? 0.3 : 0.08);
      this.juice.shake(isBoss ? 1 : 0.4);
      this.fx.star(e.x, y + 0.3, e.z, r * 3, '#ffffff', 0.18);
      this.hud.flash(isBoss ? 0.8 : 0.2);
      sfx.explode();
    } else if (def.xp >= 4) this.juice.shake(0.08);
    if (this.combo % 50 === 0) this.dmg.spawn(this.player.x, 3, this.player.z, `${this.combo} COMBO!`, 'score');

    if (def.split) {
      for (let i = 0; i < def.split.count; i++) {
        const a = (i / def.split.count) * Math.PI * 2;
        this.enemyCtx.spawnChild(def.split.into, e.x + Math.cos(a) * 0.8, e.z + Math.sin(a) * 0.8, e);
      }
    }
    this.enemies.kill(e);
    // Combos and Mod triggers after the kill is resolved (they may kill more).
    if (wasFrozen) this.shatter(e);
    this.synergy.kill(e, source);
    if (this.kills === 300 || this.kills % 1000 === 0) this.checkAchievements();
  }

  blast(x: number, z: number, r: number, base: number, color: string, source: string, tags: Tag[] = ['explosive'], noStatus = false): void {
    const explosive = tags.includes('explosive');
    if (explosive) r *= 1 + this.synergy.flags.explosiveArea * this.synergy.tagCount('explosive');
    sfx.explode();
    this.fx.ring(x, z, 1, r * 2, color, 0.25);
    this.fx.star(x, 1, z, r, color, 0.12);
    this.particles.burst(x, 0.6, z, { count: 8, color, color2: '#fff35c', speed: [3, 8], size: [0.15, 0.3], life: [0.2, 0.45], up: 4, gravity: 12 });
    const targets = this.enemiesInRadius(x, z, r, this.targets).slice();
    // Napalm: an explosion that catches a burning enemy sets the whole blast alight.
    const napalm = explosive && !noStatus && targets.some((e) => e.burnT > 0);
    if (napalm) this.fx.ring(x, z, 1, r * 2.2, '#ff5e3a', 0.35);
    for (const e of targets) {
      const d = Math.hypot(e.x - x, e.z - z) || 1;
      this.damage(e, base, { source, tags, dirX: (e.x - x) / d, dirZ: (e.z - z) / d, knockback: 8, canCrit: true, noStatus });
      if (napalm && e.active) this.ignite(e, statusTuning.napalmDps);
    }
  }

  /** Exploder enemy goes off: hurts the player and other enemies nearby. */
  private detonate(e: Enemy): void {
    const F = e.def.fuse!;
    const p = this.player;
    const R = F.radius * e.scale;
    this.fx.ring(e.x, e.z, 1, R * 2, '#ff3d5a', 0.3);
    this.fx.star(e.x, 1, e.z, R * 1.2, '#ffb627', 0.15);
    this.particles.burst(e.x, 0.6, e.z, { count: 14, color: '#ff9f3d', color2: '#3a3d5c', speed: [4, 9], size: [0.15, 0.35], life: [0.3, 0.6], up: 5, gravity: 14 });
    sfx.explode();
    this.juice.shake(0.3);
    if (!p.dead && Math.hypot(p.x - e.x, p.z - e.z) < R + p.radius) this.hurtPlayer(F.damage * e.dmgMul, e.x, e.z);
    for (const o of this.enemiesInRadius(e.x, e.z, R, this.targets).slice()) {
      if (o === e) continue;
      const d = Math.hypot(o.x - e.x, o.z - e.z) || 1;
      this.damage(o, 40, { source: 'exploder', dirX: (o.x - e.x) / d, dirZ: (o.z - e.z) / d, knockback: 10 });
    }
    if (e.active) this.killEnemy(e);
  }

  private bossSlam(e: Enemy): void {
    const p = this.player;
    const R = 3.8;
    sfx.bomb();
    this.juice.shake(0.8);
    this.juice.freeze(0.06);
    this.fx.ring(e.x, e.z, 1, R * 2.4, '#ff3d5a', 0.4);
    this.fx.ring(e.x, e.z, 1, R * 1.6, '#ffffff', 0.3);
    this.particles.burst(e.x, 0.3, e.z, { count: 30, color: '#f2e2b8', color2: '#ffffff', speed: [5, 12], size: [0.2, 0.4], life: [0.4, 0.8], up: 4, gravity: 10 });
    if (!p.dead && Math.hypot(p.x - e.x, p.z - e.z) < R + p.radius) this.hurtPlayer(30 * e.dmgMul, e.x, e.z);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      this.enemyCtx.fireBullet(e, Math.cos(a), Math.sin(a), 8, 12);
    }
  }

  private contactDamage(): void {
    const p = this.player;
    if (p.invuln > 0) return;
    let worst: Enemy | null = null;
    let dmg = 0;
    this.hash.query(p.x, p.z, 2.5, (e) => {
      if (!e.alive || e.frozen > 0 || e.hopY > 0.5) return;
      const rr = e.radius + p.radius;
      if ((e.x - p.x) ** 2 + (e.z - p.z) ** 2 > rr * rr) return;
      const d = e.contactDamage * (e.state === 'attack' ? 1.5 : 1);
      if (d > dmg) {
        dmg = d;
        worst = e;
      }
    });
    const w = worst as Enemy | null;
    if (w) this.hurtPlayer(dmg, w.x, w.z);
  }

  private hurtPlayer(raw: number, fromX: number, fromZ: number): void {
    const p = this.player;
    if (cheats.god || p.dead || p.invuln > 0) return;
    const dmg = Math.max(1, Math.round(raw - this.stats.armor));
    const dx = p.x - fromX;
    const dz = p.z - fromZ;
    const d = Math.hypot(dx, dz) || 1;
    if (!p.hurt(dmg, dx / d, dz / d)) return;
    this.damagedThisStage = true;
    this.synergy.hurt();
    if (this.combo >= 25) this.dmg.spawn(p.x, 3, p.z, 'COMBO BREAK', 'player');
    this.combo = 0;
    sfx.playerHurt();
    this.hud.hurt();
    this.juice.freeze(0.06);
    this.juice.shake(0.35);
    this.juice.kick(dx / d, dz / d, 6);
    this.dmg.spawn(p.x, 2.2, p.z, dmg, 'player');
    this.fx.star(p.x, 1.1, p.z, 2, '#ff3d5a', 0.15);
    this.particles.burst(p.x, 1, p.z, { count: 10, color: '#ff3d5a', color2: '#ffffff', speed: [3, 8], size: [0.12, 0.25], life: [0.2, 0.4], up: 3, gravity: 12 });
    if (p.dead) this.onPlayerDown();
  }

  private onPlayerDown(): void {
    const p = this.player;
    if (this.revivesLeft > 0) {
      this.revivesLeft--;
      p.dead = false;
      p.hp = p.maxHp * 0.5;
      p.invuln = 2.5;
      p.rig.root.visible = true;
      this.bombCharge = 1;
      this.tryBomb();
      this.hud.showBanner('SECOND WIND!', 'Back on your feet', 1.6);
      return;
    }
    sfx.playerDie();
    this.juice.freeze(0.25);
    this.juice.shake(1);
    this.hud.flash(0.5);
    this.fx.ring(p.x, p.z, 1, 10, '#2f7bff', 0.6);
    this.particles.burst(p.x, 1, p.z, { count: 40, color: '#2f7bff', color2: '#ffd23f', speed: [4, 12], size: [0.2, 0.45], life: [0.6, 1.2], up: 7, gravity: 16, drag: 1.5 });
    this.mode = 'dead';
    this.modeT = 0;
    this.gameOverShown = false;
  }

  private collect(type: PickupType, value: number): void {
    const p = this.player;
    switch (type) {
      case PickupType.Gem:
        this.gainXp(value);
        this.synergy.gem(value);
        sfx.gem();
        break;
      case PickupType.Bolt: {
        const g = Math.max(1, Math.round(value * (1 + this.synergy.flags.goldMul)));
        this.gold += g;
        sfx.coin();
        this.dmg.spawn(p.x, 2.4, p.z, `+${g}\u25CF`, 'score');
        break;
      }
      case PickupType.Heart: {
        const h = p.heal(30);
        sfx.heal();
        if (h > 0) this.dmg.spawn(p.x, 2.4, p.z, `+${Math.round(h)}`, 'heal');
        break;
      }
      case PickupType.Magnet:
        this.pickups.vacuum = true;
        sfx.heal();
        this.hud.toast('MAGNET!');
        break;
      case PickupType.Chest:
        this.chestsPending++;
        this.gold += 2;
        sfx.chest();
        this.hud.flash(0.3);
        break;
    }
  }

  private updateBullets(dt: number): void {
    const b = this.bullets;
    b.integrate(dt);
    const p = this.player;
    for (let i = 0; i < b.count; i++) {
      const x = b.x[i];
      const z = b.z[i];
      if (b.life[i] <= 0) {
        b.kill(i--);
        continue;
      }
      if (this.walls.hitCircle(x, z, b.radius[i])) {
        this.particles.burst(b.px[i], BULLET_Y, b.pz[i], { count: 3, color: '#ffffff', color2: b.team[i] === Team.Enemy ? '#ff3df0' : '#fff36b', speed: [2, 6], size: [0.08, 0.15], life: [0.1, 0.25], up: 2, gravity: 10 });
        b.kill(i--);
        continue;
      }
      if (b.team[i] === Team.Enemy) {
        const rr = b.radius[i] + p.radius * 0.8;
        if (!p.dead && p.invuln <= 0 && (p.x - x) ** 2 + (p.z - z) ** 2 < rr * rr) {
          this.hurtPlayer(b.damage[i], b.px[i], b.pz[i]);
          b.kill(i--);
        }
        continue;
      }
      let hit = null as Enemy | null;
      const r = b.radius[i];
      const last = b.lastHit[i];
      this.hash.query(x, z, r, (e) => {
        if (hit || !e.alive || e.hp <= 0 || e.uid === last) return;
        const rr = e.radius + r;
        if ((e.x - x) ** 2 + (e.z - z) ** 2 < rr * rr) hit = e;
      });
      if (hit) {
        const sp = Math.hypot(b.vx[i], b.vz[i]) || 1;
        this.damage(hit, b.damage[i], { source: 'buster', dirX: b.vx[i] / sp, dirZ: b.vz[i] / sp, knockback: b.knockback[i], hx: x, hz: z, canCrit: true, loud: true });
        if (b.pierce[i] > 0) {
          b.pierce[i]--;
          b.lastHit[i] = hit.uid;
        } else b.kill(i--);
      }
    }
  }

  private tryBomb(): void {
    if (this.bombCharge < 1 || this.bombT >= 0) return;
    const p = this.player;
    this.bombCharge = 0;
    this.bombT = 0;
    this.bombId++;
    this.bombX = p.x;
    this.bombZ = p.z;
    p.invuln = Math.max(p.invuln, 0.6);
    sfx.bomb();
    this.hud.flash(0.9);
    this.juice.shake(0.9);
    this.juice.freeze(0.06);
    const R = bombTuning.radius;
    this.fx.ring(p.x, p.z, 1, R * 2, '#ff3df0', bombTuning.duration + 0.15);
    this.fx.ring(p.x, p.z, 1, R * 1.6, '#ffffff', bombTuning.duration);
    this.fx.star(p.x, 1.2, p.z, 5, '#ffffff', 0.2);
    for (let i = 0; i < this.bullets.count; i++) if (this.bullets.team[i] === Team.Enemy) this.bullets.kill(i--);
  }

  private updateBomb(dt: number): void {
    if (this.bombT < 0) return;
    this.bombT += dt;
    const k = Math.min(1, this.bombT / bombTuning.duration);
    const r = bombTuning.radius * (1 - (1 - k) * (1 - k));
    for (const e of this.enemies.list) {
      if (!e.alive || e.hp <= 0 || e.bombStamp === this.bombId) continue;
      const dx = e.x - this.bombX;
      const dz = e.z - this.bombZ;
      const d = Math.hypot(dx, dz);
      if (d > r + e.radius) continue;
      e.bombStamp = this.bombId;
      const n = d || 1;
      this.damage(e, bombTuning.damage, { source: 'bomb', dirX: dx / n, dirZ: dz / n, knockback: bombTuning.knockback });
    }
    if (k >= 1) this.bombT = -1;
  }

  // ------------------------------------------------------------------ render

  render(alpha: number, frameDt: number): void {
    const p = this.player;
    const input = this.input;
    const frozen = this.paused || this.mode === 'levelup' || this.mode === 'shop';
    const a = this.juice.hitStop > 0 || frozen ? 1 : alpha;
    const rdt = frozen ? 0 : frameDt;
    if (!frozen) {
      this.juice.tick(frameDt);
      this.animTime += frameDt;
    }

    p.render(a, rdt);
    p.renderPos(a, this.playerPos);
    this.enemies.render(a, this.animTime);
    this.bullets.render(a);
    this.particles.render();
    this.pickups.render(this.animTime);
    for (const w of this.weapons) w.render(a, this.ctx);
    this.fx.render(this.cam.camera);
    this.portal.render(rdt);

    const buster = this.weapons[0] as Buster | undefined;
    this.muzzleFlash.visible = !!buster && buster.muzzleT > 0 && !p.dead;
    if (this.muzzleFlash.visible) {
      p.muzzle(this.mz);
      this.muzzleFlash.position.set(this.mz.x, BULLET_Y, this.mz.z);
      this.muzzleFlash.scale.setScalar(0.8 + Math.random() * 0.6);
    }

    const inMenu = this.mode === 'title' || this.screens.current !== 'none';
    if (this.mode === 'title') this.lead.set(0, 0, 0);
    else if (input.device === 'pad') {
      const active = input.padAim.x !== 0 || input.padAim.y !== 0;
      this.lead.set(p.aim.x, 0, p.aim.z).multiplyScalar(active ? cameraTuning.padLookAhead : 0);
    } else if (!frozen && this.mouseAimPoint()) {
      this.lead.set(this.aimHit.x - this.playerPos.x, 0, this.aimHit.z - this.playerPos.z).multiplyScalar(cameraTuning.lookAhead);
      if (this.lead.length() > cameraTuning.lookAheadMax) this.lead.setLength(cameraTuning.lookAheadMax);
    }
    this.juice.shakeOffset(this.shake);
    this.cam.update(this.playerPos, this.lead, frameDt, this.shake);

    if (inMenu || p.dead) this.reticle.style.display = 'none';
    else if (input.device === 'pad') {
      this.tmp.set(this.playerPos.x + p.aim.x * 5, AIM_HEIGHT, this.playerPos.z + p.aim.z * 5).project(this.cam.camera);
      this.reticle.style.transform = `translate(${((this.tmp.x + 1) / 2) * innerWidth}px, ${((1 - this.tmp.y) / 2) * innerHeight}px)`;
      this.reticle.style.display = '';
    } else {
      this.reticle.style.transform = `translate(${input.mouse.x}px, ${input.mouse.y}px)`;
      this.reticle.style.display = input.mouse.inside ? '' : 'none';
    }

    if (this.loadoutDirty) {
      this.loadoutDirty = false;
      this.hud.setLoadout(this.loadout());
    }
    this.hud.setMods(this.synergy.slots.map((sl, i) => ({ icon: sl.def.icon, color: sl.def.color, name: sl.def.name, readout: this.synergy.readout(i), cursed: !!sl.def.cursed })));
    this.dmg.render(rdt, this.cam.camera);
    const boss = this.boss && this.boss.active ? this.boss : null;
    this.hud.update(
      {
        hp: p.hp,
        maxHp: p.maxHp,
        dash01: p.dashReady01,
        bomb01: this.bombCharge,
        score: this.score,
        combo: this.combo,
        multiplier: this.multiplier,
        combo01: this.combo > 0 ? Math.max(0, this.comboT / scoreTuning.comboWindow) : 0,
        stage: this.stage,
        level: this.level,
        xp01: this.xp / this.xpNext,
        timeLeft: !this.director.bossSpawned ? this.director.remaining : this.boss ? -1 : -2,
        kills: this.kills,
        gold: this.gold,
        boss: boss ? { name: boss.def.name, hp01: Math.max(0, boss.hp / boss.maxHp) } : null,
        lowHp: !p.dead && p.hp / p.maxHp <= 0.3 && this.mode !== 'title',
      },
      frameDt,
    );
  }
}
