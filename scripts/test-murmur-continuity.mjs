import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {freshAdventure} from '../src/bangkok/adventure.ts';
import {finishFight,word,adventureState as saved} from './expedition-test-helpers.mjs';
const phone=process.argv.includes('--phone'),base=process.env.PLAYTEST_BASE_URL??'http://127.0.0.1:5188/';
const local=base.includes('127.0.0.1'),out=`artifacts/murmur-continuity/${local?'local':'public'}-${phone?'phone':'desktop'}`;
await mkdir(out,{recursive:true});const report={finished:false,base,phone,steps:[],errors:[]};
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
const context=await browser.newContext({viewport:phone?{width:390,height:844}:{width:1440,height:900},isMobile:phone,hasTouch:phone,permissions:['microphone']});
await context.addInitScript(s=>{if(!localStorage.getItem('bangkok-rift-adventure-v1'))localStorage.setItem('bangkok-rift-adventure-v1',JSON.stringify(s));},{...freshAdventure(),flags:['intro','innkeeper']});
const page=await context.newPage();page.setDefaultTimeout(90000);page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
const checkpoint=()=>writeFile(`${out}/progress.json`,JSON.stringify(report,null,2));
async function log(s){report.steps.push(s);await checkpoint();console.log(s);}
const model=()=>page.locator('.bk-world').evaluate(h=>JSON.parse(h.dataset.riverSpirits));
try{
 await checkpoint();await page.goto(base,{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:/Continue adventure/}).click();await page.waitForFunction(()=>!document.querySelector('.bk-loading'));
 await page.getByRole('button',{name:'Walk to Murmur wisp ↗',exact:true}).click();await page.waitForFunction(()=>{const p=JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')).position;return Math.hypot(p.x+16,p.z-30)<.3;},null,{timeout:180000});
 if(local)await page.waitForFunction(()=>JSON.parse(document.querySelector('.bk-world')?.dataset.riverSpirits ?? '{}').worldMurmur);
 await page.screenshot({path:`${out}/lumphini-wisp.png`});await page.getByRole('button',{name:/^E · /}).click();await page.locator('[aria-label="Story conversation"]').waitFor();
 if(local){await page.waitForFunction(()=>{const c=JSON.parse(document.querySelector('.bk-world')?.dataset.conversationCast??'null');return c?.members?.some(m=>m.id==='wisp')&&!c.moving;});const c=await page.locator('.bk-world').evaluate(h=>JSON.parse(h.dataset.conversationCast));const w=c.members.find(m=>m.id==='wisp');for(const member of c.members.filter(m=>m.id!=='wisp'))assert(Math.hypot(member.x-w.x,member.z-w.z)>=1.1);report.cast=c;}
 await page.waitForTimeout(1800);await page.screenshot({path:`${out}/introduction.png`});
 await page.getByRole('button',{name:/^Continue/}).click();await page.getByRole('button',{name:/^Continue/}).click();await page.getByRole('button',{name:'Face the Murmur with Su →',exact:true}).click();await page.locator('.exp-command-panel').waitFor();await page.waitForTimeout(2400);
 if(local){const s=await model();assert.equal(s.creatures[0].model,'MurmurWisp');assert.equal(s.creatures[1].model,'LanternEcho');assert.equal(s.state,'ready');}
 await page.screenshot({path:`${out}/story-battle.png`});await log('Met the Blender Murmur in Lumphini and entered its main-story battle');
 const before=await saved(page);await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:/Continue adventure/}).click();await page.locator('.exp-command-panel').waitFor();assert.deepEqual((await saved(page)).battle,before.battle);
 if(local)await page.waitForFunction(()=>{const s=JSON.parse(document.querySelector('.bk-world')?.dataset.riverSpirits ?? '{}');return s.state==='ready'&&s.creatures?.[0]?.model==='MurmurWisp';});
 await word(page,'First Light','Lantern Echo',true);await finishFight(page,'murmur');assert((await saved(page)).flags.includes('murmur'));assert((await saved(page)).xp>before.xp);await page.getByRole('button',{name:'Walk to Uncle Lek ↗',exact:true}).waitFor();await page.screenshot({path:`${out}/victory.png`});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(report.errors,[]);await log('Reload retained the encounter; a recorded reply and normal battle victory advanced the campaign');report.finished=true;
}catch(e){report.failure=e.stack;await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});throw e;}finally{await checkpoint();await browser.close();}
