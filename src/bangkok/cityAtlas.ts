import { findPath, walkable, type Point } from './adventure.ts';
import { cityAreas, type CityArea } from './city.ts';

export const atlasBounds = { x: -65, z: -15, w: 158, d: 61 };
export function atlasView(area: CityArea, overview: boolean) {
  if (overview) return atlasBounds;
  const b = cityAreas.find((a) => a.id === area)!.bounds;
  return { x: b.x - 6, z: b.z - 6, w: b.w + 12, d: b.d + 12 };
}
/** Snap exactly as world navigation does; blocked clicks never silently move elsewhere. */
export function atlasRoute(start: Point, target: Point) {
  const end = { x: Math.round(target.x * 2) / 2, z: Math.round(target.z * 2) / 2 };
  if (!walkable(end)) return { end, points: [], status: 'blocked' as const };
  if (Math.hypot(start.x - end.x, start.z - end.z) < 0.4)
    return { end, points: [], status: 'arrived' as const };
  const path = findPath(start, end);
  return {
    end,
    points: path.length ? [start, ...path] : [],
    status: path.length ? ('ready' as const) : ('blocked' as const),
  };
}
