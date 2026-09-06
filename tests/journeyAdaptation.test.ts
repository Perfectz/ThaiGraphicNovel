import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import {
  beginJourney,
  freshJourneys,
  journeyHosts,
  journeyPhrase,
  journeyIsRecall,
  journeyCursor,
  normalizeJourneys,
  advanceJourney,
  recordJourneyPractice,
  cityJourneys,
} from '../src/bangkok/cityJourneys.ts';
import { journeySituation, journeySituations } from '../src/bangkok/journeySituations.ts';
import { freshTraining, recordAttempt } from '../src/bangkok/learning.ts';
import { freshAdventure, completeJourneyStep } from '../src/bangkok/adventure.ts';
const today = '2026-09-06';
function familiar(ids: string[]) {
  let t = freshTraining();
  for (const id of ids)
    for (const date of ['2026-09-01', '2026-09-03']) t = recordAttempt(t, id, 'recall', true, date);
  return t;
}
test('earlier multi-day self-checks earn recall-first prompts; new, failed and same-day lines keep support', () => {
  const ids = ['hello', 'reservation-have'];
  let t = familiar(ids);
  const a = beginJourney(freshJourneys(), t, today).active!;
  for (let step = 0; step < 3; step++)
    assert.equal(journeyIsRecall({ ...a, step }), ids.includes(journeyPhrase({ ...a, step })));
  const fresh = beginJourney(freshJourneys(), freshTraining(), today).active!;
  for (let step = 0; step < 3; step++) assert(!journeyIsRecall({ ...fresh, step }));
  for (const result of [false, true]) {
    const changed = recordAttempt(t, 'hello', 'recall', result, today);
    const next = beginJourney(freshJourneys(), changed, today).active!;
    const i = next.queues[0].indexOf('hello');
    assert(i >= 0);
    assert(!journeyIsRecall({ ...next, step: i }));
  }
  t.records.hello.lastRecall = '2099-01-01';
  const next = beginJourney(freshJourneys(), t, today).active!;
  assert(!journeyIsRecall({ ...next, step: next.queues[0].indexOf('hello') }));
});
test('all outings revisit each selected phrase once in a different order, frozen with the active save', () => {
  for (const j of cityJourneys) {
    const s = beginJourney(freshJourneys(), familiar(['hello']), today, j.id),
      a = s.active!;
    for (let stop = 0; stop < 3; stop++) {
      const first = [0, 1, 2].map((step) => journeyPhrase({ ...a, stop, step }));
      const last = [3, 4, 5].map((step) => journeyPhrase({ ...a, stop, step }));
      assert.notDeepEqual(last, first);
      assert.deepEqual([...last].sort(), [...first].sort());
    }
    assert.deepEqual(normalizeJourneys(JSON.parse(JSON.stringify(s))), s);
    assert.equal(beginJourney(s, freshTraining(), '2026-09-12'), s);
  }
});
test('legacy queues keep their original order and malformed challenge metadata does not erase an outing', () => {
  const s = beginJourney(freshJourneys(), freshTraining(), today);
  delete s.active!.challenge;
  const old = normalizeJourneys(s);
  assert.deepEqual(old, s);
  for (let step = 0; step < 6; step++) {
    const a = { ...old.active!, step };
    assert.equal(journeyPhrase(a), a.queues[0][step % 3]);
    assert.equal(journeyIsRecall(a), step >= 3);
  }
  for (const challenge of [
    { firstRecall: [[true]], order: [[0, 1, 2]] },
    { firstRecall: Array(3).fill([true, true, true]), order: Array(3).fill([0, 0, 4]) },
  ]) {
    const next = normalizeJourneys({ ...s, active: { ...s.active, challenge } });
    assert.deepEqual(next, s);
  }
});
test('first-round recall credits the right phrase, keeps hints due and never treats text as speech', () => {
  const t = familiar(['hello']);
  let a = beginJourney(freshJourneys(), t, today).active!;
  a = { ...a, step: a.queues[0].indexOf('hello') };
  assert(journeyIsRecall(a));
  const hinted = recordJourneyPractice(t, a, { spoken: false, recalled: true, hinted: true }, today);
  assert.equal(hinted.records.hello.recalled, 2);
  assert.equal(hinted.records.hello.interval, 0);
  assert.equal(hinted.records.hello.due, today);
  assert.equal(hinted.records.hello.spoken, 0);
  assert.equal(hinted.dailyPractice[today].recalls, 1);
  const spoken = recordJourneyPractice(t, a, { spoken: true, recalled: true }, today);
  assert.equal(spoken.records.hello.recalled, 3);
  assert.equal(spoken.records.hello.spoken, 1);
  const again = recordJourneyPractice(spoken, a, { spoken: false, recalled: true }, today);
  assert.equal(again.records.hello.recalled, 3);
  assert.equal(again.dailyPractice[today].recalls, 2);
  const shuffled = { ...a, step: 3 };
  const id = journeyPhrase(shuffled);
  const after = recordJourneyPractice(t, shuffled, { spoken: false, recalled: false }, today);
  assert.equal(after.records[id].due, today);
  assert.equal(after.records[id].interval, 0);
});
test('fully familiar outings permit eighteen honest recall attempts but award adventure supplies only once', () => {
  const t = familiar([...new Set(Object.values(journeyHosts).flatMap((h) => h.pool))]);
  let s = { ...freshAdventure(), journeys: beginJourney(freshJourneys(), t, today) };
  for (let i = 0; i < 18; i++) {
    const a = s.journeys.active!;
    assert(journeyIsRecall(a));
    if (i === 0) {
      const paused = { ...s.journeys, active: { ...a, paused: true } };
      assert.equal(advanceJourney(paused, journeyCursor(a), { spoken: true, recalled: true }), paused);
    }
    s = completeJourneyStep(s, journeyCursor(a), { spoken: false, recalled: true });
  }
  assert.equal(s.journeys.completed[0].recalled, 18);
  assert.equal(s.journeys.completed[0].spoken, 0);
  assert.deepEqual(normalizeJourneys(s.journeys), s.journeys);
  const done = s;
  s = { ...s, journeys: beginJourney(s.journeys, t, today, 1) };
  for (let i = 0; i < 18; i++)
    s = completeJourneyStep(s, journeyCursor(s.journeys.active!), { spoken: false, recalled: true });
  assert.deepEqual(s, done);
});
test('every host phrase has an authored English situation and existing reference audio', () => {
  for (const [actor, host] of Object.entries(journeyHosts))
    for (const id of host.pool) {
      assert(journeySituations[id], id);
      const text = journeySituation(actor as keyof typeof journeyHosts, id);
      assert(text.length > 35 && !text.includes('{host}'));
      assert(existsSync(`public/bangkok/audio/${id}.mp3`));
    }
});
