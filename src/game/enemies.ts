import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { EnemyDef } from '../data/enemies';
import { createRetroMaterial } from '../render/retroMaterial';
import { paint } from '../render/geometry';
import { textures } from '../render/textures';
import type { SpatialHash } from '../core/spatialHash';
import { resolveCircleVsBoxes, type AABB } from '../world/collision';
import { commit } from '../render/instancing';

export type EnemyState = 'spawning' | 'move' | 'windup' | 'attack' | 'recover';
type BossAction = 'ring' | 'summon' | 'slam';

const SPAWN_TIME = 0.45;
const BATCH_CAP = 700; // max simultaneous enemies of one type
const DARK = '#2b2f4a';

// ------------------------------------------------------------------ models

type Part = (g: THREE.BufferGeometry, color: string, x: number, y: number, z: number) => void;

/**
 * Builds a vertex-coloured, merged geometry for an enemy model. Each model is
 * authored around its def's radius so variants (e.g. Zippy vs Bopper) scale.
 */
function buildModel(def: EnemyDef, add: Part): void {
  const r = def.radius;
  const B = def.bodyColor;
  const A = def.accentColor;
  const eye = (y: number, z: number, s = 1) => {
    add(new THREE.SphereGeometry(r * 0.42 * s, 8, 6), '#ffffff', 0, y, z);
    add(new THREE.SphereGeometry(r * 0.2 * s, 6, 5), DARK, 0, y + r * 0.02, z + r * 0.34 * s);
  };
  switch (def.model) {
    case 'bopper':
      add(new THREE.SphereGeometry(r, 10, 8), B, 0, r + 0.08, 0);
      add(new THREE.CylinderGeometry(r * 1.03, r * 1.03, 0.14, 12), A, 0, r * 0.85, 0);
      eye(r * 1.25, r * 0.72);
      add(new THREE.CylinderGeometry(0.035, 0.035, 0.4, 4), DARK, 0, r * 2 + 0.25, 0);
      add(new THREE.SphereGeometry(0.11, 6, 4), A, 0, r * 2 + 0.47, 0);
      add(new THREE.BoxGeometry(r * 0.4, 0.14, r * 0.55), DARK, -r * 0.5, 0.07, 0.05);
      add(new THREE.BoxGeometry(r * 0.4, 0.14, r * 0.55), DARK, r * 0.5, 0.07, 0.05);
      break;
    case 'swarmer': {
      // Flying bat-ball: round body, two flat wings, one eye. Hovers above ground.
      const y = 0.9;
      add(new THREE.SphereGeometry(r, 8, 6), B, 0, y, 0);
      const wl = new THREE.BoxGeometry(r * 1.5, 0.05, r * 0.9).rotateZ(0.5);
      add(wl, A, -r * 1.1, y + 0.15, -0.05);
      const wr = new THREE.BoxGeometry(r * 1.5, 0.05, r * 0.9).rotateZ(-0.5);
      add(wr, A, r * 1.1, y + 0.15, -0.05);
      eye(y + 0.05, r * 0.7, 0.9);
      break;
    }
    case 'shooter':
      // Turret bot: drum body, dome head, cannon barrel, antenna.
      add(new THREE.CylinderGeometry(r * 0.8, r * 0.95, r * 1.2, 10), B, 0, r * 0.6 + 0.05, 0);
      add(new THREE.SphereGeometry(r * 0.7, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), A, 0, r * 1.25, 0);
      add(new THREE.CylinderGeometry(r * 0.22, r * 0.26, r * 1.1, 8).rotateX(Math.PI / 2), DARK, 0, r * 0.75, r * 0.9);
      add(new THREE.BoxGeometry(r * 0.9, 0.12, r * 0.2), '#ffffff', 0, r * 1.45, r * 0.45);
      add(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 4), DARK, r * 0.3, r * 1.9 + 0.1, 0);
      add(new THREE.SphereGeometry(0.09, 6, 4), '#ff3d5a', r * 0.3, r * 1.9 + 0.32, 0);
      break;
    case 'charger':
      // Rhino: boxy body, big horn pointing forward, stubby legs.
      add(new THREE.BoxGeometry(r * 1.6, r * 1.1, r * 2.0), B, 0, r * 0.85, 0);
      add(new THREE.BoxGeometry(r * 1.3, r * 0.9, r * 0.8), B, 0, r * 0.95, r * 1.2);
      add(new THREE.ConeGeometry(r * 0.28, r * 1.0, 6).rotateX(Math.PI / 2), A, 0, r * 1.05, r * 2.0);
      add(new THREE.BoxGeometry(r * 1.62, r * 0.2, r * 2.02), A, 0, r * 1.3, 0);
      for (const sx of [-1, 1]) {
        add(new THREE.BoxGeometry(r * 0.4, r * 0.4, r * 0.4), DARK, sx * r * 0.5, r * 0.2, r * 0.6);
        add(new THREE.BoxGeometry(r * 0.4, r * 0.4, r * 0.4), DARK, sx * r * 0.5, r * 0.2, -r * 0.6);
        add(new THREE.SphereGeometry(r * 0.16, 6, 4), '#ffffff', sx * r * 0.45, r * 1.15, r * 1.55);
      }
      break;
    case 'exploder':
      // Cartoon bomb with legs and a sparking fuse.
      add(new THREE.SphereGeometry(r, 10, 8), B, 0, r + 0.12, 0);
      add(new THREE.CylinderGeometry(r * 1.02, r * 1.02, 0.12, 12), A, 0, r + 0.12, 0);
      add(new THREE.CylinderGeometry(r * 0.25, r * 0.3, r * 0.3, 8), '#8a90c8', 0, r * 2 + 0.1, 0);
      add(new THREE.CylinderGeometry(0.04, 0.04, r * 0.5, 4), '#e8c27a', 0, r * 2.4 + 0.1, 0);
      add(new THREE.SphereGeometry(0.12, 6, 4), '#fff35c', 0, r * 2.7 + 0.1, 0);
      eye(r * 1.2, r * 0.75, 0.8);
      add(new THREE.BoxGeometry(0.12, 0.25, 0.12), DARK, -r * 0.45, 0.1, 0);
      add(new THREE.BoxGeometry(0.12, 0.25, 0.12), DARK, r * 0.45, 0.1, 0);
      break;
    case 'splitter':
      // Wobbly jelly cube with two eyes.
      add(new THREE.BoxGeometry(r * 1.7, r * 1.5, r * 1.7), B, 0, r * 0.75, 0);
      add(new THREE.BoxGeometry(r * 1.2, r * 0.25, r * 1.2), '#ffffff', 0, r * 1.55, 0);
      for (const sx of [-1, 1]) {
        add(new THREE.SphereGeometry(r * 0.24, 6, 5), '#ffffff', sx * r * 0.4, r * 0.95, r * 0.85);
        add(new THREE.SphereGeometry(r * 0.12, 6, 4), DARK, sx * r * 0.4, r * 0.95, r * 1.05);
      }
      break;
    case 'spawner':
      // Crystal pylon: wide base, tall spire, glowing orb.
      add(new THREE.CylinderGeometry(r * 1.0, r * 1.2, r * 0.5, 8), DARK, 0, r * 0.25, 0);
      add(new THREE.CylinderGeometry(r * 0.35, r * 0.8, r * 2.2, 6), B, 0, r * 1.6, 0);
      add(new THREE.OctahedronGeometry(r * 0.55, 0), A, 0, r * 3.2, 0);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        add(new THREE.ConeGeometry(r * 0.2, r * 0.9, 4), A, Math.cos(a) * r * 0.9, r * 0.7, Math.sin(a) * r * 0.9);
      }
      break;
    case 'king': {
      add(new THREE.SphereGeometry(r, 14, 10), B, 0, r + 0.1, 0);
      add(new THREE.CylinderGeometry(r * 1.02, r * 1.02, r * 0.22, 16), A, 0, r * 0.85, 0);
      eye(r * 1.25, r * 0.72);
      // Crown
      add(new THREE.CylinderGeometry(r * 0.55, r * 0.6, r * 0.35, 10), '#ffd23f', 0, r * 2.0, 0);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        add(new THREE.ConeGeometry(r * 0.12, r * 0.45, 4), '#ffd23f', Math.cos(a) * r * 0.5, r * 2.35, Math.sin(a) * r * 0.5);
        add(new THREE.SphereGeometry(r * 0.08, 5, 4), '#ff3df0', Math.cos(a) * r * 0.58, r * 2.0, Math.sin(a) * r * 0.58);
      }
      add(new THREE.BoxGeometry(r * 0.5, r * 0.25, r * 0.7), DARK, -r * 0.5, r * 0.12, 0.1);
      add(new THREE.BoxGeometry(r * 0.5, r * 0.25, r * 0.7), DARK, r * 0.5, r * 0.12, 0.1);
      break;
    }
  }
}

const geoCache = new Map<string, THREE.BufferGeometry>();
function enemyGeometry(def: EnemyDef): THREE.BufferGeometry {
  let geo = geoCache.get(def.id);
  if (geo) return geo;
  const parts: THREE.BufferGeometry[] = [];
  buildModel(def, (g, color, x, y, z) => {
    // mergeGeometries needs matching attributes and index-ness: de-index everything.
    const ng = (g.index ? g.toNonIndexed() : g).translate(x, y, z);
    parts.push(paint(ng, color));
  });
  geo = mergeGeometries(parts)!;
  geoCache.set(def.id, geo);
  return geo;
}

// ------------------------------------------------------------------ state

let nextUid = 1;

export interface SpawnOpts {
  hpMul?: number;
  speedMul?: number;
  dmgMul?: number;
  elite?: boolean;
  instant?: boolean;
}

/** Simulation state for one enemy. Pure data; drawn by `Enemies` via instancing. */
export class Enemy {
  uid = 0;
  active = false;
  state: EnemyState = 'spawning';
  t = 0;
  x = 0;
  z = 0;
  px = 0;
  pz = 0;
  vx = 0;
  vz = 0;
  kx = 0; // knockback velocity
  kz = 0;
  hp = 0;
  maxHp = 0;
  speedMul = 1;
  dmgMul = 1;
  scale = 1;
  radius = 0;
  elite = false;
  /** Id of the last bomb wave that hit this enemy (each bomb hits once). */
  bombStamp = 0;
  flash = 0;
  frozen = 0;
  slowT = 0;
  slowAmt = 0;
  shatter = 0; // bonus damage taken while frozen
  lungeX = 0;
  lungeZ = 0;
  facing = 0;
  hitPlayer = false;
  timerA = 0;
  action: BossAction = 'ring';
  hopY = 0;
  fromX = 0;
  fromZ = 0;
  targetX = 0;
  targetZ = 0;
  strafe = 1;
  /** Squash-and-stretch spring: displacement and velocity. */
  sq = 0;
  sqV = 0;

  constructor(public def: EnemyDef) {}

  reset(x: number, z: number, o: SpawnOpts): void {
    this.uid = nextUid++;
    this.active = true;
    this.state = 'spawning';
    this.t = o.instant ? 0.01 : SPAWN_TIME;
    this.x = this.px = x;
    this.z = this.pz = z;
    this.vx = this.vz = this.kx = this.kz = 0;
    this.elite = !!o.elite;
    this.scale = this.elite ? 1.6 : 1;
    this.radius = this.def.radius * this.scale;
    this.hp = this.maxHp = Math.round(this.def.hp * (o.hpMul ?? 1) * (this.elite ? 10 : 1));
    this.speedMul = (o.speedMul ?? 1) * (this.elite ? 0.9 : 1);
    this.dmgMul = (o.dmgMul ?? 1) * (this.elite ? 1.5 : 1);
    this.bombStamp = 0;
    this.flash = this.frozen = this.slowT = this.shatter = 0;
    this.sq = this.sqV = this.hopY = 0;
    this.timerA = this.def.behavior === 'boss' ? 3 : 1 + Math.random() * 2;
    this.strafe = Math.random() < 0.5 ? -1 : 1;
  }

  get alive(): boolean {
    return this.active && this.state !== 'spawning';
  }

  get contactDamage(): number {
    return this.def.contactDamage * this.dmgMul;
  }

  /** Kick the squash spring: positive = stretch up, negative = squash down. */
  squash(amount: number): void {
    this.sqV += amount;
  }
}

/** Side effects enemies need from the game. */
export interface EnemyCtx {
  target: { x: number; z: number; radius: number };
  targetAlive: boolean;
  hash: SpatialHash<Enemy>;
  colliders: AABB[];
  onWindup(e: Enemy): void;
  fireBullet(e: Enemy, dirX: number, dirZ: number, speed: number, damage: number): void;
  spawnChild(defId: string, x: number, z: number, parent: Enemy): void;
  detonate(e: Enemy): void;
  slam(e: Enemy): void;
}

// ------------------------------------------------------------------ rendering helpers

/** One InstancedMesh per enemy type, with a per-instance hit-flash attribute. */
class EnemyBatch {
  readonly mesh: THREE.InstancedMesh;
  readonly flash: THREE.InstancedBufferAttribute;

  constructor(def: EnemyDef, scene: THREE.Scene) {
    const geo = enemyGeometry(def).clone();
    this.flash = new THREE.InstancedBufferAttribute(new Float32Array(BATCH_CAP * 4), 4);
    this.flash.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('instanceFlash', this.flash);
    const mat = createRetroMaterial({ vertexColors: true, instanceFlash: true });
    this.mesh = new THREE.InstancedMesh(geo, mat, BATCH_CAP);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
  }
}

/** Instanced ground decals: blob shadows, spawn rings, charge lines, blast-radius rings. */
class GroundDecals {
  readonly shadows: THREE.InstancedMesh;
  readonly markers: THREE.InstancedMesh;
  readonly lines: THREE.InstancedMesh;
  readonly zones: THREE.InstancedMesh;
  private markerMat: THREE.MeshBasicMaterial;
  private dangerMat: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene, cap: number) {
    const blobMat = new THREE.MeshBasicMaterial({ map: textures.blob(), transparent: true, depthWrite: false });
    this.shadows = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), blobMat, cap);
    this.markerMat = new THREE.MeshBasicMaterial({ color: '#ff3d5a', transparent: true, depthWrite: false });
    this.markers = new THREE.InstancedMesh(new THREE.RingGeometry(0.45, 0.75, 16).rotateX(-Math.PI / 2), this.markerMat, cap);
    this.dangerMat = new THREE.MeshBasicMaterial({ color: '#ff2d4a', transparent: true, opacity: 0.45, depthWrite: false });
    // Line decal: unit length along +Z starting at the origin.
    this.lines = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5),
      this.dangerMat,
      64,
    );
    this.zones = new THREE.InstancedMesh(new THREE.RingGeometry(0.86, 1, 32).rotateX(-Math.PI / 2), this.dangerMat, 64);
    for (const m of [this.shadows, this.markers, this.lines, this.zones]) {
      m.frustumCulled = false;
      m.count = 0;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.renderOrder = 1;
      scene.add(m);
    }
  }

  setPulse(time: number): void {
    this.markerMat.opacity = 0.5 + 0.5 * Math.sin(time * 25);
    this.dangerMat.opacity = 0.35 + 0.25 * Math.sin(time * 30);
  }
}

// ------------------------------------------------------------------ manager

/** Pool, behaviour and rendering for all enemies. */
export class Enemies {
  readonly list: Enemy[] = [];
  private free: Enemy[] = [];
  private batches = new Map<string, EnemyBatch>();
  private decals: GroundDecals;
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private s = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);
  private alive = 0;
  private counts = new Map<string, number>();

  constructor(private scene: THREE.Scene) {
    this.decals = new GroundDecals(scene, 2048);
  }

  spawn(def: EnemyDef, x: number, z: number, o: SpawnOpts = {}): Enemy {
    let e = this.free.pop();
    if (e) e.def = def;
    else {
      e = new Enemy(def);
      this.list.push(e);
    }
    if (!this.batches.has(def.id)) this.batches.set(def.id, new EnemyBatch(def, this.scene));
    e.reset(x, z, o);
    this.alive++;
    this.counts.set(def.id, (this.counts.get(def.id) ?? 0) + 1);
    return e;
  }

  get activeCount(): number {
    return this.alive;
  }

  /** Active enemies of a given type (as of the last update or spawn). */
  countOf(id: string): number {
    return this.counts.get(id) ?? 0;
  }

  kill(e: Enemy): void {
    if (!e.active) return;
    e.active = false;
    this.free.push(e);
    this.alive--;
    this.counts.set(e.def.id, (this.counts.get(e.def.id) ?? 1) - 1);
  }

  clear(): void {
    for (const e of this.list) if (e.active) this.kill(e);
  }

  update(dt: number, ctx: EnemyCtx): void {
    const tgt = ctx.target;
    for (const e of this.list) {
      if (!e.active) continue;
      e.px = e.x;
      e.pz = e.z;
      e.flash = Math.max(0, e.flash - dt);
      e.sqV += (-220 * e.sq - 14 * e.sqV) * dt;
      e.sq += e.sqV * dt;
      if (e.slowT > 0) e.slowT -= dt;

      if (e.state === 'spawning') {
        e.t -= dt;
        if (e.t <= 0) {
          e.state = 'move';
          e.squash(5);
        }
        continue;
      }
      // Frozen solid: no thinking, no moving (knockback still slides a little).
      if (e.frozen > 0) {
        e.frozen -= dt;
        const kd = Math.exp(-6 * dt);
        e.kx *= kd;
        e.kz *= kd;
        e.x += e.kx * dt * 0.3;
        e.z += e.kz * dt * 0.3;
        continue;
      }

      const dx = tgt.x - e.x;
      const dz = tgt.z - e.z;
      const dist = Math.hypot(dx, dz) || 1;
      const nx = dx / dist;
      const nz = dz / dist;
      const speed = e.def.speed * e.speedMul * (e.slowT > 0 ? 1 - e.slowAmt : 1);
      let wantX = 0;
      let wantZ = 0;
      let rigid = false; // attack movement ignores steering smoothing
      e.t -= dt;

      switch (e.def.behavior) {
        case 'chase':
          wantX = nx * speed;
          wantZ = nz * speed;
          e.facing = Math.atan2(dx, dz);
          break;

        case 'lunge': {
          const L = e.def.lunge!;
          if (e.state === 'move') {
            wantX = nx * speed;
            wantZ = nz * speed;
            e.facing = Math.atan2(dx, dz);
            if (dist < L.range * e.scale && ctx.targetAlive) this.enter(e, 'windup', L.windup, -5, ctx);
          } else if (e.state === 'windup') {
            if (e.t > L.windup * 0.5) this.lockOn(e, nx, nz, dx, dz);
            e.sq = Math.min(e.sq, -0.25);
            if (e.t <= 0) this.enter(e, 'attack', L.duration, 9);
          } else if (e.state === 'attack') {
            wantX = e.lungeX * L.speed;
            wantZ = e.lungeZ * L.speed;
            rigid = true;
            if (e.t <= 0) this.enter(e, 'recover', L.recover, -4);
          } else if (e.t <= 0) e.state = 'move';
          break;
        }

        case 'shooter': {
          const S = e.def.shoot!;
          e.facing = Math.atan2(dx, dz);
          if (e.state === 'move') {
            // Hold a ring around the player, strafing sideways.
            const radial = dist > S.keepDistance + 1 ? 1 : dist < S.keepDistance - 1.5 ? -1 : 0;
            wantX = (nx * radial - nz * e.strafe * 0.6) * speed;
            wantZ = (nz * radial + nx * e.strafe * 0.6) * speed;
            e.timerA -= dt;
            if (e.timerA <= 0 && dist < 15 && ctx.targetAlive) this.enter(e, 'windup', 0.45, -4, ctx);
          } else if (e.state === 'windup' && e.t <= 0) {
            const base = Math.atan2(nz, nx);
            const spread = THREE.MathUtils.degToRad(S.spreadDeg);
            for (let i = 0; i < S.bullets; i++) {
              const a = base + (S.bullets > 1 ? (i / (S.bullets - 1) - 0.5) * spread : 0);
              ctx.fireBullet(e, Math.cos(a), Math.sin(a), S.speed, S.damage);
            }
            e.squash(6);
            e.timerA = S.interval * (0.8 + Math.random() * 0.4);
            e.state = 'move';
          }
          break;
        }

        case 'charger': {
          const C = e.def.charge!;
          if (e.state === 'move') {
            wantX = nx * speed;
            wantZ = nz * speed;
            e.facing = Math.atan2(dx, dz);
            if (dist < C.range && ctx.targetAlive) {
              this.lockOn(e, nx, nz, dx, dz);
              this.enter(e, 'windup', C.windup, -5, ctx);
            }
          } else if (e.state === 'windup') {
            e.sq = Math.min(e.sq, -0.2);
            if (e.t <= 0) this.enter(e, 'attack', C.duration, 8);
          } else if (e.state === 'attack') {
            wantX = e.lungeX * C.speed;
            wantZ = e.lungeZ * C.speed;
            rigid = true;
            if (e.t <= 0) this.enter(e, 'recover', C.recover, -5);
          } else if (e.t <= 0) e.state = 'move';
          break;
        }

        case 'exploder': {
          const F = e.def.fuse!;
          if (e.state === 'move') {
            wantX = nx * speed;
            wantZ = nz * speed;
            e.facing = Math.atan2(dx, dz);
            if (dist < F.range && ctx.targetAlive) this.enter(e, 'windup', F.time, -3, ctx);
          } else if (e.state === 'windup') {
            // Keeps creeping toward you while the fuse burns.
            wantX = nx * speed * 0.25;
            wantZ = nz * speed * 0.25;
            if (e.t <= 0) {
              ctx.detonate(e);
              continue;
            }
          }
          break;
        }

        case 'spawner': {
          const P = e.def.spawn!;
          if (e.state === 'move') {
            e.timerA -= dt;
            if (e.timerA <= 0) this.enter(e, 'windup', 0.7, -4, ctx);
          } else if (e.state === 'windup' && e.t <= 0) {
            for (let i = 0; i < P.count; i++) {
              const a = (i / P.count) * Math.PI * 2;
              ctx.spawnChild(P.into, e.x + Math.cos(a) * 1.6, e.z + Math.sin(a) * 1.6, e);
            }
            e.squash(8);
            e.timerA = P.interval;
            e.state = 'move';
          }
          break;
        }

        case 'boss':
          rigid = this.updateBoss(e, dt, ctx, nx, nz, dist, speed);
          wantX = e.vx;
          wantZ = e.vz;
          break;
      }

      // Separation from neighbours so crowds spread out instead of stacking.
      let sx = 0;
      let sz = 0;
      if (e.def.behavior !== 'boss') {
        const r = e.radius;
        ctx.hash.query(e.x, e.z, r * 2, (o) => {
          if (o === e || !o.alive) return;
          const ox = e.x - o.x;
          const oz = e.z - o.z;
          const d2 = ox * ox + oz * oz;
          const min = r + o.radius;
          if (d2 > 0.0001 && d2 < min * min) {
            const d = Math.sqrt(d2);
            const push = ((min - d) / min) * (o.def.behavior === 'boss' ? 3 : 1);
            sx += (ox / d) * push;
            sz += (oz / d) * push;
          }
        });
        const steer = rigid ? 1 : 1 - Math.exp(-10 * dt);
        e.vx += (wantX - e.vx) * steer;
        e.vz += (wantZ - e.vz) * steer;
      }

      const kd = Math.exp(-9 * dt);
      e.kx *= kd;
      e.kz *= kd;
      e.x += (e.vx + e.kx + sx * 7) * dt;
      e.z += (e.vz + e.kz + sz * 7) * dt;
      if (e.hopY <= 0 && resolveCircleVsBoxes(e, e.radius, ctx.colliders) && rigid && e.def.behavior === 'charger') {
        // Rhinos stop (and wobble) when they hit a wall mid-charge.
        this.enter(e, 'recover', e.def.charge!.recover, -7);
      }
    }
  }

  private enter(e: Enemy, s: EnemyState, t: number, squash: number, ctx?: EnemyCtx): void {
    e.state = s;
    e.t = t;
    e.squash(squash);
    if (s === 'attack') e.hitPlayer = false;
    if (s === 'windup' && ctx) ctx.onWindup(e);
  }

  private lockOn(e: Enemy, nx: number, nz: number, dx: number, dz: number): void {
    e.lungeX = nx;
    e.lungeZ = nz;
    e.facing = Math.atan2(dx, dz);
  }

  /** King Bopper: chases, then cycles ring bursts, summons and a jump slam. Returns true while airborne. */
  private updateBoss(e: Enemy, dt: number, ctx: EnemyCtx, nx: number, nz: number, dist: number, speed: number): boolean {
    const tgt = ctx.target;
    e.facing = Math.atan2(nx, nz);
    if (e.state === 'move') {
      e.vx = nx * speed;
      e.vz = nz * speed;
      e.timerA -= dt;
      if (e.timerA <= 0 && ctx.targetAlive) {
        // Slam when far away, otherwise rotate through the attacks.
        e.action = dist > 9 ? 'slam' : e.action === 'ring' ? (Math.random() < 0.5 ? 'summon' : 'slam') : 'ring';
        e.vx = e.vz = 0;
        if (e.action === 'slam') {
          e.targetX = tgt.x;
          e.targetZ = tgt.z;
          this.enter(e, 'windup', 1.0, -6, ctx);
        } else this.enter(e, 'windup', 0.7, -5, ctx);
      }
      return false;
    }
    if (e.state === 'windup') {
      e.vx = e.vz = 0;
      if (e.action === 'slam' && e.t > 0.45) {
        // Track the target a little during the wind-up, then commit.
        e.targetX += (tgt.x - e.targetX) * Math.min(1, dt * 3);
        e.targetZ += (tgt.z - e.targetZ) * Math.min(1, dt * 3);
      }
      if (e.t > 0) return false;
      if (e.action === 'ring') {
        const n = 18;
        const off = Math.random() * Math.PI;
        for (let i = 0; i < n; i++) {
          const a = off + (i / n) * Math.PI * 2;
          ctx.fireBullet(e, Math.cos(a), Math.sin(a), 7, 14);
        }
        for (let i = -2; i <= 2; i++) {
          const a = Math.atan2(nz, nx) + i * 0.12;
          ctx.fireBullet(e, Math.cos(a), Math.sin(a), 10, 14);
        }
        this.enter(e, 'recover', 0.8, 8);
      } else if (e.action === 'summon') {
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          ctx.spawnChild('swarmer', e.x + Math.cos(a) * 3, e.z + Math.sin(a) * 3, e);
        }
        this.enter(e, 'recover', 0.8, 8);
      } else {
        e.fromX = e.x;
        e.fromZ = e.z;
        this.enter(e, 'attack', 0.55, 10);
      }
      return false;
    }
    if (e.state === 'attack') {
      // Airborne: arc from start to the target point.
      const k = 1 - Math.max(0, e.t) / 0.55;
      e.x = e.fromX + (e.targetX - e.fromX) * k;
      e.z = e.fromZ + (e.targetZ - e.fromZ) * k;
      e.hopY = Math.sin(k * Math.PI) * 5;
      e.vx = e.vz = 0;
      if (e.t <= 0) {
        e.hopY = 0;
        ctx.slam(e);
        this.enter(e, 'recover', 1.0, -10);
      }
      return true;
    }
    // recover
    e.vx = e.vz = 0;
    if (e.t <= 0) {
      e.state = 'move';
      e.timerA = 2.2;
    }
    return false;
  }

  // ---------------------------------------------------------------- render

  /** Write every active enemy into its type's instanced mesh, plus ground decals. */
  render(alpha: number, time: number): void {
    for (const b of this.batches.values()) b.mesh.count = 0;
    const d = this.decals;
    d.shadows.count = d.markers.count = d.lines.count = d.zones.count = 0;
    d.setPulse(time);

    for (const e of this.list) {
      if (!e.active) continue;
      const x = e.px + (e.x - e.px) * alpha;
      const z = e.pz + (e.z - e.pz) * alpha;
      let sx = (1 - e.sq * 0.5) * e.scale;
      let sy = (1 + e.sq) * e.scale;
      let y = e.hopY;

      if (e.state === 'spawning') {
        const k = 1 - e.t / SPAWN_TIME;
        const ring = (1.6 - k * 0.6) * e.radius * 1.6;
        this.m4.makeScale(ring, 1, ring).setPosition(x, 0.03, z);
        d.markers.setMatrixAt(d.markers.count++, this.m4);
        const pop = Math.max(0, (k - 0.4) / 0.6);
        if (pop <= 0) continue;
        sx *= pop;
        sy *= pop * 1.3;
      } else if (e.state === 'move' && e.frozen <= 0 && e.def.speed > 0) {
        y += Math.abs(Math.sin(time * 12 + e.uid)) * 0.1 * e.scale;
      }

      // Telegraphs drawn on the ground.
      if (e.state === 'windup' && e.frozen <= 0) {
        if (e.def.behavior === 'charger') {
          const C = e.def.charge!;
          const len = C.speed * C.duration + 1;
          this.q.setFromAxisAngle(this.up, Math.atan2(e.lungeX, e.lungeZ));
          this.m4.compose(this.v.set(x, 0.04, z), this.q, this.s.set(e.radius * 1.6, 1, len));
          d.lines.setMatrixAt(d.lines.count++, this.m4);
        } else if (e.def.behavior === 'exploder') {
          const F = e.def.fuse!;
          const k = 1 - e.t / F.time;
          sx *= 1 + k * 0.35;
          sy *= 1 + k * 0.35;
          this.m4.makeScale(F.radius, 1, F.radius).setPosition(x, 0.05, z);
          d.zones.setMatrixAt(d.zones.count++, this.m4);
        }
      }
      if (e.def.behavior === 'boss' && e.action === 'slam' && (e.state === 'windup' || e.state === 'attack')) {
        this.m4.makeScale(3.8, 1, 3.8).setPosition(e.targetX, 0.05, e.targetZ);
        d.zones.setMatrixAt(d.zones.count++, this.m4);
      }

      const b = this.batches.get(e.def.id)!;
      if (b.mesh.count >= BATCH_CAP) continue;
      const i = b.mesh.count++;
      this.q.setFromAxisAngle(this.up, e.facing);
      this.m4.compose(this.v.set(x, y, z), this.q, this.s.set(sx, sy, sx));
      b.mesh.setMatrixAt(i, this.m4);

      // Flash priority: hit > frozen > telegraph > elite glow.
      if (e.flash > 0) b.flash.setXYZW(i, 1, 1, 1, 0.9);
      else if (e.frozen > 0) b.flash.setXYZW(i, 0.6, 0.95, 1, 0.6);
      else if (e.state === 'windup') {
        const fast = e.def.behavior === 'exploder' ? 70 : 40;
        b.flash.setXYZW(i, 1, 0.25, 0.3, 0.35 + 0.35 * Math.sin(time * fast));
      } else if (e.elite) b.flash.setXYZW(i, 1, 0.85, 0.2, 0.25 + 0.15 * Math.sin(time * 6));
      else b.flash.setXYZW(i, 0, 0, 0, 0);

      const ss = e.radius * 2.6 * Math.min(1, sx / e.scale) * (1 - Math.min(0.6, e.hopY * 0.1));
      this.m4.makeScale(ss, 1, ss).setPosition(x, 0.02, z);
      d.shadows.setMatrixAt(d.shadows.count++, this.m4);
    }

    for (const b of this.batches.values()) {
      commit(b.mesh.instanceMatrix, b.mesh.count);
      commit(b.flash, b.mesh.count);
    }
    for (const m of [d.shadows, d.markers, d.lines, d.zones]) commit(m.instanceMatrix, m.count);
  }
}
