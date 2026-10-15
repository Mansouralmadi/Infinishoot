import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { paint } from '../render/geometry';
import { commit } from '../render/instancing';
import { createRetroMaterial } from '../render/retroMaterial';

const MAX = 24;
export const CHEST_OPEN_RANGE = 1.4;

export interface WorldChest {
  x: number;
  z: number;
  /** Seconds since it was opened (-1 = still closed). */
  openT: number;
  facing: number;
}

/**
 * Treasure chests placed around each stage. Walk into one to pop it open:
 * it gives an item on the spot (no menu), then stays open as a marker.
 */
export class Chests {
  list: WorldChest[] = [];
  private base: THREE.InstancedMesh;
  private lid: THREE.InstancedMesh;
  private m4 = new THREE.Matrix4();
  private hinge = new THREE.Matrix4();
  private lidM = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private s = new THREE.Vector3(1, 1, 1);
  private up = new THREE.Vector3(0, 1, 0);

  constructor(scene: THREE.Scene) {
    const wood = '#b8653a';
    const trim = '#ffd23f';
    const baseGeo = mergeGeometries([
      paint(new THREE.BoxGeometry(1.0, 0.5, 0.66), wood).translate(0, 0.25, 0),
      paint(new THREE.BoxGeometry(1.04, 0.1, 0.7), trim).translate(0, 0.08, 0),
      paint(new THREE.BoxGeometry(0.12, 0.52, 0.7), trim).translate(-0.3, 0.26, 0),
      paint(new THREE.BoxGeometry(0.12, 0.52, 0.7), trim).translate(0.3, 0.26, 0),
    ]);
    // Lid is built with its hinge (back edge) at the origin so it can swing open.
    const lidGeo = mergeGeometries([
      paint(new THREE.BoxGeometry(1.02, 0.26, 0.68), wood).translate(0, 0.13, 0.34),
      paint(new THREE.BoxGeometry(0.12, 0.28, 0.7), trim).translate(-0.3, 0.14, 0.34),
      paint(new THREE.BoxGeometry(0.12, 0.28, 0.7), trim).translate(0.3, 0.14, 0.34),
      paint(new THREE.BoxGeometry(0.2, 0.2, 0.08), trim).translate(0, 0.02, 0.7),
    ]);
    const mat = createRetroMaterial({ vertexColors: true });
    this.base = new THREE.InstancedMesh(baseGeo, mat, MAX);
    this.lid = new THREE.InstancedMesh(lidGeo, mat, MAX);
    for (const m of [this.base, this.lid]) {
      m.frustumCulled = false;
      m.count = 0;
      scene.add(m);
    }
  }

  load(spots: { x: number; z: number; facing: number }[]): void {
    this.list = spots.slice(0, MAX).map((c) => ({ x: c.x, z: c.z, openT: -1, facing: c.facing }));
  }

  /** Index of the closest closed chest within range of (x, z), or -1. */
  touching(x: number, z: number, r = CHEST_OPEN_RANGE): number {
    let best = -1;
    let bd = r * r;
    this.list.forEach((c, i) => {
      if (c.openT >= 0) return;
      const d = (c.x - x) ** 2 + (c.z - z) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  }

  open(i: number): WorldChest | null {
    const c = this.list[i];
    if (!c || c.openT >= 0) return null;
    c.openT = 0;
    return c;
  }

  get closedCount(): number {
    return this.list.filter((c) => c.openT < 0).length;
  }

  render(dt: number, time: number): void {
    let n = 0;
    for (const c of this.list) {
      if (c.openT >= 0) c.openT += dt;
      // Closed chests bob a little to catch the eye; the lid snaps open with a bounce.
      const bob = c.openT < 0 ? Math.abs(Math.sin(time * 3 + c.x)) * 0.06 : 0;
      const k = c.openT < 0 ? 0 : Math.min(1, c.openT / 0.18);
      const swing = k * 1.9 - (k >= 1 ? Math.sin(Math.min(1, (c.openT - 0.18) / 0.3) * Math.PI) * 0.25 : 0);
      this.q.setFromAxisAngle(this.up, c.facing);
      this.m4.compose(this.v.set(c.x, bob, c.z), this.q, this.s);
      this.base.setMatrixAt(n, this.m4);
      // Lid: hinge at the back top edge, rotate about X.
      this.hinge.makeRotationX(-swing).setPosition(0, 0.5, -0.34);
      this.lid.setMatrixAt(n, this.lidM.multiplyMatrices(this.m4, this.hinge));
      n++;
    }
    this.base.count = this.lid.count = n;
    commit(this.base.instanceMatrix, n);
    commit(this.lid.instanceMatrix, n);
  }
}
