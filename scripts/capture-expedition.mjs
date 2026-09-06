import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { freshAdventure, flag } from '../src/bangkok/adventure.ts';
import { adventureState as state, settle } from './expedition-test-helpers.mjs';
await mkdir('artifacts/expedition-verification',{recursive:true});
const browser=await chromium.launch({headless:true});
try {
for(const phone of [false,true]) {
const c=await browser.newContext({viewport:phone?{width:390,height:844}:{width:1440,height:900},isMobile:phone,hasTouch:phone});
let s=freshAdventure();for(const f of ['intro','innkeeper','cook','ferry','murmur','keeper','chest'])s=flag(s,f);s.hp=43;s.rice=0;s.tea=0;
await c.addInitScript(s=>{if(!sessionStorage.getItem('fixture')){localStorage.setItem('bangkok-rift-adventure-v1',JSON.stringify(s));sessionStorage.setItem('fixture','yes');}},s);
const p=await c.newPage();p.setDefaultTimeout(45000);const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:5188/');
await p.getByRole('button',{name:/Rehearse combat/}).click();await p.waitForFunction(()=>!document.querySelector('.bk-loading'));await p.waitForTimeout(2600);
assert.equal((await state(p)).battle.practice,true);assert.equal((await state(p)).battle.id,'keeper');
await p.screenshot({path:`artifacts/expedition-verification/${phone?'09-final-phone':'08-final-desktop'}.png`});
await p.getByRole('button',{name:/^✦ Word arts/}).click();await p.locator('.exp-word-grid button').filter({hasText:'First Light'}).click();await p.locator('.exp-target-list button').filter({hasText:'Lantern Echo'}).click();
const thaiSize=await p.locator('.speak-thai').evaluate(e=>parseFloat(getComputedStyle(e).fontSize));assert(thaiSize>=24);
await p.getByRole('button',{name:'Use text only this time',exact:true}).scrollIntoViewIfNeeded();
await p.screenshot({path:`artifacts/expedition-verification/${phone?'11-final-phone-phrase':'10-final-desktop-phrase'}.png`});
if(!phone){const panel=await p.locator('.exp-command-panel').boundingBox(),party=await p.locator('.exp-party').boundingBox();assert(party.y+party.height<panel.y);}
await p.getByRole('button',{name:'Use text only this time',exact:true}).click();await settle(p);
const checkpoint=(await state(p)).battle;await p.reload();await p.getByRole('button',{name:/Continue adventure/}).click();await settle(p);assert.deepEqual((await state(p)).battle,checkpoint);
await p.getByRole('button',{name:'Retreat',exact:true}).click();const after=await state(p);assert.equal(after.hp,43);assert.equal(after.rice,0);assert.deepEqual(after.flags,s.flags);assert.equal(after.battle,null);
await p.getByRole('button',{name:'Battle practice',exact:true}).click();assert.equal((await state(p)).battle.practice,true);
assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);await c.close();console.log('PASS',phone?'phone':'desktop','final framing, readable Thai, repeatable sparring, checkpoint reload, preserved story/health/supplies');
}
} finally {await browser.close();}
