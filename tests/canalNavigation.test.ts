import test from 'node:test';
import assert from 'node:assert/strict';
import { beginCanalBoat, commandCanalBoat, recallCanalBoat, boatCursor, boatStart, gardenStops, boatCellOpen, normalizeCanalBoat } from '../src/bangkok/canalNavigation.ts';
import { freshAdventure, normalizeAdventure, type AdventureSave } from '../src/bangkok/adventure.ts';
import { questJournal } from '../src/bangkok/questJournal.ts';
const ready = (): AdventureSave => ({ ...freshAdventure(), visited: ['hotel','thonburi'], position: { x: 18, z: -57 }, flags: ['intro','innkeeper','murmur','cook','ferry','keeper','departed','canal-post','canal-junction','blue-house'] });
const command = (s: AdventureSave, id: string) => commandCanalBoat(s, boatCursor(s.canalBoat!), id);
function route(s: AdventureSave, col: number, row: number) {
  const queue = [{ s, steps: [] as string[] }], seen = new Set<string>();
  while (queue.length) {
    const item = queue.shift()!, b = item.s.canalBoat!;
    if (b.col === col && b.row === row) return item.steps;
    const key = `${b.col}:${b.row}:${b.heading}`; if (seen.has(key)) continue; seen.add(key);
    for (const id of ['turn-left','turn-right','go-straight']) queue.push({ s: command(item.s,id).save, steps: [...item.steps,id] });
  }
  throw Error('Unreachable quay');
}
test('garden activity opens only after the letter, at its actual loading steps, outside other activities', () => {
  const s = ready(); assert(beginCanalBoat(s).canalBoat); assert(questJournal(s).some(q => q.id === 'canal-garden'));
  for (const state of [{ ...s, flags: [] }, { ...s, position: { x: 3, z: -68.5 } }, { ...s, passage: 'riverside' as const }, { ...s, escort: { ...s.escort, stage: 'following' as const } }]) assert.equal(beginCanalBoat(state),state);
  assert.equal(normalizeAdventure({ ...freshAdventure(), canalBoat: boatStart() }).canalBoat,undefined);
});
test('turns have relative meaning, straight cannot cross the nursery, and stale commands do nothing', () => {
  let s = beginCanalBoat(ready()); const initial = structuredClone(s), cursor = boatCursor(s.canalBoat!);
  const blocked = command(s,'go-straight'); assert.equal(blocked.reply,'blocked'); assert.equal(blocked.save.canalBoat!.col,3); assert.equal(blocked.save.canalBoat!.row,0);
  s = command(s,'turn-right').save; assert.equal(s.canalBoat!.heading,3);
  assert.equal(commandCanalBoat(s,cursor,'go-straight').save,s);
  s = command(s,'go-straight').save; assert.equal(s.canalBoat!.row,1); assert.equal(s.canalBoat!.col,3);
  s = command(s,'turn-left').save; assert.equal(s.canalBoat!.heading,2);
  assert.equal(s.coins,initial.coins); assert.deepEqual(initial.canalBoat,boatStart());
  assert.equal(command(s,'invented').save,s);
});
test('all quays can be visited in either order; only docking unloads and rewards are once', () => {
  for (const stops of [gardenStops,[...gardenStops].reverse()]) {
    let s = beginCanalBoat(ready()); const original = s;
    assert.equal(command(s,'stop-here').reply,'stopped');
    for (const stop of stops) {
      for (const id of route(s,stop.col,stop.row)) { s = command(s,id).save; assert(boatCellOpen(s.canalBoat!.col,s.canalBoat!.row)); }
      assert(!s.canalBoat!.delivered.includes(stop.id));
      const result = command(s,'stop-here'); assert.equal(result.reply,'delivered'); s = result.save;
      const repeat = command(s,'stop-here'); assert.equal(repeat.reply,'visited'); assert.equal(repeat.save.xp,s.xp);
      assert.deepEqual(normalizeAdventure(JSON.parse(JSON.stringify(s))),s);
    }
    assert.equal(s.xp,original.xp+100); assert.equal(s.coins,original.coins+30); assert.equal(s.tea,original.tea+2);
    assert(s.flags.includes('canal-garden')); assert(questJournal(s).find(q=>q.id==='canal-garden')!.complete);
    s = recallCanalBoat(s); assert.equal(s.canalBoat!.delivered.length,3); assert.equal(s.xp,original.xp+100);
  }
});
test('recall preserves cargo already delivered and malformed saves cannot place boats on quays', () => {
  const s = { ...beginCanalBoat(ready()), canalBoat: { col: 0, row: 1, heading: 0, moves: 9, delivered: ['blue' as const] } };
  const recalled = recallCanalBoat(s); assert.deepEqual(recalled.canalBoat,{ ...boatStart(), moves:10, delivered:['blue'] });
  const b = normalizeCanalBoat({ col: 200, row: -6, heading: NaN, moves: Infinity, delivered: ['blue','blue','bad'] });
  assert.deepEqual(b,{ ...boatStart(), delivered:['blue'] });
  assert.equal(normalizeAdventure({ ...ready(), flags: [...ready().flags,'canal-garden'], canalBoat: boatStart() }).flags.includes('canal-garden'),false);
});
