import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {finishFight,word,adventureState as saved} from './expedition-test-helpers.mjs';
import {actors} from '../src/bangkok/adventure.ts';
const phone=process.argv.includes('--phone');
const base=process.env.PLAYTEST_BASE_URL??'http://127.0.0.1:5188/';
const out=`artifacts/story-campaign/${phone?'phone':'desktop'}`;await mkdir(out,{recursive:true});
const report={finished:false,base,phone,steps:[],errors:[]};
const checkpoint=()=>writeFile(`${out}/progress.json`,JSON.stringify(report,null,2));
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
const context=await browser.newContext({viewport:phone?{width:390,height:844}:{width:1440,height:900},isMobile:phone,hasTouch:phone,permissions:['microphone']});
const page=await context.newPage();page.setDefaultTimeout(90000);
page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
let recorded=false;
async function log(step){report.steps.push(step);await checkpoint();console.log(step);}
async function talk(){
  for(let i=0;i<16;i++){
    const dialog=page.locator('[aria-label="Story conversation"]');
    if(!await dialog.count())return;
    const choices=dialog.locator('[data-phrase-choice]');
    if(await choices.count()){
      const thai=await dialog.locator('.rpg-thai').innerText();
      await choices.filter({hasText:thai}).click();
      assert((await page.locator('.speak-preview h3[lang=en]').innerText()).length>0);
      if(!recorded){
        await page.getByRole('button',{name:'◉ Record this line',exact:true}).click();
        await page.getByRole('button',{name:'■ Stop recording',exact:true}).waitFor();await page.waitForTimeout(650);
        await page.getByRole('button',{name:'■ Stop recording',exact:true}).click();
        await page.getByRole('button',{name:'Use my spoken reply →',exact:true}).click();recorded=true;
      }else await page.getByRole('button',{name:'Use text only this time',exact:true}).click();
    }
    await dialog.getByRole('button',{name:/^(Continue|Back to the adventure|Face the |Board the ferry)/}).click();
  }throw Error('Conversation did not finish');
}
async function nextDestination(name){
  console.log(`Walking to ${name}`);
  await page.getByRole('button',{name:`Walk to ${name} ↗`,exact:true}).click();
  const actor=actors.find(a=>a.name.split(' · ')[0]===name);
  assert(actor);
  await page.waitForFunction(a=>{const p=JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')).position;return Math.hypot(p.x-a.x,p.z-a.z)<.3;},actor,{timeout:180000});
  await page.getByRole('button',{name:/^E · /}).click();
  await page.locator('[aria-label="Story conversation"]').waitFor({timeout:180000});
}
async function storyBattle(id){
  await page.locator('.exp-command-panel').waitFor();
  const before=await saved(page);assert.equal(before.battle.id,id);assert.equal(before.battle.practice,false);
  await page.waitForTimeout(2600);await page.screenshot({path:`${out}/${id}-battle.png`});
  await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:/Continue adventure/}).click();
  assert.deepEqual((await saved(page)).battle,before.battle,'story battle resumes after reload');
  await word(page,'First Light',before.battle.foes[1].name,true);
  await finishFight(page,id);const after=await saved(page);
  assert(after.flags.includes(id));assert(after.xp>before.xp);assert(after.coins>before.coins);
  await log(`${id}: main-story victory, persistent party and rewards`);
}
try{
  await checkpoint();
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:/Step through the rift/}).click();
  await page.waitForFunction(()=>!document.querySelector('.bk-loading'));
  assert.equal(await page.getByRole('button',{name:'Battle practice',exact:true}).count(),0,'practice is not the campaign entry');
  await page.getByRole('button',{name:'Talk to Su',exact:true}).click();await talk();
  await nextDestination('Mali');await talk();assert((await saved(page)).flags.includes('innkeeper'));
  await log('Fresh hotel start and spoken check-in');
  await nextDestination('Murmur wisp');
  assert.equal((await saved(page)).battle,null,'introduction does not start battle');
  await page.screenshot({path:`${out}/murmur-introduction.png`});
  await page.getByRole('button',{name:'Leave conversation',exact:true}).click();
  assert.equal((await saved(page)).battle,null);
  await page.keyboard.press('e');await talk();await storyBattle('murmur');
  await nextDestination('Uncle Lek');await talk();assert((await saved(page)).flags.includes('cook'));
  await nextDestination('Niran');await talk();assert((await saved(page)).flags.includes('ferry'));
  await log('Walked the supper errand through Yaowarat and the river pier');
  await nextDestination('The river lantern');await talk();await storyBattle('keeper');
  await nextDestination('Niran');await talk();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')).flags.includes('departed'));
  await page.locator('.rpg-ending').waitFor();await page.screenshot({path:`${out}/ferry-complete.png`});
  assert((await saved(page)).visited.length>=5);assert(recorded);
  assert.deepEqual(report.errors,[]);report.finished=true;await log('Completed The Last Ferry without practice mode or seeded progression');
}catch(e){report.failure=e.stack;await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});throw e;}
finally{await checkpoint();await browser.close();}
