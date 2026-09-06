type XYZ = { x: number; y: number; z: number };
type Bounds = { min: XYZ; max: XYZ };

/** A finite camera-to-character sightline, not an infinite ray behind either endpoint. */
export function blocksCityView(bounds: Bounds, camera: XYZ, character: XYZ): boolean {
  let enter = 0;
  let leave = 1;
  for (const axis of ['x', 'y', 'z'] as const) {
    const delta = character[axis] - camera[axis];
    const min = bounds.min[axis] - 0.25;
    const max = bounds.max[axis] + 0.25;
    if (Math.abs(delta) < 1e-8) {
      if (camera[axis] < min || camera[axis] > max) return false;
      continue;
    }
    const a = (min - camera[axis]) / delta;
    const b = (max - camera[axis]) / delta;
    enter = Math.max(enter, Math.min(a, b));
    leave = Math.min(leave, Math.max(a, b));
    if (enter > leave) return false;
  }
  return leave >= 0 && enter <= 1;
}
