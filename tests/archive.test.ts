import test from 'node:test';
import assert from 'node:assert/strict';
import {freshAdventure,findPath,followPath,walkable,normalizeAdventure,startPracticeBattle,moveAdventure} from '../src/bangkok/adventure.ts';
import {archiveSites,archiveFloors,archiveWalls,archiveFurniture} from '../src/bangkok/archiveLayout.ts';
import {archiveClues,advanceArchive,archiveScene,archiveDestinations} from '../src/bangkok/archiveQuest.ts';
import {questJournal,trackQuest} from '../src/bangkok/questJournal.ts';
import {cityAreaAt,inside} from '../src/bangkok/city.ts';
const at=(s,actor)=>{const a=archiveSites.find(a=>a.id===actor);return moveAdventure(s,{x:a.x,z:a.z});};
function accepted(){let s={...freshAdventure(),flags:['intro','innkeeper']};s=at(s,'archivist');return advanceArchive(s,'archivist','archive-accepted','may-enter');}
test('all archive rooms are physically reachable from the hotel and every exhibit has a clear approach',()=>{
 for(const site of archiveSites){const route=findPath(freshAdventure().position,site);assert(route.length>0,site.id);assert(route.every(walkable));const left=[...route];const end=followPath(freshAdventure().position,left,10000);assert(Math.hypot(end.x-site.x,end.z-site.z)<.01,site.id);assert.equal(cityAreaAt(end),'archive');}
 assert(!walkable({x:77,z:25}),'courtyard basin is viewed from the galleries');
 for(const r of [...archiveWalls,...archiveFurniture])assert(!walkable({x:r.x+r.w/2,z:r.z+r.d/2}));
 assert(archiveFloors.some(r=>inside({x:49,z:32},r)),'continuous east gate entrance');
});
test('permission, all clues, deduction and a polite document request gate the reward',()=>{
 let s=accepted();assert(s.flags.includes('archive-accepted'));const initial={xp:s.xp,coins:s.coins,tea:s.tea};
 assert.equal(advanceArchive(at(s,'archive-cabinet'),'archive-cabinet','archive-found','ferry').flags.includes('archive-found'),false);
 for(const clue of [...archiveClues].reverse()){s=at(s,clue.id);s=advanceArchive(s,clue.id,clue.id);assert(s.flags.includes(clue.id));assert.equal(advanceArchive(s,clue.id,clue.id),s);}
 s=at(s,'archive-cabinet');assert(archiveScene(s,'archive-cabinet').puzzle);assert.equal(advanceArchive(s,'archive-cabinet','archive-found','road'),s);s=advanceArchive(s,'archive-cabinet','archive-found','ferry');
 assert.deepEqual(archiveDestinations(s),['archivist']);s=at(s,'archivist');assert.equal(advanceArchive(s,'archivist','archive-complete','thank-for-time'),s);
 s=advanceArchive(s,'archivist','archive-document','may-see-document');s=advanceArchive(s,'archivist','archive-complete','thank-for-time');
 assert.equal(s.xp,initial.xp+100);assert.equal(s.coins,initial.coins+25);assert.equal(s.tea,initial.tea+2);assert.equal(advanceArchive(s,'archivist','archive-complete','thank-for-time'),s);
 assert(questJournal(s).find(q=>q.id==='archive')?.complete);assert.deepEqual(normalizeAdventure(JSON.parse(JSON.stringify(s))),s);
});
test('remote actions, wrong phrases, battle mode and forged later flags cannot skip exploration',()=>{
 const s=accepted();assert.equal(advanceArchive({...s,position:freshAdventure().position},'archive-cargo','archive-cargo').flags.includes('archive-cargo'),false);
 const before=at({...freshAdventure(),flags:['intro','innkeeper']},'archivist');assert.equal(advanceArchive(before,'archivist','archive-accepted','thank-you'),before);
 const battle=startPracticeBattle(s);assert.equal(advanceArchive(battle,'archivist','archive-document','may-see-document'),battle);
 const forged=normalizeAdventure({...s,flags:[...s.flags,'archive-found','archive-document','archive-complete']});assert(!forged.flags.includes('archive-found'));
 const tracked=trackQuest(s,'archive');assert.equal(tracked.trackedQuest,'archive');assert.equal(normalizeAdventure(JSON.parse(JSON.stringify(tracked))).trackedQuest,'archive');
});
