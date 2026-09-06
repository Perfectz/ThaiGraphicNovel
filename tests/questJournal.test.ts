import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshAdventure, normalizeAdventure, objective, findPath, followPath, walkable } from '../src/bangkok/adventure.ts';
import { questJournal, trackQuest, trackedQuest } from '../src/bangkok/questJournal.ts';
import { beginJourney } from '../src/bangkok/cityJourneys.ts';
import { freshTraining } from '../src/bangkok/learning.ts';

test('hotel introduction reveals only the current story and tracking cannot skip prerequisites', () => {
  const s = freshAdventure();
  assert.deepEqual(questJournal(s).map(q => q.id), ['ferry']);
  assert.equal(trackQuest(s, 'escort'), s);
  assert.equal(objective(s).actor, 'su');
  s.flags = ['intro'];
  assert.equal(objective(s).actor, 'innkeeper');
});
test('tracking survives saves, changes the world objective and grants no rewards', () => {
  const s = freshAdventure(); s.flags = ['intro', 'innkeeper'];
  const next = trackQuest(s, 'routes');
  assert.deepEqual(next, { ...s, trackedQuest: 'routes' });
  const restored = normalizeAdventure(JSON.parse(JSON.stringify(next)));
  assert.equal(trackedQuest(restored).id, 'routes');
  assert.equal(objective(restored).actor, 'station');
  restored.flags.push('station');
  assert.equal(trackedQuest(restored).id, 'ferry');
  assert.equal(objective(restored).actor, 'cook');
  assert(questJournal(restored).find(q => q.id === 'routes')?.complete);
  assert.equal(normalizeAdventure({ ...s, trackedQuest: 'invalid' }).trackedQuest, undefined);
});
test('canal objectives reflect either collection order and never offer collected steps', () => {
  const s = freshAdventure(); s.flags = ['intro', 'innkeeper', 'canal-accepted']; s.trackedQuest = 'canal';
  assert.deepEqual(trackedQuest(s).destinations.map(d => d.actor), ['gardener', 'artisan']);
  s.flags.push('canal-frame');
  assert.deepEqual(trackedQuest(s).destinations.map(d => d.actor), ['gardener']);
  s.flags.push('canal-paper');
  assert.equal(objective(s).actor, 'canal-lantern');
  s.flags.push('canal-restored');
  assert.equal(trackedQuest(s).id, 'ferry');
});
test('escort targets actual Nok location then Dao and completed stories cannot be tracked', () => {
  const s = freshAdventure(); s.flags = ['intro', 'innkeeper']; s.trackedQuest = 'escort';
  assert.deepEqual(trackedQuest(s).destinations[0].point, s.escort.position);
  s.escort.stage = 'following';
  assert.equal(objective(s).actor, 'station');
  s.escort.stage = 'complete';
  assert.equal(trackedQuest(s).id, 'ferry');
  assert.equal(trackQuest(s, 'escort'), s);
});
test('active travel missions retain priority and can be paused before changing stories', () => {
  const s = freshAdventure(); s.flags = ['intro', 'innkeeper'];
  s.journeys = beginJourney(s.journeys, freshTraining(), '2026-09-04');
  assert.equal(trackQuest(s, 'canal'), s);
  const before = objective(s);
  assert.deepEqual(objective({ ...s, trackedQuest: 'escort' }), before);
  s.journeys.active!.paused = true;
  assert.equal(trackQuest(s, 'canal').trackedQuest, 'canal');
});
test('every journal destination is reachable continuously from the hotel', () => {
  const s = freshAdventure(); s.flags = ['intro', 'innkeeper', 'station', 'canal-accepted'];
  const stages = [freshAdventure(), { ...freshAdventure(), flags: ['intro'] }, s];
  for (const flag of ['cook', 'ferry', 'murmur', 'keeper', 'canal-paper', 'canal-frame'])
    stages.push({ ...stages.at(-1)!, flags: [...stages.at(-1)!.flags, flag] });
  stages.push({ ...s, escort: { ...s.escort, stage: 'following' } });
  for (const stage of stages) for (const quest of questJournal(stage)) for (const d of quest.destinations) {
    let p = { ...s.position }; const path = findPath(p, d.point);
    assert(path.length > 0, `${quest.id}/${d.actor} has a route`);
    for (let i = 0; path.length && i < 20000; i++) {
      p = followPath(p, path, 5 * .05);
      assert(walkable(p), `${quest.id}/${d.actor} stays walkable`);
    }
    assert(Math.hypot(p.x - d.point.x, p.z - d.point.z) < .8, `${quest.id}/${d.actor} arrives`);
  }
});
