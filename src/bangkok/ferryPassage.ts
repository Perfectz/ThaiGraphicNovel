import { mooredBoatOrigin } from './RiverBoats.ts';

export const crossingDuration = 12;
export function crossingTime(elapsed: number, delta: number, hidden: boolean) {
  return hidden ? elapsed : Math.min(crossingDuration, elapsed + Math.max(0, Math.min(0.25, delta)));
}
export function crossingPose(progress: number) {
  const t = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const s = t * t * (3 - 2 * t);
  const turn = Math.min(1, t * 4);
  return {
    x: mooredBoatOrigin.x + 18 * s,
    y: mooredBoatOrigin.y,
    z: mooredBoatOrigin.z - 4 * s,
    yaw: Math.atan2(4, 18) * turn * turn * (3 - 2 * turn),
  };
}
