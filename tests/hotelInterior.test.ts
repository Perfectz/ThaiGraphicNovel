import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { HotelInterior } from '../src/bangkok/HotelInterior.ts';
import { cityAreas } from '../src/bangkok/city.ts';

function interior() {
  const root = new T.Group();
  const surfaces = new Map<string, T.Material>();
  new HotelInterior(root, {
    box: size => new T.BoxGeometry(size[0], size[1], size[2]),
    get: (surface, color) => {
      const key = surface + color;
      if (!surfaces.has(key)) surfaces.set(key, new T.MeshStandardMaterial());
      return surfaces.get(key)!;
    },
  });
  root.updateMatrixWorld(true);
  return root;
}
test('hotel details fit the room, stay off the walking surface and preserve furniture footprints', () => {
  const root = interior(), room = cityAreas.find(a => a.id === 'hotel')!.bounds;
  root.traverse(o => {
    if (!(o instanceof T.Mesh)) return;
    const b = new T.Box3().setFromObject(o);
    assert(b.min.x >= room.x && b.max.x <= room.x + room.w);
    assert(b.min.z >= room.z && b.max.z <= room.z + room.d);
    assert(b.min.y >= 0.08 && b.max.y <= 3.6);
    const onFloor = b.max.y < .13;
    const onWestWall = b.max.x < -61.5;
    const onCounter = b.min.z >= 25.09 && b.max.z < 25.2 && b.min.x > -52 && b.max.x < -46;
    const onNorthWall = b.max.z < 23.4;
    assert(onFloor || onWestWall || onCounter || onNorthWall, `${o.name || 'detail'} intrudes into the walking space`);
  });
  const floor = new T.Box3().setFromObject(root.getObjectByName('bedroom-timber-floor')!);
  assert(floor.max.x < -54.1, 'Timber floor must end at the bedroom divider');
  assert(floor.min.y > .08, 'Timber must not fight the existing marble floor');
});
test('botanical reliefs and rugs remain finite and compatible with static district batches', () => {
  const root = interior();
  assert(root.getObjectByName('botanical-relief-1'));
  assert(root.getObjectByName('botanical-relief-2'));
  assert(root.getObjectByName('botanical-relief-3'));
  const groups = new Map<T.Material, T.BufferGeometry[]>();
  root.traverse(o => {
    if (!(o instanceof T.Mesh) || Array.isArray(o.material)) return;
    const geometry = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    geometry.applyMatrix4(o.matrixWorld);
    assert(Array.from(geometry.getAttribute('position').array).every(Number.isFinite));
    const parts = groups.get(o.material) ?? []; parts.push(geometry); groups.set(o.material, parts);
  });
  assert(groups.size < 25, 'Repeated details share their materials');
  for (const parts of groups.values()) {
    const merged = mergeGeometries(parts); assert(merged); merged.dispose();
    parts.forEach(p => p.dispose());
  }
});
