import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Rng } from '../core/rng';
import { createRetroMaterial } from '../render/retroMaterial';
import { textures } from '../render/textures';
import { paint, tiledBox } from '../render/geometry';
import { mergeStatic } from '../render/mergeStatic';
import { aabbFromCenter, overlapsAny, type AABB } from './collision';

/**
 * Big, open island field for survival stages. Mostly open grass for kiting,
 * with sparse clusters of cover (ruins, crates, trees) and winding dirt
 * paths. Seeded, so the same run seed rebuilds the same stage.
 */
export interface Arena {
  group: THREE.Group;
  colliders: AABB[];
  halfSize: number;
}

const HALF = 55;
const TILE = 2;
const CLEAR_CENTER = 9;

export function createFieldArena(seed: number): Arena {
  const rng = new Rng(seed);
  const group = new THREE.Group();
  const colliders: AABB[] = [];
  const tex = {
    grass: textures.grass(),
    path: textures.path(),
    sand: textures.sand(),
    brick: textures.brick(),
    crate: textures.crate(),
    water: textures.water(),
    leaves: textures.leaves(),
  };

  // --- Winding dirt paths: a few random walks painted onto the tile grid ---
  const n = (HALF * 2) / TILE;
  const isPath = new Uint8Array(n * n);
  for (let w = 0; w < 5; w++) {
    let cx = rng.int(0, n - 1);
    let cz = rng.int(0, n - 1);
    let dir = rng.next() * Math.PI * 2;
    for (let s = 0; s < 70; s++) {
      for (let ox = -1; ox <= 0; ox++)
        for (let oz = -1; oz <= 0; oz++) {
          const tx = cx + ox;
          const tz = cz + oz;
          if (tx >= 0 && tz >= 0 && tx < n && tz < n) isPath[tz * n + tx] = 1;
        }
      dir += rng.range(-0.5, 0.5);
      cx = Math.max(0, Math.min(n - 1, Math.round(cx + Math.cos(dir))));
      cz = Math.max(0, Math.min(n - 1, Math.round(cz + Math.sin(dir))));
    }
  }
  // Central plaza
  for (let tz = 0; tz < n; tz++)
    for (let tx = 0; tx < n; tx++) {
      const x = -HALF + tx * TILE + TILE / 2;
      const z = -HALF + tz * TILE + TILE / 2;
      if (Math.hypot(x, z) < 5) isPath[tz * n + tx] = 1;
    }

  const grassTiles: THREE.BufferGeometry[] = [];
  const pathTiles: THREE.BufferGeometry[] = [];
  for (let tz = 0; tz < n; tz++) {
    for (let tx = 0; tx < n; tx++) {
      const g = new THREE.PlaneGeometry(TILE, TILE);
      g.rotateX(-Math.PI / 2);
      g.translate(-HALF + tx * TILE + TILE / 2, 0, -HALF + tz * TILE + TILE / 2);
      const v = ((tx + tz) % 2 === 0 ? 1 : 0.94) * rng.range(0.96, 1.04);
      paint(g, new THREE.Color(v, v, v));
      (isPath[tz * n + tx] ? pathTiles : grassTiles).push(g);
    }
  }
  group.add(
    new THREE.Mesh(mergeGeometries(grassTiles), createRetroMaterial({ map: tex.grass, vertexColors: true })),
    new THREE.Mesh(mergeGeometries(pathTiles), createRetroMaterial({ map: tex.path, vertexColors: true })),
  );

  // --- Island base and sea ---
  const base = new THREE.Mesh(tiledBox(HALF * 2 + 4, 1.4, HALF * 2 + 4, 2), createRetroMaterial({ map: tex.sand }));
  base.position.y = -0.72;
  group.add(base);
  const seaGeo = new THREE.PlaneGeometry(400, 400, 20, 20);
  seaGeo.rotateX(-Math.PI / 2);
  const seaUv = seaGeo.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < seaUv.count; i++) seaUv.setXY(i, seaUv.getX(i) * 100, seaUv.getY(i) * 100);
  const sea = new THREE.Mesh(seaGeo, createRetroMaterial({ map: tex.water, uvScroll: [0.05, 0.03], unlit: 0.35 }));
  sea.position.y = -0.4;
  group.add(sea);

  // Invisible boundary walls just inside the hedge line
  const T = 2;
  const B = HALF - 1;
  colliders.push(
    aabbFromCenter(0, -B - T / 2, B * 2 + 2 * T, T),
    aabbFromCenter(0, B + T / 2, B * 2 + 2 * T, T),
    aabbFromCenter(-B - T / 2, 0, T, B * 2),
    aabbFromCenter(B + T / 2, 0, T, B * 2),
  );

  // --- Hedge ring (instanced) ---
  const hedge: [number, number][] = [];
  for (let t = -HALF; t <= HALF; t += 1.6) hedge.push([t, -HALF], [t, HALF], [-HALF, t], [HALF, t]);
  const bushes = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.9, 0), createRetroMaterial({ map: tex.leaves }), hedge.length);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const greens = ['#4fd36a', '#3fbf5a', '#6ee07a', '#38b06a'].map((c) => new THREE.Color(c));
  hedge.forEach(([x, z], i) => {
    const s = rng.range(0.8, 1.25);
    q.setFromEuler(e.set(0, rng.range(0, Math.PI), 0));
    m4.compose(new THREE.Vector3(x, 0.4 * s, z), q, new THREE.Vector3(s, s * 0.85, s));
    bushes.setMatrixAt(i, m4);
    bushes.setColorAt(i, rng.pick(greens));
  });
  group.add(bushes);

  // --- Sparse cover clusters ---
  const placed: AABB[] = [];
  const lim = HALF - 5;
  const spot = (w: number, d: number, margin: number, cx?: number, cz?: number, spread = 0): [number, number] | null => {
    for (let attempt = 0; attempt < 30; attempt++) {
      const x = cx !== undefined ? cx + rng.range(-spread, spread) : rng.range(-lim, lim);
      const z = cz !== undefined ? cz + rng.range(-spread, spread) : rng.range(-lim, lim);
      if (Math.abs(x) > lim || Math.abs(z) > lim || Math.hypot(x, z) < CLEAR_CENTER) continue;
      const box = aabbFromCenter(x, z, w, d);
      if (overlapsAny(box, placed, margin)) continue;
      placed.push(box);
      return [x, z];
    }
    return null;
  };
  const solid = (mesh: THREE.Object3D, x: number, z: number, w: number, d: number) => {
    group.add(mesh);
    colliders.push(aabbFromCenter(x, z, w, d));
  };

  const brickMat = createRetroMaterial({ map: tex.brick });
  const capMat = createRetroMaterial({ color: '#fff4c9' });
  const pillarMat = createRetroMaterial({ map: tex.brick, color: '#ffd6f0' });
  const crateMat = createRetroMaterial({ map: tex.crate });
  const crateGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
  const trunkMat = createRetroMaterial({ color: '#a86a3c' });
  const leafMat = createRetroMaterial({ map: tex.leaves });
  const barrelGeo = mergeGeometries([
    paint(new THREE.CylinderGeometry(0.45, 0.45, 1.1, 8), '#ff4d5e'),
    paint(new THREE.CylinderGeometry(0.47, 0.47, 0.18, 8), '#ffd23f').translate(0, 0.28, 0),
    paint(new THREE.CylinderGeometry(0.47, 0.47, 0.18, 8), '#ffd23f').translate(0, -0.28, 0),
  ]);
  const barrelMat = createRetroMaterial({ vertexColors: true });

  const ruin = (cx: number, cz: number) => {
    // An L or U of short walls plus a pillar or two.
    const parts = rng.int(2, 3);
    for (let i = 0; i < parts; i++) {
      const long = rng.int(3, 5);
      const horiz = rng.chance(0.5);
      const w = horiz ? long : 1;
      const d = horiz ? 1 : long;
      const h = rng.pick([1.2, 1.6, 2.2]);
      const p = spot(w, d, 0.6, cx, cz, 4);
      if (!p) continue;
      const wall = new THREE.Mesh(tiledBox(w, h, d, 2), brickMat);
      wall.position.set(p[0], h / 2, p[1]);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.2, d + 0.2), capMat);
      cap.position.y = h / 2 + 0.1;
      wall.add(cap);
      solid(wall, p[0], p[1], w, d);
    }
    if (rng.chance(0.6)) {
      const p = spot(1.4, 1.4, 1, cx, cz, 5);
      if (p) {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 3, 8), pillarMat);
        pillar.position.set(p[0], 1.5, p[1]);
        const top = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.3, 1.6), capMat);
        top.position.y = 1.65;
        pillar.add(top);
        solid(pillar, p[0], p[1], 1.2, 1.2);
      }
    }
  };
  const crates = (cx: number, cz: number) => {
    for (let i = rng.int(2, 4); i > 0; i--) {
      const p = spot(1.2, 1.2, 0.1, cx, cz, 2);
      if (!p) continue;
      const c = new THREE.Mesh(crateGeo, crateMat);
      c.position.set(p[0], 0.6, p[1]);
      c.rotation.y = rng.pick([0, 0.15, -0.1]);
      if (rng.chance(0.3)) {
        const top = new THREE.Mesh(crateGeo, crateMat);
        top.position.y = 1.2;
        top.rotation.y = rng.range(-0.4, 0.4);
        c.add(top);
      }
      solid(c, p[0], p[1], 1.2, 1.2);
    }
    for (let i = rng.int(0, 2); i > 0; i--) {
      const p = spot(0.9, 0.9, 0.2, cx, cz, 2.5);
      if (!p) continue;
      const b = new THREE.Mesh(barrelGeo, barrelMat);
      b.position.set(p[0], 0.55, p[1]);
      solid(b, p[0], p[1], 0.9, 0.9);
    }
  };
  const grove = (cx: number, cz: number) => {
    for (let i = rng.int(2, 5); i > 0; i--) {
      const p = spot(0.8, 0.8, 1.6, cx, cz, 4);
      if (!p) continue;
      const tree = new THREE.Group();
      tree.position.set(p[0], 0, p[1]);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 1.6, 6), trunkMat);
      trunk.position.y = 0.8;
      tree.add(trunk);
      const s = rng.range(1.0, 1.5);
      const canopy = new THREE.Mesh(new THREE.IcosahedronGeometry(1.3 * s, 0), leafMat);
      canopy.position.y = 2.2 + 0.4 * s;
      canopy.rotation.y = rng.range(0, Math.PI);
      tree.add(canopy);
      const canopy2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85 * s, 0), leafMat);
      canopy2.position.y = 3.3 + 0.5 * s;
      tree.add(canopy2);
      solid(tree, p[0], p[1], 0.8, 0.8);
    }
  };

  // Cluster centres spread out over the field.
  for (let i = 0; i < 26; i++) {
    const cx = rng.range(-lim, lim);
    const cz = rng.range(-lim, lim);
    if (Math.hypot(cx, cz) < CLEAR_CENTER + 3) continue;
    const kind = rng.next();
    if (kind < 0.35) ruin(cx, cz);
    else if (kind < 0.65) crates(cx, cz);
    else grove(cx, cz);
  }

  // Hundreds of props -> one draw call per material.
  mergeStatic(group);
  return { group, colliders, halfSize: HALF };
}
