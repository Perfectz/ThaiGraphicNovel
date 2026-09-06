import test from 'node:test';
import assert from 'node:assert/strict';
import { actors, freshAdventure, normalizeAdventure, startPracticeBattle } from '../src/bangkok/adventure.ts';
import { advanceCanalErrand, canalHost, canalStepFor, type CanalStep } from '../src/bangkok/canalErrand.ts';
const at = (s: ReturnType<typeof freshAdventure>, step: CanalStep) => ({ ...s, position: { ...actors.find(a => a.id === canalHost[step])! } });

test('the optional errand needs hotel preparation, proximity and both pieces before repair', () => {
  const s = freshAdventure();
  assert.equal(advanceCanalErrand(at(s, 'canal-accepted'), 'canal-accepted').flags.length, 0);
  const prepared = { ...s, flags: ['intro', 'innkeeper'] };
  assert.equal(advanceCanalErrand(prepared, 'canal-accepted'), prepared);
  assert.equal(canalStepFor(prepared, 'gardener'), null);
  const accepted = advanceCanalErrand(at(prepared, 'canal-accepted'), 'canal-accepted');
  assert.equal(canalStepFor(accepted, 'canal-lantern'), null);
  assert.equal(advanceCanalErrand(at(accepted, 'canal-restored'), 'canal-restored').xp, 0);
  const fighting = startPracticeBattle(at(accepted, 'canal-paper'));
  assert.equal(advanceCanalErrand(fighting, 'canal-paper'), fighting);
});

test('pieces can be collected in either order; reload preserves them and repair rewards only once', () => {
  for (const order of [['canal-paper', 'canal-frame'], ['canal-frame', 'canal-paper']] as CanalStep[][]) {
    let s = { ...freshAdventure(), flags: ['intro', 'innkeeper'] };
    s = advanceCanalErrand(at(s, 'canal-accepted'), 'canal-accepted');
    for (const step of order) {
      s = advanceCanalErrand(at(s, step), step);
      assert.equal(advanceCanalErrand(s, step), s);
      const normalized = normalizeAdventure(JSON.parse(JSON.stringify(s)));
      assert.deepEqual(normalized.flags, s.flags);
      assert.equal(normalized.xp, 0);
      s = normalized;
    }
    s = advanceCanalErrand(at(s, 'canal-restored'), 'canal-restored');
    assert.equal(s.xp, 80); assert.equal(s.coins, 45); assert.equal(s.rice, 2); assert.equal(s.tea, 2);
    assert.deepEqual(normalizeAdventure(s).flags, s.flags);
    assert.equal(advanceCanalErrand(s, 'canal-restored'), s);
    assert.equal(canalStepFor(s, 'canal-lantern'), null);
  }
});

test('malformed errand flags cannot light the lamp without the prerequisite pieces', () => {
  assert.deepEqual(normalizeAdventure({ ...freshAdventure(), flags: ['canal-restored', 'canal-frame'] }).flags, []);
  assert.deepEqual(normalizeAdventure({ ...freshAdventure(), flags: ['canal-accepted', 'canal-restored'] }).flags, ['canal-accepted']);
});
