import test from 'node:test';
import assert from 'node:assert/strict';
import {freshAdventure,normalizeAdventure,findPath,followPath,walkable,transitTo,startPracticeBattle,completeConversation} from '../src/bangkok/adventure.ts';
import {beginRiverCrossing,arriveAcrossRiver,westLanding,eastLanding,thonburiSites,canalHouses} from '../src/bangkok/thonburi.ts';
import {crossingPose} from '../src/bangkok/ferryPassage.ts';
const ready=()=>({...freshAdventure(),flags:['intro','innkeeper','murmur','cook','ferry','keeper'],position:{...eastLanding}});
test('crossing requires story progress and a nearby landing, persists mid-voyage and awards no extra rewards',()=>{
 const s=ready();assert.equal(beginRiverCrossing(freshAdventure(),'thonburi').passage,undefined);
 assert.equal(beginRiverCrossing({...s,position:{x:1,z:5}},'thonburi').passage,undefined);
 assert.equal(beginRiverCrossing(startPracticeBattle(s),'thonburi').passage,undefined);
 const underway=beginRiverCrossing(s,'thonburi');assert.equal(underway.passage,'thonburi');assert(!underway.flags.includes('departed'));
 assert.equal(normalizeAdventure(JSON.parse(JSON.stringify(underway))).passage,'thonburi');
 const arrived=arriveAcrossRiver(underway);assert.deepEqual(arrived.position,westLanding);assert(arrived.visited.includes('thonburi'));assert(arrived.flags.includes('departed'));assert.equal(arrived.xp,s.xp);assert.equal(arrived.coins,s.coins);
 assert.equal(arriveAcrossRiver(arrived),arrived);assert.equal(transitTo({...arrived,flags:[...arrived.flags,'station']},'hotel').position,arrived.position);
 const back=arriveAcrossRiver(beginRiverCrossing(arrived,'riverside'));assert.deepEqual(back.position,eastLanding);assert.equal(back.xp,s.xp);assert.equal(back.coins,s.coins);
 assert.deepEqual(normalizeAdventure(JSON.parse(JSON.stringify(back))).position,eastLanding);
 assert.deepEqual({x:crossingPose(1).x,z:crossingPose(1).z},{x:17,z:-37});
});
test('the other bank has two actual footbridges and water cannot be used as a shortcut',()=>{
 assert.equal(findPath(eastLanding,westLanding).length,0);
 for(const p of [{x:0,z:-20},{x:12,z:-62},{x:20,z:-65}])assert(!walkable(p));
 for(const h of canalHouses)assert(!walkable({x:h.x+h.w/2,z:h.z+h.d/2}));
 let p={...westLanding};
 for(const target of [{x:-5.5,z:-57},{x:-5.5,z:-68},{x:29,z:-68},{x:29,z:-56},westLanding]){
  const route=findPath(p,target);assert(route.length);for(let i=0;i<10000&&route.length;i++){p=followPath(p,route,.1);assert(walkable(p));}assert.equal(route.length,0);assert.deepEqual(p,target);
 }
});
test('the sealed letter needs both route steps and the correct nearby house; completion survives reload and cannot be farmed',()=>{
 let s=arriveAcrossRiver(beginRiverCrossing(ready(),'thonburi'));
 assert.equal(completeConversation(s,'blue-house'),s);assert.equal(completeConversation(s,'canal-junction'),s);
 const before={xp:s.xp,coins:s.coins,tea:s.tea};
 for(const id of ['canal-post','canal-junction','blue-house'] as const){
  const a=thonburiSites.find(a=>a.id===id)!;s={...s,position:{x:a.x,z:a.z}};
  assert.equal(completeConversation(s,'red-house'),s);
  s=completeConversation(s,id);assert(s.flags.includes(id));assert.equal(completeConversation(s,id),s);
  s=normalizeAdventure(JSON.parse(JSON.stringify(s)));
 }
 assert.equal(s.xp,before.xp+80);assert.equal(s.coins,before.coins+20);assert.equal(s.tea,before.tea+1);
 const repaired=normalizeAdventure({...s,flags:['departed','blue-house']});assert(!repaired.flags.includes('blue-house'));
});
