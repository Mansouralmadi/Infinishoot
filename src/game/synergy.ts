import type { Rng } from '../core/rng';
import type { Tag } from '../data/tags';
import type { Enemy } from './enemies';
import { emptyFlags, type DamageEvent, type ModApi, type ModDef, type ModFlags, type ModState } from './modTypes';
import type { Player } from './player';
import type { Stats } from './stats';
import type { Weapon } from './weapons';

/** What the synergy engine needs from the game. */
export interface SynergyHost {
  readonly player: Player;
  readonly level: number;
  readonly gold: number;
  readonly weapons: Weapon[];
  readonly rng: Rng;
  blast(x: number, z: number, r: number, dmg: number, color: string, source: string, tags: Tag[]): void;
  zap(from: Enemy, hops: number, dmg: number): void;
  ignite(e: Enemy, dps: number): void;
  shock(e: Enemy): void;
}

export interface Slot {
  def: ModDef;
  st: ModState;
}

export const MAX_MOD_SLOTS = 5;

/**
 * Runs the player's Mods. Slots are ordered; an Echo in slot i adds a second
 * copy of slot i+1 at its own position. Every hook runs once per effective
 * entry, so an echoed trigger fires twice and an echoed multiplier applies twice.
 */
export class Synergy implements ModApi {
  slots: Slot[] = [];
  flags: ModFlags = emptyFlags();
  moving = false;
  private eff: Slot[] = [];

  constructor(private host: SynergyHost) {}

  // ---------------------------------------------------------------- ModApi
  get player(): Player {
    return this.host.player;
  }
  get level(): number {
    return this.host.level;
  }
  get gold(): number {
    return this.host.gold;
  }
  tagCount(tag: Tag): number {
    let n = 0;
    for (const w of this.host.weapons) if (w.def.tags.includes(tag)) n++;
    return n;
  }
  distinctTags(): number {
    const set = new Set<Tag>();
    for (const w of this.host.weapons) for (const t of w.def.tags) set.add(t);
    return set.size;
  }
  topTag(): Tag | null {
    const counts = new Map<Tag, number>();
    let best: Tag | null = null;
    let bestN = 0;
    for (const w of this.host.weapons) {
      for (const t of w.def.tags) {
        const n = (counts.get(t) ?? 0) + 1;
        counts.set(t, n);
        if (n > bestN) {
          bestN = n;
          best = t;
        }
      }
    }
    return best;
  }
  chance(p: number): boolean {
    return this.host.rng.chance(p);
  }
  blast(x: number, z: number, r: number, dmg: number, color: string, source: string, tags: Tag[]): void {
    this.host.blast(x, z, r, dmg, color, source, tags);
  }
  zap(from: Enemy, hops: number, dmg: number): void {
    this.host.zap(from, hops, dmg);
  }
  ignite(e: Enemy, dps: number): void {
    this.host.ignite(e, dps);
  }
  shock(e: Enemy): void {
    this.host.shock(e);
  }

  // ---------------------------------------------------------------- slots

  reset(): void {
    this.slots = [];
    this.rebuild();
  }

  get full(): boolean {
    return this.slots.length >= MAX_MOD_SLOTS;
  }

  owns(id: string): boolean {
    return this.slots.some((s) => s.def.id === id);
  }

  add(def: ModDef): void {
    this.slots.push({ def, st: { n: 0, t: 0 } });
    this.rebuild();
  }

  remove(i: number): Slot | undefined {
    const [s] = this.slots.splice(i, 1);
    this.rebuild();
    return s;
  }

  move(i: number, dir: -1 | 1): void {
    const j = i + dir;
    if (j < 0 || j >= this.slots.length) return;
    [this.slots[i], this.slots[j]] = [this.slots[j], this.slots[i]];
    this.rebuild();
  }

  /** Resolve Echoes and sum flags. */
  private rebuild(): void {
    this.eff = [];
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      if (s.def.echo) {
        const next = this.slots[i + 1];
        if (next && !next.def.echo) this.eff.push(next);
      } else this.eff.push(s);
    }
    const f = emptyFlags();
    for (const s of this.eff) {
      if (!s.def.flags) continue;
      for (const [k, v] of Object.entries(s.def.flags) as [keyof ModFlags, number | boolean][]) {
        if (typeof v === 'boolean') (f[k] as boolean) = (f[k] as boolean) || v;
        else (f[k] as number) += v;
      }
    }
    // Two Hair Triggers shouldn't make every 16th shot special: take the smallest N.
    const megas = this.eff.map((s) => s.def.flags?.busterMegaEvery ?? 0).filter((n) => n > 0);
    f.busterMegaEvery = megas.length ? Math.max(3, Math.min(...megas) - (megas.length - 1) * 2) : 0;
    this.flags = f;
  }

  // ---------------------------------------------------------------- stats

  /** Permanent stat changes (after passives and Workshop). */
  applyStatic(s: Stats): void {
    for (const e of this.eff) e.def.stat?.(s);
  }

  /** Per-step stat changes. */
  applyLive(s: Stats): void {
    for (const e of this.eff) e.def.live?.(s, this, e.st);
  }

  // ---------------------------------------------------------------- damage

  /** Run a hit through the slots left to right: amount = (amount + add) * mult. */
  damage(ev: DamageEvent, amount: number): number {
    for (const e of this.eff) {
      const r = e.def.dmg?.(ev, this, e.st);
      if (!r) continue;
      amount = (amount + (r.add ?? 0)) * (r.mult ?? 1);
    }
    return amount;
  }

  // ---------------------------------------------------------------- triggers

  hit(ev: DamageEvent): void {
    for (const e of this.eff) e.def.onHit?.(ev, this, e.st);
  }
  crit(ev: DamageEvent): void {
    for (const e of this.eff) e.def.onCrit?.(ev, this, e.st);
  }
  kill(en: Enemy, source: string): void {
    for (const e of this.eff) e.def.onKill?.(en, source, this, e.st);
  }
  dash(): void {
    for (const e of this.eff) e.def.onDash?.(this, e.st);
  }
  hurt(): void {
    for (const e of this.eff) e.def.onHurt?.(this, e.st);
  }
  gem(v: number): void {
    for (const e of this.eff) e.def.onGem?.(v, this, e.st);
  }
  levelUp(): void {
    for (const e of this.eff) e.def.onLevelUp?.(this, e.st);
  }
  tick(dt: number): void {
    for (const e of this.eff) e.def.tick?.(dt, this, e.st);
  }

  /** Readout text for slot i (e.g. a live multiplier), or ''. */
  readout(i: number): string {
    const s = this.slots[i];
    if (!s) return '';
    if (s.def.echo) {
      const next = this.slots[i + 1];
      return next && !next.def.echo ? `= ${next.def.name}` : 'no target';
    }
    return s.def.readout?.(this, s.st) ?? '';
  }
}
