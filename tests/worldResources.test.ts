import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { disposeWorldObject } from '../src/bangkok/worldResources.ts';

test('shared model resources and sprite maps are released once per retired graph', () => {
  const root = new T.Group();
  const geometry = new T.BoxGeometry();
  const map = new T.Texture();
  const material = new T.MeshBasicMaterial({ map });
  const spriteMaterial = new T.SpriteMaterial({ map });
  const counts = { geometry: 0, map: 0, material: 0, sprite: 0, instance: 0 };
  geometry.addEventListener('dispose', () => counts.geometry++);
  map.addEventListener('dispose', () => counts.map++);
  material.addEventListener('dispose', () => counts.material++);
  spriteMaterial.addEventListener('dispose', () => counts.sprite++);
  const instance = new T.InstancedMesh(geometry, material, 2);
  instance.addEventListener('dispose', () => counts.instance++);
  root.add(new T.Mesh(geometry, material), instance, new T.Sprite(spriteMaterial));
  disposeWorldObject(root, [map]);
  assert.deepEqual(counts, { geometry: 1, map: 1, material: 1, sprite: 1, instance: 1 });
});

test('party skeleton textures and both shadow render targets are explicitly released', () => {
  const root = new T.Group();
  const bone = new T.Bone();
  const skeleton = new T.Skeleton([bone]);
  skeleton.computeBoneTexture();
  let boneDisposals = 0;
  skeleton.boneTexture!.addEventListener('dispose', () => boneDisposals++);
  const mesh = new T.SkinnedMesh(new T.BufferGeometry(), new T.MeshBasicMaterial());
  mesh.add(bone);
  mesh.bind(skeleton);
  const second = new T.SkinnedMesh(mesh.geometry, mesh.material);
  second.bind(skeleton);
  const light = new T.DirectionalLight();
  light.shadow.map = new T.WebGLRenderTarget(8, 8);
  light.shadow.mapPass = new T.WebGLRenderTarget(8, 8);
  let shadowDisposals = 0;
  light.shadow.map.addEventListener('dispose', () => shadowDisposals++);
  light.shadow.mapPass.addEventListener('dispose', () => shadowDisposals++);
  root.add(mesh, second, light);
  disposeWorldObject(root);
  assert.equal(skeleton.boneTexture, null);
  assert.equal(boneDisposals, 1);
  assert.equal(shadowDisposals, 2);
});

test('line and particle geometry are released along with off-scene owned textures', () => {
  const root = new T.Group();
  const line = new T.Line(new T.BufferGeometry(), new T.LineBasicMaterial());
  const points = new T.Points(new T.BufferGeometry(), new T.PointsMaterial());
  const texture = new T.Texture();
  let released = 0;
  for (const resource of [line.geometry, line.material, points.geometry, points.material, texture]) {
    resource.addEventListener('dispose', () => released++);
  }
  root.add(line, points);
  disposeWorldObject(root, [texture]);
  assert.equal(released, 5);
});
