import { findPath, walkable, type Point } from './adventure.ts';
import { discoveryFor } from './discoveries.ts';

/** An initial follower offset can fall beyond a room edge; recover before path following. */
export function companionStart(player: Point, current: Point): Point {
  if (walkable(current)) return current;
  const candidates: Point[] = [];
  for (let x = -4; x <= 4; x++)
    for (let z = -4; z <= 4; z++) {
      const point = { x: Math.round(player.x * 2) / 2 + x / 2, z: Math.round(player.z * 2) / 2 + z / 2 };
      if (
        Math.hypot(point.x - player.x, point.z - player.z) >= 1.1 &&
        [
          [0, 0],
          [0.25, 0],
          [-0.25, 0],
          [0, 0.25],
          [0, -0.25],
        ].every(([dx, dz]) => walkable({ x: point.x + dx, z: point.z + dz }))
      )
        candidates.push(point);
    }
  candidates.sort(
    (a, b) => Math.hypot(a.x - current.x, a.z - current.z) - Math.hypot(b.x - current.x, b.z - current.z),
  );
  return (
    candidates.find((point) => {
      const path = findPath(player, point);
      return path.length > 0 && path.length < 15;
    }) ?? player
  );
}

/** Step out of a host's silhouette only when the player has approached too closely. */
export function playerConversationMark(start: Point, contact: Point, companion: Point): Point {
  const distance = Math.hypot(start.x - contact.x, start.z - contact.z);
  if (distance >= 1.15) return start;
  const candidates: { point: Point; score: number }[] = [];
  for (let x = -4; x <= 4; x++)
    for (let z = -4; z <= 4; z++) {
      const point = { x: Math.round(contact.x * 2) / 2 + x / 2, z: Math.round(contact.z * 2) / 2 + z / 2 };
      const separation = Math.hypot(point.x - contact.x, point.z - contact.z);
      if (
        separation < 1.35 ||
        separation > 1.8 ||
        Math.hypot(point.x - companion.x, point.z - companion.z) < 1.1
      )
        continue;
      if (
        ![
          [0, 0],
          [0.25, 0],
          [-0.25, 0],
          [0, 0.25],
          [0, -0.25],
        ].every(([dx, dz]) => walkable({ x: point.x + dx, z: point.z + dz }))
      )
        continue;
      const radial =
        distance > 0.05
          ? ((point.x - contact.x) * (start.x - contact.x) + (point.z - contact.z) * (start.z - contact.z)) /
            distance
          : 0;
      candidates.push({ point, score: Math.hypot(point.x - start.x, point.z - start.z) - radial * 0.25 });
    }
  for (const { point } of candidates.sort((a, b) => a.score - b.score)) {
    const path = findPath(start, point);
    if (path.length && path.length <= 10) return point;
  }
  return start;
}

export function conversationCamera(player: Point, contact: Point & { id?: string }) {
  // Read the fronts of the map/recipe boards while keeping the party beside them.
  if (contact.id && discoveryFor(contact.id)) return { x: 6, z: 11 };
  const length = Math.hypot(contact.x - player.x, contact.z - player.z);
  if (length < 0.2) return { x: 6, z: 11 };
  const x = (contact.z - player.z) / length,
    z = -(contact.x - player.x) / length;
  // View the ferryman toward the water; the reverse angle puts food counters in front of Su.
  const sign = x * (contact.id === 'ferry' ? -6 : 6) + z * 11 < 0 ? -1 : 1;
  return { x: x * sign * 12.5, z: z * sign * 12.5 };
}

/** Choose a reachable mark that separates all three silhouettes in the conversation camera. */
export function companionMark(player: Point, contact: Point & { id?: string }, start: Point): Point {
  const camera = conversationCamera(player, contact);
  const horizontal = { x: camera.z / 12.5, z: -camera.x / 12.5 };
  const candidates: { point: Point; score: number }[] = [];
  for (let x = -4; x <= 4; x++)
    for (let z = -4; z <= 4; z++) {
      const point = { x: Math.round(player.x * 2) / 2 + x / 2, z: Math.round(player.z * 2) / 2 + z / 2 };
      const distance = Math.hypot(point.x - player.x, point.z - player.z);
      if (
        distance < 1.15 ||
        distance > 2 ||
        !walkable(point) ||
        Math.hypot(point.x - contact.x, point.z - contact.z) < 1.1
      )
        continue;
      // Keep the body, not just its centre, away from walls and furniture.
      if (
        ![
          [0.25, 0],
          [-0.25, 0],
          [0, 0.25],
          [0, -0.25],
        ].every(([dx, dz]) => walkable({ x: point.x + dx, z: point.z + dz }))
      )
        continue;
      const separation = Math.min(
        ...[player, contact].map((p) =>
          Math.abs((point.x - p.x) * horizontal.x + (point.z - p.z) * horizontal.z),
        ),
      );
      candidates.push({
        point,
        score: separation - distance * 0.12 - Math.hypot(point.x - start.x, point.z - start.z) * 0.04,
      });
    }
  for (const { point } of candidates.sort((a, b) => b.score - a.score)) {
    const path = findPath(start, point);
    if (path.length && path.length < 15) return point;
    if (Math.hypot(start.x - point.x, start.z - point.z) < 0.1) return point;
  }
  return start;
}
