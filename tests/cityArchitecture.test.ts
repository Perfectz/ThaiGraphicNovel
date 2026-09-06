import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CityArchitecture } from '../src/bangkok/CityArchitecture.ts';

test('district facades and gables retain finite, batch-compatible 3D geometry', () => {
  const architecture = new CityArchitecture(),
    root = new T.Group();
  for (const style of ['modern', 'market', 'timber'] as const) {
    const front = architecture.facade(root, style, 0, 0, 5, 6, 4, 1);
    const bounds = new T.Box3().setFromObject(front);
    assert(bounds.min.y >= -0.01 && bounds.max.y <= 7.4, style + ' height');
    assert(bounds.min.x >= -3 && bounds.max.x <= 3, style + ' frontage');
  }
  architecture.pavilionRoof(root, 0, 0, 0);
  root.updateMatrixWorld(true);
  const groups = new Map<T.Material, T.BufferGeometry[]>();
  root.traverse((obj) => {
    if (!(obj instanceof T.Mesh) || Array.isArray(obj.material)) return;
    const geometry = obj.geometry.index ? obj.geometry.toNonIndexed() : obj.geometry.clone();
    geometry.applyMatrix4(obj.matrixWorld);
    assert(Array.from(geometry.getAttribute('position').array).every(Number.isFinite));
    const parts = groups.get(obj.material) ?? [];
    parts.push(geometry);
    groups.set(obj.material, parts);
  });
  for (const parts of groups.values()) {
    const batch = mergeGeometries(parts);
    assert(batch, 'Shared materials must merge without dropping geometry');
    batch.dispose();
    parts.forEach((p) => p.dispose());
  }
});

test('a reversed shop front faces its street and its pitched roof stays over its own footprint', () => {
  const architecture = new CityArchitecture(),
    root = new T.Group();
  const front = architecture.facade(root, 'timber', 10, 20, 5, 6, 4, -1);
  const bounds = new T.Box3().setFromObject(front);
  assert(bounds.min.z >= 19 && bounds.max.z <= 24.4);
  assert(bounds.min.x >= 7 && bounds.max.x <= 13);
});
