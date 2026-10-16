import type * as THREE from 'three';
import type { Rng } from '../../core/rng';
import type { SpatialHash } from '../../core/spatialHash';
import type { Tag } from '../../data/tags';
import type { WeaponDef } from '../../data/weapons';
import type { ModFlags } from '../modTypes';
import type { Bullets } from '../bullets';
import type { Enemy, Enemies } from '../enemies';
import type { BurstOptions } from '../particles';
import type { Player } from '../player';
import type { Stats } from '../stats';

export interface DamageOpts {
  /** Weapon id, for the end-of-run damage breakdown. */
  source: string;
  dirX?: number;
  dirZ?: number;
  knockback?: number;
  /** Hit point for sparks (defaults to the enemy). */
  hx?: number;
  hz?: number;
  canCrit?: boolean;
  /** Show a damage number and play the hit sound (off for auras, burns, blasts). */
  loud?: boolean;
  /** Override the source weapon's tags (Mods, combos). */
  tags?: readonly Tag[];
  /** Don't apply statuses or fire Mod hit triggers (DoT ticks, combo blasts). */
  noStatus?: boolean;
}

/** Cosmetic effects (recorded for online clients). */
export interface FxApi {
  star(x: number, y: number, z: number, size: number, color?: string, life?: number): void;
  ring(x: number, z: number, size: number, grow: number, color: string, life?: number): void;
}
export interface ParticleApi {
  burst(x: number, y: number, z: number, o: BurstOptions): void;
}

/** Everything a weapon may touch. Implemented by Game, one per hero. */
export interface WeaponCtx {
  scene: THREE.Scene;
  player: Player;
  stats: Stats;
  rng: Rng;
  time: number;
  enemies: Enemies;
  hash: SpatialHash<Enemy>;
  bullets: Bullets;
  particles: ParticleApi;
  fx: FxApi;
  /** Index of the hero who owns this weapon. */
  owner: number;
  /** Manual fire held (mouse / trigger / auto-fire). */
  firing: boolean;
  /** Charge shot held (right mouse / X). */
  charging: boolean;
  /** An arm weapon has taken over the Buster's rapid fire / charge shot. */
  readonly armPrimary: boolean;
  readonly armSecondary: boolean;
  /** Extra shots from Buster levels; left-click arm weapons inherit them. */
  readonly multishot: number;
  /** Summed Mod flags (Hair Trigger, Pacifist Core, Lightning Rod...). */
  readonly flags: ModFlags;
  /** Apply base damage (scaled by stats, crits, shatter). Returns the dealt amount. */
  damage(e: Enemy, base: number, o: DamageOpts): number;
  nearest(x: number, z: number, r: number, skip?: (e: Enemy) => boolean): Enemy | null;
  inRadius(x: number, z: number, r: number, out: Enemy[]): Enemy[];
  /** Damage every barrel whose centre passes `inside` (beams, zaps, fields; bullets and blasts handle their own). */
  hitBarrels(dmg: number, inside: (x: number, z: number) => boolean): void;
  /** Area blast that damages enemies (never the player). */
  blast(x: number, z: number, r: number, base: number, color: string, source: string): void;
  sound(name: 'zap' | 'disc' | 'missile' | 'mine' | 'freeze' | 'explode' | 'shoot' | 'flame' | 'charge' | 'chargeFull' | 'chargeShot'): void;
}

/** Base class for an owned weapon. Levels are 1-based. */
export abstract class Weapon {
  level = 1;
  protected cd = 0.5;
  /** Muzzle flash timer (arm weapons; drives the flash and camera kick). */
  muzzleT = 0;

  constructor(readonly def: WeaponDef) {}

  /** Parameters for the current level. */
  get p(): Record<string, number> {
    return this.def.levels[this.level - 1].p;
  }

  get maxed(): boolean {
    return this.level >= this.def.levels.length;
  }

  /** Reached the evolution level (the def's last level). */
  get evolved(): boolean {
    return !!this.def.evo && this.maxed;
  }

  get name(): string {
    return this.evolved ? this.def.evo!.name : this.def.name;
  }

  get color(): string {
    return this.evolved ? this.def.evo!.color : this.def.color;
  }

  /** Right-click arm weapons: recharge speed from Quick Draw / Capacitor. */
  protected rightClickSpeed(ctx: WeaponCtx): number {
    return ctx.stats.chargeSpeed * (1 + ctx.flags.chargeSpeed);
  }

  /** Left-click arm weapons: Hair Trigger makes every Nth shot a MEGA shot. */
  private shotCount = 0;
  protected megaShot(ctx: WeaponCtx): boolean {
    const every = ctx.flags.busterMegaEvery;
    if (every <= 0 || ++this.shotCount % every !== 0) return false;
    ctx.sound('explode');
    return true;
  }

  /** Pixel icon id (evolved weapons get their own icon). */
  get iconId(): string {
    return this.evolved ? this.def.id + '_evo' : this.def.id;
  }

  levelUp(): void {
    if (!this.maxed) this.level++;
  }

  /** Counts down a cooldown scaled by stats; returns true when it fires. */
  protected tick(dt: number, ctx: WeaponCtx, base: number): boolean {
    this.cd -= dt;
    if (this.cd > 0) return false;
    this.cd += base * ctx.stats.cooldownMul;
    if (this.cd < 0) this.cd = 0;
    return true;
  }

  abstract update(dt: number, ctx: WeaponCtx): void;
  /** Visual state for online clients (positions, angles...). */
  net(): number[] {
    return [];
  }
  /** Client: apply visual state from the host. */
  setNet(_a: number[]): void {}
  render(_alpha: number, _ctx: WeaponCtx): void {}
  dispose(): void {}
}
