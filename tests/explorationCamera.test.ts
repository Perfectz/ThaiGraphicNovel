import test from 'node:test';
import assert from 'node:assert/strict';
import { explorationDirection } from '../src/bangkok/explorationCamera.ts';

test('movement follows the viewed direction without diagonal speed gains', () => {
  for (const view of [
    { x: 8, y: 12, z: 15 },
    { x: 15, y: 8, z: 0 },
    { x: 0, y: 10, z: -15 },
    { x: -15, y: 5, z: 0 },
  ]) {
    const forward = explorationDirection(0, -1, view),
      right = explorationDirection(1, 0, view);
    assert(forward.x * view.x + forward.z * view.z < -1);
    assert(Math.abs(forward.x * right.x + forward.z * right.z) < 1e-9);
    assert(Math.abs(Math.hypot(...Object.values(explorationDirection(1, -1, view))) - 1) < 1e-9);
  }
  assert.deepEqual(explorationDirection(0, 0), { x: 0, z: 0 });
  assert.deepEqual(explorationDirection(0, -1), explorationDirection(0, -1, { x: 8, y: 12, z: 15 }));
});
