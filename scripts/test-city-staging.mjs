import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { actors, freshAdventure, walkable } from '../src/bangkok/adventure.ts';
const only=process.argv.find(a=>a.startsWith('--only='))?.split('=')[1];
const out='artifacts/city-staging'+(only?'/'+only:'');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});let page;
const report={scenes:[],finished:false},errors=[];
const checkpoint=()=>writeFile(out+'/progress.json',JSON.stringify(report,null,2));
try {
 for(const [id,phone,reduced] of [['innkeeper',false,false],['station',false,false],['gardener',false,false],['cook',false,false],['artisan',false,false],['ferry',false,false],['cook',true,false],['innkeeper',true,true]].filter(([id])=>!only||id===only)) {
  const actor=actors.find(a=>a.id===id),save=freshAdventure();
  save.position=[[-1,-1],[0,1],[1,-1],[-1,0]].map(([x,z])=>({x:actor.x+x,z:actor.z+z})).find(walkable);
  save.flags=['intro',...(id==='ferry'?['cook']:[])];
  const context=await browser.newContext({viewport:phone?{width:390,height:844}:{width:1280,height:900},isMobile:phone,hasTouch:phone,reducedMotion:reduced?'reduce':'no-preference'});
  await context.addInitScript(s=>localStorage.setItem('bangkok-rift-adventure-v1',JSON.stringify(s)),save);
  page=await context.newPage();page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5188/');await page.getByRole('button',{name:/Continue adventure/}).click();
  await page.waitForFunction(()=>document.querySelector('.bk-world')?.getAttribute('data-npc-ready')==='6'&&document.querySelector('.bk-world')?.getAttribute('data-city-props')==='ready'&&!document.querySelector('.bk-loading'));
  await page.keyboard.press('e');await page.locator('.rpg-dialogue').waitFor();
  await page.waitForFunction(()=>{const c=JSON.parse(document.querySelector('.bk-world')?.getAttribute('data-conversation-cast')??'null');return c&&!c.moving;});
  const snapshot=()=>page.locator('.bk-world').getAttribute('data-city-people').then(JSON.parse);
  const first=(await snapshot()).find(p=>p.id===id);
  if(reduced){await page.waitForTimeout(1200);assert.deepEqual((await snapshot()).find(p=>p.id===id).head,first.head);}
  else await page.waitForFunction(({id,head})=>JSON.stringify(JSON.parse(document.querySelector('.bk-world')?.getAttribute('data-city-people')??'[]').find(p=>p.id===id)?.head)!==JSON.stringify(head),{id,head:first.head});
  await page.waitForTimeout(1000);
  const cast=JSON.parse(await page.locator('.bk-world').getAttribute('data-conversation-cast'));
  const dialogue=await page.locator('.rpg-dialogue').boundingBox();
  for(const member of cast.members){assert(member.screenX>12&&member.screenX<(phone?390:1280)-12,`${id} ${member.id} horizontal`);assert(member.screenY>0&&member.screenY<dialogue.y,`${id} ${member.id} above dialogue`);}
  for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)assert(Math.abs(cast.members[i].screenX-cast.members[j].screenX)>(phone?20:35),`${id} separated silhouettes`);
  assert((await page.locator('.choice-meaning').first().innerText()).length>0);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(phone) assert.equal(await page.locator('.rpg-party-panel').isVisible(),false,'Party HUD must not cover the conversation cast');
  const label=id+(phone?'-phone':'')+(reduced?'-reduced':'');
  await page.screenshot({path:`${out}/${label}.png`});
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')).position),save.position);
  await page.getByRole('button',{name:'Leave conversation',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.bk-world')?.getAttribute('data-conversation-cast')==='null');
  report.scenes.push({id,phone,reduced,cast});await checkpoint();console.log('PASS staging',label);await context.close();
 }
 assert.deepEqual(errors,[]);report.finished=true;await checkpoint();
}catch(e){report.error=String(e);await checkpoint();await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});throw e;}finally{await browser.close();}
