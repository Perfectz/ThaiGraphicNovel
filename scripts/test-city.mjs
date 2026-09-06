import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { cityAreaAt, cityAreas } from '../src/bangkok/city.ts';
import { actors } from '../src/bangkok/adventure.ts';
import { finishFight, adventureState as state } from './expedition-test-helpers.mjs';
const out='artifacts/city-verification';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
const errors=[];let p;let recorded=false;
const report={districts:[],conversations:[],battles:[],recorded:false,keyboard:false,touch:false,finished:false};
const livePosition=()=>p.locator('.bk-world').evaluate(e=>({x:Number(e.dataset.playerX),z:Number(e.dataset.playerZ)}));
async function checkpoint(){await writeFile(`${out}/progress.json`,JSON.stringify(report,null,2));}
async function openMap(area){await p.getByRole('button',{name:'Open town map ↗',exact:true}).click();await p.locator(`.city-map button[data-area="${area}"]`).click();}
async function walk(id){
 const npc=actors.find(a=>a.id===id);const area=cityAreaAt(npc);console.log('Walking to',npc.name,'in',area);
 await openMap(area);await p.locator('.city-contacts button').filter({hasText:npc.name}).click();
 await p.locator(['wisp','shrine'].includes(id)?'.exp-command-panel':'.rpg-dialogue').waitFor({timeout:240000});
 assert.equal(cityAreaAt((await state(p)).position),area);
 report.districts=[...new Set([...report.districts,area])];await checkpoint();
}
async function conversation(){
 for(let i=0;i<16;i++){
  if(!await p.locator('.rpg-dialogue').count())return;
  if(await p.locator('.rpg-dialogue .thai-choice-list').count()) {
   const thai=await p.locator('.rpg-thai').innerText();const row=p.locator('.rpg-dialogue .thai-choice-list>button').filter({hasText:thai});
   assert((await row.locator('.choice-meaning').innerText()).length>1);await row.click();
   if(!recorded){
    await p.getByRole('button',{name:'◉ Record this line',exact:true}).click();await p.getByRole('button',{name:'■ Stop recording',exact:true}).waitFor();await p.waitForTimeout(500);await p.getByRole('button',{name:'■ Stop recording',exact:true}).click();await p.getByRole('button',{name:'Use my spoken reply →',exact:true}).click();recorded=true;report.recorded=true;
   }else await p.getByRole('button',{name:'Use text only this time',exact:true}).click();
  }
  await p.locator('.rpg-dialogue').getByRole('button',{name:/^(Continue|Back to the adventure|Board the ferry)/}).click();
 }
 throw new Error('Conversation did not finish');
}
async function meet(id){await walk(id);await p.screenshot({path:`${out}/${id}.png`});await conversation();report.conversations.push(id);await checkpoint();}
try {
 const c=await browser.newContext({viewport:{width:1280,height:900},permissions:['microphone']});p=await c.newPage();p.setDefaultTimeout(60000);p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:5188/');await p.getByRole('button',{name:/Step through the rift/}).click();await p.waitForFunction(()=>!document.querySelector('.bk-loading'));await p.waitForTimeout(1800);
 assert.equal(cityAreaAt((await state(p)).position),'hotel');await p.screenshot({path:`${out}/00-hotel-start.png`});
 const keyStart=await livePosition();await p.keyboard.down('w');await p.waitForTimeout(600);await p.keyboard.up('w');await p.waitForTimeout(600);const keyEnd=await livePosition();assert(Math.hypot(keyEnd.x-keyStart.x,keyEnd.z-keyStart.z)>.2);report.keyboard=true;
 await p.getByRole('button',{name:'Talk to Su',exact:true}).click();await conversation();
 await meet('innkeeper');await meet('chest');assert((await state(p)).flags.includes('chest'));
 await meet('station');assert((await state(p)).flags.includes('station'));
 await openMap('oldtown');assert(await p.getByRole('button',{name:/Use city pass/}).isDisabled());await p.getByRole('button',{name:/Close/}).last().click();
 await meet('gardener');assert((await state(p)).flags.includes('gardener'));
 await walk('wisp');await finishFight(p,'murmur');report.battles.push('murmur');await checkpoint();
 await meet('cook');await meet('ferry');await meet('artisan');assert((await state(p)).flags.includes('artisan'));
 await walk('shrine');await finishFight(p,'keeper');report.battles.push('keeper');await checkpoint();
 assert.equal((await state(p)).visited.length,6);
 const before=await state(p);await openMap('hotel');await p.getByRole('button',{name:'Use city pass',exact:true}).click();await p.waitForFunction(()=>document.querySelector('.bk-world')?.getAttribute('data-city-area')==='hotel');assert.equal(cityAreaAt((await state(p)).position),'hotel');assert.deepEqual((await state(p)).flags,before.flags);
 await p.reload();await p.getByRole('button',{name:/Continue adventure/}).click();assert.equal((await state(p)).visited.length,6);await openMap('riverside');await p.getByRole('button',{name:'Use city pass',exact:true}).click();await meet('ferry');await p.locator('.rpg-ending').waitFor();await p.screenshot({path:`${out}/08-ending.png`});
 await c.close();
 const phone=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});p=await phone.newPage();p.setDefaultTimeout(60000);p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:5188/');await p.getByRole('button',{name:/Step through the rift/}).click();await p.waitForFunction(()=>!document.querySelector('.bk-loading'));await p.screenshot({path:`${out}/09-phone-hotel.png`});
 const touchStart=await livePosition();const pad=await p.getByRole('button',{name:'Walk right',exact:true}).boundingBox();assert(pad);const cdp=await phone.newCDPSession(p);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:pad.x+pad.width/2,y:pad.y+pad.height/2}]});await p.waitForTimeout(600);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(600);const touchEnd=await livePosition();assert(Math.hypot(touchEnd.x-touchStart.x,touchEnd.z-touchStart.z)>.2);report.touch=true;
 await openMap('sukhumvit');await p.screenshot({path:`${out}/10-phone-map.png`});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await phone.close();
 assert.deepEqual(errors,[]);report.finished=true;report.errors=errors;await checkpoint();console.log('PASS full connected-city journey',JSON.stringify(report));
}catch(e){report.error=String(e);await checkpoint();console.error(await p?.locator('body').innerText().catch(()=>''));await p?.screenshot({path:`${out}/failure.png`}).catch(()=>{});throw e;}finally{await browser.close();}
