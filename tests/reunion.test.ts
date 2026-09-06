import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import {
  freshAdventure,
  moveAdventure,
  normalizeAdventure,
  findPath,
  followPath,
  walkable,
  startPracticeBattle,
  type AdventureSave,
  type ActorId,
} from '../src/bangkok/adventure.ts';
import {
  advanceReunion,
  reunionChoices,
  reunionDestinations,
  reunionReason,
  reunionRoute,
  reunionStatus,
  reunionStep,
  reunionVenue,
} from '../src/bangkok/reunion.ts';
import { questJournal, trackedQuest } from '../src/bangkok/questJournal.ts';
import { beginJourney } from '../src/bangkok/cityJourneys.ts';
import { freshTraining } from '../src/bangkok/learning.ts';

function start(): AdventureSave {
  return {
    ...freshAdventure(),
    flags: ['intro', 'innkeeper', 'cook', 'ferry', 'murmur', 'keeper', 'departed'],
    coins: 0,
  };
}
function walk(s: AdventureSave, actor: ActorId) {
  const dest = questJournal(s)
    .find((q) => q.id === 'reunion')!
    .destinations.find((d) => d.actor === actor)!;
  assert(dest, `journal exposes ${actor}`);
  const path = findPath(s.position, dest.point);
  let position = s.position;
  assert(path.length > 0);
  for (let i = 0; path.length && i < 20000; i++) {
    position = followPath(position, path, 0.15);
    assert(walkable(position));
  }
  assert.equal(path.length, 0);
  assert(Math.hypot(position.x - dest.point.x, position.z - dest.point.z) < 0.01);
  const next = moveAdventure(s, position);
  assert.equal(reunionReason(next, actor), null);
  return next;
}
function reply(s: AdventureSave, actor: ActorId, id?: string) {
  const step = reunionStep(s, actor)!;
  assert(step);
  for (const phrase of reunionChoices(step)) assert(existsSync(`public/bangkok/voices/${phrase}.mp3`));
  return advanceReunion(s, actor, step, id ?? reunionChoices(step)[0]);
}
test('both schedules and invitation orders connect on foot, persist and award once', () => {
  for (const plan of ['free-evening', 'tomorrow-ok'])
    for (const order of [
      ['innkeeper', 'artisan'],
      ['artisan', 'innkeeper'],
    ] as ActorId[][]) {
      let s = start();
      assert.equal(trackedQuest(s).id, 'reunion');
      s = walk(s, 'ferry');
      const atPier = s;
      s = reply(s, 'ferry', plan);
      assert.equal(s.position, atPier.position);
      assert.equal(s.xp, 0);
      assert.equal(reunionRoute(s), plan === 'free-evening' ? 'evening' : 'tomorrow');
      assert.deepEqual(reunionDestinations(s), ['innkeeper', 'artisan']);
      for (const actor of order) {
        assert.equal(
          advanceReunion(
            s,
            actor,
            reunionStep(s, actor)!,
            actor === 'innkeeper' ? 'go-together' : 'meet-where',
          ),
          s,
          'no remote invitation',
        );
        s = walk(s, actor);
        const before = s;
        s = reply(s, actor);
        assert.equal(s.xp, 0);
        assert.equal(s.coins, 0);
        assert.equal(s.position, before.position);
        assert.equal(
          advanceReunion(
            s,
            actor,
            actor === 'innkeeper' ? 'mali' : 'arun',
            actor === 'innkeeper' ? 'go-together' : 'meet-where',
          ),
          s,
        );
        assert.deepEqual(normalizeAdventure(JSON.parse(JSON.stringify(s))), s);
      }
      const host = reunionVenue(s);
      s = walk(s, host);
      s = reply(s, host);
      assert.equal(reunionStep(s, host), 'finish');
      assert.deepEqual(normalizeAdventure(s), s);
      const before = s;
      s = reply(s, host);
      assert.equal(s.xp, before.xp + 120);
      assert.equal(s.rice, before.rice + 2);
      assert.equal(s.tea, before.tea + 2);
      assert.equal(s.coins, 0);
      assert.deepEqual(s.journeys, before.journeys);
      assert.deepEqual(s.learned, []);
      assert(questJournal(s).find((q) => q.id === 'reunion')!.complete);
      assert(reunionStatus(s).includes(plan === 'free-evening' ? 'Yaowarat' : 'Lumphini'));
      assert.equal(advanceReunion(s, host, 'finish', 'see-you'), s);
      assert.equal(advanceReunion(s, 'ferry', 'plan', plan), s);
      assert.deepEqual(normalizeAdventure(s), s);
    }
});
test('chapter respects ferry completion, current stage, battle and travel mission ownership', () => {
  assert.equal(
    questJournal(freshAdventure()).some((q) => q.id === 'reunion'),
    false,
  );
  const initial = walk(start(), 'ferry');
  const mission = { ...initial, journeys: beginJourney(initial.journeys, freshTraining(), '2026-09-06') };
  for (const s of [freshAdventure(), startPracticeBattle(initial), mission])
    assert.equal(advanceReunion(s, 'ferry', 'plan', 'free-evening'), s);
  assert.equal(advanceReunion(initial, 'ferry', 'finish', 'see-you'), initial);
  assert.equal(advanceReunion(initial, 'ferry', 'plan', 'hello'), initial);
  mission.journeys.active!.paused = true;
  assert.equal(reunionReason(mission, 'ferry'), null);
});
test('normalization removes impossible progress and contradictory schedules without harming existing saves', () => {
  const initial = start();
  assert.deepEqual(normalizeAdventure(initial), initial);
  const s = normalizeAdventure({
    ...initial,
    flags: [...initial.flags, 'reunion-evening', 'reunion-tomorrow', 'reunion-welcome', 'reunion-complete'],
  });
  assert.deepEqual(s.flags, [...initial.flags, 'reunion-evening']);
  const locked = normalizeAdventure({
    ...initial,
    flags: ['intro', 'innkeeper', 'reunion-evening', 'reunion-mali'],
  });
  assert.deepEqual(locked.flags, ['intro', 'innkeeper']);
  const noPlan = normalizeAdventure({
    ...initial,
    flags: [...initial.flags, 'reunion-mali', 'reunion-arun', 'reunion-complete'],
  });
  assert.deepEqual(noPlan.flags, initial.flags);
});
