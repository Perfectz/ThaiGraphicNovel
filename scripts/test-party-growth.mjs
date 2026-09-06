import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshAdventure, startBattle } from '../src/bangkok/adventure.ts';
import { adventureState, settle } from './expedition-test-helpers.mjs';
const out='artifacts/party-growth';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
let page;const errors=[];const report={allocation:false,combat:false,phone:false,finished:false};
const checkpoint=()=>writeFile(`${out}/progress.json`,JSON.stringify(report,null,2));
async function open(save,phone=false){
 const context=await browser.newContext({viewport:phone?{width:390,height:844}:{width:1280,height:900},isMobile:phone,hasTouch:phone});
 await context.addInitScript(s=>{if(!localStorage.getItem('bangkok-rift-adventure-v1'))localStorage.setItem('bangkok-rift-adventure-v1',JSON.stringify(s));},save);
 page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5188/');await page.getByRole('button',{name:/Continue adventure/}).click();await page.waitForFunction(()=>!document.querySelector('.bk-loading'));return context;
}
const card=name=>page.locator('.growth-talents button').filter({hasText:name});
async function growth(){await page.getByRole('button',{name:'Party growth',exact:true}).click();await page.locator('.party-growth').waitFor();}
async function close(){await page.getByRole('button',{name:/Close dialog/}).click();}
try{
 await checkpoint();const base={...freshAdventure(),flags:['intro','innkeeper'],xp:100};
 const allocation=await open(base);await growth();
 await card('First to Speak').click();assert.equal(await card('A Guiding Voice').isDisabled(),true);assert.equal(await card('Take Your Time').isDisabled(),true);
 await card('First to Speak').click();await card('A Guiding Voice').click();assert.deepEqual((await adventureState(page)).talents,['guiding']);
 await page.reload();await page.getByRole('button',{name:/Continue adventure/}).click();await growth();assert.equal(await card('A Guiding Voice').getAttribute('aria-pressed'),'true');
 await close();await page.getByRole('button',{name:'Battle practice',exact:true}).click();await page.locator('.exp-commands').waitFor();
 assert.deepEqual((await adventureState(page)).battle.heroes.map(h=>h.ap),[3,4]);assert.equal(await page.getByRole('button',{name:'Party growth',exact:true}).count(),0);
 report.allocation=true;await checkpoint();await allocation.close();console.log('PASS talent budget, reallocation, persistence and practice AP');
 const fixture=startBattle({...base,flags:[...base.flags,'cook','ferry','murmur'],xp:1100,talents:['ready','unhurried','kindness','harmony'],hp:40},'keeper');
 assert(fixture.battle,'The combat fixture must satisfy the story encounter gate');
 const combat=await open(fixture);assert.equal((await adventureState(page)).battle.heroes[0].ap,4);
 await page.getByRole('button',{name:/^✦ Word arts/}).click();const slow=page.locator('.exp-word-grid button').filter({hasText:'Still the River'});assert.match(await slow.innerText(),/80 break/);await slow.click();
 await page.locator('.exp-target-list button').filter({hasText:fixture.battle.foes[0].name}).click();
 assert.match(await page.locator('.exp-command-panel').innerText(),/slow/i);
 await page.getByRole('button',{name:'Use text only this time',exact:true}).click();await settle(page);
 let b=(await adventureState(page)).battle;assert.equal(b.foes[0].break,80);assert.equal(b.heroes[0].ap,2);
 await page.reload();await page.getByRole('button',{name:/Continue adventure/}).click();assert.equal((await adventureState(page)).battle.heroes[0].ap,2);
 await page.getByRole('button',{name:/^✦ Word arts/}).click();const mend=page.locator('.exp-word-grid button').filter({hasText:'Make Amends'});assert.match(await mend.innerText(),/48/);await mend.click();
 await page.locator('.exp-target-list button').filter({hasText:'Patrick'}).click();await page.getByRole('button',{name:'Use text only this time',exact:true}).click();await settle(page);
 b=(await adventureState(page)).battle;assert.equal(b.heroes[0].hp,88);assert.deepEqual(b.growth.talents,fixture.talents);
 await page.screenshot({path:`${out}/battle.png`});report.combat=true;await checkpoint();await combat.close();console.log('PASS enhanced break, healing and exact battle reload');
 const phone=await open({...base,xp:1100},true);await growth();
 for(const name of ['First to Speak','Take Your Time','Care in Every Word','A Shared Tomorrow'])await card(name).tap();
 assert.equal(await card('Listen Before Replying').isDisabled(),true);assert.match(await page.locator('.growth-stats').innerText(),/0 \/ 5/);
 await page.locator('.growth-heading').scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/phone.png`});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await card('A Shared Tomorrow').tap();await card('Listen Before Replying').tap();assert.deepEqual((await adventureState(page)).talents,['ready','unhurried','kindness','patience']);
 await close();await page.screenshot({path:`${out}/phone-world.png`});
 await page.setViewportSize({width:1280,height:900});await growth();await page.screenshot({path:`${out}/desktop.png`});
 report.phone=true;await phone.close();assert.deepEqual(errors,[]);report.finished=true;await checkpoint();console.log('PASS',JSON.stringify(report));
}catch(e){report.error=String(e);await checkpoint();console.error(await page?.locator('body').innerText().catch(()=>''));await page?.screenshot({path:`${out}/failure.png`}).catch(()=>{});throw e;}finally{await browser.close();}
