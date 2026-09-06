import test from 'node:test';
import assert from 'node:assert/strict';
import { atlasBounds, atlasRoute, atlasView } from '../src/bangkok/cityAtlas.ts';
import { cityAreas, hotelStart } from '../src/bangkok/city.ts';
import { followPath, walkable } from '../src/bangkok/adventure.ts';

test('chart routes from the hotel reach every district using real walkable streets', () => {
  for (const area of cityAreas) {
    const route = atlasRoute(hotelStart, area.center);
    assert.equal(route.status, 'ready', area.id);
    assert(route.points.every(walkable), area.id);
    const path = route.points.slice(1); let position = hotelStart;
    for (let i = 0; i < 10000 && path.length; i++) {
      position = followPath(position, path, .09); assert(walkable(position), area.id);
    }
    assert.equal(path.length, 0, area.id);
    assert(Math.hypot(position.x - route.end.x, position.z - route.end.z) < .001, area.id);
    const view = atlasView(area.id, false);
    assert(view.x < area.center.x && view.z < area.center.z);
    assert(view.x + view.w > area.center.x && view.z + view.d > area.center.z);
  }
});
test('water, furniture and walls reject destinations rather than silently moving them', () => {
  for (const p of [{ x: -23, z: 32 }, { x: 43, z: 35 }, { x: 5, z: -9 }, { x: -58, z: 32 }, { x: 67, z: 23 }]) {
    assert.equal(atlasRoute(hotelStart, p).status, 'blocked', JSON.stringify(p));
    assert.deepEqual(atlasRoute(hotelStart, p).points, []);
  }
  assert.equal(atlasRoute(hotelStart, hotelStart).status, 'arrived');
  assert.deepEqual(atlasRoute(hotelStart, { x: -55.12, z: 29.1 }).end, { x: -55, z: 29 });
  assert(atlasBounds.z <= -11.45, 'the pier is inside the overview');
});
