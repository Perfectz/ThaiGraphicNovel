import test from 'node:test';
import assert from 'node:assert/strict';
import { oldTownWalls, cityWalkable, recoverOldTownPosition, inside } from '../src/bangkok/city.ts';
import { findPath, followPath, stepPlayer, freshAdventure, normalizeAdventure } from '../src/bangkok/adventure.ts';

test('court walls stop movement while the west and south entrances remain open', () => {
  for (const wall of oldTownWalls) assert(!cityWalkable({ x: wall.x + wall.w / 2, z: wall.z + wall.d / 2 }));
  let p = { x: 30, z: 39 };
  for (let i = 0; i < 20; i++) p = stepPlayer(p, 0, .1);
  assert(p.z < 39.5, 'Walking cannot cross the south wall');
  assert(cityWalkable({ x: 24, z: 37.5 }), 'West opening');
  assert(cityWalkable({ x: 37, z: 39.5 }), 'South opening');
  assert(cityWalkable({ x: 43, z: 39 }), 'The hall has a usable rear path');
});
test('the canal-to-workshop loop and rear path work through real continuous movement', () => {
  for (const distance of [.075, .225]) {
    let p = { x: 20, z: 39 };
    for (const target of [{ x: 26, z: 37 }, { x: 29, z: 29 }, { x: 43, z: 39 }, { x: 37, z: 40.5 }, { x: 20, z: 39 }]) {
      const route = findPath(p, target); assert(route.length);
      for (let tick = 0; route.length && tick < 10000; tick++) {
        p = followPath(p, route, distance); assert(cityWalkable(p));
      }
      assert.deepEqual(p, target);
    }
  }
});
test('saves on newly solid walls recover nearby without losing quest or party progress', () => {
  for (const position of [{ x: 24.2, z: 30 }, { x: 48.8, z: 30 }, { x: 28, z: 39.7 }]) {
    assert(oldTownWalls.some(r => inside(position, r)));
    const s = { ...freshAdventure(), position, flags: ['intro', 'innkeeper', 'artisan'], xp: 160, coins: 81, trackedQuest: 'canal' as const };
    s.escort = { stage: 'following', position: { ...position } };
    const next = normalizeAdventure(s);
    assert(cityWalkable(next.position));
    assert(Math.hypot(next.position.x - position.x, next.position.z - position.z) < 1.5);
    assert.deepEqual(next.flags, s.flags); assert.equal(next.xp, 160); assert.equal(next.coins, 81);
    assert.equal(next.trackedQuest, 'canal'); assert(next.visited.includes('oldtown'));
    assert.equal(next.escort.stage, 'following'); assert(cityWalkable(next.escort.position));
    assert(Math.hypot(next.escort.position.x - position.x, next.escort.position.z - position.z) < 1.5);
  }
  assert.equal(recoverOldTownPosition({ x: Infinity, z: 30 }), null);
  assert.equal(recoverOldTownPosition({ x: 37, z: 30 }), null);
});
