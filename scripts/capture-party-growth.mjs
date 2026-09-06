import { chromium } from 'playwright-core';
import { freshAdventure, startPracticeBattle } from '../src/bangkok/adventure.ts';
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await context.addInitScript(s=>localStorage.setItem('bangkok-rift-adventure-v1',JSON.stringify(s)),startPracticeBattle({...freshAdventure(),xp:1100,talents:['patience']}));
 const page=await context.newPage();page.setDefaultTimeout(60000);await page.goto('http://127.0.0.1:5188/');await page.getByRole('button',{name:/Continue adventure/}).click();await page.getByRole('button',{name:/^◇ Guard/}).waitFor();
 // Advance rendered frames, not a fixed wall delay: software WebGL may render slowly.
 await page.evaluate(()=>new Promise(resolve=>{let frames=0;function tick(){if(++frames>=100)resolve(true);else requestAnimationFrame(tick);}requestAnimationFrame(tick);}));
 await page.screenshot({path:'artifacts/party-growth/guard-phone-settled.png'});
 console.log('PASS captured settled phone battle after 100 rendered frames');
}finally{await browser.close();}
