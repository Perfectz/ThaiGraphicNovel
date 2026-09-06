import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { actors, walkable, findPath, followPath } from '../src/bangkok/adventure.ts';
import { companionMark, conversationCamera, playerConversationMark } from '../src/bangkok/conversationStaging.ts';
import { ResidentPose } from '../src/bangkok/ResidentPose.ts';

test('overlapping approaches step onto reachable ground without crowding the host or companion', () => {
  for (const contact of actors.filter(a => ['innkeeper', 'cook', 'ferry', 'station', 'gardener', 'artisan', 'traveler', 'wisp'].includes(a.id))) {
    for (const [dx, dz] of [[0, 0], [.1, .1], [-.2, .1], [.1, -.2]]) {
      const start = { x: contact.x + dx, z: contact.z + dz };
      if (!walkable(start)) continue;
      const companion = { x: start.x + .8, z: start.z + .6 };
      const mark = playerConversationMark(start, contact, companion);
      assert(Math.hypot(mark.x - contact.x, mark.z - contact.z) >= 1.35, contact.id);
      assert(Math.hypot(mark.x - companion.x, mark.z - companion.z) >= 1.1, contact.id);
      const path = findPath(start, mark); let current = start;
      for (let i = 0; i < 100 && path.length; i++) { current = followPath(current, path, .08); assert(walkable(current)); }
      assert.equal(path.length, 0, contact.id);
      const su = companionMark(mark, contact, companion), camera = conversationCamera(mark, contact);
      for (const p of [mark, contact]) assert(Math.abs((su.x - p.x) * camera.z - (su.z - p.z) * camera.x) / 12.5 > .9, contact.id);
    }
  }
});

test('a comfortably spaced player is not moved just by opening a conversation', () => {
  const contact = { x: 29, z: 29 }, start = { x: 28, z: 28 };
  assert.equal(playerConversationMark(start, contact, { x: 30, z: 28 }), start);
});

test('every resident has a reachable conversation mark that separates the companion and respects obstacles', () => {
  for (const contact of actors.filter(a=>['innkeeper','cook','ferry','station','gardener','artisan','waystone','canal-lantern','wisp'].includes(a.id))) {
    const player = [[-1,-1],[0,1],[1,-1],[-1,0]].map(([x,z])=>({x:contact.x+x,z:contact.z+z})).find(walkable)!;
    const start = {x:player.x+.8,z:player.z+.6};
    const mark = companionMark(player,contact,start);
    assert(walkable(mark),contact.id);
    assert(Math.hypot(mark.x-player.x,mark.z-player.z)>=1.15,contact.id);
    assert(Math.hypot(mark.x-contact.x,mark.z-contact.z)>=1.1,contact.id);
    const camera = conversationCamera(player,contact);
    for(const p of [player,contact]) assert(Math.abs((mark.x-p.x)*camera.z-(mark.z-p.z)*camera.x)/12.5>.9,contact.id);
    const path = findPath(start,mark);let current=start;
    for(let i=0;i<1000&&path.length;i++){current=followPath(current,path,.035*2.4);assert(walkable(current));}
    assert.equal(path.length,0,contact.id);
    assert(Math.hypot(current.x-mark.x,current.z-mark.z)<.001,contact.id);
  }
});

test('resident gestures do not move the feet, accumulate bone drift, or animate in reduced motion',()=>{
  const body = new T.Group(),head=new T.Bone(),foot=new T.Bone();head.name='Head';foot.name='LeftFoot';body.add(head,foot);
  const q = new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),.3);head.quaternion.copy(q);
  const pose = new ResidentPose(body);pose.update(2,true,false);
  assert(head.quaternion.angleTo(q)>0);assert.deepEqual(foot.position.toArray(),[0,0,0]);
  const first=head.quaternion.clone();pose.update(2,true,false);assert(head.quaternion.angleTo(first)<1e-7);
  pose.update(999,true,true);assert(head.quaternion.angleTo(q)<1e-7);
  pose.update(0,false,true);assert(head.quaternion.angleTo(q)<1e-7);
});
