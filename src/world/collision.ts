/** Axis-aligned box on the XZ plane. Gameplay is 2D; Y is presentation only. */
export interface AABB {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export function aabbFromCenter(x: number, z: number, w: number, d: number): AABB {
  return { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 };
}

/**
 * Push a circle out of every overlapping box. Mutates `pos`.
 * Brute force for now; swap for the spatial hash once entity counts grow.
 */
export function resolveCircleVsBoxes(pos: { x: number; z: number }, r: number, boxes: AABB[]): boolean {
  let hit = false;
  for (let iter = 0; iter < 2; iter++) {
    for (const b of boxes) {
      const cx = Math.max(b.minX, Math.min(pos.x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      hit = true;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * r;
        pos.z = cz + (dz / d) * r;
      } else {
        // Centre inside the box: push out along the shallowest axis.
        const left = pos.x - b.minX;
        const right = b.maxX - pos.x;
        const top = pos.z - b.minZ;
        const bottom = b.maxZ - pos.z;
        const m = Math.min(left, right, top, bottom);
        if (m === left) pos.x = b.minX - r;
        else if (m === right) pos.x = b.maxX + r;
        else if (m === top) pos.z = b.minZ - r;
        else pos.z = b.maxZ + r;
      }
    }
  }
  return hit;
}

export function overlapsAny(box: AABB, boxes: AABB[], pad = 0): boolean {
  return boxes.some(
    (b) =>
      box.minX - pad < b.maxX && box.maxX + pad > b.minX && box.minZ - pad < b.maxZ && box.maxZ + pad > b.minZ,
  );
}
