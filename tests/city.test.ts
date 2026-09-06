import test from 'node:test';
import assert from 'node:assert/strict';
import { cityAreas, cityAreaAt, cityObstacles, hotelStart } from '../src/bangkok/city.ts';
import { actors, freshAdventure, normalizeAdventure, findPath, followPath, walkable, moveAdventure, transitTo, completeConversation, flag, startPracticeBattle } from '../src/bangkok/adventure.ts';
test('the adventure starts in the Sukhumvit hotel, with only that district discovered',()=>{
 const s=freshAdventure();assert.deepEqual(s.position,hotelStart);assert.equal(cityAreaAt(s.position),'hotel');assert.deepEqual(s.visited,['hotel']);assert(walkable(s.position));
});
test('every district and NPC is reachable on foot from the hotel, with no collision crossing',()=>{
 for(const destination of [...cityAreas.map(a=>({...a.center,name:a.name})),...actors]) {
  assert(walkable(destination),`${destination.name} stands on reachable ground`);
  const route=findPath(hotelStart,destination);assert(route.length,`Foot route to ${destination.name}`);
  assert.deepEqual(route.at(-1),{x:Math.round(destination.x*2)/2,z:Math.round(destination.z*2)/2});
  assert(route.every(walkable));
  for(let i=1;i<route.length;i++)assert(Math.hypot(route[i].x-route[i-1].x,route[i].z-route[i-1].z)<=.51);
 }
});
test('buildings, furniture and the park lake have solid footprints',()=>{
 for(const obstacle of cityObstacles)assert(!walkable({x:obstacle.x+obstacle.w/2,z:obstacle.z+obstacle.d/2}),obstacle.kind);
 assert(!walkable({x:100,z:100}));assert(!walkable({x:NaN,z:20}));
});

test('continuous walking reaches every NPC across corners and district seams',()=>{
 for(const dt of [1/60,.035]) {
  let p={x:-58.4,z:27.5};
  for(const actor of actors.filter(a=>a.id!=='su')) {
   const route=findPath(p,actor);
   for(let tick=0;tick<10000&&route.length;tick++) {
    p=followPath(p,route,dt*4.5);assert(walkable(p));
   }
   assert.equal(route.length,0,`Did not reach ${actor.name} at ${dt}: ${JSON.stringify(p)}`);
   assert(Math.hypot(p.x-actor.x,p.z-actor.z)<.01);
  }
 }
});
test('walking discovers districts once and discoveries survive a reload',()=>{
 let s=freshAdventure();for(const a of cityAreas){s=moveAdventure(s,a.center);s=moveAdventure(s,a.center);}
 assert.equal(s.visited.length,cityAreas.length);assert.deepEqual(normalizeAdventure(JSON.parse(JSON.stringify(s))),s);
});
test('return transit needs the station favour and a prior visit; it cannot bypass a battle',()=>{
 const fresh=freshAdventure();assert.equal(transitTo(fresh,'sukhumvit'),fresh);
 let s=completeConversation(fresh,'station');assert.equal(transitTo(s,'yaowarat'),s);
 s=moveAdventure(s,cityAreas.find(a=>a.id==='yaowarat')!.center);s=transitTo(s,'hotel');assert.deepEqual(s.position,cityAreas[0].center);
 s=startPracticeBattle(s);assert.equal(transitTo(s,'yaowarat'),s);
});
test('local favours reward once and persist with the old story flags',()=>{
 let s=flag(freshAdventure(),'keeper');for(const id of ['station','gardener','artisan'] as const){s=completeConversation(s,id);assert.equal(completeConversation(s,id),s);}
 assert.equal(s.tea,2);assert.equal(s.coins,35);assert.equal(s.xp,75);assert.deepEqual(normalizeAdventure(s),s);
});
test('a pre-city save retains story, inventory and its valid riverside position',()=>{
 const s=normalizeAdventure({version:1,flags:['innkeeper','cook','chest'],hp:43,rice:4,tea:2,coins:80,xp:95,learned:['hello'],position:{x:-5,z:4.5},battle:null});
 assert.equal(s.worldVersion,2);assert.deepEqual(s.position,{x:-5,z:4.5});assert.equal(s.hp,43);assert.equal(s.coins,80);assert.deepEqual(s.flags,['innkeeper','cook','chest']);assert(s.visited.includes('riverside'));
});
