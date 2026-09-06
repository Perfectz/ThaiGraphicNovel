import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { actors, freshAdventure, moveAdventure } from '../src/bangkok/adventure.ts';
import { adventureState } from './expedition-test-helpers.mjs';
const out='artifacts/city-services';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
let page;const errors=[],report={walkedToShop:false,spoken:false,purchase:false,rest:false,phone:false,reload:false,finished:false};
const checkpoint=()=>writeFile(`${out}/progress.json`,JSON.stringify(report,null,2));
const training=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('bangkok-rift-training-v1')));
async function open(host,phone=false,override={}) {
 const a=actors.find(a=>a.id===host), fixture=moveAdventure({...freshAdventure(),flags:['intro','innkeeper','cook','gardener','ferry','murmur'],hp:40,...override},host==='cook'?{x:a.x-5,z:a.z}:{x:a.x,z:a.z+1.2});
 const context=await browser.newContext({viewport:phone?{width:390,height:844}:{width:1280,height:900},isMobile:phone,hasTouch:phone,permissions:phone?[]:['microphone']});
 await context.addInitScript(s=>{if(!localStorage.getItem('bangkok-rift-adventure-v1'))localStorage.setItem('bangkok-rift-adventure-v1',JSON.stringify(s));},fixture);
 if(phone)await context.addInitScript(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Microphone denied for fallback test','NotAllowedError');};});
 page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5188/');await page.getByRole('button',{name:/Continue adventure/}).click();await page.waitForFunction(()=>!document.querySelector('.bk-loading'));return context;
}
async function enter(){await page.keyboard.press('e');await page.locator('.city-service').waitFor();}
async function offer(){await page.locator('.service-offer').click();assert((await page.locator('.speak-preview h3[lang=en]').innerText()).length>0);}
async function textReply(){await page.getByRole('button',{name:'Use text only this time',exact:true}).click();}
try{
 await checkpoint();const shop=await open('cook');const initial=await adventureState(page);
 await page.getByRole('button',{name:/^Bag/}).click();assert.equal(await page.getByRole('button',{name:/Buy a rice parcel/}).count(),0);
 await page.getByRole('button',{name:/Find provisions in Yaowarat/}).click();await page.locator('.city-contacts button').filter({hasText:'Uncle Lek'}).click();await page.locator('.city-service').waitFor();
 const arrived=(await adventureState(page)).position;assert(Math.hypot(initial.position.x-35,initial.position.z-16.5)>3);assert(Math.hypot(arrived.x-initial.position.x,arrived.z-initial.position.z)>2);assert(Math.hypot(arrived.x-35,arrived.z-16.5)<=3);report.walkedToShop=true;
 await page.keyboard.press('Escape');assert.equal(await page.locator('.city-service').count(),0);await enter();
 assert.match(await page.locator('.service-offer').innerText(),/You will say/);assert.match(await page.locator('.city-service-story').innerText(),/empty bowl/);
 const stopped=(await adventureState(page)).position;await page.keyboard.down('w');await page.waitForTimeout(600);await page.keyboard.up('w');assert.deepEqual((await adventureState(page)).position,stopped);
 await page.screenshot({path:`${out}/lek.png`});await offer();assert.equal((await adventureState(page)).coins,initial.coins);
 const reference=page.waitForResponse(r=>r.url().includes('/bangkok/voices/want-this.mp3')&&r.ok());await page.getByRole('button',{name:'♫ Hear this line',exact:true}).click();await reference;
 await page.getByRole('button',{name:'◉ Record this line',exact:true}).click();await page.getByRole('button',{name:'■ Stop recording',exact:true}).waitFor();await page.waitForTimeout(600);await page.getByRole('button',{name:'■ Stop recording',exact:true}).click();
 await page.getByRole('button',{name:'▷ Play my recording',exact:true}).click();await page.getByRole('button',{name:'Use my spoken reply →',exact:true}).click();
 assert.equal((await training()).records['want-this'].spoken,1);assert.equal((await adventureState(page)).coins,initial.coins);report.spoken=true;
 await page.getByRole('button',{name:'Cancel · keep my coins',exact:true}).click();assert.equal((await adventureState(page)).rice,initial.rice);
 await offer();await textReply();await page.getByRole('button',{name:'Receive rice parcel · pay 10 coins',exact:true}).click();let s=await adventureState(page);assert.equal(s.coins,initial.coins-10);assert.equal(s.rice,initial.rice+1);assert.equal(s.xp,initial.xp+5);assert.equal((await training()).records['want-this'].spoken,1);report.purchase=true;
 await offer();await textReply();await page.reload();await page.getByRole('button',{name:/Continue adventure/}).click();s=await adventureState(page);assert.equal(s.coins,initial.coins-10);assert.equal(s.rice,initial.rice+1);report.reload=true;
 await enter();await offer();await textReply();await page.getByRole('button',{name:'Receive rice parcel · pay 10 coins',exact:true}).click();assert.equal(await page.locator('.service-offer').isDisabled(),true);assert.equal((await adventureState(page)).coins,0);await shop.close();await checkpoint();console.log('PASS local rice purchase, real walk entry, speech, cancellation, reload and budget');
 const hotel=await open('innkeeper');await enter();assert.equal((await adventureState(page)).hp,40);await offer();await textReply();assert.equal((await adventureState(page)).hp,40);await page.getByRole('button',{name:'Rest now · full recovery',exact:true}).click();assert.equal((await adventureState(page)).hp,100);assert.equal((await adventureState(page)).coins,20);assert.equal(await page.locator('.service-offer').isDisabled(),true);await page.screenshot({path:`${out}/hotel.png`});report.rest=true;await hotel.close();await checkpoint();console.log('PASS free hotel recovery by explicit choice');
 const phone=await open('gardener',true);await enter();assert.match(await page.locator('.city-service-story').innerText(),/park back/);await offer();
 await page.getByRole('button',{name:'◉ Record this line',exact:true}).tap();await page.waitForFunction(()=>document.querySelector('.speak-record')?.textContent?.includes('Record this line'));assert.equal(await page.getByRole('button',{name:'Use my spoken reply →',exact:true}).isDisabled(),true);
 await page.screenshot({path:`${out}/phone-tea-preview.png`});const closeBox=await page.getByRole('button',{name:'Leave local services',exact:true}).boundingBox();assert(closeBox&&closeBox.width>=44&&closeBox.height>=44&&closeBox.y>=0&&closeBox.y+closeBox.height<=844);await textReply();await page.getByRole('button',{name:'Receive flask of thai tea · pay 8 coins',exact:true}).tap();assert.equal((await adventureState(page)).tea,2);assert.equal((await adventureState(page)).coins,12);assert.equal((await training()).records['want-this'].spoken,0);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.getByRole('button',{name:'Leave local services',exact:true}).tap();await page.getByRole('button',{name:'Journeys',exact:true}).tap();await page.getByRole('button',{name:'Begin this outing →',exact:true}).tap();await page.getByRole('button',{name:'Open town map ↗',exact:true}).tap();await page.locator('.city-map button[data-area="hotel"]').tap();await page.locator('.city-contacts button').filter({hasText:'Mali'}).tap();await page.locator('.journey-visit').waitFor({timeout:240000});assert.equal(await page.locator('.city-service').count(),0);
 report.phone=true;await phone.close();assert.deepEqual(errors,[]);report.finished=true;await checkpoint();console.log('PASS city services',JSON.stringify(report));
}catch(e){report.error=String(e);await checkpoint();console.error(await page?.locator('body').innerText().catch(()=>''));await page?.screenshot({path:`${out}/failure.png`}).catch(()=>{});throw e;}finally{await browser.close();}
