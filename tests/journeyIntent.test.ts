import test from 'node:test';
import assert from 'node:assert/strict';
import {
  beginJourney,
  freshJourneys,
  cityJourneys,
  journeyIntentChoices,
  journeyPhrase,
  journeyCursor,
  markJourneyMeaningHelp,
  normalizeJourneys,
  recordJourneyPractice,
  advanceJourney,
} from '../src/bangkok/cityJourneys.ts';
import { freshTraining } from '../src/bangkok/learning.ts';

const date = '2026-09-06';
function situation() {
  const save = beginJourney(freshJourneys(), freshTraining(), date);
  save.active!.step = 3;
  return save;
}
test('all 30 outings offer the three learned intentions with a stable, varied answer position', () => {
  const positions = new Set<number>();
  for (const journey of cityJourneys) {
    const save = beginJourney(freshJourneys(), freshTraining(), date, journey.id);
    for (let stop = 0; stop < 3; stop++)
      for (let step = 3; step < 6; step++) {
        const active = { ...save.active!, stop, step };
        const choices = journeyIntentChoices(active);
        assert.deepEqual([...choices].sort(), [...active.queues[stop]].sort());
        assert.equal(new Set(choices).size, 3);
        positions.add(choices.indexOf(journeyPhrase(active)));
        assert.deepEqual(journeyIntentChoices(structuredClone(active)), choices);
      }
  }
  assert.equal(positions.size, 3);
});
test('meaning support persists without advancing the conversation or duplicating marks', () => {
  const s = situation(),
    cursor = journeyCursor(s.active!);
  const next = markJourneyMeaningHelp(s, cursor);
  assert.equal(next.active!.step, 3);
  assert.equal(next.active!.spoken, 0);
  assert.deepEqual(next.active!.meaningHelp, [cursor]);
  assert.deepEqual(normalizeJourneys(JSON.parse(JSON.stringify(next))), next);
  assert.equal(markJourneyMeaningHelp(next, cursor), next);
  assert.equal(markJourneyMeaningHelp(s, '1:0:4'), s);
  const paused = { ...s, active: { ...s.active!, paused: true } };
  assert.equal(markJourneyMeaningHelp(paused, cursor), paused);
});
test('a supported meaning stays due even if a caller tries to credit successful recall', () => {
  const s = situation(),
    cursor = journeyCursor(s.active!);
  const next = markJourneyMeaningHelp(s, cursor),
    a = next.active!;
  const result = { spoken: false, recalled: true };
  const training = recordJourneyPractice(freshTraining(), a, result, date);
  const record = training.records[journeyPhrase(a)];
  assert.equal(record.recalled, 0);
  assert.equal(record.spoken, 0);
  assert.equal(record.due, date);
  assert.equal(advanceJourney(next, cursor, result).active!.recalled, 0);
  assert.equal(advanceJourney(next, cursor, result).active!.step, 4);
});
test('an actual recorded reply still earns speech practice after meaning help', () => {
  const s = situation(),
    cursor = journeyCursor(s.active!);
  const a = markJourneyMeaningHelp(s, cursor).active!;
  const training = recordJourneyPractice(freshTraining(), a, { spoken: true, recalled: true }, date);
  assert.equal(training.records[journeyPhrase(a)].spoken, 1);
  assert.equal(training.records[journeyPhrase(a)].recalled, 0);
});
test('meaning support is limited to its exact turn and corrupt metadata cannot erase the outing', () => {
  const s = situation(),
    cursor = journeyCursor(s.active!);
  const next = normalizeJourneys({
    ...s,
    active: { ...s.active, meaningHelp: [cursor, cursor, '9:0:3', '1:0:0', '1:9:3', null] },
  });
  assert.deepEqual(next.active!.meaningHelp, [cursor]);
  const advanced = advanceJourney(next, cursor, { spoken: false });
  const a = advanced.active!;
  const training = recordJourneyPractice(freshTraining(), a, { spoken: false, recalled: true }, date);
  assert.equal(training.records[journeyPhrase(a)].recalled, 1);
  assert.deepEqual(normalizeJourneys(s), s, 'older saves without support metadata still load');
});
