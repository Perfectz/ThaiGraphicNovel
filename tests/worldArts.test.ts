import test from 'node:test';
import assert from 'node:assert/strict';
import { worldArts, earnedWorldArts } from '../src/bangkok/worldArts.ts';
import {
  createBattle,
  moves,
  moveReason,
  performMove,
  defend,
  restoreBattle,
} from '../src/bangkok/expeditionCombat.ts';
import {
  freshAdventure,
  flag,
  startBattle,
  startPracticeBattle,
  normalizeAdventure,
  moveAdventure,
} from '../src/bangkok/adventure.ts';
import { advanceCanalErrand, canalApproach } from '../src/bangkok/canalErrand.ts';
import { advanceArchive, archiveClues } from '../src/bangkok/archiveQuest.ts';
import { archiveSites } from '../src/bangkok/archiveLayout.ts';

test('new word arts require completed world stories and keep the eight starting arts available', () => {
  let s = flag(freshAdventure(), 'innkeeper');
  assert.deepEqual(earnedWorldArts(s.flags), []);
  for (const [step, actor] of [
    ['canal-accepted', 'canal-lantern'],
    ['canal-paper', 'gardener'],
    ['canal-frame', 'artisan'],
    ['canal-restored', 'canal-lantern'],
  ] as const) {
    s = moveAdventure(s, canalApproach(actor));
    if (step !== 'canal-restored') assert.deepEqual(earnedWorldArts(s.flags), []);
    s = advanceCanalErrand(s, step);
  }
  assert.deepEqual(earnedWorldArts(s.flags), ['shelter']);
  assert.deepEqual(startBattle(s, 'murmur').battle!.arts, ['shelter']);
  assert.deepEqual(startPracticeBattle(s).battle!.arts, ['shelter']);
  const locked = createBattle('murmur', 100, 2, 1, false);
  assert.equal(performMove(locked, 'open-book', 'murmur'), locked);
  assert.match(moveReason(locked, moves.find((m) => m.id === 'open-book')!)!, /House of Returning Maps/);
  assert.equal(moves.filter((m) => !worldArts.some((a) => a.id === m.id)).length, 8);
});

test('archive discovery and old completed saves unlock an art without restarting an in-progress battle', () => {
  let s = flag(freshAdventure(), 'innkeeper');
  const visit = (actor: (typeof archiveSites)[number]['id'], action: string, answer?: string) => {
    const site = archiveSites.find((a) => a.id === actor)!;
    s = advanceArchive(moveAdventure(s, site), actor, action, answer);
  };
  visit('archivist', 'archive-accepted', 'may-enter');
  for (const clue of archiveClues) visit(clue.id, clue.id);
  visit('archive-cabinet', 'archive-found', 'ferry');
  visit('archivist', 'archive-document', 'may-see-document');
  assert.deepEqual(earnedWorldArts(s.flags), []);
  visit('archivist', 'archive-complete', 'thank-for-time');
  let fight = startBattle(s, 'murmur');
  fight = { ...fight, battle: performMove(fight.battle!, 'greet', 'murmur') };
  const legacy = structuredClone(fight);
  delete legacy.battle!.arts;
  const resumed = normalizeAdventure(legacy);
  assert.deepEqual(resumed.battle!.arts, ['open-book']);
  assert.equal(resumed.battle!.turn, fight.battle!.turn);
  assert.deepEqual(resumed.battle!.foes, fight.battle!.foes);
  const forged = { ...createBattle('murmur', 100, 2, 1, false), arts: ['shelter', 'open-book', 'fake'] };
  assert.deepEqual(restoreBattle(forged, createBattle('murmur', 100, 2, 1, false)).arts, []);
});

test('Lantern Shelter protects Patrick through the enemy phase, then expires on his next turn', () => {
  let b = createBattle('keeper', 100, 2, 1, false, false, undefined, false, ['shelter']);
  b = performMove(b, 'greet', 'keeper');
  const before = structuredClone(b);
  const input = b;
  const ap = b.heroes[0].ap;
  b = performMove(b, 'shelter', 'patrick');
  assert.equal(b.heroes[0].guard, true);
  assert.equal(b.heroes[0].ap, Math.min(6, ap + 1));
  assert.equal(b.heroes[1].ap, before.heroes[1].ap - 2);
  assert.equal(b.heroes[0].hp, 100);
  assert.equal(b.phase, 'defense');
  const after = defend(b, 'miss');
  assert.equal(after.heroes[0].hp, 94, '20 base damage becomes 6 under shelter');
  b = defend(after, 'block');
  assert.equal(b.phase, 'command');
  assert.equal(b.heroes[0].guard, false);
  assert.deepEqual(input, before, 'performing an art leaves its source checkpoint untouched');
  const down = createBattle('keeper', 100, 2, 1, false, false, undefined, false, ['shelter']);
  down.turn = 1;
  down.heroes[0].hp = 0;
  assert.equal(performMove(down, 'shelter', 'patrick'), down);
  const full = createBattle('keeper', 100, 2, 1, false, false, undefined, false, ['shelter']);
  full.turn = 1;
  full.heroes[0].guard = true;
  full.heroes[0].ap = 6;
  assert.equal(performMove(full, 'shelter', 'patrick'), full);
});

test('An Open Book creates a teamwork opening and weakens exactly the next enemy attack', () => {
  const before = createBattle('keeper', 100, 2, 1, false, false, undefined, false, ['open-book']);
  const b = performMove(before, 'open-book', 'keeper');
  assert.equal(b.foes[0].hp, 218);
  assert.equal(b.foes[0].break, 10);
  assert(b.foes[0].exposed && b.foes[0].weakened);
  assert.equal(b.heroes[0].ap, 0);
  const follow = performMove(b, 'thanks', 'keeper');
  assert.equal(follow.foes[0].hp, 194, 'Su consumes exposure for 24 damage');
  assert(!follow.foes[0].exposed);
  const defended = defend(follow, 'miss');
  assert.equal(defended.heroes[0].hp, 90);
  assert(!defended.foes[0].weakened);
  assert.equal(before.foes[0].hp, 230);
});
