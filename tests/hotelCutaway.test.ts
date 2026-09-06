import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { HotelInterior } from '../src/bangkok/HotelInterior.ts';
import { groupHotelNorthWall } from '../src/bangkok/HotelCutaway.ts';
import { blocksCityView } from '../src/bangkok/cityVisibility.ts';

test('hotel north wall cutaway includes attached art while preserving floors and reception', () => {
  const root = new T.Group();
  new HotelInterior(root, {
    box: (size) => new T.BoxGeometry(size[0], size[1], size[2]),
    get: () => new T.MeshStandardMaterial(),
  });
  const structure = new T.Mesh(new T.BoxGeometry(16, 3.6, 0.22), new T.MeshStandardMaterial());
  structure.position.set(-54, 1.8, 23);
  root.add(structure);
  const original = new T.Box3().setFromObject(structure);
  const group = groupHotelNorthWall(root);
  assert.equal(structure.parent, group);
  assert(group.children.length > 10, 'attached reception art follows the wall');
  assert(new T.Box3().setFromObject(structure).equals(original));
  assert(root.getObjectByName('bedroom-timber-floor')?.parent !== group);
  const reception = root.getObjectByName('reception-craftwork')!;
  assert(reception.children.length > 20, 'counter trim remains in the room');
  const bounds = new T.Box3().setFromObject(group);
  assert(blocksCityView(bounds, { x: -51, y: 7.4, z: 29.5 }, { x: -57, y: 1.55, z: 18.7 }));
  assert(!blocksCityView(bounds, { x: -55, y: 7.4, z: 46 }, { x: -61, y: 1.55, z: 35.7 }));
});
