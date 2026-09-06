import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {conversations} from '../src/bangkok/adventureStory.ts';
import {freshAdventure} from '../src/bangkok/adventure.ts';
const out='artifacts/openai-voices/browser';await mkdir(out,{recursive:true});
const base=process.env.PLAYTEST_BASE_URL??'http://127.0.0.1:5188/';
const manifest=JSON.parse(await readFile('public/bangkok/voices/manifest.json','utf8'));
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
const report={finished:false,cases:[],errors:[]};let page;
const checkpoint=()=>writeFile(`${out}/progress.json`,JSON.stringify(report,null,2));
const active=()=>page.evaluate(()=>window.testVoices.filter(a=>!a.paused&&!a.ended&&a.currentSrc.includes('/bangkok/voices/')).map(a=>({url:a.currentSrc,time:a.currentTime,rate:a.playbackRate})));
async function openMali(){
  await page.getByRole('button',{name:'Open town map ↗',exact:true}).click();await page.locator('.city-map button[data-area="hotel"]').click();await page.locator('.city-contacts button[data-area="innkeeper"]').click();await page.locator('[data-voice-speaker="Mali"]').waitFor();
}
async function hearMali(){
  if(await page.getByRole('button',{name:'Stop character voice',exact:true}).count())await page.getByRole('button',{name:'Stop character voice',exact:true}).click();
  await page.getByRole('button',{name:'Hear Mali',exact:true}).click();
  await page.waitForFunction(()=>window.testVoices.some(a=>a.currentSrc.includes('/bangkok/voices/line-')&&!a.paused&&a.currentTime>0));
}
try{
  for(const phone of [false,true]){
    const label=phone?'phone':'desktop';console.log(`Voice flow ${label}`);
    const context=await browser.newContext({viewport:phone?{width:390,height:844}:{width:1440,height:900},isMobile:phone,hasTouch:phone,permissions:['microphone']});
    await context.addInitScript(s=>{
      if(!localStorage.getItem('bangkok-rift-adventure-v1'))localStorage.setItem('bangkok-rift-adventure-v1',JSON.stringify(s));
      window.testVoices=[];window.micRequests=0;
      const Native=window.Audio;window.Audio=class extends Native{constructor(...args){super(...args);window.testVoices.push(this);}};
      const get=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=(...args)=>{window.micRequests++;return get(...args);};
    },{...freshAdventure(),flags:['intro','hotel-journal']});
    page=await context.newPage();page.setDefaultTimeout(90000);page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
    await page.goto(base,{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:/Continue adventure/}).click();await openMali();
    await hearMali();assert.equal((await active()).length,1);assert.equal(await page.evaluate(()=>window.micRequests),0);
    await page.screenshot({path:`${out}/${label}-mali.png`});
    await page.getByRole('button',{name:'Story voices on',exact:true}).click();assert.deepEqual(await active(),[]);
    await page.getByRole('button',{name:'Story voices off',exact:true}).click();
    await page.locator('[data-phrase-choice="hello"]').click();await page.locator('.speak-preview').waitFor();assert.deepEqual(await active(),[],'meaning preview stops story narration');
    assert((await page.locator('.speak-preview h3').innerText()).length>0);
    await page.getByRole('button',{name:'♫ Hear this line',exact:true}).click();
    await page.waitForFunction(()=>window.testVoices.some(a=>a.currentSrc.endsWith('/bangkok/voices/hello.mp3')&&!a.paused&&a.currentTime>0));
    assert.equal((await active()).length,1);
    await page.getByRole('button',{name:'Hear it slowly',exact:true}).click();
    await page.waitForFunction(()=>window.testVoices.some(a=>a.currentSrc.endsWith('/bangkok/voices/hello.mp3')&&!a.paused&&a.playbackRate===.78));
    assert.equal((await active())[0].rate,.78);
    await page.getByRole('button',{name:'◉ Record this line',exact:true}).click();await page.getByRole('button',{name:'■ Stop recording',exact:true}).waitFor();assert.deepEqual(await active(),[],'microphone practice has no reference or narration overlap');
    await page.waitForTimeout(650);await page.getByRole('button',{name:'■ Stop recording',exact:true}).click();
    await page.getByRole('button',{name:'▷ Play my recording',exact:true}).click();
    await page.getByRole('button',{name:'Use my spoken reply →',exact:true}).click();
    const response=conversations.innkeeper.find(l=>l.phrase==='hello').response;
    const responseUrl=manifest.clips[`Mali|${response}`].url;
    await page.waitForFunction(url=>window.testVoices.some(a=>a.currentSrc.endsWith(url)&&!a.paused&&a.currentTime>0),responseUrl);
    assert.equal((await active()).length,1,'character response replaces recording playback');
    assert.equal(await page.locator('.rpg-feedback').innerText(),response);
    await page.getByRole('button',{name:'Continue →',exact:true}).click();
    await page.locator('[data-phrase-choice="my-name-is-patrick"]').waitFor();
    await hearMali();assert.equal((await active()).length,1,'next line replaces earlier voice');
    await page.getByRole('button',{name:'Story voices on',exact:true}).click();
    await page.getByRole('button',{name:'Leave conversation',exact:true}).click();assert.deepEqual(await active(),[]);
    await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:/Continue adventure/}).click();await openMali();
    await page.getByRole('button',{name:'Story voices off',exact:true}).waitFor();assert.deepEqual(await active(),[],'muted narration remains muted after reload');
    await hearMali();assert.equal((await active()).length,1,'manual replay works while automatic voices are off');
    await page.getByRole('button',{name:'Leave conversation',exact:true}).click();assert.deepEqual(await active(),[]);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    report.cases.push({label,autoAndManual:true,exclusivePlayback:true,slowReference:true,recordedReply:true,characterResponse:true,mutePersists:true});await checkpoint();await context.close();
  }
  assert.deepEqual(report.errors,[]);report.finished=true;
}catch(error){report.failure=error.stack;if(page)await page.screenshot({path:`${out}/failure.png`,timeout:10000}).catch(()=>{});throw error;}finally{await checkpoint();await browser.close();}
