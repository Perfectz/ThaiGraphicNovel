import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { freshAdventure, actors, moveAdventure, normalizeAdventure, findPath, followPath, walkable, startPracticeBattle, type AdventureSave } from '../src/bangkok/adventure.ts';
import { advanceEvening, eveningChoices, eveningHost, eveningMemory, eveningOrder, eveningReason, eveningRoute, eveningStep } from '../src/bangkok/eveningOuting.ts';
import { questJournal, trackedQuest } from '../src/bangkok/questJournal.ts';
import { beginJourney } from '../src/bangkok/cityJourneys.ts';
import { freshTraining } from '../src/bangkok/learning.ts';

function arrive(s: AdventureSave) { const a = actors.find(a => a.id === eveningHost(s))!; return moveAdventure(s, {x: a.x, z: a.z}); }
function start() { return arrive({...freshAdventure(), flags: ['intro', 'innkeeper'], coins: 0}); }

test('all four endings follow distinct choices, keep world progress, persist and reward once', () => {
  for (const [plan, order, expected] of [['like-thai-food','not-spicy','evening-mild'], ['like-thai-food','little-spicy','evening-chilli'], ['i-am-thirsty','water-please','evening-water'], ['i-am-thirsty','want-this','evening-tea']]) {
    const initial = start(); let s = advanceEvening(initial, 'plan', plan);
    assert.equal(s.position, initial.position, 'planning does not teleport');
    assert.equal(s.xp, initial.xp); assert.equal(s.coins, 0); assert.equal(s.rice, 1); assert.equal(s.tea, 1);
    assert.equal(advanceEvening(s, 'plan', plan), s, 'duplicate plan rejected');
    assert.equal(advanceEvening(s, 'order', order), s, 'cannot order remotely');
    s = arrive(s); const beforeOrder = s; s = advanceEvening(s, 'order', order);
    assert.equal(eveningOrder(s), expected); assert.equal(s.xp, beforeOrder.xp);
    assert.equal(advanceEvening(s, 'order', order), s, 'cannot replace a confirmed order');
    s = normalizeAdventure(JSON.parse(JSON.stringify(s)));
    assert.equal(eveningStep(s), 'finish'); assert.equal(eveningOrder(s), expected);
    for (const id of eveningChoices(s)) assert(existsSync(`public/bangkok/audio/${id}.mp3`));
    const before = s; s = advanceEvening(s, 'finish', eveningChoices(s)[0]);
    assert.equal(s.xp, before.xp + 60); assert.equal(s.rice, before.rice + (eveningRoute(s) === 'food' ? 2 : 0));
    assert.equal(s.tea, before.tea + (eveningRoute(s) === 'park' ? 2 : 0));
    assert.equal(s.coins, 0); assert.equal(s.hp, before.hp); assert.deepEqual(s.learned, []); assert.deepEqual(s.journeys, before.journeys);
    assert(questJournal(s).find(q => q.id === 'evening')?.complete); assert.equal(trackedQuest(s).id, 'ferry');
    assert.equal(advanceEvening(s, 'finish', 'thank-you'), s); assert.equal(advanceEvening(s, 'plan', plan), s);
    assert.deepEqual(normalizeAdventure(JSON.parse(JSON.stringify(s))), s);
    assert(eveningMemory(s).length > 70);
  }
});
test('prerequisites, active missions, combat, invalid and stale replies cannot change the outing', () => {
  const initial = start();
  const mission = {...initial, journeys: beginJourney(initial.journeys, freshTraining(), '2026-09-06')};
  for (const s of [freshAdventure(), startPracticeBattle(initial), mission]) {
    assert(eveningReason(s)); assert.equal(advanceEvening(s, 'plan', 'like-thai-food'), s);
  }
  assert.equal(advanceEvening(initial, 'finish', 'delicious'), initial);
  assert.equal(advanceEvening(initial, 'plan', 'invalid'), initial);
  mission.journeys.active!.paused = true; assert.equal(eveningReason(mission), null);
});
test('migration preserves valid flags in their original order and drops contradictory branches', () => {
  const initial = start(); assert.deepEqual(normalizeAdventure(initial), initial);
  const invalid = normalizeAdventure({...initial, flags: [...initial.flags, 'evening-food', 'cook', 'evening-park', 'evening-water', 'evening-complete']});
  assert.deepEqual(invalid.flags, ['intro','innkeeper','evening-food','cook']);
  const wrong = normalizeAdventure({...initial, flags: ['evening-park', 'evening-tea', 'evening-complete']}); assert.deepEqual(wrong.flags, []);
  const order = normalizeAdventure({...initial, flags: [...initial.flags, 'evening-food', 'cook', 'evening-chilli', 'station', 'evening-complete']});
  assert.deepEqual(normalizeAdventure(order), order);
});
test('both routes connect to the hotel on foot and every offered phrase has reference audio', () => {
  for (const plan of eveningChoices(start())) {
    let s = start();
    assert(existsSync(`public/bangkok/audio/${plan}.mp3`)); s = advanceEvening(s, 'plan', plan);
    const dest = questJournal(s).find(q => q.id === 'evening')!.destinations[0];
    assert.equal(dest.actor, eveningHost(s)); const path = findPath(s.position, dest.point); let p = s.position;
    assert(path.length > 0);
    for (let i = 0; path.length && i < 20000; i++) { p = followPath(p, path, .15); assert(walkable(p)); }
    assert.equal(path.length, 0); assert(Math.hypot(p.x-dest.point.x,p.z-dest.point.z) < .01);
    assert.equal(eveningReason({...s,position:p}), null);
    for (const id of eveningChoices(s)) assert(existsSync(`public/bangkok/audio/${id}.mp3`));
  }
});
