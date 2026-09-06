import test from 'node:test';
import assert from 'node:assert/strict';
import { PracticeClock } from '../src/bangkok/practiceClock.ts';
import { addPracticeTime, freshTraining, normalizeTraining, recordAttempt } from '../src/bangkok/learning.ts';

test('walking, hidden tabs and activation boundaries never get retrospective practice credit', () => {
  const clock = new PracticeClock(0);
  assert.equal(clock.sample(1000, false, true), 0);
  assert.equal(clock.sample(2000, true, true), 0);
  assert.equal(clock.sample(3000, true, true), 1);
  assert.equal(clock.sample(4000, true, false), 0);
  assert.equal(clock.sample(5000, true, true), 0);
  assert.equal(clock.sample(6000, true, true), 1);
  clock.reset(6500);
  assert.equal(clock.sample(7000, true, true), 0);
  assert.equal(clock.sample(8000, false, true), 0);
});
test('idle practice clips at 45 seconds and resumes after interaction', () => {
  const clock = new PracticeClock(0);
  clock.sample(0, true, true);
  let seconds = 0;
  for (let now = 1000; now <= 50000; now += 1000) seconds += clock.sample(now, true, true);
  assert.equal(seconds, 45);
  clock.touch(50000);
  assert.equal(clock.sample(51000, true, true), 1);
  assert.equal(clock.sample(51000, true, true), 0);
});
test('a suspended browser cannot bank a long missed interval', () => {
  const clock = new PracticeClock(0);
  clock.sample(0, true, true);
  clock.touch(100000);
  assert.equal(clock.sample(101000, true, true), 2);
});
test('legacy activity time is preserved without relabelling it as phrase practice', () => {
  const save = normalizeTraining({ version: 1, minutes: { '2026-09-04': 3600 }, xp: 35 });
  assert.deepEqual(save.dailyPractice, {});
  const next = addPracticeTime(save, 3.5, '2026-09-04');
  assert.equal(next.minutes['2026-09-04'], 3600);
  assert.equal(next.dailyPractice['2026-09-04'].seconds, 3.5);
  assert.equal(next.xp, 35);
  assert.deepEqual(save.dailyPractice, {});
  assert.deepEqual(normalizeTraining(JSON.parse(JSON.stringify(next))), next);
});
test('daily speaking and recall attempts stay separate, including failed self-checks and a new day', () => {
  let save = recordAttempt(freshTraining(), 'hello', 'choice', true, '2026-09-04');
  save = recordAttempt(save, 'hello', 'spoken', true, '2026-09-04');
  save = recordAttempt(save, 'hello', 'coach', true, '2026-09-04');
  save = recordAttempt(save, 'hello', 'recall', false, '2026-09-04');
  save = recordAttempt(save, 'hello', 'recall', true, '2026-09-04');
  save = addPracticeTime(save, 4, '2026-09-05');
  assert.deepEqual(save.dailyPractice['2026-09-04'], { seconds: 0, spoken: 2, recalls: 2 });
  assert.deepEqual(save.dailyPractice['2026-09-05'], { seconds: 4, spoken: 0, recalls: 0 });
});
test('invalid timing fields are rejected and implausible daily seconds capped', () => {
  const save = freshTraining();
  assert.equal(addPracticeTime(save, NaN), save);
  assert.equal(addPracticeTime(save, -1), save);
  const next = normalizeTraining({
    ...save,
    dailyPractice: {
      '2026-09-04': { seconds: Infinity, spoken: 1, recalls: 1 },
      '2026-09-05': { seconds: 1e9, spoken: 2.5, recalls: 3.9 },
    },
  });
  assert.deepEqual(next.dailyPractice, { '2026-09-05': { seconds: 86400, spoken: 2, recalls: 3 } });
});
