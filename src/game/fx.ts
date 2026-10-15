import * as THREE from 'three';
import { commit } from '../render/instancing';

/**
 * Comic impact effects drawn with additive blending:
 *  - stars: camera-facing "POW" bursts at hit points
 *  - rings: flat shockwaves on the ground (kills, explosions, bomb)
 * Each kind is one InstancedMesh. Fading = scaling colour toward black,
 * which is invisible under additive blending.
 */
const MAX = 160;

interface FxPool {
  mesh: THREE.InstancedMesh;
  x: Float32Array;
  y: Float32Array;
  z: Float32Array;
  t: Float32Array;
  life: Float32Array;
  size: Float32Array;
  grow: Float32Array; // ring: end size multiplier
  rot: Float32Array;
  colors: THREE.Color[];
  count: number;
}

function starGeometry(points: number, inner: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  for (let i = 0; i <= points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 === 0 ? 0.5 : 0.5 * inner;
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return new THREE.ShapeGeometry(shape);
}

function makePool(scene: THREE.Scene, geo: THREE.BufferGeometry): FxPool {
  const mat = new THREE.MeshBasicMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, MAX);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  const colors: THREE.Color[] = [];
  for (let i = 0; i < MAX; i++) {
    colors.push(new THREE.Color());
    mesh.setColorAt(i, colors[i]);
  }
  mesh.count = 0;
  scene.add(mesh);
  const f = () => new Float32Array(MAX);
  return { mesh, x: f(), y: f(), z: f(), t: f(), life: f(), size: f(), grow: f(), rot: f(), colors, count: 0 };
}

export class Fx {
  private stars: FxPool;
  private rings: FxPool;
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private qz = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private s = new THREE.Vector3();
  private zAxis = new THREE.Vector3(0, 0, 1);
  private c = new THREE.Color();

  constructor(scene: THREE.Scene) {
    this.stars = makePool(scene, starGeometry(5, 0.42));
    this.rings = makePool(scene, new THREE.RingGeometry(0.42, 0.5, 24).rotateX(-Math.PI / 2));
  }

  private add(p: FxPool, x: number, y: number, z: number, size: number, life: number, color: THREE.ColorRepresentation, grow = 1) {
    if (p.count >= MAX) return;
    const i = p.count++;
    p.x[i] = x;
    p.y[i] = y;
    p.z[i] = z;
    p.t[i] = 0;
    p.life[i] = life;
    p.size[i] = size;
    p.grow[i] = grow;
    p.rot[i] = Math.random() * Math.PI;
    p.colors[i].set(color);
  }

  /** Camera-facing comic star burst. */
  star(x: number, y: number, z: number, size: number, color: THREE.ColorRepresentation = '#ffffff', life = 0.12) {
    this.add(this.stars, x, y, z, size, life, color);
  }

  /** Expanding ground shockwave from `size` to `size * grow`. */
  ring(x: number, z: number, size: number, grow: number, color: THREE.ColorRepresentation, life = 0.3) {
    this.add(this.rings, x, 0.06, z, size, life, color, grow);
  }

  clear(): void {
    this.stars.count = this.rings.count = 0;
  }

  update(dt: number): void {
    for (const p of [this.stars, this.rings]) {
      for (let i = 0; i < p.count; i++) {
        p.t[i] += dt;
        if (p.t[i] < p.life[i]) continue;
        const j = --p.count;
        p.x[i] = p.x[j];
        p.y[i] = p.y[j];
        p.z[i] = p.z[j];
        p.t[i] = p.t[j];
        p.life[i] = p.life[j];
        p.size[i] = p.size[j];
        p.grow[i] = p.grow[j];
        p.rot[i] = p.rot[j];
        p.colors[i].copy(p.colors[j]);
        i--;
      }
    }
  }

  render(camera: THREE.Camera): void {
    // Stars: pop to full size fast, then shrink while fading.
    const st = this.stars;
    for (let i = 0; i < st.count; i++) {
      const k = st.t[i] / st.life[i];
      const sc = st.size[i] * (k < 0.25 ? 0.5 + k * 3 : 1.25 - (k - 0.25) * 0.6);
      this.qz.setFromAxisAngle(this.zAxis, st.rot[i] + k * 0.6);
      this.q.copy(camera.quaternion).multiply(this.qz);
      this.m4.compose(this.v.set(st.x[i], st.y[i], st.z[i]), this.q, this.s.set(sc, sc, sc));
      st.mesh.setMatrixAt(i, this.m4);
      st.mesh.setColorAt(i, this.c.copy(st.colors[i]).multiplyScalar(1 - k * k));
    }
    // Rings: ease-out expansion.
    const rg = this.rings;
    for (let i = 0; i < rg.count; i++) {
      const k = rg.t[i] / rg.life[i];
      const e = 1 - (1 - k) * (1 - k);
      const sc = rg.size[i] * (1 + (rg.grow[i] - 1) * e);
      this.m4.makeScale(sc, 1, sc).setPosition(rg.x[i], rg.y[i], rg.z[i]);
      rg.mesh.setMatrixAt(i, this.m4);
      rg.mesh.setColorAt(i, this.c.copy(rg.colors[i]).multiplyScalar(1 - k));
    }
    for (const p of [st, rg]) {
      p.mesh.count = p.count;
      commit(p.mesh.instanceMatrix, p.mesh.count);
      if (p.mesh.instanceColor) commit(p.mesh.instanceColor, p.mesh.count);
    }
  }
}
