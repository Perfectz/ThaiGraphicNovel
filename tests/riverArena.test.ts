import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RiverArena } from '../src/bangkok/RiverArena.ts';

test('Blender arena has portable geometry, clear battle positions and upward paving', async () => {
  const b = readFileSync('public/bangkok/models/river-arena.glb');
  assert(b.length < 1800000);
  assert(existsSync('art/blender/river-arena.blend'));
  const { scene } = await new GLTFLoader().parseAsync(
    b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
    '',
  );
  scene.updateMatrixWorld(true);
  const platform = scene.getObjectByName('StonePlatform')!;
  const lamps = scene.getObjectByName('LanternGallery')!;
  const rails = scene.getObjectByName('RiverBalustrade')!;
  assert(platform && lamps && rails);
  const pavingBounds = new T.Box3().setFromObject(platform);
  assert(pavingBounds.max.y < 0.025, 'geometry remains below .05 targeting rings');
  assert(pavingBounds.min.x < -7.7 && pavingBounds.max.x > 7.7);
  assert(new T.Box3().setFromObject(lamps).max.z < -5.4, 'tall architecture remains behind combat');
  assert(new T.Box3().setFromObject(rails).max.z < -5.4);
  let triangles = 0,
    meshes = 0,
    upward = 0;
  scene.traverse((o) => {
    assert(!(o instanceof T.Light || o instanceof T.Camera));
    if (!(o instanceof T.Mesh)) return;
    meshes++;
    const positions = o.geometry.getAttribute('position'),
      normals = o.geometry.getAttribute('normal');
    assert(normals);
    triangles += (o.geometry.index?.count ?? positions.count) / 3;
    for (const mat of Array.isArray(o.material) ? o.material : [o.material]) {
      assert(mat instanceof T.MeshStandardMaterial);
      assert(!mat.map, 'no external textures');
    }
    for (let i = 0; i < positions.count; i++) {
      const p = new T.Vector3().fromBufferAttribute(positions, i).applyMatrix4(o.matrixWorld);
      assert(p.toArray().every(Number.isFinite));
      if (platform.getObjectById(o.id) && [0.006, 0.016, 0.02].some((y) => Math.abs(p.y - y) < 0.0001)) {
        const n = new T.Vector3().fromBufferAttribute(normals, i).transformDirection(o.matrixWorld);
        if (Math.abs(n.y) > 0.9) {
          assert(n.y > 0.9, 'inlay/paving faces upward');
          upward++;
        }
      }
    }
  });
  assert(triangles > 15000 && triangles < 32000);
  assert(meshes <= 20, 'material batches bound draw calls');
  assert(upward > 100);
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
function fixture(valid = true) {
  const scene = new T.Group();
  if (valid)
    for (const name of ['StonePlatform', 'LanternGallery', 'RiverBalustrade']) {
      const p = new T.Group();
      p.name = name;
      scene.add(p);
    }
  const mesh = new T.Mesh(new T.BoxGeometry(), new T.MeshStandardMaterial());
  scene.add(mesh);
  let disposed = 0;
  mesh.geometry.addEventListener('dispose', () => disposed++);
  return { scene, disposals: () => disposed };
}
test('arena swaps only after complete download and keeps runtime ownership', async () => {
  const root = new T.Group(),
    fallback = new T.Group(),
    model = fixture();
  root.add(fallback);
  let resolve!: (value: { scene: T.Group }) => void;
  const arena = new RiverArena(root, fallback, () => new Promise((r) => (resolve = r)));
  assert(fallback.visible);
  assert.equal(arena.state, 'loading');
  resolve(model);
  await flush();
  assert.equal(arena.state, 'ready');
  assert(!fallback.visible);
  assert.equal(model.scene.parent, root);
  arena.dispose();
  assert.equal(model.disposals(), 0, 'world owns attached resources');
});
test('failed or incomplete model leaves procedural arena playable', async () => {
  for (const broken of [false, true]) {
    const root = new T.Group(),
      fallback = new T.Group(),
      model = fixture(false);
    const arena = new RiverArena(root, fallback, () =>
      broken ? Promise.reject(new Error('offline')) : Promise.resolve(model),
    );
    await flush();
    assert.equal(arena.state, 'fallback');
    assert(fallback.visible);
    assert.equal(root.children.length, 0);
    assert.equal(model.disposals(), broken ? 0 : 1);
  }
});
test('late model after world disposal releases geometry without attaching', async () => {
  const root = new T.Group(),
    fallback = new T.Group(),
    model = fixture();
  let resolve!: (value: { scene: T.Group }) => void;
  const arena = new RiverArena(root, fallback, () => new Promise((r) => (resolve = r)));
  arena.dispose();
  resolve(model);
  await flush();
  assert.equal(model.disposals(), 1);
  assert.equal(root.children.length, 0);
  assert(fallback.visible);
});
