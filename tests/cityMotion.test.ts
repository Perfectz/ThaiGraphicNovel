import test from 'node:test';
import assert from 'node:assert/strict';
import { trainPosition, steamPoint, cameraBlend } from '../src/bangkok/cityMotion.ts';
import { foodStallOrigin } from '../src/bangkok/city.ts';
test('the complete train remains on its viaduct, with continuous turns and station dwell', () => {
  for (let t = -40; t <= 80; t += 0.05) {
    const x = trainPosition(t);
    assert(x - 4.12 >= -61 && x + 4.12 <= -31);
    assert(Math.abs(trainPosition(t + 0.001) - x) < 0.003);
  }
  for (const t of [0, 1, 2, 3]) assert.equal(trainPosition(t), -55);
  for (const t of [20, 21, 22, 23]) assert.equal(trainPosition(t), -37);
  assert.equal(trainPosition(0), trainPosition(40));
  for (const t of [0, 4, 18, 30, 80]) assert.equal(trainPosition(t, true), -43);
});
test('cooking steam rises above the stock pot at the shared cart origin', () => {
  for (let t = 0; t < 20; t += 0.1)
    for (let i = 0; i < 12; i++) {
      const p = steamPoint(t, i);
      assert(Math.abs(p.x - (foodStallOrigin.x - 1.52)) <= 0.12);
      assert(p.y >= 1.45 && p.y <= 2.2);
      assert(Math.abs(p.z - (foodStallOrigin.z - 0.09)) <= 0.1);
    }
});
test('camera convergence takes the same real time at different frame rates', () => {
  const remaining = (steps: number) =>
    Array.from({ length: steps }).reduce<number>((r) => r * (1 - cameraBlend(1 / steps)), 1);
  assert(Math.abs(remaining(60) - remaining(5)) < 1e-10);
  assert(Math.abs(cameraBlend(1) - (1 - Math.exp(-2.5))) < 1e-10);
  assert.equal(cameraBlend(0.01, true), 1);
  assert.equal(cameraBlend(-1), 0);
});
