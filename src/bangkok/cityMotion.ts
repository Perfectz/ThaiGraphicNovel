import { foodStallOrigin } from './city.ts';
/** Ambient movement follows elapsed time; it never alters navigation or learning state. */
const ease = (n: number) => n * n * (3 - 2 * n);
export function trainPosition(seconds: number, reducedMotion = false): number {
  if (reducedMotion) return -43;
  const t = ((seconds % 40) + 40) % 40;
  if (t < 3) return -55;
  if (t < 20) return -55 + 18 * ease((t - 3) / 17);
  if (t < 23) return -37;
  return -37 - 18 * ease((t - 23) / 17);
}
export const cameraBlend = (seconds: number, reducedMotion = false) =>
  reducedMotion ? 1 : 1 - Math.exp(-Math.max(0, seconds) * 2.5);
export function steamPoint(seconds: number, index: number) {
  const phase = (((seconds * 0.24 + index / 12) % 1) + 1) % 1;
  return {
    x: foodStallOrigin.x - 1.52 + Math.sin(index * 2.4 + phase * 5) * phase * 0.12,
    y: 1.45 + phase * 0.75,
    z: foodStallOrigin.z - 0.09 + Math.cos(index * 3 + phase * 3) * phase * 0.1,
  };
}
