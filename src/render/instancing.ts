import type * as THREE from 'three';

/**
 * Mark only the first `count` instances of an attribute for upload. Without
 * an update range three.js re-uploads the whole buffer (sized for the pool's
 * capacity) every frame, which is the main cost with many big pools.
 */
export function commit(attr: THREE.BufferAttribute, count: number): void {
  attr.clearUpdateRanges();
  attr.addUpdateRange(0, Math.max(1, count) * attr.itemSize);
  attr.needsUpdate = true;
}
