import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { CityWayfinding, wayfindingSites } from '../src/bangkok/CityWayfinding.ts';
import { CityArchitecture } from '../src/bangkok/CityArchitecture.ts';
import { cityWalkable } from '../src/bangkok/city.ts';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

test('ten signs have physical frames, connected supports and head clearance; ground posts stay off routes', () => {
  const signs = new CityWayfinding(), root = new T.Group();
  assert.equal(wayfindingSites.length, 10);
  for (const site of wayfindingSites) {
    const frame = signs.build(root, site, g => {
      const mesh = new T.Mesh(new T.PlaneGeometry(site.width, site.width / 4));
      mesh.position.set(...site.position); g.add(mesh); return mesh;
    });
    const bounds = new T.Box3().setFromObject(frame).expandByScalar(1e-6);
    assert(bounds.containsPoint(new T.Vector3(...site.anchor)), site.id);
    assert(site.position[1] - site.width / 8 - .06 > 2.2, `${site.id} has insufficient head clearance`);
    for (const [x, y, z] of site.feet ?? []) {
      if (y < .2) for (const dx of [-.16, .16]) for (const dz of [-.16, .16])
        assert(!cityWalkable({ x: x + dx, z: z + dz }), `${site.id} post intrudes on a path`);
      assert(bounds.containsPoint(new T.Vector3(x, y, z)));
    }
    frame.traverse(o => { if (o instanceof T.Mesh) for (const n of o.geometry.getAttribute('position').array) assert(Number.isFinite(n)); });
  }
  signs.dispose();
});
test('rear facades face both directions and keep protruding utilities above walking height', () => {
  const architecture = new CityArchitecture();
  for (const style of ['modern', 'market', 'timber'] as const) for (const facing of [-1, 1]) {
    const root = new T.Group(), rear = architecture.rear(root, style, 0, 0, 5, 6, facing);
    const bounds = new T.Box3().setFromObject(rear);
    assert(bounds.max.x < 2.51 && bounds.min.x > -2.51);
    assert(facing > 0 ? bounds.min.z >= -.03 && bounds.max.z < .4 : bounds.max.z <= .03 && bounds.min.z > -.4);
    const parts: T.BufferGeometry[] = [];
    rear.updateWorldMatrix(true, true);
    rear.traverse(o => {
      if (!(o instanceof T.Mesh)) return;
      const b = new T.Box3().setFromObject(o);
      if (b.min.y < 2.2) assert(Math.max(Math.abs(b.max.z), Math.abs(b.min.z)) < .13);
      parts.push(o.geometry.clone().applyMatrix4(o.matrixWorld));
    });
    const merged = mergeGeometries(parts); assert(merged);
    merged.dispose(); parts.forEach(p => p.dispose());
  }
  assert.equal(architecture.rearFacades, 6);
});
