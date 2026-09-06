import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshAdventure, walkable } from '../src/bangkok/adventure.ts';
const only = process.argv.find(a => a.startsWith('--only='))?.slice(7);
const out = `artifacts/blender-landmarks/browser${only ? '/' + only : ''}`; await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true}); const report={scenes:[],finished:false},errors=[]; let page;
const checkpoint=()=>writeFile(`${out}/progress.json`,JSON.stringify(report,null,2));
const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')));
const ready=()=>page.waitForFunction(()=>{ const host=document.querySelector('.bk-world'); const models=JSON.parse(host?.dataset.cityLandmarks ?? '[]'); return host?.dataset.npcReady==='7' && !document.querySelector('.bk-loading') && models.length===2 && models.every(m=>m.state!=='loading'); },null,{timeout:120000});
async function capture(label) { await page.waitForTimeout(900); await page.screenshot({path:`${out}/${label}.png`}); assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)); }
try {
  for(const config of [
    {name:'hall',position:{x:43,z:38.6}},
    {name:'hall-cutaway',position:{x:43,z:32}},
    {name:'pavilion',position:{x:-24.5,z:28.5}},
    {name:'pavilion-phone',position:{x:-25,z:27},phone:true},
    {name:'fallback',position:{x:-25,z:27},fallback:true},
  ].filter(c=>!only||c.name===only)) {
    report.step=config.name; await checkpoint();
    const context=await browser.newContext({viewport:config.phone?{width:390,height:844}:{width:1280,height:900},isMobile:!!config.phone,hasTouch:!!config.phone});
    const s=freshAdventure();s.flags=['intro','innkeeper'];s.position=config.position;s.trackedQuest=config.name.startsWith('hall')?'artisan':'park';
    await context.addInitScript(s=>{if(!localStorage.getItem('bangkok-rift-adventure-v1'))localStorage.setItem('bangkok-rift-adventure-v1',JSON.stringify(s));},s);
    if(config.fallback)await context.route('**/bangkok/models/*.glb',route=>route.abort());
    page=await context.newPage();page.setDefaultTimeout(120000);
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!(config.fallback&&m.location().url.includes('/bangkok/models/')))errors.push(m.text());});
    await page.goto('http://127.0.0.1:5188/');await page.getByRole('button',{name:/Continue adventure/}).click();await ready();
    const models=JSON.parse(await page.locator('.bk-world').getAttribute('data-city-landmarks'));
    for(const model of models){assert.equal(model.state,config.fallback?'fallback':'ready');assert.equal(model.fallback,!!config.fallback);if(!config.fallback)assert.equal(model.parts.length,3);}
    const hall=models.find(m=>m.id==='oldtown-hall');
    if(config.name==='hall')assert(hall.parts.find(p=>p.name==='HallWalls').visible&&hall.parts.find(p=>p.name==='HallRoof').visible);
    if(config.name==='hall-cutaway'){assert(!hall.parts.find(p=>p.name==='HallWalls').visible);assert(!hall.parts.find(p=>p.name==='HallRoof').visible);assert(hall.parts.find(p=>p.name==='HallBase').visible);}
    await capture(config.name);
    if(config.name==='hall') {
      const before=(await read()).position;
      await page.keyboard.down('ArrowUp');await page.waitForTimeout(1400);await page.keyboard.up('ArrowUp');await page.waitForTimeout(900);
      const blocked=(await read()).position;assert(walkable(blocked));assert(blocked.z>=38,'hall remains solid');assert(Math.hypot(blocked.x-before.x,blocked.z-before.z)>.1);
      await page.getByRole('button',{name:'Walk to Arun ↗',exact:true}).click();
      await page.getByRole('button',{name:'E · Arun · lantern maker',exact:true}).waitFor({timeout:240000});
    } else if(config.name==='pavilion') {
      await page.getByRole('button',{name:'Walk to Pim ↗',exact:true}).click();
      await page.getByRole('button',{name:'E · Pim · park volunteer',exact:true}).waitFor({timeout:180000});
    }
    if(config.name!=='hall-cutaway') {
      await page.keyboard.press('e');await page.locator('.rpg-dialogue').waitFor();
      await page.waitForFunction(()=>{const c=JSON.parse(document.querySelector('.bk-world')?.dataset.conversationCast??'null');return c&&!c.moving;});
      assert(await page.locator('.choice-meaning').count()>0);await capture(config.name+'-conversation');
      const cast=JSON.parse(await page.locator('.bk-world').getAttribute('data-conversation-cast')), dialogue=await page.locator('.rpg-dialogue').boundingBox();
      for(const member of cast.members)assert(member.screenX>8&&member.screenX<(config.phone?390:1280)-8&&member.screenY<dialogue.y);
      await page.getByRole('button',{name:'Leave conversation',exact:true}).click();
    }
    if(config.phone) {
      const before=await read();await page.getByRole('button',{name:'Train at camp',exact:true}).click();
      await page.getByRole('button',{name:/(Begin|Continue) your journey/}).waitFor();await page.getByRole('button',{name:/Return to the adventure/}).click();
      await page.getByRole('button',{name:/Continue adventure/}).click();await ready();assert.deepEqual(await read(),before);
      assert(JSON.parse(await page.locator('.bk-world').getAttribute('data-city-landmarks')).every(m=>m.state==='ready'&&!m.fallback));
    }
    const after=await read();assert.equal(after.xp,0);assert.deepEqual(after.flags,['intro','innkeeper']);
    report.scenes.push({name:config.name,models,drawCalls:await page.locator('.bk-world').getAttribute('data-draw-calls')});await checkpoint();console.log('PASS',config.name);await context.close();
  }
  assert.deepEqual(errors,[]);report.finished=true;await checkpoint();
}catch(error){report.error=String(error);report.errors=errors;await checkpoint();await page?.screenshot({path:`${out}/failure.png`}).catch(()=>{});throw error;}finally{await browser.close();}
