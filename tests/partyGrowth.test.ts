import test from 'node:test';
import assert from 'node:assert/strict';
import { partyLevel, partyGrowth, normalizeTalents } from '../src/bangkok/partyGrowth.ts';
import { freshAdventure, toggleTalent, startPracticeBattle, leaveBattle, normalizeAdventure } from '../src/bangkok/adventure.ts';
import { createBattle, performMove, partyAction, restoreBattle } from '../src/bangkok/expeditionCombat.ts';
const battle=(ids:string[])=>createBattle('keeper',100,2,1,false,false,partyGrowth(1100,ids));

test('XP unlocks a capped talent budget and invalid selections cannot exceed it',()=>{
 assert.deepEqual([0,99,100,249,250,450,750,1100,99999].map(partyLevel),[1,1,2,2,3,4,5,6,6]);
 assert.equal(partyLevel(NaN),1);
 assert.deepEqual(normalizeTalents(['ready','ready','guiding','harmony','bad'],2),['ready']);
 assert.deepEqual(normalizeTalents(['harmony','patience','ready','guiding'],6),['harmony','patience','ready']);
});
test('points can be reallocated for free but battle loadouts are locked',()=>{
 let s={...freshAdventure(),xp:100};
 assert.equal(toggleTalent(s,'kindness'),s);
 s=toggleTalent(s,'ready');assert.deepEqual(s.talents,['ready']);assert.equal(toggleTalent(s,'guiding'),s);
 s=toggleTalent(s,'ready');s=toggleTalent(s,'guiding');assert.deepEqual(s.talents,['guiding']);
 const active=startPracticeBattle(s);assert.equal(toggleTalent(active,'guiding'),active);assert.equal(active.battle!.heroes[1].ap,4);
 const back=leaveBattle(active);assert.deepEqual(back,s);
});
test('opening AP talents affect the correct hero only',()=>{
 assert.deepEqual(battle(['ready']).heroes.map(h=>h.ap),[4,3]);
 assert.deepEqual(battle(['guiding']).heroes.map(h=>h.ap),[3,4]);
});
test('break, healing and revival talents change actual combat results',()=>{
 let b=battle(['unhurried']);b.foes[0].break=20;b=performMove(b,'slow','keeper');assert(b.foes[0].staggered);
 let ordinary=battle([]);ordinary.foes[0].break=20;ordinary=performMove(ordinary,'slow','keeper');assert.equal(ordinary.foes[0].break,85);
 b=battle(['kindness']);b.turn=1;b.heroes[0].hp=20;assert.equal(performMove(b,'mend','patrick').heroes[0].hp,68);
 b.heroes[0].hp=0;assert.equal(performMove(b,'mend','patrick').heroes[0].hp,34);
});
test('guard and duet talents support a strategy without timed inputs',()=>{
 let b=battle(['harmony','patience']);b=partyAction(b,'guard');assert.equal(b.resonance,10);
 b.resonance=100;b.heroes[0].hp=20;b.heroes[1].hp=30;b=partyAction(b,'duet');assert.deepEqual(b.heroes.map(h=>h.hp),[45,55]);assert.equal(b.resonance,0);
});
test('reload keeps spent AP and the battle snapshot even if adventure XP grows',()=>{
 let s=toggleTalent({...freshAdventure(),xp:100},'ready');s=startPracticeBattle(s);s.battle!.heroes[0].ap=1;s={...s,xp:450};
 const restored=normalizeAdventure(JSON.parse(JSON.stringify(s)));assert.deepEqual(restored,s);assert.equal(restored.battle!.growth!.level,2);assert.equal(restored.battle!.heroes[0].ap,1);
 const next=startPracticeBattle(leaveBattle(restored));assert.equal(next.battle!.growth!.level,4);assert.equal(next.battle!.heroes[0].ap,4);
});
test('old checkpoints keep old mechanics and malformed growth cannot enter combat',()=>{
 const old=createBattle('keeper',74,1,0,false);old.heroes[0].ap=1;
 const fallback=battle(['ready']);assert.deepEqual(restoreBattle(old,fallback),old);
 for(const growth of [0,null,{level:7,talents:[]},{level:2,talents:['ready','guiding']},{level:3,talents:['bad']}])assert.equal(restoreBattle({...old,growth},fallback),fallback);
 const legacy={...freshAdventure(),talents:undefined,xp:450,battle:old};assert.deepEqual(normalizeAdventure(legacy).talents,[]);assert.deepEqual(normalizeAdventure(legacy).battle,old);
});
