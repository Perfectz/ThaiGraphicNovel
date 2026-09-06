import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
import { freshAdventure,actors,moveAdventure } from '../src/bangkok/adventure.ts';
import { cityObstacles } from '../src/bangkok/city.ts';
const hotelOnly=process.argv.includes('--hotel-only');
const out=process.argv.includes('--interior')?'artifacts/hotel-interior':'artifacts/city-architecture'+(hotelOnly?'/hotel':'');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});let page;const errors=[],report={hotel:false,route:false,facades:[],phone:false,remount:false,finished:false};
const checkpoint=()=>writeFile(`${out}/progress.json`,JSON.stringify(report,null,2));
async function ready(){await page.waitForFunction(()=>document.querySelector('.bk-world')?.getAttribute('data-city-props')==='ready'&&JSON.parse(document.querySelector('.bk-world')?.getAttribute('data-city-furniture')??'[]').length===4&&!document.querySelector('.bk-loading'),null,{timeout:120000});}
async function open(fixture,phone=false){const context=await browser.newContext({viewport:phone?{width:390,height:844}:{width:1280,height:900},isMobile:phone,hasTouch:phone});await context.addInitScript(s=>{if(!localStorage.getItem('bangkok-rift-adventure-v1'))localStorage.setItem('bangkok-rift-adventure-v1',JSON.stringify(s));},fixture);page=await context.newPage();page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5188/');await page.getByRole('button',{name:/Continue adventure/}).click();await ready();return context;}
const furniture=()=>page.locator('.bk-world').getAttribute('data-city-furniture').then(JSON.parse);
async function walk(id,area){await page.getByRole('button',{name:'Open town map ↗',exact:true}).click();await page.locator(`.city-map button[data-area="${area}"]`).click();const actor=actors.find(a=>a.id===id);await page.locator('.city-contacts button').filter({hasText:actor.name}).click();await page.locator('.rpg-dialogue').waitFor({timeout:180000});}
try{
 await checkpoint();const fixture={...freshAdventure(),flags:['intro','hotel-journal']};const hotel=await open(fixture);
 const furnishings=await furniture();for(const [id,kind] of [['guest-bed','bed'],['lobby-sofa','seat'],['bedside-table','desk']]){
  const f=furnishings.find(f=>f.id===id),footprint=cityObstacles.find(o=>o.kind===kind&&(id!=='bedside-table'||o.x===-60.85));assert(f);assert(footprint);assert(f.min.x>=footprint.x-.001&&f.max.x<=footprint.x+footprint.w+.001&&f.min.z>=footprint.z-.001&&f.max.z<=footprint.z+footprint.d+.001,id+' must fit collision');
 }
 const table=furnishings.find(f=>f.id==='bedside-table'),lamp=furnishings.find(f=>f.id==='bedside-lamp');
 report.furniture=furnishings;report.lampGap=lamp.min.y-table.max.y;
 assert(Math.abs(report.lampGap)<.001,'Lamp must rest on the actual loaded tabletop');
 await page.screenshot({path:`${out}/hotel-room.png`});report.hotel=true;await checkpoint();
 await walk('hotel-journal','hotel');await page.screenshot({path:`${out}/bedside-route.png`});await page.getByRole('button',{name:'Leave conversation',exact:true}).click();await walk('innkeeper','hotel');await page.locator('.rpg-thai').waitFor();await page.screenshot({path:`${out}/hotel-reception.png`});report.route=true;await page.getByRole('button',{name:'Leave conversation',exact:true}).click();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')));await page.getByRole('button',{name:'Train at camp',exact:true}).click();await page.getByRole('button',{name:/(Begin|Continue) your journey/}).waitFor();await page.waitForFunction(()=>!document.querySelector('.bk-loading'));await page.getByRole('button',{name:/Return to the adventure/}).click();await page.getByRole('button',{name:/Continue adventure/}).click();await ready();assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1'))),saved);report.remount=true;await hotel.close();await checkpoint();console.log('PASS hotel furniture, bedside route, first conversation and remount',JSON.stringify({lampGap:report.lampGap}));
 for(const id of (hotelOnly?[]:['station','cook'])){
  const actor=actors.find(a=>a.id===id),context=await open(moveAdventure({...freshAdventure(),flags:['intro','innkeeper']},{x:actor.x-1,z:actor.z-1}));await page.screenshot({path:`${out}/${id}-facade.png`});await page.keyboard.press('e');await page.locator('.rpg-thai').waitFor();await page.screenshot({path:`${out}/${id}-dialogue.png`});assert((await page.locator('.choice-meaning').first().innerText()).length>0);report.facades.push(id);await context.close();await checkpoint();console.log('PASS facade',id);
 }
 const phone=await open(fixture,true);await page.screenshot({path:`${out}/phone-room.png`});await walk('innkeeper','hotel');await page.locator('.rpg-thai').waitFor();await page.screenshot({path:`${out}/phone-reception.png`});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));report.phone=true;await phone.close();assert.deepEqual(errors,[]);report.finished=true;await checkpoint();console.log('PASS city architecture',JSON.stringify(report));
}catch(e){report.error=String(e);await checkpoint();console.error(await page?.locator('body').innerText().catch(()=>''));await page?.screenshot({path:`${out}/failure.png`}).catch(()=>{});throw e;}finally{await browser.close();}
