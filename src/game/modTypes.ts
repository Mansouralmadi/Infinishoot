import type { Tag } from '../data/tags';
import type { Enemy } from './enemies';
import type { Player } from './player';
import type { Stats } from './stats';

/**
 * Types for Mods: Balatro-style perks that sit in ordered slots. Damage
 * passes through the slots left to right; each Mod may add (+) and/or
 * multiply (x) the running amount, so order matters.
 */
export interface DamageEvent {
  e: Enemy;
  source: string;
  tags: readonly Tag[];
  /** Distance from the player to the enemy. */
  dist: number;
  crit: boolean;
}

/** Per-Mod runtime memory (counters, timers). Shared by Echo copies. */
export interface ModState {
  n: number;
  t: number;
}

/** What Mods may read and do. Implemented by the synergy engine. */
export interface ModApi {
  readonly player: Player;
  readonly level: number;
  readonly gold: number;
  readonly moving: boolean;
  /** How many owned weapons carry this tag. */
  tagCount(tag: Tag): number;
  /** Number of different tags across owned weapons. */
  distinctTags(): number;
  /** The tag most owned weapons share (ties: first found). */
  topTag(): Tag | null;
  chance(p: number): boolean;
  blast(x: number, z: number, r: number, dmg: number, color: string, source: string, tags: Tag[]): void;
  zap(from: Enemy, hops: number, dmg: number): void;
  ignite(e: Enemy, dps: number): void;
  shock(e: Enemy): void;
}

/** Flags are summed (numbers) or OR'd (booleans) across owned Mods. */
export interface ModFlags {
  busterMegaEvery: number; // every Nth Buster shot is a mega shot (0 = off)
  busterDisabled: boolean;
  shockMult: number; // extra damage multiplier on shocked enemies (added to base 0.2)
  chainBonus: number;
  shockTime: number;
  explosiveArea: number; // per Explosive weapon owned
  shatterMult: number;
  overloadMult: number;
  enemyHp: number; // extra enemy HP fraction
  goldMul: number;
  interestCap: number;
  shopDiscount: number;
  freeRerolls: number;
}

export function emptyFlags(): ModFlags {
  return {
    busterMegaEvery: 0,
    busterDisabled: false,
    shockMult: 0,
    chainBonus: 0,
    shockTime: 0,
    explosiveArea: 0,
    shatterMult: 0,
    overloadMult: 0,
    enemyHp: 0,
    goldMul: 0,
    interestCap: 0,
    shopDiscount: 0,
    freeRerolls: 0,
  };
}

export type ModRarity = 'common' | 'uncommon' | 'rare';

export interface ModDef {
  id: string;
  name: string;
  icon: string;
  color: string;
  rarity: ModRarity;
  price: number;
  desc: string;
  cursed?: boolean;
  /** Tags this Mod cares about (shown as synergy hints in the shop). */
  synergy?: Tag[];
  /** Copies the Mod in the slot to its right. */
  echo?: boolean;
  flags?: Partial<ModFlags>;
  /** Permanent stat change while owned (runs after passives and Workshop). */
  stat?(s: Stats): void;
  /** Per-step stat change (moving, timers...). */
  live?(s: Stats, api: ModApi, st: ModState): void;
  dmg?(ev: DamageEvent, api: ModApi, st: ModState): { add?: number; mult?: number } | void;
  onHit?(ev: DamageEvent, api: ModApi, st: ModState): void;
  onCrit?(ev: DamageEvent, api: ModApi, st: ModState): void;
  onKill?(e: Enemy, source: string, api: ModApi, st: ModState): void;
  onDash?(api: ModApi, st: ModState): void;
  onHurt?(api: ModApi, st: ModState): void;
  onGem?(value: number, api: ModApi, st: ModState): void;
  onLevelUp?(api: ModApi, st: ModState): void;
  tick?(dt: number, api: ModApi, st: ModState): void;
  /** Live readout for the HUD/shop, e.g. "x1.42". */
  readout?(api: ModApi, st: ModState): string;
}
