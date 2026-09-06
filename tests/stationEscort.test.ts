import test from 'node:test';
import assert from 'node:assert/strict';
import { beginEscort, finishEscort, EscortFollower, escortDestination, normalizeEscort } from '../src/bangkok/stationEscort.ts';
import { freshAdventure, normalizeAdventure, findPath, followPath, walkable, transitTo } from '../src/bangkok/adventure.ts';

test('acceptance requires checking in and reaching Nok; repeated confirmation cannot restart the escort', () => {
  let s = freshAdventure(); assert.equal(beginEscort(s), s);
  s = { ...s, flags: ['intro', 'innkeeper'], position: { x: -19, z: 17.5 } };
  s = beginEscort(s); assert.equal(s.escort.stage, 'following'); assert.equal(beginEscort(s), s);
  assert.equal(finishEscort(s), s);
  s.flags.push('station'); s.visited.push('sukhumvit'); assert.equal(transitTo(s, 'sukhumvit'), s);
});
test('Nok follows the real park-to-station route without crossing obstacles and pauses with the game', () => {
  const follower = new EscortFollower();
  follower.sync({ stage: 'following', position: { x: -20, z: 18.2 } });
  let player = { x: -19, z: 17.5 }; const route = findPath(player, { x: -39.6, z: 16.8 });
  for (let i = 0; i < 500 && follower.state.stage !== 'arrived'; i++) {
    player = followPath(player, route, .4); follower.update(player, .1, false); assert(walkable(follower.state.position));
    if (i === 25) { const before = structuredClone(follower.state); for (let wait = 0; wait < 30; wait++) follower.update(player, .1, true); assert.deepEqual(follower.state, before); }
  }
  assert.equal(follower.state.stage, 'arrived');
  assert(Math.hypot(follower.state.position.x - escortDestination.x, follower.state.position.z - escortDestination.z) < 2.8);
  const save = { ...freshAdventure(), escort: follower.state }; assert.deepEqual(normalizeAdventure(save).escort, save.escort);
});
test('completion rewards only an arrived escort beside Dao, once, and preserves all other quest progress', () => {
  let s = { ...freshAdventure(), flags: ['intro', 'innkeeper', 'canal-accepted'], position: { x: -40, z: 17.5 }, escort: { stage: 'arrived' as const, position: { ...escortDestination } } };
  const next = finishEscort(s); assert.equal(next.xp, s.xp + 70); assert.equal(next.coins, s.coins + 20); assert.equal(next.tea, s.tea + 1);
  assert.deepEqual(next.flags, s.flags); assert.equal(next.escort.stage, 'complete'); assert.equal(finishEscort(next), next);
  s = { ...s, position: { x: -20, z: 18 } }; assert.equal(finishEscort(s), s);
});
test('old and malformed saves recover safely; stale movement checkpoints cannot roll back an arrival', () => {
  assert.equal(normalizeEscort(undefined).stage, 'waiting');
  assert.equal(normalizeEscort({ stage: 'following', position: { x: NaN, z: 0 } }).stage, 'waiting');
  assert.equal(normalizeEscort({ stage: 'arrived', position: { x: -20, z: 18.2 } }).stage, 'following');
  const f = new EscortFollower(); f.sync({ stage: 'arrived', position: { ...escortDestination } });
  f.sync({ stage: 'following', position: { x: -20, z: 18.2 } }); assert.equal(f.state.stage, 'arrived');
});
