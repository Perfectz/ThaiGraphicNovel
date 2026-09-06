import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { crossingPose, crossingTime, crossingDuration } from '../src/bangkok/ferryPassage.ts';
import { FerryPassengers } from '../src/bangkok/FerryPassengers.ts';
import { freshAdventure, flag, normalizeAdventure, moveAdventure } from '../src/bangkok/adventure.ts';
import { adventureScore } from '../src/bangkok/adventureScore.ts';
test('crossing stays on the river, moves bow-first, and pauses elapsed time while hidden', () => {
  assert.deepEqual(crossingPose(-1), crossingPose(0));
  assert.deepEqual(crossingPose(NaN), crossingPose(0));
  assert.deepEqual(crossingPose(2), crossingPose(1));
  for (let p = 0; p < 1; p += 0.01) {
    const a = crossingPose(p),
      b = crossingPose(p + 0.01);
    assert(b.x > a.x);
    assert(b.z < a.z);
    assert(a.z <= -13);
    assert(a.y === -0.6);
    assert(a.yaw >= 0 && a.yaw < 0.23);
  }
  assert.equal(crossingTime(5, 3, true), 5);
  assert.equal(crossingTime(5, 3, false), 5.25);
  assert.equal(crossingTime(5, -1, false), 5);
  assert.equal(crossingTime(11.9, 1, false), crossingDuration);
  assert.equal(adventureScore('riverside', 'crossing'), 'journey');
});
test('passenger copies preserve original transforms and resources, remain bounded, and are reused', () => {
  const scene = new T.Scene(),
    passengers = new FerryPassengers(scene);
  const objects = ['patrick', 'su', 'niran'].map((id, i) => {
    const object = new T.Mesh(new T.BoxGeometry(0.4, 1.6, 0.4), new T.MeshStandardMaterial());
    object.position.set(10 + i, 4, -3);
    object.rotation.y = 0.7;
    return { id, object, x: i - 1, z: 0 };
  });
  const originals = objects.map((r) => ({
    position: r.object.position.clone(),
    rotation: r.object.rotation.clone(),
    geometry: r.object.geometry,
  }));
  passengers.prepare(objects.slice(0, 2));
  assert.equal(passengers.root.children.length, 0);
  passengers.prepare(objects);
  passengers.prepare(objects);
  assert.equal(passengers.root.children.length, 3);
  objects.forEach((r, i) => {
    assert.deepEqual(r.object.position, originals[i].position);
    assert.deepEqual(r.object.rotation.toArray(), originals[i].rotation.toArray());
    assert.equal((passengers.root.children[i] as T.Mesh).geometry, originals[i].geometry);
  });
  for (const child of passengers.root.children) {
    const b = new T.Box3().setFromObject(child);
    assert(Math.abs(b.min.y - 0.15) < 1e-6);
    assert(b.max.y < 1.8);
  }
  passengers.update(crossingPose(0.5), 0.1, false);
  assert(passengers.root.visible);
  assert.equal(passengers.root.position.x, 8);
  passengers.update(null, 0.1, false);
  assert(!passengers.root.visible);
  passengers.dispose();
  assert.equal(objects[0].object.geometry.getAttribute('position').count, 24);
});
test('departure and replay keep rewards and the saved riverside location intact', () => {
  let s = moveAdventure(freshAdventure(), { x: 1, z: -5.5 });
  s.flags = ['intro', 'innkeeper', 'cook', 'ferry', 'murmur', 'keeper'];
  s.coins = 73;
  s.xp = 400;
  const next = flag(s, 'departed');
  assert.equal(next.coins, 73);
  assert.equal(next.xp, 400);
  assert.deepEqual(next.position, s.position);
  assert.deepEqual(normalizeAdventure(next), next);
  assert.deepEqual(flag(next, 'departed'), next);
});
