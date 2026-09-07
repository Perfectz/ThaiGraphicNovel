import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {freshAdventure,startBattle} from '../src/bangkok/adventure.ts';
const base=process.env.PLAYTEST_BASE_URL;if(!base)throw Error('PLAYTEST_BASE_URL required');
const out='artifacts/pronunciation-power/hosted';await mkdir(out,{recursive:true});
const report={base,finished:false,errors:[]};
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',`--use-file-for-fake-audio-capture=${resolve('artifacts/pronunciation-power/mic.wav')}`]});
try{
 const c=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,permissions:['microphone']});
 const s=startBattle({...freshAdventure(),flags:['intro','innkeeper']},'murmur');
 await c.addInitScript(s=>localStorage.setItem('bangkok-rift-adventure-v1',JSON.stringify(s)),s);
 const p=await c.newPage();p.setDefaultTimeout(55000);p.on('pageerror',e=>report.errors.push(e.message));
 const health=await p.goto(new URL('/api/realtime/battle',base).href);assert.equal(health.status(),200);
 report.health=JSON.parse(await p.locator('body').innerText());assert.equal(report.health.model,'gpt-realtime-2.1');
 await p.goto(base);await p.getByRole('button',{name:/Continue adventure/}).click();await p.waitForFunction(()=>!document.querySelector('.bk-loading'));
 await p.getByRole('button',{name:/^✦ Word arts/}).click();await p.locator('.exp-word-grid button').filter({hasText:'First Light'}).click();await p.locator('.exp-target-list button').filter({hasText:'Lantern Echo'}).click();
 await p.locator('.speak-record').click();await p.getByRole('button',{name:'■ Stop recording',exact:true}).waitFor();await p.waitForTimeout(4200);await p.getByRole('button',{name:'■ Stop recording',exact:true}).click();
 await p.getByRole('button',{name:/Enable pronunciation power/}).click();await p.getByRole('button',{name:'Assess my pronunciation',exact:true}).click();
 if(report.health.available)await p.locator('.speech-verdict').waitFor();
 else await p.getByText(/AI coaching is not configured here/).waitFor();
 const current=await p.evaluate(()=>JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')));assert.deepEqual(current.battle,s.battle);
 await p.screenshot({path:`${out}/voice-state.png`});
 await p.getByRole('button',{name:'Use my spoken reply →',exact:true}).click();await p.locator('.exp-resolving').waitFor({state:'hidden'});
 const after=await p.evaluate(()=>JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')));assert.equal(s.battle.foes[1].hp-after.battle.foes[1].hp,18);assert.equal(after.battle.turn,1);
 assert.deepEqual(report.errors,[]);report.finished=true;await p.screenshot({path:`${out}/attack.png`});
}finally{await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify(report));
