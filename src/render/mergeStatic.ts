import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Bake every plain (non-instanced) mesh under `root` into one mesh per
 * material, with world transforms applied. Turns hundreds of static props
 * into a handful of draw calls. Only for scenery that never moves.
 */
export function mergeStatic(root: THREE.Group): void {
  root.updateMatrixWorld(true);
  const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const remove: THREE.Object3D[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || (m as unknown as THREE.InstancedMesh).isInstancedMesh || Array.isArray(m.material)) return;
    const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrixWorld);
    const list = byMat.get(m.material) ?? [];
    list.push(g);
    byMat.set(m.material, list);
    remove.push(m);
  });
  for (const o of remove) o.removeFromParent();
  // Children of removed meshes were merged too; drop now-empty groups.
  for (const [mat, geos] of byMat) {
    // Attributes must match to merge: keep only those every geometry has.
    const names = Object.keys(geos[0].attributes).filter((n) => geos.every((g) => g.getAttribute(n)));
    for (const g of geos) for (const n of Object.keys(g.attributes)) if (!names.includes(n)) g.deleteAttribute(n);
    const merged = mergeGeometries(geos);
    for (const g of geos) g.dispose();
    if (merged) root.add(new THREE.Mesh(merged, mat));
  }
}
