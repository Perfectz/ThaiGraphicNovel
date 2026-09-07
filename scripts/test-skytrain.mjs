import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {freshAdventure} from '../src/bangkok/adventure.ts';
import {cityAreaAt} from '../src/bangkok/city.ts';
const base=process.env.PLAYTEST_BASE_URL??'http://127.0.0.1:5188/',local=base.includes('127.0.0.1');
const only=process.argv.find(s=>s.startsWith('--only='))?.slice(7),out=`artifacts/blender-skytrain/${local?'local':'public'}`;
await mkdir(out,{recursive:true});const report={finished:false,base,cases:[],errors:[]};
const browser=await chromium.launch({headless:true,channel:'chrome'});
const digest=b=>createHash('sha256').update(b).digest('hex'),expected=digest(await readFile('public/bangkok/models/sukhumvit-railway.glb'));
let page;const checkpoint=()=>writeFile(`${out}/progress${only?'-'+only:''}.json`,JSON.stringify(report,null,2));
const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')));
const rail=()=>page.locator('.bk-world').evaluate(h=>JSON.parse(h.dataset.cityRailway));
async function talk(){for(let i=0;i<10;i++){const d=page.getByRole('region',{name:'Story conversation',exact:true});if(!await d.count())return;const choices=d.locator('[data-phrase-choice]');if(await choices.count()){const thai=await d.locator('.rpg-thai').innerText();await choices.filter({hasText:thai}).click();await page.getByRole('button',{name:'Use text only this time',exact:true}).click();}await d.getByRole('button',{name:/^(Continue|Back to the adventure)/}).click();}throw Error('Conversation did not finish');}
try{
 for(const c of [{name:'desktop'},{name:'phone',phone:true},{name:'reduced',reduced:true},{name:'fallback',fallback:true}].filter(c=>!only||c.name===only)){
  report.phase=c.name;await checkpoint();const context=await browser.newContext({viewport:c.phone?{width:390,height:844}:{width:1440,height:950},isMobile:!!c.phone,hasTouch:!!c.phone,reducedMotion:c.reduced?'reduce':'no-preference'});
  await context.addInitScript(s=>{if(!localStorage.getItem('bangkok-rift-adventure-v1'))localStorage.setItem('bangkok-rift-adventure-v1',JSON.stringify(s));},{...freshAdventure(),flags:['intro','innkeeper']});
  if(c.fallback)await context.route('**/sukhumvit-railway.glb',r=>r.abort());page=await context.newPage();page.setDefaultTimeout(120000);page.on('pageerror',e=>report.errors.push(e.message));
  const asset=c.fallback?null:page.waitForResponse(r=>r.url().endsWith('/sukhumvit-railway.glb'));
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:/Continue adventure/}).click();await page.waitForFunction(()=>!document.querySelector('.bk-loading'));
  if(asset){const response=await asset;assert.equal(response.status(),200);assert.equal(digest(await response.body()),expected);}
  if(local)await page.waitForFunction(state=>JSON.parse(document.querySelector('.bk-world')?.dataset.cityRailway??'{}').state===state,c.fallback?'fallback':'ready');
  if(c.phone){
   const card=page.locator('.rpg-objective'),details=page.getByRole('button',{name:'Quest details ▾',exact:true});
   assert.equal(await details.getAttribute('aria-expanded'),'false');assert(!await card.locator('h2').isVisible());
   const compact=(await card.boundingBox()).height;assert(compact<180,'compact phone quest leaves the street visible');
   assert(await card.getByRole('button',{name:/^Walk to /}).isVisible());assert(await card.getByRole('button',{name:'Open town map ↗',exact:true}).isVisible());
   await details.click();assert(await card.locator('h2').isVisible());assert(await card.getByLabel('Main story battles').isVisible());assert((await card.boundingBox()).height>compact);
   await page.getByRole('button',{name:'Hide quest details ▴',exact:true}).click();assert(!await card.locator('h2').isVisible());
  }
  await page.getByRole('button',{name:'Open town map ↗',exact:true}).click();await page.locator('.city-map button[data-area="sukhumvit"]').click();
  const chart=page.getByRole('group',{name:'Choose a walking destination on the city chart',exact:true});await chart.scrollIntoViewIfNeeded();const p=await chart.evaluate(svg=>{const p=new DOMPoint(-47,12).matrixTransform(svg.getScreenCTM());return{x:p.x,y:p.y};});await page.mouse.click(p.x,p.y);await page.getByRole('button',{name:'Walk this route →',exact:true}).click();
  await page.waitForFunction(()=>{const p=JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')).position;return Math.hypot(p.x+47,p.z-12)<.3;});await page.waitForTimeout(2200);await page.screenshot({path:`${out}/${c.name}-railway.png`});
  await page.getByRole('button',{name:'Open town map ↗',exact:true}).click();await page.locator('.city-map button[data-area="sukhumvit"]').click();await page.locator('.city-contacts button[data-area="station"]').click();await page.getByRole('region',{name:'Story conversation',exact:true}).waitFor();
  if(local){const r=await rail();assert(r.visible);assert.equal(r.trainFallback,!!c.fallback);assert.equal(r.guideFallback,!!c.fallback);assert.equal(r.trainY,4.62);assert.equal(r.trainZ,9.3);
   if(c.reduced){assert.equal(r.trainX,-43);await page.waitForTimeout(1000);assert.equal((await rail()).trainX,-43);}else await page.waitForFunction(x=>Math.abs(JSON.parse(document.querySelector('.bk-world').dataset.cityRailway).trainX-x)>.1,r.trainX,{timeout:15000});}
  await page.screenshot({path:`${out}/${c.name}-dao.png`});await talk();assert((await saved()).flags.includes('station'));await page.screenshot({path:`${out}/${c.name}-street.png`});
  await page.getByRole('button',{name:'Open town map ↗',exact:true}).click();await page.locator('.city-map button[data-area="hotel"]').click();await page.getByRole('button',{name:'Use city pass',exact:true}).click();assert.equal(cityAreaAt((await saved()).position),'hotel');
  await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:/Continue adventure/}).click();assert((await saved()).flags.includes('station'));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  report.cases.push({name:c.name,asset:c.fallback?'fallback':expected,stationConversation:true,returnAndReload:true});await checkpoint();await context.close();console.log('PASS railway',c.name);
 }
 assert.deepEqual(report.errors,[]);report.finished=true;
}catch(e){report.failure=e.stack;await page?.screenshot({path:`${out}/failure.png`}).catch(()=>{});throw e;}finally{await checkpoint();await browser.close();}
