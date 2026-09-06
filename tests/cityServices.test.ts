import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { cityServices, serviceReason, purchaseService, hostWelcome } from '../src/bangkok/cityServices.ts';
import { actors, freshAdventure, moveAdventure, normalizeAdventure, startPracticeBattle } from '../src/bangkok/adventure.ts';
const at = (host: string) => { const a=actors.find(a=>a.id===host)!;return moveAdventure({...freshAdventure(), flags:['intro','innkeeper','cook','gardener'],hp:30,coins:20},{x:a.x,z:a.z}); };
test('each local service uses an existing Thai reference and a reachable host',()=>{
 for(const service of cityServices){assert(existsSync('public/bangkok/audio/'+service.phrase+'.mp3'));const s=at(service.host);assert.equal(serviceReason(s,service.id),null);}
});
test('services reject remote, unintroduced and mid-battle purchases without mutation',()=>{
 for(const service of cityServices){
  for(const s of [freshAdventure(),{...at(service.host),flags:[]},startPracticeBattle(at(service.host)),{...at(service.host),position:{x:0,z:5}}])assert.equal(purchaseService(s,service.id),s);
 }
 assert(serviceReason(at('cook'),'not-a-service'));
});
test('rice and tea spend the displayed price, cannot overdraw, and persist without XP or story rewards',()=>{
 for(const service of cityServices.filter(s=>s.id!=='room')){
  const s=at(service.host),next=purchaseService(s,service.id);assert.equal(next.coins,s.coins-service.cost);assert.equal(next[service.id],s[service.id]+1);assert.equal(next.xp,s.xp);assert.deepEqual(next.flags,s.flags);assert.deepEqual(normalizeAdventure(JSON.parse(JSON.stringify(next))),next);
  const poor={...s,coins:service.cost-1};assert.equal(purchaseService(poor,service.id),poor);const full={...s,[service.id]:99};assert.equal(purchaseService(full,service.id),full);
 }
});
test('the hotel restores health for free once needed and cannot farm XP or resources',()=>{
 const s=at('innkeeper'),rested=purchaseService(s,'room');assert.equal(rested.hp,100);assert.equal(rested.coins,s.coins);assert.equal(rested.rice,s.rice);assert.equal(rested.xp,s.xp);assert.equal(purchaseService(rested,'room'),rested);
});
test('return conversations acknowledge delivered supper, the quiet park, and the restored lantern',()=>{
 for(const [host,flag] of [['cook','ferry'],['gardener','murmur'],['innkeeper','keeper']] as const){const s=at(host);assert.notEqual(hostWelcome(s,host),hostWelcome({...s,flags:[...s.flags,flag]},host));}
});
