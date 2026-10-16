import * as THREE from 'three';
import type { WeaponDef } from '../../data/weapons';
import { BULLET_Y, Team } from '../bullets';
import type { Enemy } from '../enemies';
import { Weapon, type WeaponCtx } from './base';

const TICK = 0.2;

/**
 * Secondary arm weapon: hold to raise an energy shield in front of you. It
 * eats enemy bullets and shoves enemies back, draining while held. Evolved
 * (Mirror Aegis) it becomes a golden dome all around you that reflects
 * bullets back at enemies.
 */
export class Shield extends Weapon {
  private up = 0;
  private energy = 1;
  private broken = false;
  private tickT = 0;
  private hits: Enemy[] = [];
  private group = new THREE.Group();
  private arcMesh: THREE.Mesh;
  /** Curved wall above the ground arc; reads as a shield from the top-down camera. */
  private wall: THREE.Mesh;
  private dome: THREE.Mesh;
  private arcMat: THREE.MeshBasicMaterial;
  private domeMat: THREE.MeshBasicMaterial;
  private builtArc = -1;
  /** Arc in degrees (level + Mega Buster), synced for clients. */
  private arc = 0;

  constructor(def: WeaponDef, private scene: THREE.Scene) {
    super(def);
    const additive = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide } as const;
    this.arcMat = new THREE.MeshBasicMaterial({ color: def.color, opacity: 0.7, ...additive });
    this.domeMat = new THREE.MeshBasicMaterial({ color: def.evo!.color, opacity: 0.6, wireframe: true, ...additive });
    this.arcMesh = new THREE.Mesh(new THREE.BufferGeometry(), this.arcMat);
    this.wall = new THREE.Mesh(new THREE.BufferGeometry(), this.arcMat);
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), this.domeMat);
    this.group.add(this.arcMesh, this.wall, this.dome);
    this.group.renderOrder = 2;
    this.group.visible = false;
    scene.add(this.group);
  }

  net(): number[] {
    return [this.up, Math.round(this.energy * 100) / 100, this.arc];
  }
  setNet(a: number[]): void {
    this.up = a[0] ?? 0;
    this.energy = a[1] ?? 1;
    this.arc = a[2] ?? this.p.arc;
  }

  private radius(ctx: WeaponCtx): number {
    return this.p.radius * Math.sqrt(ctx.stats.areaMul);
  }

  /** Is (dx, dz) from the player inside the shield's arc? */
  private inArc(ctx: WeaponCtx, dx: number, dz: number): boolean {
    if (this.arc >= 360) return true;
    const a = Math.atan2(dz, dx) - Math.atan2(ctx.player.aim.z, ctx.player.aim.x);
    return Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) <= (this.arc * Math.PI) / 360;
  }

  update(dt: number, ctx: WeaponCtx): void {
    const p = this.p;
    const pl = ctx.player;
    // Mega Buster widens the arc; Quick Draw / Capacitor stretch the energy.
    this.arc = Math.min(360, p.arc + 60 * ctx.flags.chargeSplit);
    const speed = this.rightClickSpeed(ctx);
    const want = ctx.charging && !pl.dead && !this.broken && !ctx.flags.busterDisabled;
    if (want) this.energy -= dt / (p.dur * speed);
    else this.energy = Math.min(1, this.energy + (dt * speed) / (p.dur * 1.5));
    if (this.energy <= 0) {
      this.energy = 0;
      this.broken = true;
      ctx.sound('freeze');
    }
    if (this.broken && this.energy >= 0.35) this.broken = false;
    this.up = want && !this.broken ? 1 : 0;
    if (!this.up) return;

    const r = this.radius(ctx);
    // Bullets: blocked, or reflected by the Mirror Aegis (or with Overcharge).
    const reflect = this.evolved || ctx.flags.overcharge;
    const dmg = p.dmg * ctx.stats.chargeDmg;
    const b = ctx.bullets;
    for (let i = 0; i < b.count; i++) {
      if (b.team[i] !== Team.Enemy) continue;
      const dx = b.x[i] - pl.x;
      const dz = b.z[i] - pl.z;
      const d = Math.hypot(dx, dz);
      if (d > r + 0.3 || !this.inArc(ctx, dx, dz)) continue;
      if (reflect) {
        const sp = Math.max(14, Math.hypot(b.vx[i], b.vz[i]) * 1.5);
        b.team[i] = Team.Player;
        b.vx[i] = (dx / (d || 1)) * sp;
        b.vz[i] = (dz / (d || 1)) * sp;
        b.damage[i] = dmg * 1.5;
        b.knockback[i] = 4;
        b.life[i] = 1;
        b.owner[i] = ctx.owner;
        b.kind[i] = 4;
        b.lastHit[i] = -1;
        b.pierce[i] = 1;
        b.blast[i] = 0;
        b.setColor(i, '#ffd23f');
        ctx.fx.star(b.x[i], BULLET_Y, b.z[i], 0.8, this.color, 0.08);
      } else {
        ctx.particles.burst(b.x[i], BULLET_Y, b.z[i], { count: 3, color: this.color, color2: '#ffffff', speed: [2, 5], size: [0.08, 0.16], life: [0.1, 0.2] });
        b.kill(i--);
      }
    }
    // Enemies touching the shield get shoved and hurt.
    this.tickT -= dt;
    if (this.tickT > 0) return;
    this.tickT = TICK;
    let n = 0;
    for (const e of ctx.inRadius(pl.x, pl.z, r + 0.6, this.hits)) {
      const dx = e.x - pl.x;
      const dz = e.z - pl.z;
      if (!this.inArc(ctx, dx, dz)) continue;
      const d = Math.hypot(dx, dz) || 1;
      ctx.damage(e, dmg, { source: 'shield', dirX: dx / d, dirZ: dz / d, knockback: p.knock, canCrit: true, loud: true });
      n++;
    }
    if (n) ctx.sound('disc');
    ctx.hitBarrels(dmg, (bx, bz) => (bx - pl.x) ** 2 + (bz - pl.z) ** 2 < (r + 0.6) ** 2 && this.inArc(ctx, bx - pl.x, bz - pl.z));
  }

  render(_alpha: number, ctx: WeaponCtx): void {
    const pl = ctx.player;
    this.group.visible = this.up > 0 && !pl.dead;
    if (!this.group.visible) return;
    const evo = this.evolved;
    if (this.builtArc !== this.arc) {
      this.builtArc = this.arc;
      const arc = (this.arc * Math.PI) / 180;
      this.arcMesh.geometry.dispose();
      // Centred on +X (the aim direction in the group's frame), lying flat.
      this.arcMesh.geometry = new THREE.RingGeometry(0.6, 1, 24, 1, -arc / 2, arc).rotateX(-Math.PI / 2);
      // Cylinder angles run from +Z toward +X, so centre the wall on +X too.
      this.wall.geometry.dispose();
      this.wall.geometry = new THREE.CylinderGeometry(1, 1, 0.9, 24, 1, true, Math.PI / 2 - arc / 2, arc);
    }
    const r = this.radius(ctx);
    this.group.position.set(pl.rig.root.position.x, BULLET_Y * 0.6, pl.rig.root.position.z);
    this.group.scale.setScalar(r);
    // RingGeometry's angle runs toward -Z after rotateX, so mirror the aim's z.
    this.arcMesh.rotation.y = this.wall.rotation.y = -Math.atan2(pl.aim.z, pl.aim.x) + (evo ? ctx.time * 2 : 0);
    this.wall.scale.y = 1 / r;
    this.arcMat.color.set(this.color);
    const pulse = 0.55 + Math.sin(ctx.time * 25) * 0.1;
    this.arcMat.opacity = Math.min(1, pulse * 1.4 * (0.4 + 0.6 * this.energy));
    this.dome.visible = evo;
    this.dome.position.y = -BULLET_Y * 0.6;
    this.dome.rotation.y = ctx.time * 1.5;
    this.domeMat.opacity = pulse * (0.3 + 0.5 * this.energy);
  }

  dispose(): void {
    this.scene.remove(this.group);
    this.arcMesh.geometry.dispose();
    this.wall.geometry.dispose();
    this.dome.geometry.dispose();
    this.arcMat.dispose();
    this.domeMat.dispose();
  }
}
