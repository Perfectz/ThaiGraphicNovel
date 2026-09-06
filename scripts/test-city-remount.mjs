import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
try {
 const context=await browser.newContext({viewport:{width:1280,height:900}});
 const p=await context.newPage();p.setDefaultTimeout(60000);const errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:5188/');
 await p.getByRole('button',{name:/Step through the rift/}).click();
 async function ready(){await p.waitForFunction(()=>Number(document.querySelector('.bk-world')?.getAttribute('data-npc-ready'))===6&&document.querySelector('.bk-world')?.getAttribute('data-city-props')==='ready'&&!document.querySelector('.bk-loading'));}
 await ready();
 await p.screenshot({path:'artifacts/city-presentation/hotel-start-materials.png'});
 const initial=await p.locator('.bk-world').getAttribute('data-player-x');
 await p.keyboard.down('d');await p.waitForTimeout(500);await p.keyboard.up('d');await p.waitForTimeout(700);
 assert(Number(await p.locator('.bk-world').getAttribute('data-player-x'))>Number(initial)+.1);
 const saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')));
 for(let i=0;i<2;i++){
  await p.getByRole('button',{name:'Train at camp',exact:true}).click();
  await p.getByRole('button',{name:/(Begin|Continue) your journey/}).waitFor();
  await p.waitForFunction(()=>!document.querySelector('.bk-loading'));
  await p.getByRole('button',{name:/Return to the adventure/}).click();
  await p.getByRole('button',{name:/Continue adventure|Step through the rift/}).click();
  await ready();
  const current=await p.evaluate(()=>JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')));
  assert.deepEqual(current.flags,saved.flags);assert.deepEqual(current.visited,saved.visited);
  assert.equal(current.hp,saved.hp);
 }
 assert.deepEqual(errors,[]);console.log('PASS character/prop loads, keyboard movement and two camp/adventure remounts with preserved progress');
}finally{await browser.close();}
