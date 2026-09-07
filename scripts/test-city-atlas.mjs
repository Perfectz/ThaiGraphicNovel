import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {freshAdventure,walkable} from '../src/bangkok/adventure.ts';
import {cityAreas} from '../src/bangkok/city.ts';
const phone=process.argv.includes('--phone'),base=process.env.PLAYTEST_BASE_URL??'http://127.0.0.1:5188/';
const out=`artifacts/city-atlas/${base.includes('127.0.0.1')?'local':'public'}-${phone?'phone':'desktop'}`;
await mkdir(out,{recursive:true});const report={finished:false,base,phone,steps:[],errors:[]};
const browser=await chromium.launch({headless:true,channel:'chrome'});
const context=await browser.newContext({viewport:phone?{width:390,height:844}:{width:1440,height:1000},isMobile:phone,hasTouch:phone});
await context.addInitScript(s=>{if(!localStorage.getItem('bangkok-rift-adventure-v1'))localStorage.setItem('bangkok-rift-adventure-v1',JSON.stringify(s));},{...freshAdventure(),flags:['intro','innkeeper']});
const page=await context.newPage();page.setDefaultTimeout(90000);page.on('pageerror',e=>report.errors.push(e.message));
const chart=()=>page.getByRole('group',{name:'Choose a walking destination on the city chart',exact:true});
const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')));
async function log(s){report.steps.push(s);await writeFile(`${out}/progress.json`,JSON.stringify(report,null,2));console.log(s);}
async function open(area){await page.getByRole('button',{name:'Open town map ↗',exact:true}).click();await page.locator(`.city-map button[data-area="${area}"]`).click();}
async function choose(x,z){await chart().scrollIntoViewIfNeeded();const p=await chart().evaluate((svg,p)=>{const v=new DOMPoint(p.x,p.z).matrixTransform(svg.getScreenCTM());return{x:v.x,y:v.y};},{x,z});await page.mouse.click(p.x,p.y);}
async function arrive(x,z){await page.getByRole('button',{name:'Walk this route →',exact:true}).click();await page.waitForFunction(p=>{const s=JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1'));return Math.hypot(s.position.x-p.x,s.position.z-p.z)<.25;},{x,z},{timeout:180000});}
try{
 await page.goto(base,{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:/Continue adventure/}).click();await page.waitForFunction(()=>!document.querySelector('.bk-loading'));
 const before=await saved();await open('lumphini');assert.equal(await page.locator('.atlas-districts button').count(),cityAreas.length);
 await choose(-23,32);assert.equal(await chart().getAttribute('data-route-status'),'blocked');assert(await page.getByRole('button',{name:'Walk this route →',exact:true}).isDisabled());
 await choose(-13.5,35);assert.equal(await chart().getAttribute('data-route-status'),'ready');const points=(await page.getByTestId('walking-route').getAttribute('points')).split(' ').map(s=>{const[x,z]=s.split(',').map(Number);return{x,z};});assert(points.every(walkable));
 await chart().focus();await page.keyboard.press('ArrowRight');assert.equal(await chart().getAttribute('data-target'),'-13,35');await page.keyboard.press('ArrowLeft');
 await page.getByRole('button',{name:'Whole city',exact:true}).click();await page.locator('.city-atlas').screenshot({path:`${out}/whole-city.png`});
 await page.getByRole('button',{name:'District detail',exact:true}).click();await chart().scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/park-route.png`});
 if(phone){const b=await page.getByRole('button',{name:'Walk this route →',exact:true}).boundingBox();assert(b&&b.y>=0&&b.y+b.height<=844,'departure stays visible with the chart');}
 await arrive(-13.5,35);assert.deepEqual((await saved()).flags,before.flags);assert((await saved()).visited.includes('lumphini'));await page.screenshot({path:`${out}/park-arrival.png`});await log('Planned a custom lakeside walk, rejected the pond and reached the destination through the city');
 await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:/Continue adventure/}).click();await open('archive');await choose(84,32);assert.equal(await chart().getAttribute('data-route-status'),'ready');await page.locator('.city-atlas').screenshot({path:`${out}/archive-route.png`});
 await arrive(84,32);assert((await saved()).visited.includes('archive'));assert.deepEqual((await saved()).flags,before.flags);await open('archive');assert(await page.getByRole('region',{name:'Archive floor plan'}).isVisible());
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`${out}/archive-arrival.png`});assert.deepEqual(report.errors,[]);await log('Reload retained the journey; the selected archive route reached the map room without granting quest progress');report.finished=true;
}catch(e){report.failure=e.stack;await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});throw e;}finally{await writeFile(`${out}/progress.json`,JSON.stringify(report,null,2));await browser.close();}
