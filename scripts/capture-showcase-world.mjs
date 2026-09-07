import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshAdventure } from '../src/bangkok/adventure.ts';
const out='videos/bangkok-rift-showcase/capture';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const reports=[];
try {
  for(const shot of [
    {id:'hotel',position:{x:-54,z:29},dialogue:true},
    {id:'yaowarat',position:{x:32,z:16.5}},
    {id:'river',position:{x:1,z:-5.5}},
    {id:'phone',position:{x:0,z:13},phone:true},
  ].filter(s=>!process.argv.includes('--river-only')||s.id==='river')){
    const viewport=shot.phone?{width:390,height:844}:{width:1600,height:900};
    const context=await browser.newContext({viewport,hasTouch:!!shot.phone,isMobile:!!shot.phone,recordVideo:{dir:out,size:viewport}});
    const save={...freshAdventure(),flags:['intro','innkeeper'],position:shot.position};
    await context.addInitScript(s=>localStorage.setItem('bangkok-rift-adventure-v1',JSON.stringify(s)),save);
    const page=await context.newPage();page.setDefaultTimeout(60000);
    const start=Date.now();await page.goto('http://127.0.0.1:5188/');await page.getByRole('button',{name:/Continue adventure/}).click();
    await page.waitForFunction(()=>!document.querySelector('.bk-loading'));await page.waitForTimeout(2200);
    const trim=(Date.now()-start)/1000;
    if(shot.phone){
      await page.getByRole('button',{name:'Look around',exact:true}).tap();
      const cdp=await context.newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:160,y:390}]});
      for(let i=0;i<30;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:160+i*2,y:390}]});await page.waitForTimeout(70);}
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await page.waitForTimeout(3500);await page.getByRole('button',{name:'Reset view',exact:true}).tap();
      await page.waitForTimeout(7000);
    }else if(shot.dialogue){
      await page.waitForTimeout(2500);await page.getByRole('button',{name:'Talk to Su',exact:true}).click();
      await page.waitForTimeout(8500);await page.getByRole('button',{name:'Leave conversation',exact:true}).click();
      await page.waitForTimeout(3000);
    }else{
      await page.addStyleTag({content:'.rpg-header,.rpg-party-panel,.rpg-objective,.rpg-explore-bar,.rpg-location,.rpg-dpad{visibility:hidden!important}'});
      await page.mouse.move(700,420);await page.mouse.down({button:'right'});
      for(let i=0;i<75;i++){await page.mouse.move(700+i*2.3,420+i*.16);await page.waitForTimeout(120);}
      await page.mouse.up({button:'right'});await page.waitForTimeout(6500);
    }
    await page.screenshot({path:`${out}/${shot.id}.png`});
    const path=await page.video().path();await context.close();reports.push({id:shot.id,path,trim,viewport});console.log(reports.at(-1));
    await writeFile(`${out}/world-clips.json`,JSON.stringify(reports,null,2));
  }
}finally{await browser.close();}
