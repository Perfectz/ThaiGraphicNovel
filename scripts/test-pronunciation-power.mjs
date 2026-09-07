import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { freshAdventure, startBattle } from '../src/bangkok/adventure.ts';
const live=process.argv.includes('--live'), phone=process.argv.includes('--phone'), capture=process.argv.includes('--capture');
const questionTest=process.argv.includes('--question');
const base=process.env.PLAYTEST_BASE_URL || 'http://127.0.0.1:5188/';
const out=`artifacts/pronunciation-power/${live?'live':'mock'}-${phone?'phone':'desktop'}${questionTest?'-question':''}`;
await mkdir(out,{recursive:true});
const report={finished:false,live,phone,base,questionTest,assessmentFixture:questionTest,events:[],errors:[],responses:[]};
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',`--use-file-for-fake-audio-capture=${resolve(`artifacts/pronunciation-power/${questionTest?'question-mic':'mic'}.wav`)}`]});
let page;
try {
  const viewport=phone?{width:390,height:844}:{width:1600,height:900};
  const context=await browser.newContext({viewport,hasTouch:phone,isMobile:phone,permissions:['microphone'],...(capture?{recordVideo:{dir:out,size:viewport}}:{})});
  let s=startBattle({...freshAdventure(),flags:['intro','innkeeper'],position:{x:-16,z:30}},'murmur');
  await context.addInitScript(s=>{if(!localStorage.getItem('bangkok-rift-adventure-v1'))localStorage.setItem('bangkok-rift-adventure-v1',JSON.stringify(s));},s);
  page=await context.newPage();page.setDefaultTimeout(65000);page.on('pageerror',e=>report.errors.push(e.message));
  const videoStart=Date.now();
  const mark=label=>{report.events.push({label,at:(Date.now()-videoStart)/1000});console.log(label);};
  let requests=0;
  if(questionTest)await page.route('**/api/realtime/battle',async route=>{
    if(route.request().method()!=='POST'||route.request().postDataJSON().mode!=='assess')return route.continue();
    const b=route.request().postDataJSON();await route.fulfill({json:{assessment:{attemptId:b.attemptId,turnKey:b.turnKey,phraseId:'hello',assessable:true,band:'clear',heard:'สวัสดีครับ',feedback:'Clear.',focus:'',correction:''}}});
  });
  if(!live) await page.route('**/api/realtime/battle',async route=>{
    if(route.request().method()==='GET')return route.continue();
    const request=route.request().postDataJSON();
    if(request.mode==='coach')return route.fulfill({json:{audio:(await readFile('artifacts/pronunciation-power/live-coach.pcm')).toString('base64'),transcript:'Keep the final syllable clear. สวัสดีครับ'}});
    const band=requests++===0?'developing':'excellent';
    await new Promise(r=>setTimeout(r,500));
    await route.fulfill({json:{assessment:{attemptId:request.attemptId,turnKey:request.turnKey,phraseId:'hello',assessable:true,band,heard:'สวัสดีครับ',feedback:'Practise a clearer final syllable.',focus:'ครับ',correction:'Listen to the final syllable and repeat slowly.'}}});
  });
  page.on('response',async r=>{if(r.url().endsWith('/api/realtime/battle')&&r.request().method()==='POST'){const b=await r.json().catch(()=>({}));report.responses.push({...b,audio:b.audio?'[audio omitted]':undefined});if(live&&b.audio)await writeFile(`${out}/coaching.pcm`,Buffer.from(b.audio,'base64'));}});
  if(live)page.on('request',r=>{if(r.url().endsWith('/api/realtime/battle')&&r.method()==='POST'){const b=r.postDataJSON();if(b.audio)void writeFile(`${out}/submitted-test-audio.pcm`,Buffer.from(b.audio,'base64'));}});
  await page.goto(base);await page.getByRole('button',{name:/Continue adventure/}).click();
  await page.waitForFunction(()=>!document.querySelector('.bk-loading'));
  if(base.includes('127.0.0.1')) {
    report.health=await page.evaluate(async()=>Promise.all(['/api/realtime/health','/api/whisper/health','/api/realtime/battle'].map(async url=>{const r=await fetch(url);return {url,status:r.status,body:await r.json()};})));
    assert(report.health.every(h=>h.status===200));
  }
  const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')));
  const before=(await state()).battle;
  mark('battle ready');if(capture)await page.waitForTimeout(3500);
  await page.getByRole('button',{name:/^✦ Word arts/}).click();
  if(capture)await page.waitForTimeout(2000);
  await page.locator('.exp-word-grid button').filter({hasText:'First Light'}).click();
  await page.locator('.exp-target-list button').filter({hasText:before.foes[1].name}).click();
  assert.equal(await page.locator('.speak-preview h3').innerText(),'Hello');
  mark('English preview');if(capture)await page.waitForTimeout(2500);
  async function record(){
    await page.locator('.speak-record').click();await page.getByRole('button',{name:'■ Stop recording',exact:true}).waitFor();
    await page.waitForTimeout(live?4200:750);
    await page.getByRole('button',{name:'■ Stop recording',exact:true}).click();
    await page.getByRole('button',{name:'▷ Play my recording',exact:true}).waitFor();
  }
  await record();
  await page.getByRole('button',{name:/Enable pronunciation power/}).click();
  mark('recording ready');
  await page.getByRole('button',{name:'Assess my pronunciation',exact:true}).click();
  await page.locator('.speech-verdict').waitFor();
  const graded=!!(await page.locator('.speech-commit').count());report.graded=graded;
  if(!graded)assert((await page.locator('.speech-verdict').innerText()).includes('Could not assess reliably'));
  assert.deepEqual((await state()).battle,before);
  mark('assessment preview');
  if(graded)await page.locator('.speech-power-preview').scrollIntoViewIfNeeded();
  await page.screenshot({path:`${out}/assessment.png`});
  if(capture)await page.waitForTimeout(3500);
  if(questionTest){
    await page.getByRole('button',{name:'Ask Su a question',exact:true}).click();
    await page.getByRole('button',{name:'Finish question',exact:true}).waitFor();
    await page.waitForTimeout(4200);
    await page.getByRole('button',{name:'Finish question',exact:true}).click();
  } else await page.getByRole('button',{name:'Coach me, Su',exact:true}).click();
  await page.locator('.speech-coaching').waitFor();
  mark('coaching returned');
  await page.screenshot({path:`${out}/coaching.png`});
  assert.deepEqual((await state()).battle,before);
  if(capture)await page.waitForTimeout(7000);
  if(!live){
    assert((await page.locator('.speech-commit').innerText()).includes('13 damage'));
    await record();await page.getByRole('button',{name:'Assess my pronunciation',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('.speech-power-preview')?.textContent.includes('140%'));
    assert((await page.locator('.speech-commit').innerText()).includes('25 damage'));
    assert.deepEqual((await state()).battle,before);
  }
  const expected=graded?Number((await page.locator('.speech-commit').innerText()).match(/· (\d+) damage/)[1]):18;
  if(graded)await page.locator('.speech-commit').click();
  else await page.getByRole('button',{name:'Use my spoken reply →',exact:true}).click();
  await page.locator('.exp-resolving').waitFor({state:'hidden'});
  const after=(await state()).battle;
  assert.equal(before.foes[1].hp-after.foes[1].hp,expected);assert.equal(after.turn,1);
  mark(`attack dealt ${expected} damage`);
  await page.screenshot({path:`${out}/attack.png`});if(capture)await page.waitForTimeout(4000);
  await page.reload();await page.getByRole('button',{name:/Continue adventure/}).click();
  assert.deepEqual((await state()).battle,after);
  assert.deepEqual(report.errors,[]);report.finished=true;
  if(capture)report.video=await page.video().path();
  await context.close();
}catch(e){report.failure=e.stack;await page?.screenshot({path:`${out}/failure.png`}).catch(()=>{});throw e;}
finally {await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();}
