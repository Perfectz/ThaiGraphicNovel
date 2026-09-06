import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBattle,
  performMove,
  partyAction,
  defend,
  actor,
  timingResult,
  restoreBattle,
  enemyIntent,
} from '../src/bangkok/expeditionCombat.ts';
const fresh = () => createBattle('keeper', 100, 2, 1, false);
test('Patrick and Su act independently before any enemy attacks', () => {
  const initial = fresh(),
    p = performMove(initial, 'greet', 'keeper');
  assert.equal(initial.foes[0].hp, 230);
  assert.equal(p.foes[0].hp, 212);
  assert.equal(p.heroes[0].ap, 5);
  assert.equal(actor(p), 'su');
  assert.equal(p.heroes[0].hp, 100);
  const s = performMove(p, 'thanks', 'echo');
  assert.equal(s.foes[1].hp, 60);
  assert.equal(s.phase, 'defense');
  assert.equal(actor(s), 'keeper');
});
test('unaffordable, wrong-character, dead and invalid target moves spend nothing', () => {
  const b = fresh();
  assert.equal(performMove(b, 'reveal', 'keeper'), b);
  assert.equal(performMove(b, 'greet', 'patrick'), b);
  b.heroes[0].ap = 0;
  assert.equal(performMove(b, 'resolve', 'keeper'), b);
  b.foes[1].hp = 0;
  assert.equal(performMove(b, 'greet', 'echo'), b);
});
test('Su exposure enables Patrick to exploit a 50 percent damage opening', () => {
  let b = partyAction(fresh(), 'guard');
  b = performMove(b, 'reveal', 'keeper');
  assert(b.foes[0].exposed);
  b = defend(b, 'dodge');
  b = defend(b, 'dodge');
  const hp = b.foes[0].hp;
  b = performMove(b, 'resolve', 'keeper');
  assert.equal(hp - b.foes[0].hp, 63);
  assert(!b.foes[0].exposed);
});
test('breaking an enemy cancels its turn and exposes it', () => {
  let b = fresh();
  b.foes[0].break = 40;
  b = performMove(b, 'slow', 'keeper');
  assert(b.foes[0].staggered);
  b = performMove(b, 'thanks', 'echo');
  assert.equal(actor(b), 'echo');
  assert(!b.foes[0].staggered);
  assert(b.foes[0].exposed);
  assert(b.log.some((t) => t.includes('turn is skipped')));
});
test('guard reduces damage across the enemy phase then expires next turn', () => {
  let b = partyAction(fresh(), 'guard');
  b = partyAction(b, 'guard');
  assert.equal(b.heroes[0].ap, 5);
  b = defend(b, 'miss');
  assert.equal(b.heroes[0].hp, 94);
  b = defend(b, 'miss');
  assert.equal(b.heroes[1].hp, 86);
  assert(!b.heroes[0].guard);
});
test('weaken and equipped ward reduce damage, dodge avoids it, parry counters', () => {
  let b = performMove(fresh(), 'cool', 'keeper');
  b = performMove(b, 'thanks', 'echo');
  assert.equal(defend(b, 'miss').heroes[0].hp, 90);
  assert.equal(defend({ ...b, ward: true }, 'miss').heroes[0].hp, 93);
  assert.equal(defend(b, 'dodge').heroes[0].hp, 100);
  const p = defend(b, 'parry');
  assert.equal(p.heroes[0].hp, 100);
  assert.equal(p.foes[0].hp, b.foes[0].hp - 22);
  assert.equal(p.heroes[0].ap, b.heroes[0].ap + 1);
});
test('timing distinguishes wide dodge, tight parry, early input and invalid input', () => {
  assert.equal(timingResult('dodge', 0.7), 'dodge');
  assert.equal(timingResult('parry', 0.7), 'miss');
  assert.equal(timingResult('parry', 0.86), 'parry');
  assert.equal(timingResult('dodge', 0.1), 'miss');
  assert.equal(timingResult('parry', NaN), 'miss');
});
test('support Echo heals its living companion; defeating it prevents that turn', () => {
  let b = performMove(fresh(), 'greet', 'keeper');
  b = performMove(b, 'thanks', 'keeper');
  b = defend(b, 'dodge');
  const hp = b.foes[0].hp;
  b = defend(b, 'block');
  assert.equal(b.foes[0].hp, hp + 10);
  let c = fresh();
  c.foes[1].hp = 10;
  c = performMove(c, 'greet', 'echo');
  c = performMove(c, 'thanks', 'keeper');
  c = defend(c, 'block');
  assert.equal(c.round, 2);
  assert.equal(c.foes[0].hp, 214);
});
test('items target one ally, consume a turn and cannot be wasted on full health', () => {
  let b = fresh();
  assert.equal(partyAction(b, 'rice', 'su'), b);
  b.heroes[1].hp = 20;
  b = partyAction(b, 'rice', 'su');
  assert.equal(b.heroes[1].hp, 65);
  assert.equal(b.heroes[0].hp, 100);
  assert.equal(b.rice, 1);
  assert.equal(actor(b), 'su');
  b.heroes[0].ap = 0;
  b = partyAction(b, 'tea', 'patrick');
  assert.equal(b.heroes[0].ap, 6);
  assert.equal(b.tea, 0);
});
test('downed allies miss turns and Su can revive Patrick', () => {
  let b = fresh();
  b.heroes[0].hp = 1;
  b = performMove(b, 'greet', 'keeper');
  b = performMove(b, 'thanks', 'echo');
  b = defend(b, 'miss');
  b = defend(b, 'dodge');
  assert.equal(actor(b), 'su');
  assert.equal(b.heroes[0].hp, 0);
  b = performMove(b, 'mend', 'patrick');
  assert.equal(b.heroes[0].hp, 24);
});
test('duet requires full resonance and two living allies, then hits all enemies', () => {
  let b = fresh();
  assert.equal(partyAction(b, 'duet'), b);
  b.resonance = 100;
  b.heroes[1].hp = 40;
  b = partyAction(b, 'duet');
  assert.equal(b.foes[0].hp, 165);
  assert.equal(b.foes[1].hp, 11);
  assert.equal(b.heroes[1].hp, 55);
  assert.equal(b.resonance, 0);
});
test('terminal states stop combat and victory never permits an enemy counter', () => {
  let b = fresh();
  b.foes[1].hp = 0;
  b.foes[0].hp = 10;
  b = performMove(b, 'greet', 'keeper');
  assert.equal(b.phase, 'victory');
  assert.equal(b.heroes[0].hp, 100);
  assert.equal(defend(b, 'miss'), b);
  let d = fresh();
  d.heroes.forEach((h) => (h.hp = 1));
  d = performMove(d, 'greet', 'keeper');
  d = performMove(d, 'thanks', 'echo');
  d = defend(d, 'miss');
  d = defend(d, 'miss');
  assert.equal(d.phase, 'defeat');
  assert.equal(partyAction(d, 'guard'), d);
});
test('valid checkpoints restore exact turns; corrupt saves restart safely', () => {
  const b = performMove(fresh(), 'greet', 'echo');
  assert.deepEqual(restoreBattle(JSON.parse(JSON.stringify(b)), fresh()), b);
  assert.deepEqual(restoreBattle({ ...b, turn: 9 }, fresh()), fresh());
  const bad = structuredClone(b);
  bad.heroes[1].hp = NaN;
  assert.deepEqual(restoreBattle(bad, fresh()), fresh());
});
test('both encounters can be won using basic word arts and untimed guards', () => {
  for (const id of ['murmur', 'keeper'] as const) {
    let b = createBattle(id, 100, 3, 1, false),
      steps = 0;
    while (!['victory', 'defeat'].includes(b.phase) && steps++ < 120) {
      if (b.phase === 'defense') {
        b = defend(b, 'block');
        continue;
      }
      const hero = b.heroes.find((h) => h.id === actor(b))!;
      const low = b.heroes.find((h) => h.hp < h.maxHp - 35);
      if (hero.id === 'su' && low && hero.ap >= 2) b = performMove(b, 'mend', low.id);
      else if (low && low.hp > 0 && b.rice) b = partyAction(b, 'rice', low.id);
      else if (b.resonance === 100 && b.heroes.every((h) => h.hp)) b = partyAction(b, 'duet');
      else {
        const target = b.foes[1].hp ? b.foes[1] : b.foes[0];
        b = performMove(b, hero.id === 'su' ? 'thanks' : hero.ap >= 3 ? 'resolve' : 'greet', target.id);
      }
    }
    assert.equal(b.phase, 'victory', `${id} must be finishable without timing or microphone`);
  }
});
test('Keeper telegraphs heavy attack every third round and alternates targets', () => {
  let b = fresh();
  b.turn = 2;
  b.phase = 'defense';
  assert.equal(enemyIntent(b).damage, 20);
  assert.equal(enemyIntent(b).target.id, 'patrick');
  b.round = 2;
  assert.equal(enemyIntent(b).target.id, 'su');
  b.round = 3;
  assert.equal(enemyIntent(b).damage, 38);
});
