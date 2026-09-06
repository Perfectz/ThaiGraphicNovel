import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { CityGroundLight } from '../src/bangkok/CityGroundLight.ts';

test('ground detail uses at most two instanced batches per district with no shadow-map cost', () => {
  const ground = new CityGroundLight(),
    street = new T.Group(),
    park = new T.Group();
  ground.add(street, 'shade', 3, 4, 6, 2);
  ground.add(street, 'light', 5, 6, 4, 3);
  ground.add(street, 'light', 8, 9, 5, 5);
  ground.add(park, 'shade', 0, 0, 2);
  ground.build();
  assert.equal(ground.meshes.length, 3);
  assert.equal(
    ground.meshes.reduce((n, mesh) => n + mesh.count, 0),
    4,
  );
  const matrix = new T.Matrix4();
  ground.meshes[0].getMatrixAt(0, matrix);
  assert(Math.abs(matrix.elements[13] - 0.13) < 0.00001);
  assert.equal(matrix.elements[12], 3);
  assert.equal(matrix.elements[14], 4);
  for (const mesh of ground.meshes) {
    assert.equal(mesh.castShadow, false);
    assert.equal(mesh.receiveShadow, false);
    assert.equal((mesh.material as T.Material).depthWrite, false);
    assert(mesh.userData.animated);
    assert(mesh.boundingSphere?.radius);
  }
  ground.dispose();
  assert.equal(street.children.length, 0);
  assert.equal(park.children.length, 0);
});
