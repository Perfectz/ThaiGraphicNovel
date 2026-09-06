import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
import { freshAdventure } from '../src/bangkok/adventure.ts';
const out='artifacts/city-architecture/fallback';await mkdir(out,{recursive:true});const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:1280,height:900}});await context.addInitScript(s=>localStorage.setItem('bangkok-rift-adventure-v1',JSON.stringify(s)),{...freshAdventure(),flags:['intro']});
 const page=await context.newPage();page.setDefaultTimeout(90000);const errors=[];let blocked=0;page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/hotel-furnishings.glb',route=>route.abort());
 await page.route('**/Bed.glb*',route=>{if(route.request().resourceType()==='fetch'){blocked++;return route.abort();}return route.continue();});
 await page.goto('http://127.0.0.1:5188/');await page.getByRole('button',{name:/Continue adventure/}).click();
 await page.waitForFunction(()=>document.querySelector('.bk-world')?.getAttribute('data-city-props')==='error'&&JSON.parse(document.querySelector('.bk-world')?.getAttribute('data-city-furniture')??'[]').length===3&&!document.querySelector('.bk-loading'));
 assert(blocked>0);const items=JSON.parse(await page.locator('.bk-world').getAttribute('data-city-furniture'));assert(!items.some(i=>i.id==='guest-bed'));assert(Math.abs(items.find(i=>i.id==='bedside-lamp').min.y-items.find(i=>i.id==='bedside-table').max.y)<.001);
 await page.screenshot({path:`${out}/bed-fallback.png`});
 await page.getByRole('button',{name:'Open town map ↗',exact:true}).click();await page.locator('.city-map button[data-area="hotel"]').click();await page.locator('.city-contacts button').filter({hasText:'Mali'}).click();await page.locator('.rpg-thai').waitFor();assert((await page.locator('.choice-meaning').first().innerText()).length>0);assert.deepEqual(errors,[]);
 await writeFile(`${out}/progress.json`,JSON.stringify({finished:true,blockedBedRequests:blocked,otherFurniture:items.map(i=>i.id),conversation:true,errors},null,2));console.log('PASS failed bed model retains playable fallback and aligned remaining furniture');
}finally{await browser.close();}
