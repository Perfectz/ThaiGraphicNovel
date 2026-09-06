import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { discoveries, hasRiverCharm, discoveryCount } from '../src/bangkok/discoveries.ts';
import { freshAdventure, completeConversation, normalizeAdventure, moveAdventure, flag, startBattle, leaveBattle, startPracticeBattle } from '../src/bangkok/adventure.ts';
import { cityAreaAt } from '../src/bangkok/city.ts';

test('each district has one discovery and an existing reference phrase',()=>{
  assert.equal(new Set(discoveries.map(d=>d.area)).size,6);
  for(const d of discoveries){assert.equal(cityAreaAt(d),d.area);assert(existsSync(`public/bangkok/audio/${d.phrase}.mp3`));}
});
test('discoveries require proximity, reward once, and survive old-save normalization',()=>{
  let s=freshAdventure();
  for(const d of discoveries){
    const remote={...s,position:{x:0,z:5}};assert.equal(completeConversation(remote,d.id),remote);
    const before=moveAdventure(s,{x:d.x,z:d.z});s=completeConversation(before,d.id);
    assert.equal(s.xp,before.xp+25);assert.equal(s.coins,before.coins+d.coins);assert.equal(s.rice,before.rice+d.rice);assert.equal(s.tea,before.tea+d.tea);
    assert.equal(completeConversation(s,d.id),s);
    assert.deepEqual(normalizeAdventure(JSON.parse(JSON.stringify(s))),s);
  }
  assert.equal(discoveryCount(s.flags),6);assert(hasRiverCharm(s.flags));
  assert(!hasRiverCharm(s.flags.slice(1)));
  assert.equal(discoveryCount(['hotel-journal','hotel-journal']),1);
});
test('River Charm heals only after a story victory, caps at full health, and cannot be farmed in sparring',()=>{
  const original={...flag(freshAdventure(),'innkeeper'),flags:['innkeeper',...discoveries.map(d=>d.id)],hp:80};
  let s=startBattle(original,'murmur');s.battle!.phase='victory';
  let won=leaveBattle(s);assert.equal(won.hp,95);assert.equal(leaveBattle(won),won);
  s={...s,hp:96};won=leaveBattle(s);assert.equal(won.hp,100);
  const rehearsal=startPracticeBattle(original);rehearsal.battle!.phase='victory';assert.equal(leaveBattle(rehearsal).hp,80);
  const retreat=startBattle(original,'murmur');assert.equal(leaveBattle(retreat).hp,80);
  const noCharm=startBattle({...original,flags:['innkeeper']},'murmur');noCharm.battle!.phase='victory';assert.equal(leaveBattle(noCharm).hp,80);
});
