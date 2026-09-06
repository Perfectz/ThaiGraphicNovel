import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { hotelFurnishingOrigin } from '../src/bangkok/HotelFurnishings.ts';
import { cityObstacles, hotelStart } from '../src/bangkok/city.ts';
import { findPath, followPath, walkable, actors } from '../src/bangkok/adventure.ts';

test('Blender hotel furniture fits existing solid footprints and exports portable shaded geometry', async () => {
  const b = readFileSync('public/bangkok/models/hotel-furnishings.glb');
  assert(b.length < 2000000);
  assert(existsSync('art/blender/hotel-furnishings.blend'));
  const { scene } = await new GLTFLoader().parseAsync(
    b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
    '',
  );
  scene.position.set(hotelFurnishingOrigin.x, 0, hotelFurnishingOrigin.z);
  scene.updateMatrixWorld(true);
  let triangles = 0;
  let upwardCounterFaces = 0;
  const craft = scene.getObjectByName('BedroomWallCraft');
  assert(craft, 'original Blender wall collection is exported');
  const wallBounds = new T.Box3().setFromObject(craft);
  assert(wallBounds.min.x > -61.9 && wallBounds.max.x < -61.1, 'wall craft stays against the west wall');
  assert(wallBounds.min.y > 1.35 && wallBounds.max.y < 3.15, 'wall craft stays above the navigation plane');
  assert(wallBounds.min.z > 26.8 && wallBounds.max.z < 35.2);
  for (const [name, x] of [
    ['GuestBed', -60],
    ['LobbySofa', -52],
    ['Reception', -52],
    ['ReceptionObjects', -52],
  ] as const) {
    const part = scene.getObjectByName(name);
    assert(part, name);
    const kind = name === 'GuestBed' ? 'bed' : name === 'LobbySofa' ? 'seat' : 'desk';
    const footprint = cityObstacles.find(
      (o) => o.kind === kind && o.x === x && (kind !== 'desk' || o.z === 24),
    )!;
    const bounds = new T.Box3().setFromObject(part);
    assert(
      bounds.min.x >= footprint.x - 0.001 && bounds.max.x <= footprint.x + footprint.w + 0.001,
      `${name} X: ${JSON.stringify(bounds)}`,
    );
    assert(
      bounds.min.z >= footprint.z - 0.001 && bounds.max.z <= footprint.z + footprint.d + 0.001,
      `${name} Z: ${JSON.stringify(bounds)}`,
    );
    assert(bounds.min.y >= 0.07 && bounds.max.y < 2.2);
    if (name === 'ReceptionObjects') assert(bounds.min.y >= 1.22, 'objects rest on the actual counter top');
  }
  scene.traverse((o) => {
    assert(!(o instanceof T.Light || o instanceof T.Camera));
    if (!(o instanceof T.Mesh)) return;
    assert(o.geometry.getAttribute('normal'));
    triangles += (o.geometry.index?.count ?? o.geometry.getAttribute('position').count) / 3;
    for (const mat of Array.isArray(o.material) ? o.material : [o.material]) {
      assert(mat instanceof T.MeshStandardMaterial);
      assert(!mat.map, 'no external texture downloads');
    }
    const p = o.geometry.getAttribute('position');
    if (!Array.isArray(o.material) && o.material.name === 'Green stone') {
      const normals = o.geometry.getAttribute('normal');
      for (let i = 0; i < p.count; i++) {
        const point = new T.Vector3().fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
        const normal = new T.Vector3().fromBufferAttribute(normals, i).transformDirection(o.matrixWorld);
        if (point.y > 1.222 && Math.abs(normal.y) > 0.9) {
          assert(normal.y > 0.9, 'countertop faces point upward for correct lighting and shadow bias');
          upwardCounterFaces++;
        }
      }
    }
    for (let i = 0; i < p.count; i++)
      assert(new T.Vector3().fromBufferAttribute(p, i).toArray().every(Number.isFinite));
  });
  assert(triangles > 22000 && triangles < 45000);
  assert(upwardCounterFaces > 10);
});

test('the journal, reception and city exit remain reachable from the guest room', () => {
  let p = { ...hotelStart };
  for (const id of ['hotel-journal', 'innkeeper', 'station']) {
    const target = actors.find((a) => a.id === id)!;
    const route = findPath(p, target);
    assert(route.length);
    for (let i = 0; i < 10000 && route.length; i++) {
      p = followPath(p, route, 0.1);
      assert(walkable(p));
    }
    assert.equal(route.length, 0);
    assert(Math.hypot(p.x - target.x, p.z - target.z) < 0.01);
  }
});
