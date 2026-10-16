import * as THREE from 'three';
import type { WeaponDef } from '../../data/weapons';
import { createRetroMaterial, type RetroMaterial } from '../../render/retroMaterial';
import { Weapon, type WeaponCtx } from './base';

const MAX = 24;
const FLIGHT = 0.55;
const BOMBLET_FLIGHT = 0.32;

interface Shell {
  fx: number;
  fz: number;
  tx: number;
  tz: number;
  t: number;
  dur: number;
  peak: number;
  /** Bomblets are small and don't split again. */
  small: boolean;
  // Current position (for rendering and net).
  x: number;
  y: number;
  z: number;
}

/**
 * Secondary arm weapon: lobs grenades in an arc to a point ahead of you.
 * Evolved (Cluster Mortar) the shell turns into a red finned mortar round
 * that scatters a ring of bomblets on impact.
 */
export class Grenade extends Weapon {
  private shells: Shell[] = [];
  private meshes: THREE.Group[] = [];
  private mats: RetroMaterial[];
  private geos: THREE.BufferGeometry[];
  private mz = { x: 0, z: 0 };

  constructor(def: WeaponDef, private scene: THREE.Scene) {
    super(def);
    const body = createRetroMaterial({ color: def.color, unlit: 0.4 });
    const band = createRetroMaterial({ color: '#2b2b3a', unlit: 0.2 });
    const evoBody = createRetroMaterial({ color: def.evo!.color, unlit: 0.7 });
    this.mats = [body, band, evoBody];
    const ball = new THREE.IcosahedronGeometry(0.28, 1);
    const ring = new THREE.TorusGeometry(0.28, 0.06, 4, 10);
    const fin = new THREE.BoxGeometry(0.06, 0.32, 0.3).translate(0, 0, -0.3);
    this.geos = [ball, ring, fin];
    for (let i = 0; i < MAX; i++) {
      const g = new THREE.Group();
      const finA = new THREE.Mesh(fin, band);
      const finB = new THREE.Mesh(fin, band);
      finB.rotation.z = Math.PI / 2;
      g.add(new THREE.Mesh(ball, body), new THREE.Mesh(ring, band), finA, finB);
      g.visible = false;
      scene.add(g);
      this.meshes.push(g);
    }
  }

  net(): number[] {
    const out = [this.muzzleT];
    for (const s of this.shells) out.push(Math.round(s.x * 10) / 10, Math.round(s.y * 10) / 10, Math.round(s.z * 10) / 10, s.small ? 1 : 0);
    return out;
  }
  setNet(a: number[]): void {
    this.muzzleT = a[0] ?? 0;
    this.shells.length = 0;
    for (let i = 1; i + 3 < a.length; i += 4) {
      this.shells.push({ fx: 0, fz: 0, tx: 0, tz: 0, t: 0, dur: 1, peak: 0, small: a[i + 3] === 1, x: a[i], y: a[i + 1], z: a[i + 2] });
    }
  }

  private lob(fx: number, fz: number, tx: number, tz: number, small: boolean): void {
    if (this.shells.length >= MAX) return;
    const dur = small ? BOMBLET_FLIGHT : FLIGHT;
    this.shells.push({ fx, fz, tx, tz, t: 0, dur, peak: small ? 1.4 : 3.2, small, x: fx, y: 1, z: fz });
  }

  update(dt: number, ctx: WeaponCtx): void {
    this.muzzleT = Math.max(0, this.muzzleT - dt);
    const p = this.p;
    // Overcharge: bigger, harder blasts. Plasma Core: right-click damage.
    const over = ctx.flags.overcharge;
    const area = Math.sqrt(ctx.stats.areaMul) * (over ? 1.4 : 1);
    const dmg = p.dmg * ctx.stats.chargeDmg * (over ? 1.5 : 1);
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const s = this.shells[i];
      s.t += dt;
      const k = Math.min(1, s.t / s.dur);
      s.x = s.fx + (s.tx - s.fx) * k;
      s.z = s.fz + (s.tz - s.fz) * k;
      s.y = 0.3 + (1 - k) * 0.8 + 4 * s.peak * k * (1 - k);
      if (k < 1) continue;
      this.shells.splice(i, 1);
      if (s.small) {
        ctx.blast(s.x, s.z, 1.8 * area, dmg * 0.4, this.color, 'grenade');
        continue;
      }
      ctx.blast(s.x, s.z, p.radius * area, dmg, this.color, 'grenade');
      ctx.shake(s.x, s.z, 0.3);
      ctx.sound('explode');
      for (let b = 0; b < p.bomblets; b++) {
        const a = (b / p.bomblets) * Math.PI * 2 + ctx.rng.next() * 0.5;
        const d = p.radius * area * (0.8 + ctx.rng.next() * 0.5);
        this.lob(s.x, s.z, s.x + Math.cos(a) * d, s.z + Math.sin(a) * d, true);
      }
    }

    this.cd -= dt;
    this.tickReady();
    const pl = ctx.player;
    if (!ctx.charging || pl.dead || this.cd > 0 || ctx.flags.busterDisabled) return;
    this.startCooldown((p.cd * ctx.stats.cooldownMul) / this.rightClickSpeed(ctx));
    pl.muzzle(this.mz);
    // Mega Buster: extra grenades in a fan.
    const n = 1 + ctx.flags.chargeSplit;
    const base = Math.atan2(pl.aim.z, pl.aim.x);
    for (let k = 0; k < n; k++) {
      const a = base + (n > 1 ? (k / (n - 1) - 0.5) * 0.6 : 0);
      this.lob(this.mz.x, this.mz.z, pl.x + Math.cos(a) * p.range, pl.z + Math.sin(a) * p.range, false);
    }
    this.armFx(ctx, this.color, 0.9);
    ctx.sound('lob');
    ctx.particles.burst(this.mz.x, 1.05, this.mz.z, { count: 8, color: '#d8def0', color2: this.color, speed: [2, 5], size: [0.15, 0.3], life: [0.2, 0.4], dir: { x: pl.aim.x, z: pl.aim.z, spread: 1.2 }, up: 2 });
  }

  render(_alpha: number, ctx: WeaponCtx): void {
    const evo = this.evolved;
    this.meshes.forEach((g, i) => {
      const s = this.shells[i];
      g.visible = !!s;
      if (!s) return;
      g.position.set(s.x, s.y, s.z);
      (g.children[0] as THREE.Mesh).material = evo ? this.mats[2] : this.mats[0];
      // Mortar rounds fly nose-first with fins; plain grenades tumble.
      g.children[2].visible = g.children[3].visible = evo && !s.small;
      g.scale.setScalar(s.small ? 0.55 : evo ? 1.35 : 1);
      if (evo && !s.small) g.rotation.set(-Math.PI / 4, ctx.time * 12, 0);
      else g.rotation.set(ctx.time * 9 + i, ctx.time * 7, 0);
    });
  }

  dispose(): void {
    for (const g of this.meshes) this.scene.remove(g);
    for (const geo of this.geos) geo.dispose();
    for (const m of this.mats) m.dispose();
  }
}
