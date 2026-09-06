import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {freshAdventure} from '../src/bangkok/adventure.ts';
import {localDate,addDays} from '../src/bangkok/learning.ts';
const phone=process.argv.includes('--phone'),base=process.env.PLAYTEST_BASE_URL??'http://127.0.0.1:5188/';
const local=base.includes('127.0.0.1'),out=`artifacts/field-review/${local?'local':'public'}-${phone?'phone':'desktop'}`;
await mkdir(out,{recursive:true});const report={finished:false,base,phone,steps:[],errors:[]};
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
const context=await browser.newContext({viewport:phone?{width:390,height:844}:{width:1440,height:950},isMobile:phone,hasTouch:phone,permissions:['microphone']});
await context.addInitScript(s=>{if(!localStorage.getItem('bangkok-rift-adventure-v1'))localStorage.setItem('bangkok-rift-adventure-v1',JSON.stringify(s));},{...freshAdventure(),flags:['intro','innkeeper']});
const page=await context.newPage();page.setDefaultTimeout(90000);page.on('pageerror',e=>report.errors.push(e.message));
const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')));
const training=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('bangkok-rift-training-v1')));
const field=()=>page.getByRole('region',{name:'Return to a city memory',exact:true});
async function log(s){report.steps.push(s);await writeFile(`${out}/progress.json`,JSON.stringify(report,null,2));console.log(s);}
async function revisit(){await page.getByRole('button',{name:'Journal',exact:true}).click();await page.getByRole('button',{name:'Revisit The traveller’s journal ↗',exact:true}).click();await field().waitFor();}
async function enter(){await page.getByRole('button',{name:/Continue adventure/}).click();await page.waitForFunction(()=>!document.querySelector('.bk-loading'));}
const treasure=s=>({xp:s.xp,coins:s.coins,rice:s.rice,tea:s.tea,flags:s.flags});
try{
 await page.goto(base,{waitUntil:'domcontentloaded'});await enter();await page.getByRole('button',{name:'Open town map ↗',exact:true}).click();
 const chart=page.getByRole('group',{name:'Choose a walking destination on the city chart',exact:true});await page.locator('.city-map button[data-area="hotel"]').click();await chart.scrollIntoViewIfNeeded();
 const at=await chart.evaluate(svg=>{const p=new DOMPoint(-61,34.5).matrixTransform(svg.getScreenCTM());return{x:p.x,y:p.y};});await page.mouse.click(at.x,at.y);await page.getByRole('button',{name:'Walk this route →',exact:true}).click();
 await page.waitForFunction(()=>{const p=JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')).position;return Math.hypot(p.x+61,p.z-34.5)<.3;});await page.getByRole('button',{name:/^E · /}).click();
 const thai=await page.locator('.rpg-thai').innerText();await page.locator('.thai-choice-list button').filter({hasText:thai}).click();await page.getByRole('button',{name:'Use text only this time',exact:true}).click();await page.getByRole('button',{name:/^Continue/}).click();await page.getByRole('button',{name:/Back to the adventure/}).click();
 assert((await saved()).flags.includes('hotel-journal'));const original=treasure(await saved());await log('Walked from the hotel room and collected the traveller’s journal through its original speaking choice');
 if(local)await page.waitForFunction(()=>JSON.parse(document.querySelector('.bk-world')?.dataset.visibleMemories??'[]').includes('hotel-journal'));
 await revisit();assert.equal(await field().locator('.journey-recall [lang="th"]').count(),0);assert((await field().locator('[lang="en"]').innerText()).includes('Patrick'));
 const before=await training();await page.getByRole('button',{name:'Show me the Thai first',exact:true}).click();assert(await page.getByRole('button',{name:'I recalled it →',exact:true}).isDisabled());await page.getByRole('button',{name:'Leave memory review',exact:true}).click();assert.deepEqual((await training()).records,before.records);
 await revisit();await page.getByRole('button',{name:'◉ Say it from memory',exact:true}).click();await page.getByRole('button',{name:'■ Stop recording',exact:true}).waitFor();await page.waitForTimeout(700);await page.getByRole('button',{name:'■ Stop recording',exact:true}).click();await page.getByRole('button',{name:'Compare with the Thai →',exact:true}).click();await page.getByRole('button',{name:'▷ Play my recording',exact:true}).click();await page.screenshot({path:`${out}/recorded-review.png`});await page.getByRole('button',{name:'I recalled it →',exact:true}).click();await page.getByRole('button',{name:'Return to the city →',exact:true}).click();
 const result=await training();assert.equal(result.records['my-name-is-patrick'].recalled,1);assert.equal(result.records['my-name-is-patrick'].spoken,1);assert.equal(result.fieldReviews['hotel-journal'],localDate());assert.deepEqual(treasure(await saved()),original);
 await page.reload({waitUntil:'domcontentloaded'});await enter();await page.getByRole('button',{name:'Journal',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Revisit The traveller’s journal ↗',exact:true}).count(),0);await page.getByRole('button',{name:/Close/}).last().click();
 if(local)await page.waitForFunction(()=>!JSON.parse(document.querySelector('.bk-world')?.dataset.visibleMemories??'[]').includes('hotel-journal'));
 await log('Hint cancellation changed no recall records; a recorded return visit persisted without awarding discovery treasure again');
 // Move only the review fixture's dates to yesterday to exercise the next-day return, not the world or reward state.
 await page.evaluate(yesterday=>{const s=JSON.parse(localStorage.getItem('bangkok-rift-training-v1'));s.fieldReviews['hotel-journal']=yesterday;s.records['my-name-is-patrick'].due=yesterday;localStorage.setItem('bangkok-rift-training-v1',JSON.stringify(s));},addDays(localDate(),-1));
 await page.reload({waitUntil:'domcontentloaded'});await enter();await revisit();await page.getByRole('button',{name:'Show me the Thai first',exact:true}).click();assert(await page.getByRole('button',{name:'I recalled it →',exact:true}).isDisabled());await page.getByRole('button',{name:'Needs more practice →',exact:true}).click();await page.getByRole('button',{name:'Return to the city →',exact:true}).click();assert.equal((await training()).records['my-name-is-patrick'].interval,0);assert.equal((await training()).records['my-name-is-patrick'].recalled,1);assert.deepEqual(treasure(await saved()),original);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(report.errors,[]);await page.screenshot({path:`${out}/return-complete.png`});await log('A due return became available again; a hinted self-check stayed due and did not inflate recall');report.finished=true;
}catch(e){report.failure=e.stack;await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});throw e;}finally{await writeFile(`${out}/progress.json`,JSON.stringify(report,null,2));await browser.close();}
