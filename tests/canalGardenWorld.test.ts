import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CanalGardenWorld } from '../src/bangkok/CanalGardenWorld.ts';
import { boatPoint, boatStart, boatCellOpen } from '../src/bangkok/canalNavigation.ts';
const read = async () => { const b = await readFile('public/bangkok/models/canal-garden-boat.glb'); return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),''); };
const flush = () => new Promise(r=>setTimeout(r,0));
test('authored boat fits every navigable cell at all four headings; studio assets stay out', async () => {
  const { scene } = await read(); let triangles = 0;
  scene.traverse(o=>{assert(!(o instanceof T.Light||o instanceof T.Camera));if(o instanceof T.Mesh){triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;assert(o.geometry.getAttribute('normal'));}});
  assert(triangles<10000);assert((await stat('public/bangkok/models/canal-garden-boat.glb')).size<500000);
  const boat=scene.getObjectByName('GardenBoat')!;assert(boat);assert(scene.getObjectByName('FlowerTray'));boat.scale.setScalar(.78);
  for(let col=0;col<5;col++)for(let row=0;row<2;row++)if(boatCellOpen(col,row))for(let heading=0;heading<4;heading++){
    const p=boatPoint({col,row});boat.position.set(p.x,0,p.z);boat.rotation.y=-heading*Math.PI/2;scene.updateMatrixWorld(true);
    const bounds=new T.Box3().setFromObject(boat);assert(bounds.min.x> -2.9 && bounds.max.x<26.9);assert(bounds.min.z> -65.9 && bounds.max.z< -59.1,`${col}/${row}/${heading} ${bounds.min.z} ${bounds.max.z}`);
  }
});
test('world motion follows saved commands, reduced motion settles immediately, and planted quays persist',async()=>{
 const district=new T.Group(),model=await read();const world=new CanalGardenWorld(district,()=>{},()=>Promise.resolve(model));await flush();assert.equal(world.state,'ready');
 world.sync({...boatStart(),col:4,row:1,moves:6,delivered:['green']});
 for(let i=0;i<120;i++)world.update(1/60,i/60,false);
 let s=world.snapshot();assert(Math.abs(s.x-24)<.02&&Math.abs(s.z+64.4)<.02);assert.deepEqual(s.planted,['green']);assert.equal(s.cargo,2);
 world.sync({...boatStart(),moves:7,delivered:['green']});world.update(.016,3,true);s=world.snapshot();assert.equal(s.x,18);assert.equal(s.z,-60.6);assert.deepEqual(s.planted,['green']);
});
test('failed models retain boat and flower fallbacks; late loads release resources',async()=>{
 const world=new CanalGardenWorld(new T.Group(),()=>{},()=>Promise.reject(Error('offline')));await flush();assert.equal(world.state,'fallback');world.sync({...boatStart(),delivered:['blue']});assert.deepEqual(world.snapshot().planted,['blue']);
 const model=await read();let released=0;model.scene.traverse(o=>{if(o instanceof T.Mesh)o.geometry.addEventListener('dispose',()=>released++);});
 let resolve!:(v:{scene:T.Group})=>void;const late=new CanalGardenWorld(new T.Group(),()=>{},()=>new Promise(done=>resolve=done));late.dispose();resolve(model);await flush();assert(released>0);assert(!late.boat.getObjectByName('GardenBoat'));
});
