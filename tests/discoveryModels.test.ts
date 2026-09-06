import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { discoveries } from '../src/bangkok/discoveries.ts';
import { actors, findPath, followPath, walkable } from '../src/bangkok/adventure.ts';
import { companionMark, companionStart, conversationCamera } from '../src/bangkok/conversationStaging.ts';

test('Blender memory pack has six correctly scaled, portable world props', async () => {
  const bytes = readFileSync('public/bangkok/models/city-memories.glb');
  assert(bytes.length < 1_200_000);
  const { scene } = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  let triangles = 0;
  for (const site of discoveries) {
    const model = scene.getObjectByName(site.id);
    assert(model, site.id);
    const bounds = new T.Box3().setFromObject(model);
    assert(bounds.min.x >= -0.72 && bounds.max.x <= 0.72, `${site.id}: width`);
    assert(bounds.min.z >= -0.5 && bounds.max.z <= 0.5, `${site.id}: depth`);
    assert(bounds.min.y >= -0.01 && bounds.max.y <= 1.75, `${site.id}: height`);
    assert(bounds.max.y > 0.7);
    model.traverse((object) => {
      assert(!(object instanceof T.Camera || object instanceof T.Light));
      if (object instanceof T.Mesh) {
        const positions = object.geometry.getAttribute('position');
        assert(Array.from(positions.array).every(Number.isFinite));
        triangles += (object.geometry.index?.count ?? positions.count) / 3;
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          assert(material instanceof T.MeshStandardMaterial);
          assert.equal(material.map, null, 'portable geometry needs no external texture');
        }
      }
    });
  }
  assert(triangles > 10000 && triangles < 25000);
});

test('all discoveries retain a clear approach outside their model footprint', () => {
  const start = actors.find((actor) => actor.id === 'innkeeper')!;
  for (const site of discoveries) {
    const approach = { x: site.x, z: site.z - 1.2 };
    assert(walkable(approach), site.id);
    assert(findPath(start, approach).length > 0, `${site.id}: reachable`);
    assert(Math.hypot(approach.x - site.x, approach.z - site.z) < 2.5);
  }
});

test('discovery conversations keep the board fronts visible and Su on reachable ground', () => {
  for (const site of discoveries) {
    const player = { x: site.x, z: site.z + (site.id === 'park-basket' ? -1.2 : 1.2) };
    const previous = companionStart(player, { x: player.x + 0.8, z: player.z + 0.6 });
    const mark = companionMark(player, site, previous);
    assert(walkable(mark), site.id);
    assert(Math.hypot(mark.x - player.x, mark.z - player.z) >= 1.1);
    assert(Math.hypot(mark.x - site.x, mark.z - site.z) >= 1.1);
    assert.deepEqual(conversationCamera(player, site), { x: 6, z: 11 });
    const path = findPath(previous, mark);
    let point = previous;
    for (let frame = 0; frame < 600 && path.length; frame++) point = followPath(point, path, 2.4 / 60);
    assert.equal(path.length, 0, `${site.id}: follower reaches its mark`);
    assert(walkable(point));
  }
});
