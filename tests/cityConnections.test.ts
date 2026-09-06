import test from 'node:test';
import assert from 'node:assert/strict';
import { cityAreas, cityRoads, cityBackdropBlocks, canalWalk, hotelStart } from '../src/bangkok/city.ts';
import { findPath, followPath, walkable } from '../src/bangkok/adventure.ts';

test('background lots do not cover a district or any traversable route', () => {
  for (const b of cityBackdropBlocks) for (const r of [...cityAreas.map(a => a.bounds), ...cityRoads]) {
    const overlaps = b.x < r.x + r.w && b.x + b.w > r.x && b.z < r.z + r.d && b.z + b.d > r.z;
    assert(!overlaps, `Scenery lot ${b.x},${b.z} overlaps reachable ground`);
  }
});

test('continuous travel completes the southern loop and returns to the main road', () => {
  for (const dt of [1 / 60, 0.035]) {
    let p = { ...hotelStart };
    for (const destination of [{ x: -44, z: 39 }, { x: -20, z: 39 }, { x: -20, z: 27 }, canalWalk, { x: 37, z: 38 }, { x: 37, z: 30 }, canalWalk, { x: -9, z: 13 }]) {
      const route = findPath(p, destination);
      assert(route.length, `Route to ${JSON.stringify(destination)}`);
      for (let tick = 0; tick < 20000 && route.length; tick++) {
        p = followPath(p, route, dt * 4.5);
        assert(walkable(p));
      }
      assert.equal(route.length, 0);
      assert.deepEqual(p, destination);
    }
    const southern = findPath({ x: -44, z: 39 }, { x: 37, z: 38 });
    assert(southern.every(p => p.z >= 37), 'The new southern route must not detour through the main road');
  }
});
