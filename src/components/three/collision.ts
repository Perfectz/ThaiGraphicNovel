import * as THREE from 'three';

/**
 * Movement collision for the 3D adventure stages.
 *
 * Approach: every mesh in a stage opts in (or is auto-detected) as a collider
 * by sceneHelpers — this module turns those marks into axis-aligned XZ
 * rectangles and pushes the player's bounding circle out of any rectangle
 * it overlaps. Iterative push-out (up to 4 passes) handles being squeezed
 * between two surfaces; bounds clamp covers stages without explicit walls.
 *
 * Why XZ-projected AABBs and not full 3D physics:
 *   - Patrick walks on a flat floor (Y is fixed).
 *   - All authored geometry is axis-aligned or close enough that AABBs are
 *     conservative without being noticeably loose.
 *   - This adds zero runtime dependencies and stays O(N) per frame for
 *     small N (a few dozen colliders per room).
 */

export type ColliderRect = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export type ColliderBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

/** Default Patrick body radius. Tune in one place. */
export const PLAYER_COLLISION_RADIUS = 0.34;

/** Y range Patrick's body occupies — used to filter out ceiling decor. */
const COLLISION_Y_MIN = 0.05;
const COLLISION_Y_MAX = 1.9;

/** Walk every root tree, collect XZ rectangles for marked colliders.
 *  Reads two userData conventions:
 *    - `collider: true`                → use the mesh's world AABB
 *    - `collider: true, colliderRadius: r` → synthesize a 2r×2r AABB around the
 *      object's world position (used for asynchronously-loaded NPC groups
 *      that don't have geometry yet at collection time).
 */
export function collectColliders(roots: THREE.Object3D[]): ColliderRect[] {
  const out: ColliderRect[] = [];
  const tmpBox = new THREE.Box3();
  const tmpVec = new THREE.Vector3();

  for (const root of roots) {
    root.updateMatrixWorld(true);
    root.traverse((object) => {
      if (!object.userData?.collider) return;

      const radius = object.userData.colliderRadius as number | undefined;
      if (typeof radius === 'number') {
        // Synthetic AABB around the object's world position. Use the object
        // as-is regardless of whether children have loaded yet.
        object.getWorldPosition(tmpVec);
        out.push({
          minX: tmpVec.x - radius,
          maxX: tmpVec.x + radius,
          minZ: tmpVec.z - radius,
          maxZ: tmpVec.z + radius,
        });
        return;
      }

      // Geometry-derived AABB. Skip if no geometry resolved (empty group).
      tmpBox.makeEmpty();
      tmpBox.setFromObject(object);
      if (tmpBox.isEmpty()) return;
      // Skip if entirely above or below Patrick's body
      if (tmpBox.min.y > COLLISION_Y_MAX) return;
      if (tmpBox.max.y < COLLISION_Y_MIN) return;
      out.push({
        minX: tmpBox.min.x,
        maxX: tmpBox.max.x,
        minZ: tmpBox.min.z,
        maxZ: tmpBox.max.z,
      });
    });
  }
  return out;
}

/**
 * Push `pos` out of any overlapping collider rectangle. Mutates and returns
 * `pos`. Up to 4 passes — usually 1 is enough, more handles corner cases.
 *
 * If `bounds` is provided, the position is clamped to (bounds - radius) on
 * both axes first, so the player can't escape the floor plane.
 */
export function resolveCircleCollision(
  pos: THREE.Vector3,
  radius: number,
  rects: ColliderRect[],
  bounds?: ColliderBounds,
): THREE.Vector3 {
  if (bounds) {
    pos.x = Math.max(bounds.minX + radius, Math.min(bounds.maxX - radius, pos.x));
    pos.z = Math.max(bounds.minZ + radius, Math.min(bounds.maxZ - radius, pos.z));
  }

  for (let pass = 0; pass < 4; pass++) {
    let touched = false;
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      // Fast AABB-vs-AABB reject
      if (pos.x + radius < r.minX || pos.x - radius > r.maxX) continue;
      if (pos.z + radius < r.minZ || pos.z - radius > r.maxZ) continue;

      const closestX = Math.max(r.minX, Math.min(pos.x, r.maxX));
      const closestZ = Math.max(r.minZ, Math.min(pos.z, r.maxZ));
      const dx = pos.x - closestX;
      const dz = pos.z - closestZ;
      const d2 = dx * dx + dz * dz;
      if (d2 >= radius * radius) continue;

      const d = Math.sqrt(d2);
      if (d < 1e-5) {
        // Center is inside the rect (rare — typically only happens on teleport
        // into geometry). Push out toward the nearest edge.
        const left = pos.x - r.minX;
        const right = r.maxX - pos.x;
        const back = pos.z - r.minZ;
        const front = r.maxZ - pos.z;
        const min = Math.min(left, right, back, front);
        if (min === left) pos.x = r.minX - radius;
        else if (min === right) pos.x = r.maxX + radius;
        else if (min === back) pos.z = r.minZ - radius;
        else pos.z = r.maxZ + radius;
      } else {
        const push = radius - d;
        pos.x += (dx / d) * push;
        pos.z += (dz / d) * push;
      }
      touched = true;
    }
    if (!touched) break;
  }
  return pos;
}
