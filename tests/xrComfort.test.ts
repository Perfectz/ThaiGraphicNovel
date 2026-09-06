import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_COMFORT,
  snapTurnRadians,
  vignetteStrength,
  cycleTurnStyle,
  cycleVignette,
  toggleHandedness,
  normalizeComfort,
  loadComfort,
} from '../src/components/three/xrComfort.ts';

test('snapTurnRadians maps styles to the right increments', () => {
  assert.equal(snapTurnRadians('snap-30'), (30 * Math.PI) / 180);
  assert.equal(snapTurnRadians('snap-45'), (45 * Math.PI) / 180);
  // Smooth turning is continuous, so it has no discrete step.
  assert.equal(snapTurnRadians('smooth'), 0);
});

test('vignetteStrength is ordered off < light < strong and bounded 0..1', () => {
  const off = vignetteStrength('off');
  const light = vignetteStrength('light');
  const strong = vignetteStrength('strong');
  assert.equal(off, 0);
  assert.ok(off < light && light < strong, 'strength must increase with level');
  assert.ok(strong <= 1, 'strength must stay within the vignette amount range');
});

test('cycleTurnStyle rotates through all three styles and wraps', () => {
  assert.equal(cycleTurnStyle('snap-30'), 'snap-45');
  assert.equal(cycleTurnStyle('snap-45'), 'smooth');
  assert.equal(cycleTurnStyle('smooth'), 'snap-30');
});

test('cycleVignette rotates strong -> light -> off -> strong', () => {
  assert.equal(cycleVignette('strong'), 'light');
  assert.equal(cycleVignette('light'), 'off');
  assert.equal(cycleVignette('off'), 'strong');
});

test('toggleHandedness flips between right and left', () => {
  assert.equal(toggleHandedness('right'), 'left');
  assert.equal(toggleHandedness('left'), 'right');
});

test('cycling any control returns to start after a full loop', () => {
  // 3 turn styles, 3 vignette levels, 2 hands -> LCM is 6 cycles back to start.
  let turn = DEFAULT_COMFORT.turn;
  let vig = DEFAULT_COMFORT.vignette;
  let hand = DEFAULT_COMFORT.handedness;
  for (let i = 0; i < 6; i += 1) {
    turn = cycleTurnStyle(turn);
    vig = cycleVignette(vig);
    hand = toggleHandedness(hand);
  }
  assert.equal(turn, DEFAULT_COMFORT.turn);
  assert.equal(vig, DEFAULT_COMFORT.vignette);
  assert.equal(hand, DEFAULT_COMFORT.handedness);
});

test('normalizeComfort repairs partial/garbage input field-by-field', () => {
  assert.deepEqual(normalizeComfort(null), DEFAULT_COMFORT);
  assert.deepEqual(normalizeComfort({}), DEFAULT_COMFORT);
  assert.deepEqual(normalizeComfort('nonsense'), DEFAULT_COMFORT);
  // Valid fields are kept; invalid ones fall back to the default.
  assert.deepEqual(
    normalizeComfort({ turn: 'smooth', vignette: 'banana', handedness: 'left' }),
    { turn: 'smooth', vignette: DEFAULT_COMFORT.vignette, handedness: 'left' },
  );
});

test('loadComfort returns comfort-first defaults when storage is unavailable', () => {
  // No localStorage in the Node test environment -> defaults.
  assert.deepEqual(loadComfort(), DEFAULT_COMFORT);
  // The defaults themselves must be the safe, nausea-protecting choice.
  assert.equal(DEFAULT_COMFORT.turn, 'snap-30');
  assert.equal(DEFAULT_COMFORT.vignette, 'strong');
});
