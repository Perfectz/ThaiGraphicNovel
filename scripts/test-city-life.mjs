import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshAdventure, actors, moveAdventure } from '../src/bangkok/adventure.ts';
const reducedOnly=process.argv.includes('--reduced-only');
const out='artifacts/city-life'+(reducedOnly?'/reduced':'');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});let page;
const errors=[],report={districts:[],reducedMotion:false,remount:false,battle:false,finished:false};
const checkpoint=()=>writeFile(`${out}/progress.json`,JSON.stringify(report,null,2));
const life=()=>page.locator('.bk-world').getAttribute('data-city-life').then(JSON.parse);
async function ready(){await page.waitForFunction(()=>Number(document.querySelector('.bk-world')?.getAttribute('data-npc-ready'))===6&&document.querySelector('.bk-world')?.getAttribute('data-city-props')==='ready'&&document.querySelector('.bk-world')?.getAttribute('data-city-life')&&!document.querySelector('.bk-loading'),null,{timeout:120000});}
async function open(id,phone=false,reduce=false){
 const actor=actors.find(a=>a.id===id), fixture=moveAdventure({...freshAdventure(),flags:['intro','innkeeper']},id==='gardener'?{x:-21,z:28}:{x:actor.x-1,z:actor.z-1});
 const context=await browser.newContext({viewport:phone?{width:390,height:844}:{width:1280,height:900},isMobile:phone,hasTouch:phone,reducedMotion:reduce?'reduce':'no-preference'});
 await context.addInitScript(s=>{if(!localStorage.getItem('bangkok-rift-adventure-v1'))localStorage.setItem('bangkok-rift-adventure-v1',JSON.stringify(s));},fixture);
 page=await context.newPage();page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5188/');await page.getByRole('button',{name:/Continue adventure/}).click();await ready();return context;
}
async function changed(key,before){await page.waitForFunction(({key,before})=>Math.abs(JSON.parse(document.querySelector('.bk-world').getAttribute('data-city-life'))[key]-before)>.015,{key,before},{timeout:90000});}
try{
 await checkpoint();
 for(const id of (reducedOnly?[]:['station','cook','gardener'])){
  const context=await open(id);const before=await life();
  if(id==='station'){await changed('trainX',before.trainX);await page.waitForFunction(()=>{const x=JSON.parse(document.querySelector('.bk-world').getAttribute('data-city-life')).trainX;return x>-47&&x<-40;},null,{timeout:90000});}
  if(id==='cook'){assert(before.steamVisible);await changed('lanternAngle',before.lanternAngle);await changed('steamY',before.steamY);}
  if(id==='gardener'){assert(before.birdVisible);await changed('birdX',before.birdX);await changed('rippleScale',before.rippleScale);}
  await page.screenshot({path:`${out}/${id}-explore.png`});
  if(id==='gardener'){
   await page.getByRole('button',{name:'Open town map ↗',exact:true}).click();await page.locator('.city-map button[data-area="lumphini"]').click();await page.locator('.city-contacts button').filter({hasText:'Pim'}).click();
  }else await page.keyboard.press('e');
  await page.locator('.rpg-thai').waitFor();await page.screenshot({path:`${out}/${id}-dialogue.png`});assert((await page.locator('.choice-meaning').first().innerText()).length>0);
  report.districts.push({id,motion:await life(),drawCalls:Number(await page.locator('.bk-world').getAttribute('data-draw-calls'))});await checkpoint();await context.close();console.log('PASS ambient district',id);
 }
 const phone=await open('cook',true,true);const still=await life();assert.equal(still.lanternAngle,0);assert.equal(still.steamVisible,false);
 await page.screenshot({path:`${out}/phone-market.png`});await page.keyboard.press('e');await page.locator('.rpg-thai').waitFor();await page.locator('.thai-choice-list button').first().click();await page.screenshot({path:`${out}/phone-dialogue.png`});assert.equal((await life()).lanternAngle,still.lanternAngle);assert.equal((await life()).steamVisible,false);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.getByRole('button',{name:'Leave conversation',exact:true}).click();report.reducedMotion=true;
 await page.getByRole('button',{name:'Party growth',exact:true}).click();await page.getByRole('button',{name:'Battle practice',exact:true}).click();await page.getByRole('button',{name:/^✦ Word arts/}).waitFor();await page.screenshot({path:`${out}/phone-battle.png`});await page.getByRole('button',{name:'Retreat',exact:true}).click();report.battle=true;
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')));
 await page.getByRole('button',{name:'Train at camp',exact:true}).click();await page.getByRole('button',{name:/(Begin|Continue) your journey/}).waitFor();await page.waitForFunction(()=>!document.querySelector('.bk-loading'));await page.getByRole('button',{name:/Return to the adventure/}).click();await page.getByRole('button',{name:/Continue adventure/}).click();await ready();
 const restored=await page.evaluate(()=>JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')));assert.deepEqual(restored,saved);assert.equal((await life()).steamVisible,false);report.remount=true;await phone.close();
 if(reducedOnly){const station=await open('station',false,true);assert.equal((await life()).trainX,-43);await page.screenshot({path:`${out}/station-still.png`});await page.keyboard.press('e');await page.locator('.rpg-thai').waitFor();assert.equal((await life()).trainX,-43);await station.close();}
 assert.deepEqual(errors,[]);report.finished=true;await checkpoint();console.log('PASS city life',JSON.stringify(report));
}catch(e){report.error=String(e);await checkpoint();console.error(await page?.locator('body').innerText().catch(()=>''));await page?.screenshot({path:`${out}/failure.png`}).catch(()=>{});throw e;}finally{await browser.close();}
