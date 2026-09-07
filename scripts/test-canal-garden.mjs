import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { freshAdventure } from '../src/bangkok/adventure.ts';
import { boatCursor, commandCanalBoat, gardenStops, boatPoint } from '../src/bangkok/canalNavigation.ts';
const phone=process.argv.includes('--phone'), reduced=process.argv.includes('--reduced'), fallback=process.argv.includes('--fallback');
const base=process.env.PLAYTEST_BASE_URL??'http://127.0.0.1:5188/',local=base.includes('127.0.0.1');
const out=`artifacts/canal-garden/${local?'local':'public'}-${phone?'phone':'desktop'}${reduced?'-reduced':''}${fallback?'-fallback':''}`;await mkdir(out,{recursive:true});
const report={finished:false,base,phone,reduced,fallback,steps:[],errors:[],frames:[]};
const checkpoint=()=>writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
const context=await browser.newContext({viewport:phone?{width:390,height:844}:{width:1440,height:950},isMobile:phone,hasTouch:phone,permissions:['microphone'],reducedMotion:reduced?'reduce':'no-preference'});
await context.addInitScript(s=>{if(!localStorage.getItem('bangkok-rift-adventure-v1'))localStorage.setItem('bangkok-rift-adventure-v1',JSON.stringify(s));},{...freshAdventure(),position:{x:18,z:-57},visited:['hotel','thonburi'],flags:['intro','innkeeper','murmur','cook','ferry','keeper','departed','canal-post','canal-junction','blue-house'],xp:380});
if(fallback)await context.route('**/canal-garden-boat.glb',r=>r.abort());
const page=await context.newPage();page.setDefaultTimeout(90000);
page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!(fallback&&m.text().includes('ERR_FAILED')))report.errors.push(m.text());});
const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')));
const panel=()=>page.getByRole('region',{name:'A Garden Between the Quays',exact:true});
async function log(text){report.steps.push(text);console.log(text);await checkpoint();}
async function frame(name){await page.waitForTimeout(2100);await page.screenshot({path:`${out}/${name}.png`});if(local)report.frames.push({name,...JSON.parse(await page.locator('.bk-world').getAttribute('data-canal-garden'))});}
async function open(){await page.getByRole('button',{name:/^E · /}).click();await panel().waitFor();}
let recorded=false;
async function command(id){
 const before=await saved();await panel().locator(`[data-phrase-choice="${id}"]`).click();
 assert((await panel().locator('.speak-preview h3[lang=en]').innerText()).length);
 assert.deepEqual((await saved()).canalBoat,before.canalBoat,'meaning preview cannot move the boat');
 if(!recorded){
  await panel().getByRole('button',{name:'♫ Hear this line',exact:true}).click();
  await panel().getByRole('button',{name:'◉ Record this line',exact:true}).click();await panel().getByRole('button',{name:'■ Stop recording',exact:true}).waitFor();await page.waitForTimeout(650);
  await panel().getByRole('button',{name:'■ Stop recording',exact:true}).click();await panel().getByRole('button',{name:'▷ Play my recording',exact:true}).click();await panel().getByRole('button',{name:'Use my spoken reply →',exact:true}).click();recorded=true;
 }else await panel().getByRole('button',{name:'Use text only this time',exact:true}).click();
 await page.waitForFunction(n=>JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')).canalBoat.moves>n,before.canalBoat.moves);
 await panel().locator('[data-phrase-choice]').first().waitFor();
}
function route(s,stop){
 const queue=[{s,steps:[]}],seen=new Set();
 while(queue.length){const item=queue.shift(),b=item.s.canalBoat;if(b.col===stop.col&&b.row===stop.row)return item.steps;
 const key=`${b.col}:${b.row}:${b.heading}`;if(seen.has(key))continue;seen.add(key);
 for(const id of ['turn-left','turn-right','go-straight'])queue.push({s:commandCanalBoat(item.s,boatCursor(b),id).save,steps:[...item.steps,id]});
 }throw Error('No delivery route');
}
try{
 await checkpoint();const modelResponse=fallback?null:page.waitForResponse(r=>r.url().endsWith('/canal-garden-boat.glb'));
 await page.goto(base,{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:/Continue adventure/}).click();await page.waitForFunction(()=>!document.querySelector('.bk-loading'));
 if(modelResponse){const response=await modelResponse;assert.equal(response.status(),200);const hash=b=>createHash('sha256').update(b).digest('hex');report.modelHash=hash(await response.body());assert.equal(report.modelHash,hash(await readFile('public/bangkok/models/canal-garden-boat.glb')));}
 await open();assert.equal((await saved()).canalBoat,undefined);await page.getByRole('button',{name:'Leave garden boat',exact:true}).click();assert.equal((await saved()).canalBoat,undefined);
 await open();await panel().getByRole('button',{name:'Help with the garden deliveries →',exact:true}).click();
 await frame('loading-steps');assert(await page.getByRole('button',{name:'Journal',exact:true}).isDisabled());assert.equal(await page.locator('.rpg-party-panel').count(),0);
 if(phone)for(const choice of await panel().locator('[data-phrase-choice]').all()){const box=await choice.boundingBox();assert(box&&box.y+box.height<=844,'all four commands fit in the phone viewport');}
 await command('go-straight');assert.equal((await saved()).canalBoat.col,3);assert.equal((await saved()).canalBoat.row,0);assert(await panel().getByText(/That way reaches a quay/).isVisible());
 await command('stop-here');assert.equal((await saved()).canalBoat.delivered.length,0);
 await log('English previews, recorded Thai and blocked directions preserve the cargo');
 for(const stop of [gardenStops[2],gardenStops[1],gardenStops[0]]){
  for(const id of route(await saved(),stop))await command(id);
  assert(!(await saved()).canalBoat.delivered.includes(stop.id));await command('stop-here');assert((await saved()).canalBoat.delivered.includes(stop.id));
  await frame(`delivered-${stop.id}`);
  if(local){const p=boatPoint(stop),r=report.frames.at(-1);assert(r.planted.includes(stop.id));assert(Math.hypot(r.x-p.x,r.z-p.z)<.05);assert.equal(r.cargo,3-(await saved()).canalBoat.delivered.length);}
  if(stop.id==='green'){
   const checkpointBoat=(await saved()).canalBoat;await page.getByRole('button',{name:'Leave garden boat',exact:true}).click();await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:/Continue adventure/}).click();await page.waitForFunction(()=>!document.querySelector('.bk-loading'));
   assert.deepEqual((await saved()).canalBoat,checkpointBoat);await open();await log('First planted quay and boat heading survived leaving and reloading');
  }
 }
 const finished=await saved();assert(finished.flags.includes('canal-garden'));assert.equal(finished.coins,50);assert.equal(finished.tea,3);
 await command('stop-here');assert.equal((await saved()).xp,finished.xp);assert.equal((await saved()).coins,finished.coins);
 await panel().locator('.canal-boat-help summary').click();await panel().getByRole('button',{name:'Recall to loading steps · keep deliveries',exact:true}).click();await panel().locator('[data-phrase-choice]').first().waitFor();assert.equal((await saved()).canalBoat.delivered.length,3);
 await page.getByRole('button',{name:'Leave garden boat',exact:true}).click();await page.getByRole('button',{name:'Journal',exact:true}).click();await page.locator('.quest-completed summary').click();assert(await page.locator('.quest-completed [data-quest="canal-garden"]').isVisible());await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 await frame('garden-complete');assert(recorded);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(report.errors,[]);
 report.finished=true;await log('Three deliveries changed the world, awarded once and retained progress after recall');
}catch(e){report.failure=e.stack;await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});throw e;}
finally{await checkpoint();await browser.close();}
