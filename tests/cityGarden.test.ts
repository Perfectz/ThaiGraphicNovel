import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CityGarden } from '../src/bangkok/CityGarden.ts';

test('garden meshes sharing a material can enter the world static batches without losing geometry', () => {
  const root = new T.Group(), garden = new CityGarden();
  garden.tree(root, -29, 22, 1.2, () => {});
  garden.lakeside(root);
  root.updateMatrixWorld(true);
  const batches = new Map<T.Material, T.BufferGeometry[]>();
  root.traverse((object) => {
    if (!(object instanceof T.Mesh) || Array.isArray(object.material)) return;
    const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
    geometry.applyMatrix4(object.matrixWorld);
    const parts = batches.get(object.material) ?? [];
    parts.push(geometry);
    batches.set(object.material, parts);
  });
  for (const [material, parts] of batches) {
    const combined = mergeGeometries(parts);
    assert(combined, 'shared material must have compatible vertex attributes');
    const positions = combined.getAttribute('position');
    assert.equal(positions.count, parts.reduce((total, p) => total + p.getAttribute('position').count, 0));
    assert(Array.from(positions.array).every(Number.isFinite));
    combined.dispose(); parts.forEach(p => p.dispose()); material.dispose();
  }
  root.traverse((object) => { if (object instanceof T.Mesh) object.geometry.dispose(); });
});
