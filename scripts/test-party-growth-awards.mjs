import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshAdventure, moveAdventure, startPracticeBattle } from '../src/bangkok/adventure.ts';
import { adventureState, settle } from './expedition-test-helpers.mjs';
const out='artifacts/party-growth';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});let page;const errors=[];
async function open(s){const c=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await c.addInitScript(s=>{if(!localStorage.getItem('bangkok-rift-adventure-v1'))localStorage.setItem('bangkok-rift-adventure-v1',JSON.stringify(s));},s);page=await c.newPage();page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5188/');await page.getByRole('button',{name:/Continue adventure/}).click();await page.waitForFunction(()=>!document.querySelector('.bk-loading'));return c;}
try{
 const fixture=moveAdventure({...freshAdventure(),xp:75,flags:['intro','innkeeper']},{x:-60.7,z:33.3});const city=await open(fixture);
 await page.keyboard.press('e');await page.locator('.rpg-dialogue').waitFor();
 const thai=await page.locator('.rpg-thai').innerText();await page.locator('.thai-choice-list button').filter({hasText:thai}).click();await page.getByRole('button',{name:'Use text only this time',exact:true}).click();
 await page.locator('.rpg-dialogue').getByRole('button',{name:/^Continue/}).click();await page.getByRole('button',{name:/Back to the adventure/}).click();
 await page.getByRole('button',{name:'Party growth',exact:true}).click();assert.equal((await adventureState(page)).xp,105);assert.match(await page.locator('.growth-stats').innerText(),/1 \/ 1 talent points/);
 await page.locator('.growth-talents button').filter({hasText:'First to Speak'}).tap();assert.deepEqual((await adventureState(page)).talents,['ready']);
 await page.screenshot({path:`${out}/earned-point-phone.png`});await page.reload();await page.getByRole('button',{name:/Continue adventure/}).click();await page.getByRole('button',{name:'Party growth',exact:true}).click();assert.match(await page.locator('.growth-stats').innerText(),/0 \/ 1 talent points/);await city.close();console.log('PASS exploration XP unlocks a usable point once, including reload');
 const combat=await open(startPracticeBattle({...freshAdventure(),xp:1100,talents:['patience']}));
 const guard=page.getByRole('button',{name:/^◇ Guard/});assert.match(await guard.innerText(),/10 resonance/);await page.screenshot({path:`${out}/guard-phone.png`});await guard.tap();await settle(page);assert.equal((await adventureState(page)).battle.resonance,10);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await combat.close();
 assert.deepEqual(errors,[]);await writeFile(`${out}/awards.json`,JSON.stringify({finished:true,earnedPoint:true,guardPreview:true,phone:true,errors},null,2));console.log('PASS final phone talent readability and Guard bonus');
}catch(e){await page?.screenshot({path:`${out}/awards-failure.png`}).catch(()=>{});console.error(await page?.locator('body').innerText().catch(()=>''));throw e;}finally{await browser.close();}
