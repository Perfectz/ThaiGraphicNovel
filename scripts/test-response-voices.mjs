import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {freshAdventure} from '../src/bangkok/adventure.ts';
import {discoveries} from '../src/bangkok/discoveries.ts';
import {cityServices} from '../src/bangkok/cityServices.ts';
import {eveningResponse} from '../src/bangkok/eveningOuting.ts';
import {escortArrival} from '../src/bangkok/stationEscort.ts';

const out='artifacts/response-voices/browser';await mkdir(out,{recursive:true});
const manifest=JSON.parse(await readFile('public/bangkok/voices/manifest.json','utf8'));
const report={finished:false,cases:[],errors:[]};let page;
const checkpoint=()=>writeFile(`${out}/progress.json`,JSON.stringify(report,null,2));
const browser=await chromium.launch({headless:true,channel:'chrome'});
const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')));
async function reply(id){
  await page.locator(`[data-phrase-choice="${id}"]`).click();
  assert((await page.locator('.speak-preview h3[lang=en]').innerText()).length>0);
  await page.getByRole('button',{name:'Use text only this time',exact:true}).click();
}
async function heard(speaker,text){
  const clip=manifest.clips[`${speaker}|${text}`];assert(clip,`missing ${speaker} response`);
  await page.waitForFunction(url=>window.responseAudio.some(a=>a.currentSrc.endsWith(url)&&!a.paused&&a.currentTime>.05),clip.url);
  assert.equal(await page.evaluate(()=>window.responseAudio.filter(a=>a.currentSrc.includes('/bangkok/voices/')&&!a.paused&&!a.ended).length),1,'only one voice at a time');
  assert.equal(await page.locator('.character-voice').count(),1);
}
try{
  for(const phone of [false,true])for(const kind of ['discovery','evening','service','escort']){
    const label=`${phone?'phone':'desktop'}-${kind}`;console.log(label);report.step=label;await checkpoint();
    const s={...freshAdventure(),flags:['intro','innkeeper','cook','gardener','station'],hp:40};
    if(kind==='discovery')s.position={x:-60.8,z:33.3};
    if(kind==='evening')s.position={x:-48,z:26.5};
    if(kind==='service')s.position={x:-49,z:27.7};
    if(kind==='escort'){s.position={x:-39.5,z:17};s.escort={stage:'arrived',position:{x:-41.5,z:17}};}
    const context=await browser.newContext({viewport:phone?{width:390,height:844}:{width:1440,height:900},isMobile:phone,hasTouch:phone});
    await context.addInitScript(s=>{
      localStorage.setItem('bangkok-rift-adventure-v1',JSON.stringify(s));
      window.responseAudio=[];const Native=window.Audio;
      window.Audio=class extends Native{constructor(...args){super(...args);window.responseAudio.push(this);}};
    },s);
    page=await context.newPage();page.setDefaultTimeout(90000);
    page.on('pageerror',e=>report.errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
    await page.goto('http://127.0.0.1:5188/',{waitUntil:'domcontentloaded'});
    await page.getByRole('button',{name:/Continue adventure/}).click();
    await page.waitForFunction(()=>!document.querySelector('.bk-loading'));
    let close;
    if(kind==='discovery'){
      await page.keyboard.press('e');await reply('my-name-is-patrick');
      await heard('Su',discoveries[0].response);
      assert(!(await saved()).flags.includes('hotel-journal'),'audio does not claim the discovery');
      close='Leave conversation';
    }else if(kind==='evening'){
      await page.getByRole('button',{name:'Plan an evening with Su',exact:true}).click();
      await reply('like-thai-food');await heard('Su',eveningResponse(s,'like-thai-food'));
      assert(!(await saved()).flags.includes('evening-food'),'audio does not confirm a route');
      await page.getByRole('button',{name:'Choose another reply',exact:true}).click();
      await reply('i-am-thirsty');await heard('Su',eveningResponse(s,'i-am-thirsty'));
      assert(!(await saved()).flags.includes('evening-park'));
      close='Leave evening conversation';
    }else if(kind==='service'){
      await page.keyboard.press('e');await page.locator('.service-offer').click();
      await page.getByRole('button',{name:'Use text only this time',exact:true}).click();
      assert.equal((await saved()).hp,40,'rehearsing does not rest');
      await page.getByRole('button',{name:'Rest now · full recovery',exact:true}).click();
      await heard('Mali',cityServices[0].result);assert.equal((await saved()).hp,100);
      close='Leave local services';
    }else{
      await page.getByRole('button',{name:'Ask Dao about Nok’s route',exact:true}).click();
      await reply('where-is-station');await heard('Dao',escortArrival[0].response);
      await page.getByRole('button',{name:/^Continue/}).click();
      await reply('thank-you');await heard('Dao',escortArrival[1].response);
      assert.equal((await saved()).escort.stage,'arrived','audio does not complete the escort');
      close='Leave conversation';
    }
    await page.screenshot({path:`${out}/${label}.png`});
    const before=await saved();
    await page.getByRole('button',{name:'Story voices on',exact:true}).click();
    await page.getByRole('button',{name:'Story voices off',exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>window.responseAudio.filter(a=>a.currentSrc.includes('/bangkok/voices/')&&!a.paused&&!a.ended).length),0);
    assert.deepEqual(await saved(),before,'muting audio does not advance the quest');
    await page.getByRole('button',{name:close,exact:true}).click();
    assert.equal(await page.evaluate(()=>window.responseAudio.filter(a=>a.currentSrc.includes('/bangkok/voices/')&&!a.paused&&!a.ended).length),0);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    report.cases.push({label,exclusiveResponse:true,confirmationUnchanged:true,muteAndLeave:true});await checkpoint();await context.close();
  }
  assert.deepEqual(report.errors,[]);report.finished=true;
}catch(e){report.failure=e.stack;await page?.screenshot({path:`${out}/failure.png`}).catch(()=>{});throw e;}
finally{await checkpoint();await browser.close();}
