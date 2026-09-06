import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, duePhrases, finishActivity, freshTraining, normalizeTraining, recordAttempt } from '../src/bangkok/learning.ts';

test('recognition never counts as recall or speaking', () => {
  const s = recordAttempt(freshTraining(), 'hello', 'choice', true, '2026-09-04');
  assert.equal(s.records.hello.recalled, 0); assert.equal(s.records.hello.spoken, 0);
  assert.equal(s.records.hello.interval, 0);
});
test('spaced reviews expand across days, not repeated same-day clicks', () => {
  let s = recordAttempt(freshTraining(), 'hello', 'recall', true, '2026-09-04');
  assert.equal(s.records.hello.due, '2026-09-05');
  s = recordAttempt(s, 'hello', 'recall', true, '2026-09-04');
  assert.equal(s.records.hello.interval, 1); assert.equal(s.records.hello.recalled, 1);
  s = recordAttempt(s, 'hello', 'recall', true, '2026-09-05');
  assert.equal(s.records.hello.interval, 3); assert.equal(s.records.hello.due, '2026-09-08');
});
test('a missed recall returns immediately without punishing XP', () => {
  let s = recordAttempt(freshTraining(), 'hello', 'recall', true, '2026-09-04');
  const xp = s.xp; s = recordAttempt(s, 'hello', 'recall', false, '2026-09-05');
  assert.equal(s.xp, xp); assert.equal(s.records.hello.interval, 0);
  assert.deepEqual(duePhrases(s, ['hello', 'not-studied'], '2026-09-05'), ['hello']);
});
test('speaking can be practised without claiming memory or pronunciation mastery', () => {
  const s = recordAttempt(freshTraining(), 'hello', 'spoken', true, '2026-09-04');
  assert.equal(s.records.hello.spoken, 1); assert.equal(s.records.hello.recalled, 0); assert.equal(s.records.hello.interval, 0);
});
test('activity completion is idempotent and preserves other days', () => {
  let s = freshTraining(); s.completed['2'] = [0]; s.session = { day: 1, activity: 3, queue: ['hello'], index: 0, correct: 0 };
  s = finishActivity(s); assert.deepEqual(s.completed, { 1: [3], 2: [0] }); assert.equal(s.session, null);
  assert.deepEqual(finishActivity(s), s);
});
test('saved sessions round-trip with their exact phrase and activity', () => {
  const s = freshTraining(); s.session = { day: 8, activity: 3, index: 1, queue: ['hello', 'not-spicy'], correct: 1 };
  assert.deepEqual(normalizeTraining(JSON.parse(JSON.stringify(s))), s);
});
test('invalid saves cannot inject unbounded XP or broken sessions', () => {
  const s = normalizeTraining({ version: 1, day: -1, xp: Infinity, records: { bad: null }, session: { queue: [3], index: -2 } });
  assert.equal(s.day, 1); assert.equal(s.xp, 0); assert.deepEqual(s.records, {}); assert.equal(s.session, null);
  assert.deepEqual(normalizeTraining({ version: 500 }), freshTraining());
});
test('review dates cross month and year boundaries using calendar days', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01'); assert.equal(addDays('2028-02-28', 1), '2028-02-29');
});

test('an exhausted saved queue cannot open an empty practice screen', () => {
  const s = freshTraining(); s.session = { day: 1, activity: 1, index: 1, queue: ['hello'], correct: 1 };
  assert.equal(normalizeTraining(s).session, null);
});
