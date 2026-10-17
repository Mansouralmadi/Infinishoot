import type * as THREE from 'three';
import type { Rng } from '../core/rng';
import { DEFAULT_LOADOUT, type Loadout } from '../data/loadout';
import { MOD_RARITY_WEIGHT, MODS } from '../data/mods';
import { PASSIVES } from '../data/passives';
import { SPECIALS, cooldownText, specialCooldown, type SpecialDef } from '../data/specials';
import { RARITY, rarityWeight, type Rarity } from '../data/rarity';
import type { Tag } from '../data/tags';
import { RANK_RARITY, buildKey, buildMaxed, buildParams, canEvolve, newBuild, parseBuild, totalRanks, trackTuning, type Build, type Upgradable } from '../data/tracks';
import { WEAPONS } from '../data/weapons';
import type { LoadoutItem } from '../ui/hud';
import type { Offer, ShopView } from '../ui/screens';
import type { Enemy } from './enemies';
import { modMaxLevel, type ModDef } from './modTypes';
import { Player, dashLevelMul } from './player';
import { computeStats, type Stats } from './stats';
import { MAX_MOD_SLOTS, Synergy, type SynergyHost } from './synergy';
import { createWeapon, type Weapon, type WeaponCtx } from './weapons';

/** Auto-weapon slots (the loadout's clicks don't use them). */
export const MAX_WEAPONS = 4;
export const MAX_PASSIVES = 6;
/** Gears are spent to reroll level-up cards; you can carry this many. */
export const MAX_GEARS = 5;
export const HERO_COLORS = ['#2f7bff', '#22c76a', '#ffb627', '#d8def0'];

export const economyTuning = {
  clearGold: 5, // flat gold for clearing a stage
  interestPer: 5, // +1 gold per this much held at stage clear
  interestCap: 10, // max interest per stage (Piggy Bank raises it); holding 50 gold pays 10
  rerollBase: 2, // first paid reroll; +1 each reroll in the same shop
  startGold: 15, // free gold in the starting shop (not kept)
  healCost: 3,
  shopOffers: 4,
};

export const chestTuning = {
  goldShare: 0.5, // chance a chest holds gold instead of an item level
  gold: 10,
};

export interface ChestFind {
  id: string;
  name: string;
  color: string;
  icon: string;
  text: string;
  rarity: Rarity;
}

/** A loadout item with upgrade tracks, as the level-up cards need it. */
type UpgradeItem = Upgradable & { name: string; icon: string; color: string; iconBase: string };

/** Icon id for an item's evolution: `<id>_evo` for the first, `<id>_evo2` for the second. */
function evoIconId(base: string, evo: number): string {
  return evo < 0 ? base : evo === 0 ? `${base}_evo` : `${base}_evo${evo + 1}`;
}

/** "Buckshot 2/4 · Choke 1/4", plus the evolution once chosen. */
function trackSummary(def: Upgradable, b: Build): string {
  const parts = (def.tracks ?? []).map((t, i) => `${t.name} ${b.ranks[i]}/${t.ranks.length}`);
  const evo = def.evos?.[b.evo];
  if (evo) parts.push(`${evo.name}${b.od ? ` + Overdrive ${b.od}` : ''}`);
  return parts.join(' · ') + '.';
}

/** What a hero needs from the game (combat, world, randomness). */
export interface HeroWorld {
  readonly scene: THREE.Scene;
  readonly rng: Rng;
  readonly level: number;
  /** 2+ players still in the run: co-op items can be offered. */
  readonly coop: boolean;
  blast(x: number, z: number, r: number, dmg: number, color: string, source: string, tags: Tag[], noStatus: boolean, by: Hero): void;
  zap(from: Enemy, hops: number, dmg: number, by: Hero): void;
  ignite(e: Enemy, dps: number, by: Hero): void;
  shock(e: Enemy, by: Hero): void;
  makeCtx(hero: Hero): WeaponCtx;
  goldFx(hero: Hero, n: number): void;
}

/** Latest input from a remote player (host side). */
export interface RemoteInput {
  x: number;
  z: number;
  vx: number;
  vz: number;
  ax: number;
  /** Aim distance (mouse cursor), -1 for stick aim. */
  ad: number;
  az: number;
  firing: boolean;
  charging: boolean;
  dashing: boolean;
}

/**
 * One player's run: hero body, weapons, passives, Mods, gold, level-up
 * cards and shop. Team-wide state (XP, level, score, stage) lives in Game.
 */
export class Hero implements SynergyHost {
  readonly player: Player;
  readonly synergy: Synergy;
  readonly ctx: WeaponCtx;
  weapons: Weapon[] = [];
  passives: Record<string, number> = {};
  /** Live stats (static + per-step Mod effects). Shared by reference with the player. */
  readonly stats: Stats = computeStats({});
  private statBase: Stats = computeStats({});
  gold = 0;
  /** Gears held (each rerolls one level-up). */
  rerollsLeft = 0;
  revivesLeft = 0;
  dashes = 0;
  damageBy: Record<string, number> = {};
  // Level-ups and chests waiting for this hero.
  pendingLevels = 0;
  chestsPending = 0;
  offers: Offer[] = [];
  // Shop
  shopOffers: (ModDef | null)[] = [];
  shopRerolls = 0;
  shopHealed = false;
  shopDone = true;
  /** Left click, right click and special picked before the run. */
  loadoutPick: Loadout = { ...DEFAULT_LOADOUT };
  // Special (Q/E)
  bombCharge = 0;
  /** The special on Q/E, from the loadout; level-up cards upgrade it. */
  special = { id: 'bomb', level: 1 };
  /** Specials with upgrade tracks: ranks, evolution and Overdrive taken. */
  specialBuild: Build | null = null;
  private spParams: Record<string, number> | null = null;
  bombT = -1;
  /** The current wave is a Nuke pickup, not the bomb. */
  bombNuke = false;
  bombId = 0;
  bombX = 0;
  bombZ = 0;
  /** Implosion: which wave is running (1 pulls in, 2 blasts) and the pause before wave 2. */
  bombWave = 1;
  bombNext = 0;
  /** Cluster Bomb: bomblets waiting to pop. */
  bomblets: { x: number; z: number; t: number }[] = [];
  // Downed in co-op
  reviveT = 0;
  /** The player disconnected; the hero stays out of play. */
  left = false;
  // Network
  remote: RemoteInput | null = null;
  lastSeen = 0;
  loadoutDirty = true;

  constructor(
    private world: HeroWorld,
    readonly index: number,
    public name: string,
    readonly color: string,
    /** Weapons this player's own save has unlocked. */
    public unlocked: string[],
    readonly peerId = '',
  ) {
    this.player = new Player(world.scene, color);
    this.synergy = new Synergy(this);
    this.ctx = world.makeCtx(this);
  }

  // ---------------------------------------------------------------- SynergyHost
  get level(): number {
    return this.world.level;
  }
  get rng(): Rng {
    return this.world.rng;
  }
  blast(x: number, z: number, r: number, dmg: number, color: string, source: string, tags: Tag[]): void {
    this.world.blast(x, z, r, dmg, color, source, tags, false, this);
  }
  zap(from: Enemy, hops: number, dmg: number): void {
    this.world.zap(from, hops, dmg, this);
  }
  ignite(e: Enemy, dps: number): void {
    this.world.ignite(e, dps, this);
  }
  shock(e: Enemy): void {
    this.world.shock(e, this);
  }
  addGold(n: number): void {
    this.gold += n;
    this.world.goldFx(this, n);
  }

  /** Tags for a damage source: the owned weapon's (with its evolution's), else the def's. */
  tagsOf(source: string): readonly Tag[] | undefined {
    for (const w of this.weapons) if (w.def.id === source) return w.tags;
    return WEAPONS[source]?.tags;
  }

  get alive(): boolean {
    return !this.player.dead;
  }

  // ---------------------------------------------------------------- run lifecycle

  /** Fresh run: the loadout's two clicks and special, no passives or Mods. */
  startRun(): void {
    this.disposeWeapons();
    const lo = this.loadoutPick;
    this.weapons = [createWeapon(lo.primary, this.world.scene), createWeapon(lo.secondary, this.world.scene)];
    this.passives = {};
    this.synergy.reset();
    this.gold = this.dashes = 0;
    this.damageBy = {};
    this.pendingLevels = this.chestsPending = 0;
    this.setSpecial(lo.special);
    this.bombCharge = 0;
    this.bombT = -1;
    this.bombNext = 0;
    this.bomblets.length = 0;
    this.reviveT = 0;
    this.shopDone = true;
    this.recomputeStats();
    this.rerollsLeft = Math.min(MAX_GEARS, this.stats.rerolls);
    this.revivesLeft = this.stats.revives;
    this.player.reset(this.stats);
    this.loadoutDirty = true;
  }

  disposeWeapons(): void {
    for (const w of this.weapons) w.dispose();
    this.weapons = [];
  }

  dispose(): void {
    this.disposeWeapons();
    this.player.dispose();
  }

  /** Rebuild static stats (passives + Mods) and the live copy. */
  recomputeStats(): void {
    this.statBase = computeStats(this.passives);
    this.synergy.applyStatic(this.statBase);
    this.refreshLive();
    this.player.stats = this.stats;
    this.player.hp = Math.min(this.player.hp, this.stats.maxHp);
  }

  /** Live stats = static stats + per-step Mod effects (moving, timers). */
  refreshLive(): void {
    Object.assign(this.stats, this.statBase);
    this.synergy.applyLive(this.stats);
    this.stats.dashCooldownMul *= dashLevelMul(this.world.level);
  }

  get specialDef(): SpecialDef {
    return SPECIALS[this.special.id] ?? SPECIALS.bomb;
  }

  setSpecial(id: string): void {
    this.special = { id, level: 1 };
    this.specialBuild = SPECIALS[id]?.tracks ? newBuild(SPECIALS[id]) : null;
    this.spParams = null;
  }

  /** Client: mirror the host's special build. */
  setSpecialBuild(key: string): void {
    if (!this.specialBuild || key === buildKey(this.specialBuild)) return;
    this.specialBuild = parseBuild(key, this.specialDef);
    this.spParams = null;
    this.loadoutDirty = true;
  }

  /** Seconds for the special's meter to refill (upgrades and Battery Pack). */
  get specialCooldown(): number {
    return specialCooldown(this.specialP, this.stats.specialCooldownMul);
  }

  /** Params for the special's current level (or build). */
  get specialP(): Record<string, number> {
    const def = this.specialDef;
    if (this.specialBuild) return (this.spParams ??= buildParams(def.levels[0].p, def, this.specialBuild));
    return def.levels[Math.min(this.special.level, def.levels.length) - 1].p;
  }

  /** The special's chosen evolution ('' before evolving or for level-ladder specials). */
  get specialEvo(): string {
    return (this.specialBuild && this.specialDef.evos?.[this.specialBuild.evo]?.id) || '';
  }

  private get specialView(): { name: string; color: string; iconId: string; level: number; max: boolean } {
    const def = this.specialDef;
    const b = this.specialBuild;
    if (!b) return { name: def.name, color: def.color, iconId: 'sp_' + def.id, level: this.special.level, max: this.special.level >= def.levels.length };
    const evo = def.evos?.[b.evo];
    return {
      name: evo?.name ?? def.name,
      color: evo?.color ?? def.color,
      iconId: evoIconId('sp_' + def.id, b.evo),
      level: 1 + totalRanks(b) + (b.evo >= 0 ? 1 : 0) + b.od,
      max: buildMaxed(def, b),
    };
  }

  loadout(): LoadoutItem[] {
    const sp = this.specialDef;
    const sv = this.specialView;
    const spNow = this.specialBuild ? trackSummary(sp, this.specialBuild) : `Now: ${sp.levels[this.special.level - 1].text}`;
    return [
      {
        id: sv.iconId,
        icon: sp.icon,
        color: sv.color,
        level: sv.level,
        max: sv.max,
        evo: !!this.specialEvo,
        name: sv.name,
        rarity: sp.rarity,
        desc: `SPECIAL (Q/E): ${sp.desc} ${spNow} Cooldown ${cooldownText(this.specialCooldown)}.`,
        kind: 'weapon' as const,
      },
      ...this.weapons.map((w) => ({
        id: w.iconId,
        icon: w.def.icon,
        color: w.color,
        level: w.level,
        max: w.maxed,
        evo: w.evolved,
        name: w.name,
        rarity: w.def.rarity,
        desc: `${w.def.desc} ${w.build ? trackSummary(w.def, w.build) : `Now: ${w.def.levels[w.level - 1].text}`}`,
        kind: 'weapon' as const,
      })),
      ...Object.entries(this.passives).map(([id, lv]) => {
        const d = PASSIVES[id];
        return { id, icon: d.icon, color: d.color, level: lv, max: lv >= d.maxLevel, name: d.name, rarity: d.rarity, desc: `${d.desc} (x${lv})`, kind: 'passive' as const };
      }),
    ];
  }

  // ---------------------------------------------------------------- level-ups

  get needsPick(): boolean {
    return this.pendingLevels > 0 || this.chestsPending > 0;
  }

  get skipGold(): number {
    return 2 + Math.floor(this.world.level / 8);
  }

  levelUpTitle(teamLevel: number): string {
    return this.chestsPending > 0 ? 'TREASURE!' : `LEVEL ${teamLevel - this.pendingLevels + 1}!`;
  }

  buildOffers(): Offer[] {
    type Cand = Offer & { w: number };
    const cands: Cand[] = [];
    // Everything, new or an upgrade, shows up at its own rarity's rate: a
    // legendary's levels are as rare as the legendary itself (user: they maxed too fast).
    const luck = this.stats.luck;
    const fresh = (r: Rarity) => rarityWeight(r, luck);
    const upgrade = fresh;
    // The loadout's upgrade tracks; the first item that can evolve forces its two-way choice.
    let fork: Offer[] = [];
    const upgradable = (ref: string, def: UpgradeItem, b: Build, label: string) => {
      if (canEvolve(def, b)) {
        if (!fork.length) {
          fork = def.evos!.map((e, k) => ({ kind: 'evo' as const, id: evoIconId(def.iconBase, k), pick: `${ref}|e|${k}`, name: e.name, icon: def.icon, color: e.color, tag: 'EVOLVE!', text: e.text, tags: e.tags, rarity: 'legendary' as const, label: `${label} EVOLUTION` }));
        }
        return;
      }
      const color = def.evos?.[b.evo]?.color ?? def.color;
      if (buildMaxed(def, b)) {
        const text = `+${Math.round(trackTuning.overdrive * 100)}% damage, repeatable.`;
        cands.push({ kind: 'overdrive', id: evoIconId(def.iconBase, b.evo), pick: `${ref}|od`, name: 'Overdrive', icon: def.icon, color, tag: `OVERDRIVE ${b.od + 1}`, text, rarity: 'uncommon', label, w: 1.2 * upgrade('uncommon') });
        return;
      }
      (def.tracks ?? []).forEach((t, k) => {
        const r = b.ranks[k];
        if (r >= t.ranks.length) return;
        const rarity = RANK_RARITY[Math.min(r, RANK_RARITY.length - 1)];
        cands.push({ kind: 'track', id: evoIconId(def.iconBase, b.evo), pick: `${ref}|t|${k}`, name: t.name, icon: def.icon, color, tag: `RANK ${r + 1}`, text: t.ranks[r].text, rarity, level: r, maxLevel: t.ranks.length, label, w: 3 * upgrade(rarity) });
      });
    };
    for (const w of this.weapons) {
      if (w.build) {
        upgradable(w.def.id, { ...w.def, iconBase: w.def.id }, w.build, `${w.def.name.toUpperCase()} · ${w.def.slot === 'primary' ? 'LEFT' : 'RIGHT'} CLICK`);
        continue;
      }
      if (w.maxed) continue;
      const next = w.def.levels[w.level];
      const rarity = w.def.rarity;
      if (w.def.evo && w.level + 1 === w.def.levels.length) {
        const evo = w.def.evo;
        cands.push({ kind: 'weapon', id: w.def.id + '_evo', name: evo.name, icon: w.def.icon, color: evo.color, tag: 'EVOLVE!', text: next.text, tags: w.def.tags, rarity, level: w.level, maxLevel: w.def.levels.length, w: 4 * upgrade(rarity) });
        continue;
      }
      // Loadout weapons without tracks yet weigh more, so they keep up with track ranks.
      const kindW = w.def.slot ? 4 : 3;
      cands.push({ kind: 'weapon', id: w.def.id, name: w.def.name, icon: w.def.icon, color: w.def.color, tag: `LV ${w.level + 1}`, text: next.text, tags: w.def.tags, rarity, level: w.level, maxLevel: w.def.evo ? w.def.levels.length - 1 : w.def.levels.length, w: kindW * upgrade(rarity) });
    }
    // New auto weapons, while slots are free. Loadout weapons are picked before the run.
    const autoCount = this.weapons.filter((w) => !w.def.slot).length;
    for (const id of this.unlocked) {
      const d = WEAPONS[id];
      if (!d || d.slot || autoCount >= MAX_WEAPONS || this.weapons.some((w) => w.def.id === id)) continue;
      cands.push({ kind: 'weapon', id, name: d.name, icon: d.icon, color: d.color, tag: 'NEW!', text: d.desc, tags: d.tags, rarity: d.rarity, w: 2.4 * fresh(d.rarity) });
    }
    // The special: its tracks, or its next level.
    const sp = this.specialDef;
    if (this.specialBuild) upgradable('sp', { ...sp, iconBase: 'sp_' + sp.id }, this.specialBuild, `${sp.name.toUpperCase()} · SPECIAL (Q/E)`);
    else if (this.special.level < sp.levels.length) {
      const lv = this.special.level;
      const cd = cooldownText(specialCooldown(sp.levels[lv].p, this.stats.specialCooldownMul));
      cands.push({ kind: 'special', id: 'sp_' + sp.id, name: sp.name, icon: sp.icon, color: sp.color, tag: `LV ${lv + 1}`, text: `${sp.levels[lv].text} Cooldown ${cd}.`, rarity: sp.rarity, level: lv, maxLevel: sp.levels.length, w: 4 * upgrade(sp.rarity) });
    }
    const owned = Object.keys(this.passives).length;
    for (const [id, d] of Object.entries(PASSIVES)) {
      if (d.coop && !this.world.coop) continue;
      const lv = this.passives[id] ?? 0;
      if (lv >= d.maxLevel || (lv === 0 && owned >= MAX_PASSIVES)) continue;
      cands.push({ kind: 'passive', id, name: d.name, icon: d.icon, color: d.color, tag: lv ? `LV ${lv + 1}` : 'NEW!', text: d.desc, rarity: d.rarity, level: lv, maxLevel: d.maxLevel, w: lv ? 1.8 * upgrade(d.rarity) : 0.8 * fresh(d.rarity) });
    }
    // Late runs: when the pool runs dry, mix in gold and healing.
    if (cands.length + fork.length < 3) {
      cands.push(
        { kind: 'gold', id: 'gold', name: 'Gold Bag', icon: '●', color: '#ffb627', tag: 'BONUS', text: `+${2 * this.skipGold} gold`, w: 2 },
        { kind: 'heal', id: 'heal', name: 'Snack', icon: '♥', color: '#ff5e7a', tag: 'BONUS', text: 'Heal 40 life', w: 2 },
      );
    }
    const out: Offer[] = [...fork];
    while (out.length < 3 && cands.length) {
      let r = this.rng.next() * cands.reduce((a, c) => a + c.w, 0);
      let i = 0;
      while (i < cands.length - 1 && (r -= cands[i].w) > 0) i++;
      const { w: _w, ...offer } = cands.splice(i, 1)[0];
      out.push(offer);
    }
    return out;
  }

  /** Apply a level-up card. Returns its color (for the pickup burst). */
  applyOffer(o: Offer): string {
    if (o.kind === 'track' || o.kind === 'evo' || o.kind === 'overdrive') {
      const [ref, what, k] = (o.pick ?? '').split('|');
      const n = Number(k);
      if (ref === 'sp') {
        const b = this.specialBuild;
        if (b) {
          if (what === 't') b.ranks[n] = Math.min(this.specialDef.tracks![n].ranks.length, b.ranks[n] + 1);
          else if (what === 'e' && b.evo < 0) b.evo = n;
          else if (what === 'od') b.od++;
          this.spParams = null;
        }
      } else {
        const w = this.weapons.find((x) => x.def.id === ref);
        if (what === 't') w?.addRank(n);
        else if (what === 'e') w?.evolve(n);
        else if (what === 'od') w?.overdrive();
      }
    } else if (o.kind === 'weapon') {
      const id = o.id.replace(/_evo$/, '');
      const w = this.weapons.find((x) => x.def.id === id);
      if (w) w.levelUp();
      else this.weapons.push(createWeapon(id, this.world.scene));
    } else if (o.kind === 'special') {
      this.special.level = Math.min(this.specialDef.levels.length, this.special.level + 1);
    } else if (o.kind === 'passive') {
      this.passives[o.id] = (this.passives[o.id] ?? 0) + 1;
      this.recomputeStats();
      const heal = PASSIVES[o.id].healOnPick;
      if (heal) this.player.heal(heal);
    } else if (o.kind === 'gold') this.gold += 2 * this.skipGold;
    else if (o.kind === 'heal') this.player.heal(40);
    this.player.hp = Math.min(this.player.hp, this.player.maxHp);
    this.loadoutDirty = true;
    return o.color;
  }

  /** One level-up or chest resolved. */
  consumePick(): void {
    if (this.chestsPending > 0) this.chestsPending--;
    else if (this.pendingLevels > 0) this.pendingLevels--;
  }

  /**
   * A treasure chest's item, applied on the spot: a random passive this hero
   * can take, else a level for an owned weapon, else gold.
   */
  chestItem(): ChestFind {
    // Half of all chests are a gold stash: chests every 30 s were maxing builds by stage 3 (user).
    if (this.rng.next() < chestTuning.goldShare) return this.chestGold();
    const passives = Object.values(PASSIVES).filter((d) => {
      if (d.coop && !this.world.coop) return false;
      const lv = this.passives[d.id] ?? 0;
      return lv > 0 && lv < d.maxLevel;
    });
    if (passives.length) {
      // Rarer items come out of chests less often too (Luck helps).
      const w = (r: Rarity) => rarityWeight(r, this.stats.luck);
      let r = this.rng.next() * passives.reduce((a, d) => a + w(d.rarity), 0);
      let i = 0;
      while (i < passives.length - 1 && (r -= w(passives[i].rarity)) > 0) i++;
      const d = passives[i];
      const lv = (this.passives[d.id] ?? 0) + 1;
      this.applyOffer({ kind: 'passive', id: d.id, name: d.name, icon: d.icon, color: d.color, tag: '', text: d.desc });
      return { id: d.id, name: d.name, color: d.color, icon: d.icon, text: lv > 1 ? `LV ${lv}` : 'NEW', rarity: d.rarity };
    }
    // Auto weapons only: the loadout grows through level-up choices. Evolutions are never a chest surprise.
    const weapons = this.weapons.filter((w) => !w.def.slot && !w.maxed && !(w.def.evo && w.level + 1 === w.def.levels.length));
    if (weapons.length) {
      const w = weapons[Math.floor(this.rng.next() * weapons.length)];
      w.levelUp();
      this.loadoutDirty = true;
      return { id: w.iconId, name: w.name, color: w.color, icon: w.def.icon, text: `LV ${w.level}`, rarity: w.def.rarity };
    }
    return this.chestGold();
  }

  private chestGold(): ChestFind {
    this.gold += chestTuning.gold;
    return { id: 'gold', name: 'Gold', color: '#ffb627', icon: '●', text: `+${chestTuning.gold}`, rarity: 'common' };
  }

  // ---------------------------------------------------------------- shop

  openShop(): void {
    this.shopRerolls = 0;
    this.shopHealed = false;
    this.shopDone = false;
    this.rollShop();
  }

  rollShop(): void {
    const pool = MODS.filter((m) => !this.synergy.owns(m.id));
    // Luck lifts the rarer Mods, like level-up cards.
    const w = (m: ModDef) => MOD_RARITY_WEIGHT[m.rarity] * (1 + this.stats.luck * RARITY[m.rarity].luck);
    this.shopOffers = [];
    for (let k = 0; k < economyTuning.shopOffers && pool.length; k++) {
      let r = this.rng.next() * pool.reduce((a, m) => a + w(m), 0);
      let i = 0;
      while (i < pool.length - 1 && (r -= w(pool[i])) > 0) i++;
      this.shopOffers.push(pool.splice(i, 1)[0]);
    }
  }

  price(m: ModDef): number {
    return Math.max(1, Math.round(m.price * (1 - Math.min(0.5, this.synergy.flags.shopDiscount))));
  }

  /** Half of what you actually paid (purchase + upgrades), or all of it with Pawn Shop. */
  sellPrice(paid: number): number {
    return this.synergy.flags.sellFull ? paid : Math.floor(paid / 2);
  }

  /** Gold to take an owned Mod from `level` to level + 1: its price, then 1.5x. */
  upgradeCost(m: ModDef, level: number): number {
    return Math.round(this.price(m) * (level === 1 ? 1 : 1.5));
  }

  get rerollCost(): number {
    if (this.shopRerolls < this.synergy.flags.freeRerolls) return 0;
    return economyTuning.rerollBase + this.shopRerolls - this.synergy.flags.freeRerolls;
  }

  get interestCap(): number {
    return economyTuning.interestCap + this.synergy.flags.interestCap;
  }

  get interest(): number {
    return Math.min(this.interestCap, Math.floor(this.gold / this.interestPer));
  }

  get interestPer(): number {
    return Math.max(2, economyTuning.interestPer - this.synergy.flags.interestPer);
  }

  shopView(stage: number, pre = false): ShopView {
    return {
      pre,
      gold: this.gold,
      interest: this.interest,
      interestCap: this.interestCap,
      interestPer: this.interestPer,
      offers: this.shopOffers.map((m) => (m ? { def: m, price: this.price(m), hint: this.synergyHint(m) } : null)),
      owned: this.synergy.slots.map((sl, i) => ({
        def: sl.def,
        sell: this.sellPrice(sl.paid),
        readout: this.synergy.readout(i),
        level: sl.level,
        maxLevel: modMaxLevel(sl.def),
        upCost: this.synergy.canUpgrade(i) ? this.upgradeCost(sl.def, sl.level) : -1,
      })),
      slots: MAX_MOD_SLOTS,
      rerollCost: this.rerollCost,
      healCost: economyTuning.healCost,
      healed: this.shopHealed || this.player.hp >= this.player.maxHp,
      loadout: this.loadout(),
      stage,
    };
  }

  /** Why a Mod fits this build, shown on its shop card. */
  synergyHint(m: ModDef): string {
    if (!m.synergy) return '';
    const parts = m.synergy
      .map((t) => [t, this.synergy.tagCount(t)] as const)
      .filter(([, n]) => n > 0)
      .map(([t, n]) => `${n} ${t}`);
    return parts.length ? `You have: ${parts.join(', ')}` : '';
  }

  /** Shop actions return an error message, or '' on success. */
  buy(i: number): string {
    const m = this.shopOffers[i];
    if (!m) return 'SOLD OUT';
    if (this.synergy.full) return 'MOD SLOTS FULL: SELL ONE FIRST';
    const cost = this.price(m);
    if (this.gold < cost) return 'NOT ENOUGH GOLD';
    this.gold -= cost;
    this.synergy.add(m, cost);
    this.shopOffers[i] = null;
    this.recomputeStats();
    return '';
  }

  /** Upgrade an owned Mod (acts like one more stacked copy). */
  upgradeMod(i: number): string {
    const sl = this.synergy.slots[i];
    if (!sl) return 'NOTHING TO UPGRADE';
    if (!this.synergy.canUpgrade(i)) return 'ALREADY MAX LEVEL';
    const cost = this.upgradeCost(sl.def, sl.level);
    if (this.gold < cost) return 'NOT ENOUGH GOLD';
    this.gold -= cost;
    this.synergy.upgrade(i, cost);
    this.recomputeStats();
    return '';
  }

  sell(i: number): string {
    const sl = this.synergy.slots[i];
    if (!sl) return 'NOTHING TO SELL';
    this.gold += this.sellPrice(sl.paid);
    this.synergy.remove(i);
    this.recomputeStats();
    return '';
  }

  moveMod(i: number, dir: -1 | 1): void {
    this.synergy.move(i, dir);
    this.recomputeStats();
  }

  reroll(): string {
    const cost = this.rerollCost;
    if (this.gold < cost) return 'NOT ENOUGH GOLD';
    this.gold -= cost;
    this.shopRerolls++;
    this.rollShop();
    return '';
  }

  heal(): string {
    if (this.shopHealed) return 'ALREADY HEALED';
    if (this.gold < economyTuning.healCost) return 'NOT ENOUGH GOLD';
    this.gold -= economyTuning.healCost;
    this.shopHealed = true;
    this.player.heal(this.player.maxHp * 0.4);
    return '';
  }
}
