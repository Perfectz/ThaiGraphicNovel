import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBattle,
  enemyIntent,
  defend,
  restoreBattle,
  performMove,
  partyAction,
  type Battle,
} from '../src/bangkok/expeditionCombat.ts';

function defense(id: Battle['id'], round = 2, turn = 2) {
  const b = createBattle(id, 100, 2, 2, false);
  b.round = round;
  b.turn = turn;
  b.phase = 'defense';
  return b;
}
test('reading either foe forecast costs nothing and exposes distinct encounter patterns', () => {
  for (const id of ['murmur', 'keeper', 'sentinel'] as const) {
    const b = createBattle(id, 100, 2, 2, false);
    b.round = id === 'keeper' ? 3 : 2;
    const before = structuredClone(b);
    const main = enemyIntent(b, b.foes[0].id),
      echo = enemyIntent(b, 'echo');
    assert.equal(main.foe.id, id);
    assert.equal(main.target.id, b.round % 2 ? 'patrick' : 'su');
    assert.equal(main.siphon, id === 'murmur');
    assert.equal(main.heavy, id !== 'murmur');
    assert(echo.healing);
    assert.equal(echo.target.id, b.round % 2 ? 'su' : 'patrick');
    assert.deepEqual(b, before);
    b.foes[0].staggered = true;
    assert(enemyIntent(b, b.foes[0].id).hint.includes('cancelled'));
  }
});
test('Mist Siphon drains only the struck ally and clamps AP at zero', () => {
  for (const ap of [0, 1, 3, 6]) {
    const b = defense('murmur');
    b.heroes[1].ap = ap;
    const next = defend(b, 'miss');
    assert.equal(next.heroes[1].ap, Math.max(0, ap - 2));
    assert.equal(next.heroes[0].ap, 3);
    assert.equal(next.heroes[1].hp, 76);
    assert.equal(b.heroes[1].ap, ap);
    assert(next.event.text.includes(ap ? `${Math.min(2, ap)} AP` : 'no AP'));
  }
  assert.equal(defend(defense('murmur', 1), 'miss').heroes[0].ap, 3, 'ordinary attacks do not drain');
});
test('untimed block, prepared guard, weaken and timed defenses all prevent AP theft', () => {
  for (const mode of ['block', 'dodge', 'parry', 'guard', 'weaken'] as const) {
    const b = defense('murmur');
    if (mode === 'guard') b.heroes[1].guard = true;
    if (mode === 'weaken') b.foes[0].weakened = true;
    const next = defend(b, mode === 'guard' || mode === 'weaken' ? 'miss' : mode);
    assert.equal(next.heroes[1].ap, mode === 'parry' ? 4 : 3, mode);
    assert(next.event.text.includes('steals no AP'));
  }
  let b = createBattle('murmur', 100, 2, 2, false);
  b.round = 2;
  b = performMove(b, 'cool', 'murmur');
  b = partyAction(b, 'guard');
  const next = defend(b, 'miss');
  assert.equal(next.heroes[1].ap, 5, 'Thai weakening and a planned Su guard protect her energy');
});
test('parry interrupts Echo healing even when the Echo survives; other defenses leave healing active', () => {
  for (const result of ['block', 'dodge', 'miss', 'parry'] as const) {
    const b = defense('keeper', 1, 3);
    b.foes[0].hp = 100;
    const next = defend(b, result);
    assert.equal(next.foes[0].hp, result === 'parry' ? 100 : 110);
    assert.equal(next.foes[1].hp, result === 'parry' ? 54 : 76);
    if (result === 'parry') assert(next.event.text.includes('restoration interrupted'));
  }
  const capped = defense('keeper', 1, 3);
  capped.foes[0].hp = 228;
  assert(defend(capped, 'block').event.text.includes('restores 2 HP'));
  const alone = defense('keeper', 1, 3);
  alone.foes[0].hp = 0;
  assert.equal(enemyIntent(alone).healing, false);
  assert(!defend(alone, 'block').event.text.includes('restores'));
});
test('reload retains the exact threat and cannot reapply a resolved siphon', () => {
  const b = defense('murmur'),
    fallback = createBattle('murmur', 100, 2, 2, false);
  const resumed = restoreBattle(JSON.parse(JSON.stringify(b)), fallback);
  assert.deepEqual(enemyIntent(resumed), enemyIntent(b));
  const next = defend(resumed, 'miss');
  assert.equal(next.heroes[1].ap, 1);
  const echo = restoreBattle(JSON.parse(JSON.stringify(next)), fallback);
  const after = defend(echo, 'block');
  assert.equal(after.heroes[1].ap, 1);
  assert.equal(after.round, 3);
});
