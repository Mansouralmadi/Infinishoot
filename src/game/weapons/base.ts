import type * as THREE from 'three';
import type { Rng } from '../../core/rng';
import type { SpatialHash } from '../../core/spatialHash';
import type { WeaponDef } from '../../data/weapons';
import type { Bullets } from '../bullets';
import type { Enemy, Enemies } from '../enemies';
import type { Fx } from '../fx';
import type { Particles } from '../particles';
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
}

/** Everything a weapon may touch. Implemented by Game. */
export interface WeaponCtx {
  scene: THREE.Scene;
  player: Player;
  stats: Stats;
  rng: Rng;
  time: number;
  enemies: Enemies;
  hash: SpatialHash<Enemy>;
  bullets: Bullets;
  particles: Particles;
  fx: Fx;
  /** Manual fire held (mouse / trigger / auto-fire). */
  firing: boolean;
  /** Apply base damage (scaled by stats, crits, shatter). Returns the dealt amount. */
  damage(e: Enemy, base: number, o: DamageOpts): number;
  nearest(x: number, z: number, r: number, skip?: (e: Enemy) => boolean): Enemy | null;
  inRadius(x: number, z: number, r: number, out: Enemy[]): Enemy[];
  /** Area blast that damages enemies (never the player). */
  blast(x: number, z: number, r: number, base: number, color: string, source: string): void;
  sound(name: 'zap' | 'disc' | 'missile' | 'mine' | 'freeze' | 'explode' | 'shoot' | 'flame'): void;
}

/** Base class for an owned weapon. Levels are 1-based. */
export abstract class Weapon {
  level = 1;
  protected cd = 0.5;

  constructor(readonly def: WeaponDef) {}

  /** Parameters for the current level. */
  get p(): Record<string, number> {
    return this.def.levels[this.level - 1].p;
  }

  get maxed(): boolean {
    return this.level >= this.def.levels.length;
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
  render(_alpha: number, _ctx: WeaponCtx): void {}
  dispose(): void {}
}
