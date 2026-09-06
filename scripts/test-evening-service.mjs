import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshAdventure, walkable } from '../src/bangkok/adventure.ts';
const only=process.argv.find(a=>a.startsWith('--only='))?.slice(7);
const out=`artifacts/evening-service/browser${only?'/'+only:''}`;await mkdir(out,{recursive:true});
let browser;const report={scenes:[],finished:false},errors=[];let page;
const checkpoint=()=>writeFile(`${out}/progress.json`,JSON.stringify(report,null,2));
const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')));
const display=async()=>JSON.parse(await page.locator('.bk-world').getAttribute('data-city-evening'));
const ready=()=>page.waitForFunction(()=>{const h=document.querySelector('.bk-world');const d=JSON.parse(h?.dataset.cityEvening??'null');return h?.dataset.npcReady==='6'&&d&&d.state!=='loading'&&!document.querySelector('.bk-loading');},null,{timeout:120000});
async function reply(meaning){await page.locator('.thai-choice-list > button').filter({has:page.locator('.choice-meaning',{hasText:meaning})}).click();await page.getByRole('heading',{name:meaning,exact:true}).waitFor();await page.getByRole('button',{name:'Use text only this time',exact:true}).click();}
async function castReady(){await page.waitForFunction(()=>{const c=JSON.parse(document.querySelector('.bk-world')?.dataset.conversationCast??'null');return c&&!c.moving;});}
try{
  for(const c of [
    {name:'mild',route:'food',meaning:'Not spicy, please',chilli:false},
    {name:'chilli',route:'food',meaning:'A little spicy',chilli:true},
    {name:'water-phone',route:'park',meaning:'Water, please',drink:'water',phone:true},
    {name:'tea',route:'park',meaning:'I will take this one',drink:'tea'},
    {name:'fallback',route:'food',meaning:'A little spicy',chilli:true,fallback:true},
    {name:'table-recovery',route:'park',recovery:true},
  ].filter(c=>!only||c.name===only)){
    report.step=c.name;await checkpoint();
    browser=await chromium.launch({headless:true});
    const context=await browser.newContext({viewport:c.phone?{width:390,height:844}:{width:1280,height:900},isMobile:!!c.phone,hasTouch:!!c.phone});
    const s=freshAdventure();s.flags=['intro','innkeeper',`evening-${c.route}`];s.trackedQuest='evening';s.position=c.recovery?{x:-23.8,z:24.15}:c.route==='food'?{x:34,z:16.5}:{x:-25,z:27};
    await context.addInitScript(s=>{if(!localStorage.getItem('bangkok-rift-adventure-v1'))localStorage.setItem('bangkok-rift-adventure-v1',JSON.stringify(s));},s);
    if(c.fallback)await context.route('**/bangkok/models/evening-service.glb',r=>r.abort());
    page=await context.newPage();page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(`${c.name}: ${e.message}`));page.on('console',m=>{if(m.type()==='error'&&!(c.fallback&&m.location().url.includes('evening-service.glb')))errors.push(`${c.name}: ${m.text()}`);});
    await page.goto('http://127.0.0.1:5188/');await page.getByRole('button',{name:/Continue adventure/}).click();await ready();
    assert.equal((await display()).state,c.fallback?'fallback':'ready');
    if(c.recovery){const after=await saved();assert(walkable(after.position));assert(Math.hypot(after.position.x-s.position.x,after.position.z-s.position.z)<1);assert.deepEqual(after.flags,s.flags);await page.getByRole('button',{name:'Walk to Pim ↗',exact:true}).click();await page.getByRole('button',{name:'Continue our evening',exact:true}).waitFor();await page.screenshot({path:`${out}/${c.name}.png`});report.scenes.push({name:c.name,position:after.position});await checkpoint();await context.close();await browser.close();console.log('PASS',c.name);continue;}
    await page.getByRole('button',{name:'Continue our evening',exact:true}).click();await castReady();
    const before=await display();assert.equal(before.meal,false);assert.equal(before.drink,null);
    await page.screenshot({path:`${out}/${c.name}-before.png`});
    await reply(c.meaning);assert.deepEqual(await display(),before,'practising and previewing must not serve the order');
    const beforeConfirm=await saved();
    await page.getByRole('button',{name:'Confirm my order',exact:true}).click();
    await page.waitForFunction(({route,chilli,drink})=>{const d=JSON.parse(document.querySelector('.bk-world')?.dataset.cityEvening??'{}');return d.meal===(route==='food')&&d.chilli===!!chilli&&d.drink===(drink??null);},c);
    await castReady();const served=await display();
    const shown=name=>served.parts.find(p=>p.name===name).visible;
    assert.equal(shown('ChilliAdded'),!!c.chilli);assert.equal(shown('ChilliAside'),!c.chilli);
    if(c.drink){assert.equal(shown('WaterSet'),c.drink==='water');assert.equal(shown('TeaSet'),c.drink==='tea');}
    const cast=JSON.parse(await page.locator('.bk-world').getAttribute('data-conversation-cast')),box=await page.locator('.rpg-dialogue').boundingBox();
    for(const m of cast.members)assert(m.screenY<box.y&&m.screenX>8&&m.screenX<(c.phone?390:1280)-8);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:`${out}/${c.name}-served.png`});
    await page.getByRole('button',{name:'Leave evening conversation',exact:true}).click();await page.screenshot({path:`${out}/${c.name}-world.png`});
    const ordered=await saved();assert.equal(ordered.xp,beforeConfirm.xp,'serving props add no extra XP');assert.equal(ordered.coins,s.coins);
    await page.reload();await page.getByRole('button',{name:/Continue adventure/}).click();await ready();assert.deepEqual(await saved(),ordered);assert.deepEqual(await display(),served);
    await page.getByRole('button',{name:'Continue our evening',exact:true}).click();await castReady();await reply(c.route==='food'?'Very delicious':'Thank you');
    const beforeFinish=await saved();
    await page.getByRole('button',{name:'Keep this evening in our journal',exact:true}).click();const completed=await saved();assert.equal(completed.xp,beforeFinish.xp+60);assert(completed.flags.includes('evening-complete'));
    assert.deepEqual(await display(),served,'the chosen scene remains after the outing');
    if(c.phone){await page.getByRole('button',{name:'Train at camp',exact:true}).click();await page.getByRole('button',{name:/(Begin|Continue) your journey/}).waitFor();await page.getByRole('button',{name:/Return to the adventure/}).click();await page.getByRole('button',{name:/Continue adventure/}).click();await ready();assert.deepEqual(await saved(),completed);assert.deepEqual(await display(),served);}
    report.scenes.push({name:c.name,served});await checkpoint();console.log('PASS',c.name);await context.close();await browser.close();
  }
  assert.deepEqual(errors,[]);report.finished=true;await checkpoint();
}catch(e){report.error=String(e);report.errors=errors;await checkpoint();await page?.screenshot({path:`${out}/failure.png`}).catch(()=>{});throw e;}finally{await browser?.close();}
