import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, performMove, defend, partyAction, actor, enemyIntent, restoreBattle } from '../src/bangkok/expeditionCombat.ts';
import { freshAdventure, actors, canBattle, startBattle, startPracticeBattle, updateBattle, leaveBattle, normalizeAdventure } from '../src/bangkok/adventure.ts';

test('Waywarden armor halves word damage; exposure pierces armor and break still cancels a turn',()=>{
 let b=createBattle('sentinel',100,2,1,false);b=performMove(b,'greet','sentinel');assert.equal(b.event.value,9);
 b=performMove(b,'reveal','sentinel');assert.equal(b.event.value,5);assert(b.foes[0].exposed);
 b=defend(defend(b,'block'),'block');b=performMove(b,'resolve','sentinel');assert.equal(b.event.value,63);assert.equal(b.foes[0].exposed,false);
 let c=createBattle('sentinel',100,2,1,false);c.foes[0].break=40;c=performMove(c,'slow','sentinel');assert(c.foes[0].staggered);assert(c.foes[0].exposed);
 c=performMove(c,'thanks','echo');assert.equal(actor(c),'echo');
});
test('Waywarden heavy rounds alternate and exact mid-fight checkpoints survive',()=>{
 let b=createBattle('sentinel',100,2,1,false);b=performMove(b,'greet','echo');b=performMove(b,'reveal','sentinel');
 assert.equal(enemyIntent(b).name,'Compass Sweep');b.round=2;assert.equal(enemyIntent(b).damage,34);assert.equal(enemyIntent(b).name,'Four Roads Converge');
 assert.deepEqual(restoreBattle(JSON.parse(JSON.stringify(b)),createBattle('sentinel',100,2,1,false)),b);
});
test('counterattacks and the party duet bypass compass armor',()=>{
 let b=createBattle('sentinel',100,1,1,false);b=partyAction(partyAction(b,'guard'),'guard');
 const hp=b.foes[0].hp;b=defend(b,'parry');assert.equal(b.foes[0].hp,hp-22);
 let duet=createBattle('sentinel',100,1,1,false);duet.resonance=100;duet=partyAction(duet,'duet');assert.equal(duet.foes[0].hp,105);assert.equal(duet.foes[1].hp,0);
});
test('the road challenge requires preparation and proximity, rewards once, and the seal survives reload',()=>{
 const stone=actors.find(a=>a.id==='waystone')!;let s={...freshAdventure(),flags:['intro','innkeeper'],position:{x:stone.x,z:stone.z-1}};
 assert(!canBattle(s,'sentinel'));s.flags.push('station');assert(canBattle(s,'sentinel'));assert(!canBattle({...s,position:freshAdventure().position},'sentinel'));
 s=startBattle(s,'sentinel');assert(s.battle);assert(!canBattle(s,'keeper'));s.battle!.foes.forEach(f=>f.hp=0);s.battle!.phase='victory';
 s=leaveBattle(updateBattle(s,s.battle!));assert(s.flags.includes('sentinel'));assert.equal(s.xp,75);assert.equal(s.coins,45);assert.equal(leaveBattle(s),s);assert(!canBattle(s,'sentinel'));
 s=normalizeAdventure(JSON.parse(JSON.stringify(s)));assert(s.flags.includes('sentinel'));assert.equal(startPracticeBattle(s).battle?.resonance,20);
 const trial=startPracticeBattle(s);const after=leaveBattle(trial);assert.deepEqual(after,s);
});
test('the optional encounter is winnable without reflex timing, a ward, or upgraded talents',()=>{
 let b=createBattle('sentinel',100,1,1,false),steps=0;
 while(!['victory','defeat'].includes(b.phase)&&steps++<120){
  if(b.phase==='defense'){b=defend(b,'block');continue;}
  const hero=b.heroes.find(h=>h.id===actor(b))!,low=b.heroes.find(h=>h.hp<h.maxHp-35);
  if(hero.id==='su'&&low&&hero.ap>=2)b=performMove(b,'mend',low.id);
  else if(low&&low.hp>0&&b.rice)b=partyAction(b,'rice',low.id);
  else if(b.resonance===100&&b.heroes.every(h=>h.hp))b=partyAction(b,'duet');
  else{const target=b.foes[1].hp?b.foes[1]:b.foes[0];b=performMove(b,hero.id==='su'?(target.role==='sentinel'&&!target.exposed&&hero.ap>=2?'reveal':'thanks'):hero.ap>=3?'resolve':'greet',target.id);}
 }
 assert.equal(b.phase,'victory');assert(steps<120);
});
