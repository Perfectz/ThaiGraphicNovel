import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CityBackdrop } from '../src/bangkok/CityBackdrop.ts';
import { cityAreas, cityRoads, cityBackdropBlocks } from '../src/bangkok/city.ts';
import { blocksCityView } from '../src/bangkok/cityVisibility.ts';

test('perimeter buildings leave every district, road and existing background lot clear', () => {
  const backdrop = new CityBackdrop(new T.Group(), () => {}, () => {});
  assert.equal(backdrop.buildings.length, 20);
  for (const b of backdrop.buildings) {
    for (const r of [...cityAreas.map(a => a.bounds), ...cityRoads, ...cityBackdropBlocks]) {
      const overlaps = b.min.x < r.x + r.w && b.max.x > r.x && b.min.z < r.z + r.d && b.max.z > r.z;
      assert(!overlaps, `Scenery overlaps ${JSON.stringify(r)}`);
    }
  }
});
test('five independently removable zones share finite, mergeable geometry', () => {
  let batches = 0, cutaways = 0;
  const backdrop = new CityBackdrop(new T.Group(), root => {
    batches++; root.updateMatrixWorld(true);
    const materials = new Map<T.Material, T.BufferGeometry[]>();
    root.traverse(o => {
      if (!(o instanceof T.Mesh) || Array.isArray(o.material)) return;
      const g = o.geometry.toNonIndexed(); g.applyMatrix4(o.matrixWorld);
      assert(Array.from(g.getAttribute('position').array).every(Number.isFinite));
      const group = materials.get(o.material) ?? []; group.push(g); materials.set(o.material, group);
    });
    assert(materials.size <= 11);
    for (const group of materials.values()) {
      const merged = mergeGeometries(group); assert(merged); merged.dispose(); group.forEach(g => g.dispose());
    }
  }, root => { cutaways++; assert(!new T.Box3().setFromObject(root).isEmpty()); });
  assert.equal(batches, 5); assert.equal(cutaways, 5);
  const west = new T.Box3().setFromObject(backdrop.zones[0]);
  assert(!blocksCityView(west, { x: -40, y: 16, z: 45 }, { x: -57, y: 1, z: 29 }));
  assert(blocksCityView(west, { x: -85, y: 10, z: 24 }, { x: -57, y: 1, z: 29 }), 'A westward orbit can cut away the obstructing cluster');
});
