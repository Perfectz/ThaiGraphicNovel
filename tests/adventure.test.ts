import test from 'node:test';
import assert from 'node:assert/strict';
import {
  updateBattle,
  leaveBattle,
  canBattle,
  completeConversation,
  findPath,
  flag,
  freshAdventure,
  has,
  normalizeAdventure,
  openChest,
  startBattle,
  startPracticeBattle,
  stepPlayer,
  walkable,
} from '../src/bangkok/adventure.ts';

test('sparring preserves supplies, health and story rewards, including completed saves', () => {
  const original = { ...flag(flag(freshAdventure(), 'murmur'), 'keeper'), hp: 43, rice: 0, tea: 0 };
  let s = startPracticeBattle(original);
  assert(s.battle!.practice);
  assert.equal(s.battle!.heroes[0].hp, 100);
  assert.deepEqual(normalizeAdventure(JSON.parse(JSON.stringify(s))), s);
  const b = structuredClone(s.battle!);
  b.rice = 0; b.heroes[0].hp = 12; b.foes.forEach(f => f.hp = 0); b.phase = 'victory';
  s = leaveBattle(updateBattle(s, b));
  assert.deepEqual(s, original);
});

test('a key gates the optional chest and its reward cannot be farmed', () => {
  const s = freshAdventure();
  assert.equal(openChest(s), s);
  const key = completeConversation(s, 'innkeeper');
  const chest = openChest(key);
  assert(has(chest, 'chest'));
  assert.equal(chest.coins, 45);
  assert.equal(openChest(chest), chest);
  assert.equal(completeConversation(key, 'innkeeper'), key);
});
test('the ferry favour and boss require actual quest progress', () => {
  let s = freshAdventure();
  assert.equal(completeConversation(s, 'ferry'), s);
  assert(!canBattle(s, 'keeper'));
  s = completeConversation(s, 'cook');
  s = completeConversation(s, 'ferry');
  assert(!canBattle(s, 'keeper'));
  s = flag(s, 'murmur');
  assert(canBattle(s, 'keeper'));
});
test('victory rewards are claimed once and retreat preserves quest items', () => {
  let s = startBattle(flag(flag(freshAdventure(), 'innkeeper'), 'chest'), 'murmur');
  const b = structuredClone(s.battle!);
  b.foes.forEach((f) => (f.hp = 0));
  b.phase = 'victory';
  s = leaveBattle(updateBattle(s, b));
  assert(has(s, 'murmur'));
  assert(has(s, 'chest'));
  assert.equal(s.xp, 50);
  assert.equal(s.coins, 40);
  assert.equal(leaveBattle(s), s);
  assert.equal(startBattle(s, 'murmur'), s);
});
test('defeat restores 35 HP at the inn without losing inventory', () => {
  const s = startBattle(flag(freshAdventure(), 'innkeeper'), 'murmur');
  const b = structuredClone(s.battle!);
  b.heroes.forEach((h) => (h.hp = 0));
  b.phase = 'defeat';
  const next = leaveBattle(updateBattle(s, b));
  assert.equal(next.hp, 35);
  assert(has(next, 'innkeeper'));
  assert.equal(next.rice, s.rice);
  assert.deepEqual(next.position, freshAdventure().position);
});
test('old quiz checkpoints migrate without clearing adventure progress', () => {
  const old = {
    ...flag(freshAdventure(), 'innkeeper'),
    coins: 88,
    battle: { id: 'murmur', hp: 42, maxHp: 70, round: 1, cursor: 1, combo: 1, focus: 3 },
  };
  const next = normalizeAdventure(old);
  assert.equal(next.battle!.version, 2);
  assert.equal(next.coins, 88);
  assert(has(next, 'innkeeper'));
});
test('movement respects the river and solid benches; routes walk around them', () => {
  assert(!walkable({ x: 5, z: -4 }));
  assert(!walkable({ x: 0, z: 2 }));
  assert.deepEqual(stepPlayer({ x: 2, z: 0 }, 0, -1), { x: 2, z: 0 });
  const route = findPath({ x: -5, z: 4.5 }, { x: 1, z: -5.5 });
  assert(route.length > 0);
  assert(route.every(walkable));
  assert.deepEqual(route.at(-1), { x: 1, z: -5.5 });
  for (let i = 1; i < route.length; i++)
    assert(Math.hypot(route[i].x - route[i - 1].x, route[i].z - route[i - 1].z) <= 0.51);
});
test('battle checkpoints survive reload and invalid positions are rejected', () => {
  const s = startBattle(flag(freshAdventure(), 'innkeeper'), 'murmur');
  s.battle!.foes[0].hp = 42;
  assert.deepEqual(normalizeAdventure(JSON.parse(JSON.stringify(s))), s);
  assert.deepEqual(
    normalizeAdventure({ ...s, position: { x: Infinity, z: 0 } }).position,
    freshAdventure().position,
  );
});
