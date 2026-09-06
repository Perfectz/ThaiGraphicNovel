import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  rankResult,
  applyResult,
  scoreToStars,
  buildMastery,
  resultLabel,
  type PhraseResultMap,
} from '../src/components/stageClear.ts';
import type { AdventureConversationTurn } from '../src/data/adventures/types.ts';

function turn(id: string, translation: string): AdventureConversationTurn {
  return {
    id,
    npcSpeaker: 'Su',
    npcLineThai: '',
    npcRomanization: '',
    npcEnglish: '',
    response: {
      targetPhrase: `${id}-thai`,
      romanization: `${id}-rom`,
      phoneticSpelling: `${id}-pho`,
      translation,
    },
    successText: '',
  };
}

test('rankResult: numeric beats confirmed beats skipped, higher number wins', () => {
  assert.equal(rankResult(undefined, 'skipped'), 'skipped');
  assert.equal(rankResult('skipped', 'confirmed'), 'confirmed');
  assert.equal(rankResult('confirmed', 42), 42);
  // Never downgrade.
  assert.equal(rankResult(80, 'confirmed'), 80);
  assert.equal(rankResult(80, 'skipped'), 80);
  assert.equal(rankResult('confirmed', 'skipped'), 'confirmed');
  // Between numbers, keep the best.
  assert.equal(rankResult(60, 90), 90);
  assert.equal(rankResult(90, 60), 90);
});

test('applyResult is immutable and only changes on improvement', () => {
  const base: PhraseResultMap = { hello: 70 };
  const same = applyResult(base, 'hello', 60); // worse → no change
  assert.equal(same, base, 'should return the same reference when nothing improves');
  const better = applyResult(base, 'hello', 95);
  assert.notEqual(better, base);
  assert.equal(better.hello, 95);
  assert.equal(base.hello, 70, 'original map is untouched');
});

test('scoreToStars thresholds', () => {
  assert.equal(scoreToStars(null), 0);
  assert.equal(scoreToStars(40), 0);
  assert.equal(scoreToStars(50), 1);
  assert.equal(scoreToStars(72), 2);
  assert.equal(scoreToStars(88), 3);
  assert.equal(scoreToStars(100), 3);
});

test('buildMastery rolls up rows, average, stars, and cleared count', () => {
  const turns = [turn('hello', 'Hello'), turn('thanks', 'Thank you'), turn('bye', 'Goodbye')];
  const results: PhraseResultMap = { hello: 90, thanks: 70, bye: 'skipped' };
  const m = buildMastery(turns, results);
  assert.equal(m.totalCount, 3);
  assert.equal(m.rows.length, 3);
  assert.equal(m.rows[0].translation, 'Hello');
  assert.equal(m.numericAverage, 80); // (90+70)/2
  assert.equal(m.stars, 2);
  assert.equal(m.clearedCount, 2); // skipped does not count as cleared
});

test('buildMastery handles a full no-mic run (confirmed, no numeric average)', () => {
  const turns = [turn('hello', 'Hello'), turn('bye', 'Goodbye')];
  const results: PhraseResultMap = { hello: 'confirmed', bye: 'confirmed' };
  const m = buildMastery(turns, results);
  assert.equal(m.numericAverage, null);
  assert.equal(m.stars, 0);
  assert.equal(m.clearedCount, 2);
});

test('buildMastery marks unreached phrases as null result', () => {
  const turns = [turn('hello', 'Hello'), turn('bye', 'Goodbye')];
  const m = buildMastery(turns, { hello: 88 });
  assert.equal(m.rows[1].result, null);
  assert.equal(resultLabel(m.rows[1].result), '—');
});

test('resultLabel formats each outcome', () => {
  assert.equal(resultLabel(87), '87');
  assert.equal(resultLabel('confirmed'), 'Confirmed');
  assert.equal(resultLabel('skipped'), 'Skipped');
  assert.equal(resultLabel(null), '—');
});
