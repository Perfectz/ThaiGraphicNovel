export type CameraOffset = { x: number; y: number; z: number };
/** Screen-relative movement, retaining the original direction before the player changes the view. */
export function explorationDirection(x: number, z: number, view?: CameraOffset | null) {
  const length = Math.hypot(x, z);
  if (!length) return { x: 0, z: 0 };
  const a = Math.atan2(view?.x ?? 8, view?.z ?? 15);
  return {
    x: (x * Math.cos(a) + z * Math.sin(a)) / length,
    z: (-x * Math.sin(a) + z * Math.cos(a)) / length,
  };
}
