import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { freshAdventure, normalizeAdventure, walkable, findPath, actors } from '../src/bangkok/adventure.ts';
import { advanceEvening } from '../src/bangkok/eveningOuting.ts';
import { eveningDisplay, eveningServiceParts } from '../src/bangkok/CityEvening.ts';
import { parkServingTable, recoverCityPosition, hotelStart } from '../src/bangkok/city.ts';

test('only committed choices serve a meal or select a drink; every ending survives save normalization', () => {
  for (const [route, reply, drink, chilli] of [
    ['food', 'not-spicy', null, false],
    ['food', 'little-spicy', null, true],
    ['park', 'water-please', 'water', false],
    ['park', 'want-this', 'tea', false],
  ] as const) {
    const s = freshAdventure();
    s.flags = ['intro', 'innkeeper', `evening-${route}`];
    s.position = route === 'food' ? { x: 35, z: 16.5 } : { x: -25, z: 25 };
    assert.deepEqual(eveningDisplay(s), { meal: false, chilli: false, drink: null });
    const next = advanceEvening(s, 'order', reply);
    const expected = { meal: route === 'food', chilli, drink };
    assert.deepEqual(eveningDisplay(next), expected);
    assert.deepEqual(eveningDisplay(normalizeAdventure(next)), expected);
    assert.equal(next.xp, s.xp);
    assert.equal(next.coins, s.coins);
    const complete = advanceEvening(next, 'finish', route === 'food' ? 'delicious' : 'thank-you');
    assert.deepEqual(eveningDisplay(normalizeAdventure(complete)), expected);
  }
  const supper = freshAdventure();
  supper.flags = ['cook'];
  assert(eveningDisplay(supper).meal, 'main-story supper still fills the bowls');
});
test('new table is solid, keeps every actor reachable, and recovers Patrick and Nok locally', () => {
  const point = { x: parkServingTable.x + 0.6, z: parkServingTable.z + 0.25 };
  assert(!walkable(point));
  const recovered = recoverCityPosition(point)!;
  assert(recovered && walkable(recovered));
  assert(Math.hypot(point.x - recovered.x, point.z - recovered.z) < 1);
  const s = freshAdventure();
  s.flags = ['intro', 'innkeeper'];
  s.position = point;
  s.escort = { stage: 'following', position: point };
  const restored = normalizeAdventure(s);
  assert(walkable(restored.position));
  assert(walkable(restored.escort.position));
  assert.equal(restored.escort.stage, 'following');
  assert.deepEqual(restored.flags, s.flags);
  assert.equal(restored.xp, s.xp);
  for (const actor of actors) assert(findPath(hotelStart, actor).length, actor.name);
});
test('Blender serving parts fit their supports and keep a small geometry budget', async () => {
  const bytes = readFileSync('public/bangkok/models/evening-service.glb');
  const root = (
    await new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      '',
    )
  ).scene;
  let triangles = 0;
  for (const name of eveningServiceParts) assert(root.getObjectByName(name), name);
  for (const name of ['MealBase', 'MealContents', 'ChilliAdded', 'ChilliAside']) {
    const b = new T.Box3().setFromObject(root.getObjectByName(name)!);
    assert(b.min.x >= -0.88 && b.max.x <= 0.88);
    assert(b.min.z >= -0.35 && b.max.z <= 0.35);
    assert(b.min.y >= 0 && b.max.y < 0.4);
  }
  const table = new T.Box3().setFromObject(root.getObjectByName('ParkTable')!);
  assert(table.min.x >= -0.601 && table.max.x <= 0.601);
  assert(table.min.z >= -0.251 && table.max.z <= 0.251);
  assert(Math.abs(table.max.y - 0.88) < 0.001);
  for (const name of ['WaterSet', 'TeaSet']) {
    const b = new T.Box3().setFromObject(root.getObjectByName(name)!);
    assert(b.min.x >= -0.25 && b.max.x <= 0.25 && b.min.z >= -0.22 && b.max.z <= 0.22);
  }
  root.traverse((o) => {
    assert(!(o instanceof T.Light || o instanceof T.Camera));
    if (o instanceof T.Mesh) {
      const p = o.geometry.getAttribute('position');
      assert(Array.from(p.array).every(Number.isFinite));
      triangles += (o.geometry.index?.count ?? p.count) / 3;
    }
  });
  assert(triangles < 12000 && bytes.length < 500000);
});
