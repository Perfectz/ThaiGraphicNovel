import test from 'node:test';
import assert from 'node:assert/strict';
import { residentRoutes, ResidentWalk } from '../src/bangkok/cityResidentRoutes.ts';
import { actors, walkable, findPath } from '../src/bangkok/adventure.ts';

test('six resident loops remain on clear ground and outside named conversation positions', () => {
  assert.equal(residentRoutes.length, 6);
  for (const route of residentRoutes) {
    const walker = new ResidentWalk(route), visited = new Set<number>();
    for (let i = 0; i < 2500; i++) {
      walker.update(.1, false, []);
      assert(walkable(walker.position), `${route.id} left the map`);
      for (const [dx, dz] of [[.25, 0], [-.25, 0], [0, .25], [0, -.25]])
        assert(walkable({ x: walker.position.x + dx, z: walker.position.z + dz }), `${route.id} body clips solid ground`);
      for (const actor of actors.filter(a => ['station', 'cook', 'gardener', 'artisan'].includes(a.id)))
        assert(Math.hypot(actor.x - walker.position.x, actor.z - walker.position.z) > 2.5, `${route.id} intrudes on ${actor.id}`);
      route.stops.forEach((p, index) => { if (Math.hypot(p.x - walker.position.x, p.z - walker.position.z) < .1) visited.add(index); });
    }
    assert.equal(visited.size, route.stops.length, `${route.id} cannot complete its loop`);
    assert(findPath(route.stops[0], route.stops[1]).length);
  }
});
test('residents yield without consuming their route, then resume when the party clears', () => {
  const walker = new ResidentWalk(residentRoutes[0]);
  const start = { ...walker.position };
  for (let i = 0; i < 80; i++) walker.update(.1, false, [{ x: start.x + .5, z: start.z }]);
  assert.deepEqual(walker.position, start); assert.equal(walker.moving, false);
  for (let i = 0; i < 30; i++) walker.update(.1, false, []);
  assert(walker.position.x > start.x + 2);
});
test('menu, distant and reduced-motion pauses freeze route progress without catch-up movement', () => {
  const walker = new ResidentWalk(residentRoutes[3]);
  for (let i = 0; i < 30; i++) walker.update(.1, false, []);
  const before = { ...walker.position };
  for (let i = 0; i < 100; i++) walker.update(10, true, []);
  assert.deepEqual(walker.position, before); assert.equal(walker.moving, false);
  walker.update(100, false, []);
  assert(Math.hypot(walker.position.x - before.x, walker.position.z - before.z) <= .086);
});
