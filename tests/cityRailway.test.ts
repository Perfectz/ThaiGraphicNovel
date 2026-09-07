import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {CityRailway} from '../src/bangkok/CityRailway.ts';
import {trainPosition} from '../src/bangkok/cityMotion.ts';
const read=async()=>{const b=await readFile('public/bangkok/models/sukhumvit-railway.glb');return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');};
const flush=()=>new Promise(r=>setTimeout(r,0));
function fixture(){const district=new T.Group(),guide=new T.Group(),train=new T.Group(),fallback=new T.Group();district.add(guide,train);train.add(fallback);train.position.set(-43,4.62,9.3);return{district,guide,train,fallback};}
test('the authored train fits its complete motion envelope and wheels sit on the running rails',async()=>{
 const {scene}=await read();scene.updateMatrixWorld(true);const train=scene.getObjectByName('Skytrain')!;assert(train);
 const b=new T.Box3().setFromObject(train);assert(b.min.x>=-4.121&&b.max.x<=4.121);assert(b.min.z>=-.871&&b.max.z<=.871);assert(b.min.y>-.001&&b.max.y<1.6);
 assert(Math.abs(b.min.y+4.62-4.62)<.001);
 for(let t=0;t<=40;t+=.1){const x=trainPosition(t);assert(x+b.min.x>=-61&&x+b.max.x<=-31);}
 for(const name of ['CarBodies','CabGlazing','BogieFrames'])assert(train.getObjectByName(name));
});
test('guideway piers keep the original ground footprint and the pack has bounded portable geometry',async()=>{
 const {scene}=await read();scene.updateMatrixWorld(true);const guide=scene.getObjectByName('Guideway')!;assert(guide);
 guide.traverse(o=>{if(o instanceof T.Mesh){const a=o.geometry.getAttribute('position');for(let i=0;i<a.count;i++){const p=new T.Vector3().fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld);if(p.y<2.2){assert(Math.abs(p.z)<=.401);assert([-14,-7,0,7,14].some(x=>Math.abs(p.x-x)<=.251));}}}});
 let triangles=0,meshes=0;scene.traverse(o=>{assert(!(o instanceof T.Light||o instanceof T.Camera));if(o instanceof T.Mesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;assert(o.geometry.getAttribute('normal'));}});
 assert(triangles>10000&&triangles<30000);assert(meshes<25);assert((await stat('public/bangkok/models/sukhumvit-railway.glb')).size<2000000);assert((await stat('art/blender/sukhumvit-railway.blend')).size>10000);
});
test('one successful load replaces both fallbacks without changing the motion parent',async()=>{
 const f=fixture(),model=await read(),r=new CityRailway(f.district,f.guide,f.train,f.fallback,()=>{},()=>Promise.resolve(model));await flush();
 assert.equal(r.state,'ready');assert(!f.guide.visible&&!f.fallback.visible);assert.equal(f.train.getObjectByName('Skytrain')!.position.y,0);
 assert.deepEqual(f.train.position.toArray(),[-43,4.62,9.3]);assert.deepEqual(f.district.getObjectByName('Guideway')!.position.toArray(),[-46,0,9.3]);
 f.train.position.x=-37;assert.equal(r.snapshot().trainX,-37);
});
test('missing or failed assets retain both fallbacks and late loads release their resources',async()=>{
 for(const load of [()=>Promise.reject(Error('offline')),()=>Promise.resolve({scene:new T.Group()})]){
 const f=fixture(),r=new CityRailway(f.district,f.guide,f.train,f.fallback,()=>{},load);await flush();assert.equal(r.state,'fallback');assert(f.guide.visible&&f.fallback.visible);}
 const f=fixture(),model=await read();let released=0;model.scene.traverse(o=>{if(o instanceof T.Mesh)o.geometry.addEventListener('dispose',()=>released++);});
 let resolve!:(r:{scene:T.Group})=>void;const r=new CityRailway(f.district,f.guide,f.train,f.fallback,()=>{},()=>new Promise(done=>resolve=done));r.dispose();resolve(model);await flush();assert(released>0);assert.equal(f.train.children.length,1);assert.equal(f.district.children.length,2);
});

