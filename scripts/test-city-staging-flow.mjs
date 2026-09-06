import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshAdventure } from '../src/bangkok/adventure.ts';
const out='artifacts/city-staging/flow';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});let page;const report={finished:false},errors=[];
try {
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await context.addInitScript(s=>{if(!localStorage.getItem('bangkok-rift-adventure-v1'))localStorage.setItem('bangkok-rift-adventure-v1',JSON.stringify(s));},{...freshAdventure(),flags:['intro','innkeeper'],hp:40});
 page=await context.newPage();page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(e.message));
 const ready=()=>page.waitForFunction(()=>document.querySelector('.bk-world')?.getAttribute('data-npc-ready')==='6'&&document.querySelector('.bk-world')?.getAttribute('data-city-props')==='ready'&&!document.querySelector('.bk-loading'));
 const settled=()=>page.waitForFunction(()=>{const c=JSON.parse(document.querySelector('.bk-world')?.getAttribute('data-conversation-cast')??'null');return c&&!c.moving;});
 const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')));
 async function mali(){await page.getByRole('button',{name:'Open town map ↗',exact:true}).tap();await page.locator('.city-map button[data-area="hotel"]').tap();await page.locator('.city-contacts button').filter({hasText:'Mali'}).tap();}
 await page.goto('http://127.0.0.1:5188/');await page.getByRole('button',{name:/Continue adventure/}).click();await ready();
 const initial=(await read()).position;await mali();await page.locator('.city-service').waitFor();await settled();
 assert(Math.hypot((await read()).position.x-initial.x,(await read()).position.z-initial.z)>3);report.walk=true;
 await page.locator('.service-offer').first().tap();await page.locator('.speak-record').waitFor();await page.screenshot({path:out+'/service.png'});
 assert.equal((await read()).hp,40);await page.getByRole('button',{name:'Leave local services',exact:true}).tap();
 await page.getByRole('button',{name:'Journeys',exact:true}).tap();await page.getByRole('button',{name:'Begin this outing →',exact:true}).tap();await mali();await page.locator('.journey-visit').waitFor();await settled();
  const cast=JSON.parse(await page.locator('.bk-world').getAttribute('data-conversation-cast'));assert(cast.members.some(m=>m.id==='innkeeper'));
  const toast=await page.locator('.rpg-toast').boundingBox();if(toast)assert(toast.y+toast.height<170,'Outing notice stays above the conversation cast');
 await page.screenshot({path:out+'/journey.png'});await page.keyboard.press('Escape');report.journey=true;
 await page.getByRole('button',{name:'Party growth',exact:true}).tap();await page.getByRole('button',{name:'Battle practice',exact:true}).tap();await page.getByRole('button',{name:/^✦ Word arts/}).waitFor();await page.screenshot({path:out+'/battle.png'});await page.getByRole('button',{name:'Retreat',exact:true}).tap();report.battle=true;
 const saved=await read();await page.getByRole('button',{name:'Train at camp',exact:true}).tap();await page.getByRole('button',{name:/(Begin|Continue) your journey/}).waitFor();await page.waitForFunction(()=>!document.querySelector('.bk-loading'));await page.getByRole('button',{name:/Return to the adventure/}).tap();await page.getByRole('button',{name:/Continue adventure/}).click();await ready();assert.deepEqual(await read(),saved);report.remount=true;
 assert.deepEqual(errors,[]);report.finished=true;await writeFile(out+'/progress.json',JSON.stringify(report,null,2));console.log('PASS walked hotel service, outing, battle/retreat and camp remount',JSON.stringify(report));
}catch(e){report.error=String(e);await writeFile(out+'/progress.json',JSON.stringify(report,null,2));await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});throw e;}finally{await browser.close();}
