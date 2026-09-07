import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {freshAdventure} from '../src/bangkok/adventure.ts';
const phone=process.argv.includes('--phone'),base=process.env.PLAYTEST_BASE_URL??'http://127.0.0.1:5188/';
const out=`artifacts/thonburi/${base.includes('127.0.0.1')?'local':'public'}-${phone?'phone':'desktop'}`;await mkdir(out,{recursive:true});
const report={finished:false,base,phone,steps:[],errors:[]};
const checkpoint=()=>writeFile(`${out}/progress.json`,JSON.stringify(report,null,2));
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
const context=await browser.newContext({viewport:phone?{width:390,height:844}:{width:1440,height:950},isMobile:phone,hasTouch:phone,permissions:['microphone']});
await context.addInitScript(s=>{if(!localStorage.getItem('bangkok-rift-adventure-v1'))localStorage.setItem('bangkok-rift-adventure-v1',JSON.stringify(s));},{...freshAdventure(),position:{x:1,z:-5.5},flags:['intro','innkeeper','cook','ferry','murmur','keeper'],xp:380});
const page=await context.newPage();page.setDefaultTimeout(90000);page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')));
async function log(s){report.steps.push(s);await checkpoint();console.log(s);}
let recorded=false;
async function talk(){for(let i=0;i<16;i++){
 const d=page.getByRole('region',{name:'Story conversation',exact:true});if(!await d.count())return;
 const choices=d.locator('[data-phrase-choice]');if(await choices.count()){
  const thai=await d.locator('.rpg-thai').innerText();await choices.filter({hasText:thai}).click();assert((await page.locator('.speak-preview h3[lang=en]').innerText()).length);
  if(!recorded){await page.getByRole('button',{name:'◉ Record this line',exact:true}).click();await page.getByRole('button',{name:'■ Stop recording',exact:true}).waitFor();await page.waitForTimeout(600);await page.getByRole('button',{name:'■ Stop recording',exact:true}).click();await page.getByRole('button',{name:'▷ Play my recording',exact:true}).click();await page.getByRole('button',{name:'Use my spoken reply →',exact:true}).click();recorded=true;}
  else await page.getByRole('button',{name:'Use text only this time',exact:true}).click();
 }
 await d.getByRole('button',{name:/^(Continue|Back to the adventure|Board the ferry)/}).click();
 }throw Error('Conversation did not end');}
async function walk(x,z){
 await page.getByRole('button',{name:'Open town map ↗',exact:true}).click();await page.locator('.city-map button[data-area="thonburi"]').click();
 const chart=page.getByRole('group',{name:'Choose a walking destination on the city chart',exact:true});await chart.scrollIntoViewIfNeeded();
 const p=await chart.evaluate((svg,p)=>{const q=new DOMPoint(p.x,p.z).matrixTransform(svg.getScreenCTM());return{x:q.x,y:q.y};},{x,z});await page.mouse.click(p.x,p.y);
 assert.equal(await chart.getAttribute('data-route-status'),'ready');await page.getByRole('button',{name:'Walk this route →',exact:true}).click();
 await page.waitForFunction(p=>{const s=JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1'));return Math.hypot(s.position.x-p.x,s.position.z-p.z)<.3;},{x,z});
}
async function interact(){await page.getByRole('button',{name:/^E · /}).click();await page.getByRole('region',{name:'Story conversation',exact:true}).waitFor();}
try{
 await checkpoint();await page.goto(base,{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:/Continue adventure/}).click();await page.waitForFunction(()=>!document.querySelector('.bk-loading'));
 await interact();await talk();await page.getByRole('region',{name:'The last ferry crossing',exact:true}).waitFor();
 assert.equal((await saved()).passage,'thonburi');await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:/Continue adventure/}).click();
 await page.getByRole('region',{name:'The last ferry crossing',exact:true}).waitFor();await page.locator('.rpg-ending').waitFor();
 assert.deepEqual((await saved()).position,{x:17,z:-42});assert((await saved()).visited.includes('thonburi'));
 await page.getByRole('button',{name:'Explore Thonburi →',exact:true}).click();await page.getByRole('button',{name:/^Bag ·/}).click();assert(await page.getByText('✉ Niran’s sealed letter — deliver to Suda in Thonburi',{exact:true}).isVisible());await page.getByRole('button',{name:'Close dialog',exact:true}).click();await page.waitForTimeout(1800);await page.screenshot({path:`${out}/landing.png`});await log('Saved crossing resumed and arrived on the explorable other bank');
 await page.getByRole('button',{name:'Open town map ↗',exact:true}).click();await page.locator('.city-map button[data-area="hotel"]').click();assert.equal(await page.locator('.atlas-chart svg').getAttribute('data-route-status'),'ferry');
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 await walk(17,-49);await interact();await page.getByRole('button',{name:'Leave conversation',exact:true}).click();assert(!(await saved()).flags.includes('canal-post'));
 await interact();await talk();assert((await saved()).flags.includes('canal-post'));
 await walk(2,-50.5);await interact();await talk();assert(!(await saved()).flags.includes('blue-house'));await log('Cancellation preserved the letter; the wrong house could not receive it');
 await walk(-5.5,-57);await interact();await talk();assert((await saved()).flags.includes('canal-junction'));
 await walk(-5.5,-68);await page.waitForTimeout(1800);await page.screenshot({path:`${out}/canal-loop.png`});
 await walk(3,-68.5);await interact();await page.waitForTimeout(2400);await page.screenshot({path:`${out}/blue-house.png`});await talk();assert((await saved()).flags.includes('blue-house'));
 const completed=await saved();await interact();await talk();assert.equal((await saved()).xp,completed.xp);assert.equal((await saved()).coins,completed.coins);
 await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:/Continue adventure/}).click();assert((await saved()).flags.includes('blue-house'));await log('Delivered the sealed letter after both route steps; rewards and progress survived reload');
 await page.getByRole('button',{name:'Journal',exact:true}).click();assert(await page.locator('.quest-card[data-quest="canal-garden"]').isVisible());await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 await walk(29,-68);await walk(29,-56);await walk(18,-57);await page.getByRole('button',{name:/^E · /}).click();await page.getByRole('region',{name:'A Garden Between the Quays',exact:true}).waitFor();await page.getByRole('button',{name:'Leave garden boat',exact:true}).click();assert.equal((await saved()).canalBoat,undefined);await log('The delivered letter unlocked the garden activity on the actual canal quay');
 await walk(17,-42);await interact();await talk();
 await page.getByRole('region',{name:'The last ferry crossing',exact:true}).waitFor();assert.equal((await saved()).passage,'riverside');await page.getByRole('button',{name:'Skip crossing →',exact:true}).click();
 await page.getByRole('button',{name:'Open town map ↗',exact:true}).waitFor();assert.deepEqual((await saved()).position,{x:1,z:-5.5});assert((await saved()).flags.includes('blue-house'));
 assert(recorded);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(report.errors,[]);
 await page.screenshot({path:`${out}/returned.png`});report.finished=true;await log('Walked the second bridge and sailed back with the same party and rewards');
}catch(e){report.failure=e.stack;await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});throw e;}finally{await checkpoint();await browser.close();}
