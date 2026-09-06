import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { discoveries } from '../src/bangkok/discoveries.ts';
import { freshAdventure, moveAdventure, startBattle } from '../src/bangkok/adventure.ts';
import { adventureState, word } from './expedition-test-helpers.mjs';
const only=process.argv.find(a=>a.startsWith('--only='))?.slice(7);
if(only&&!discoveries.some(d=>d.id===only))throw new Error('Unknown discovery fixture');
const out=`artifacts/discoveries${only?'/'+only:''}`;await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
let page;const errors=[];const report={found:[],charm:false,phone:false,finished:false};
const checkpoint=()=>writeFile(`${out}/progress.json`,JSON.stringify(report,null,2));
async function open(fixture,phone=false){
 const context=await browser.newContext({viewport:phone?{width:390,height:844}:{width:1280,height:900},isMobile:phone,hasTouch:phone});
 await context.addInitScript(s=>{if(!localStorage.getItem('bangkok-rift-adventure-v1'))localStorage.setItem('bangkok-rift-adventure-v1',JSON.stringify(s));},fixture);
 page=await context.newPage();page.setDefaultTimeout(45000);page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5188/');
 await page.getByRole('button',{name:/Continue adventure/}).click();await page.waitForFunction(()=>!document.querySelector('.bk-loading'));return context;
}
try {
 await checkpoint();let save=freshAdventure();save.flags=['intro','innkeeper'];
 // Explicit proximity fixtures verify each new object and interaction; continuous path tests cover every route.
 for(const [i,d] of discoveries.filter(d=>!only||d.id===only).entries()){
  const fixture=moveAdventure(save,{x:d.x-.3,z:d.z-1.2});const context=await open(fixture);
  await page.getByRole('button',{name:'Open town map ↗',exact:true}).click();await page.locator(`.city-map button[data-area="${d.area}"]`).click();
  assert.equal(await page.locator('.city-contacts button').filter({hasText:d.name}).count(),0,'Unfound discoveries must not be map destinations');
  await page.getByRole('button',{name:/Close dialog/}).click();
  await page.screenshot({path:`${out}/${d.id}-explore.png`});
  await page.keyboard.press('e');await page.locator('.rpg-dialogue').waitFor();
  if(i===0){await page.getByRole('button',{name:'Leave conversation',exact:true}).click();assert(!(await adventureState(page)).flags.includes(d.id));await page.keyboard.press('e');}
  const thai=await page.locator('.rpg-thai').innerText();
  const option=page.locator('.rpg-dialogue .thai-choice-list button').filter({hasText:thai});assert((await option.locator('.choice-meaning').innerText()).length>1);await option.click();
  await page.screenshot({path:`${out}/${d.id}.png`});await page.getByRole('button',{name:'Use text only this time',exact:true}).click();
  await page.locator('.rpg-dialogue').getByRole('button',{name:/^Continue/}).click();
  await page.getByRole('button',{name:/Back to the adventure/}).click();
  await page.waitForFunction(id=>JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')).flags.includes(id),d.id);
  save=await adventureState(page);assert.equal(save.xp,fixture.xp+30);assert.equal(save.coins,fixture.coins+d.coins);
  await page.keyboard.press('e');await page.locator('.rpg-dialogue').waitFor();assert.equal(await page.locator('.thai-choice-list').count(),0);
  await page.getByRole('button',{name:'Leave conversation',exact:true}).click();assert.equal((await adventureState(page)).xp,save.xp);
  await page.getByRole('button',{name:'Open town map ↗',exact:true}).click();await page.locator(`.city-map button[data-area="${d.area}"]`).click();
  assert.equal(await page.locator('.city-contacts button').filter({hasText:d.name}).count(),1,'Found discoveries become return destinations');
  await page.getByRole('button',{name:/Close dialog/}).click();
  await page.reload();await page.getByRole('button',{name:/Continue adventure/}).click();assert((await adventureState(page)).flags.includes(d.id));
  report.found.push(d.id);await checkpoint();await context.close();console.log('PASS discovery',d.id);
 }
 if(!only){
 const battleFixture=startBattle({...save,hp:80},'murmur');battleFixture.battle.foes.forEach((f,i)=>f.hp=i===0?1:0);
 const combat=await open(battleFixture);await word(page,'First Light',battleFixture.battle.foes[0].name);
 await page.getByRole('button',{name:'Claim rewards & continue',exact:true}).click();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')).battle===null);
 assert.equal((await adventureState(page)).hp,95);report.charm=true;
 await page.getByRole('button',{name:/^Bag/}).click();await page.getByText('✦ River Charm — equipped · restore 15 HP after a story battle victory',{exact:true}).waitFor();
 await page.screenshot({path:`${out}/river-charm.png`});await combat.close();await checkpoint();
 const phone=await open(save,true);await page.getByRole('button',{name:'Journal',exact:true}).click();
 await page.locator('.rpg-discoveries').scrollIntoViewIfNeeded();assert.equal(await page.locator('.rpg-discoveries details[open]').count(),6);
 await page.screenshot({path:`${out}/phone-journal.png`});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 report.phone=true;await phone.close();
 }
 assert.deepEqual(errors,[]);report.finished=true;await checkpoint();console.log('PASS discoveries',only??'all',JSON.stringify(report));
}catch(e){report.error=String(e);await checkpoint();console.error(await page?.locator('body').innerText().catch(()=>''));await page?.screenshot({path:`${out}/failure.png`}).catch(()=>{});throw e;}finally{await browser.close();}
