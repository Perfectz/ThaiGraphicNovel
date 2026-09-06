import test from 'node:test';
import assert from 'node:assert/strict';
import {freshAdventure,flag,completeConversation,storyObjective,startBattle,startPracticeBattle,updateBattle,leaveBattle,normalizeAdventure} from '../src/bangkok/adventure.ts';
import {storyEncounters} from '../src/bangkok/storyEncounters.ts';
test('the campaign sends the checked-in party to a real battle before the supper errand',()=>{
  let s=completeConversation(flag(freshAdventure(),'intro'),'innkeeper');
  assert.equal(storyObjective(s).actor,'wisp');
  const before={xp:s.xp,coins:s.coins};
  s=startBattle(s,'murmur');assert.equal(s.battle!.practice,false);
  const won=structuredClone(s.battle!);won.foes.forEach(f=>f.hp=0);won.phase='victory';won.heroes[0].hp=61;won.rice=0;
  s=leaveBattle(updateBattle(s,won));
  assert.equal(s.hp,61);assert.equal(s.rice,0);assert.equal(s.xp,before.xp+50);assert.equal(s.coins,before.coins+20);
  assert.equal(storyObjective(s).actor,'cook');assert.deepEqual(normalizeAdventure(JSON.parse(JSON.stringify(s))),s);
  s=completeConversation(completeConversation(s,'cook'),'ferry');assert.equal(storyObjective(s).actor,'shrine');
  s=startBattle(s,'keeper');assert.equal(s.battle!.practice,false);
  const boss=structuredClone(s.battle!);boss.foes.forEach(f=>f.hp=0);boss.phase='victory';
  s=leaveBattle(updateBattle(s,boss));assert.equal(storyObjective(s).actor,'ferry');assert(s.flags.includes('keeper'));
});
test('practice victory cannot supply the story spark or unlock the Keeper',()=>{
  const original=completeConversation(flag(freshAdventure(),'intro'),'innkeeper');
  let s=startPracticeBattle(original);const won=structuredClone(s.battle!);won.foes.forEach(f=>f.hp=0);won.phase='victory';
  s=leaveBattle(updateBattle(s,won));assert.deepEqual(s,original);assert.equal(storyObjective(s).actor,'wisp');assert.equal(startBattle(s,'keeper'),s);
});
test('both required encounters have authored introductions and physical world contacts',()=>{
  assert.deepEqual(Object.values(storyEncounters).map(e=>e.actor),['wisp','shrine']);
  for(const encounter of Object.values(storyEncounters)){assert(encounter.lines.length>=2);assert(encounter.enter.includes('with Su'));}
});
