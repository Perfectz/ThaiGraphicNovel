import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {archiveRooms,archiveSites} from '../src/bangkok/archiveLayout.ts';
import {freshAdventure} from '../src/bangkok/adventure.ts';
const phone=process.argv.includes('--phone'),base=process.env.PLAYTEST_BASE_URL??'http://127.0.0.1:5188/';
const out=`artifacts/archive/${phone?'phone':'desktop'}`;await mkdir(out,{recursive:true});
const report={finished:false,base,phone,steps:[],errors:[]};
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
const context=await browser.newContext({viewport:phone?{width:390,height:844}:{width:1440,height:900},isMobile:phone,hasTouch:phone,permissions:['microphone']});
if(phone)await context.addInitScript(s=>{if(!localStorage.getItem('bangkok-rift-adventure-v1'))localStorage.setItem('bangkok-rift-adventure-v1',JSON.stringify(s));},{...freshAdventure(),flags:['intro','innkeeper']});
await context.addInitScript(()=>{window.archiveAudio=[];const Native=window.Audio;window.Audio=class extends Native{constructor(...a){super(...a);window.archiveAudio.push(this);}};});
const page=await context.newPage();page.setDefaultTimeout(60000);
page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')));
const checkpoint=()=>writeFile(`${out}/progress.json`,JSON.stringify(report,null,2));
async function log(s){report.steps.push(s);await checkpoint();console.log(s);}
const panel=()=>page.getByRole('region',{name:'The House of Returning Maps',exact:true});
async function close(){await page.getByRole('button',{name:'Leave archive conversation',exact:true}).click();}
async function at(a){await page.waitForFunction(a=>{const p=JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')).position;return Math.hypot(p.x-a.x,p.z-a.z)<.3;},a,{timeout:180000});}
async function interact(){await page.getByRole('button',{name:/^E · /}).click();}
async function room(id){const r=archiveRooms.find(r=>r.id===id);console.log(`Walking through ${r.name}`);await page.getByRole('button',{name:'Open town map ↗',exact:true}).click();await page.locator('.city-map button[data-area="archive"]').click();await page.getByRole('button',{name:`Walk to ${r.name}`,exact:true}).click();await at({x:r.x+r.w/2,z:r.z+r.d/2});await interact();await panel().waitFor();}
async function speak(id,recorded=true){await page.locator(`[data-phrase-choice="${id}"]`).click();assert((await page.locator('.speak-preview h3[lang=en]').innerText()).length>0);if(recorded){await page.getByRole('button',{name:'◉ Record this line',exact:true}).click();await page.getByRole('button',{name:'■ Stop recording',exact:true}).waitFor();await page.waitForTimeout(650);await page.getByRole('button',{name:'■ Stop recording',exact:true}).click();await page.getByRole('button',{name:'Use my spoken reply →',exact:true}).click();}else await page.getByRole('button',{name:'Use text only this time',exact:true}).click();}
async function finishStory(){for(let i=0;i<10;i++){const d=page.locator('[aria-label="Story conversation"]');if(!await d.count())return;const choices=d.locator('[data-phrase-choice]');if(await choices.count()){const thai=await d.locator('.rpg-thai').innerText();await choices.filter({hasText:thai}).click();await page.getByRole('button',{name:'Use text only this time',exact:true}).click();}await d.getByRole('button',{name:/^(Continue|Back to the adventure)/}).click();}throw Error('story did not finish');}
try{
 await checkpoint();await page.goto(base,{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:phone?/Continue adventure/:/Step through the rift/}).click();await page.waitForFunction(()=>!document.querySelector('.bk-loading'));
 if(!phone){await page.getByRole('button',{name:'Talk to Su',exact:true}).click();await finishStory();await page.getByRole('button',{name:'Walk to Mali ↗',exact:true}).click();await at({x:-49,z:26.5});await interact();await finishStory();assert((await saved()).flags.includes('innkeeper'));}
 await page.getByRole('button',{name:'Journal',exact:true}).click();const quest=page.locator('[data-quest="archive"]');await quest.getByRole('button',{name:'Walk to Kanya ↗',exact:true}).click();await at(archiveSites[0]);await interact();await panel().waitFor();
 if(base.includes('127.0.0.1'))await page.waitForFunction(()=>JSON.parse(document.querySelector('.bk-world').dataset.archive).state==='ready');
 if(await page.getByRole('button',{name:'Stop character voice',exact:true}).count())await page.getByRole('button',{name:'Stop character voice',exact:true}).click();
 await page.getByRole('button',{name:'Hear Kanya',exact:true}).click();await page.waitForFunction(()=>window.archiveAudio.some(a=>a.currentSrc.includes('/bangkok/voices/')&&!a.paused&&a.currentTime>0));
 await page.screenshot({path:`${out}/arrival.png`});await close();assert(!(await saved()).flags.includes('archive-accepted'));await interact();await speak('may-enter');await page.getByRole('button',{name:'Accept Kanya’s search',exact:true}).click();await page.getByText('Follow the details',{exact:true}).waitFor();await close();await log('Walked from Sukhumvit through Old Town; voiced permission unlocks the archive search');
 await room('Maps');assert.equal(await page.locator('.archive-collections').count(),0);await close();
 const order=phone?[['Lantern','archive-lantern'],['River','archive-river'],['Reading','archive-cargo']]:[['Reading','archive-cargo'],['River','archive-river'],['Lantern','archive-lantern']];
 for(const [index,[r,id]] of order.entries()){
   await room(r);await page.screenshot({path:`${out}/${id}.png`});await page.getByRole('button',{name:'Keep this clue',exact:true}).click();assert((await saved()).flags.includes(id));
   if(index===0){await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:/Continue adventure/}).click();assert((await saved()).flags.includes(id));}
 }
 await log('Explored the gallery loop and collected all three clues; reload retained the notebook');
 await room('Maps');await page.getByRole('button',{name:/Road surveys/}).click();await page.getByText(/That collection does not account/).waitFor();assert(!(await saved()).flags.includes('archive-found'));await page.getByRole('button',{name:/Ferry deliveries/}).click();await page.screenshot({path:`${out}/deduction.png`});await page.getByRole('button',{name:'Mark the ferry ledger',exact:true}).click();assert((await saved()).flags.includes('archive-found'));
 await room('Reception');await speak('may-see-document');await page.getByRole('button',{name:'Ask to see the original',exact:true}).click();await page.getByText('The first lights on the water',{exact:true}).waitFor();await speak('thank-for-time');const before=await saved();await page.getByRole('button',{name:'Thank Kanya · complete the visit',exact:true}).click();let after=await saved();assert(after.flags.includes('archive-complete'));assert.equal(after.xp,before.xp+100);assert.equal(after.tea,before.tea+2);assert.equal(after.coins,before.coins+25);
 await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:/Continue adventure/}).click();await room('Reception');assert.equal(await page.locator('[data-phrase-choice]').count(),0);assert.equal((await saved()).xp,after.xp);await page.screenshot({path:`${out}/complete.png`});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(report.errors,[]);await log('Deduced the ledger, recorded both polite replies and received a persistent one-time reward');report.finished=true;
}catch(e){report.failure=e.stack;await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});throw e;}finally{await checkpoint();await browser.close();}
