import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { CityAtmosphere, cityMorning } from '../src/bangkok/CityAtmosphere.ts';
import { freshAdventure, actors, normalizeAdventure } from '../src/bangkok/adventure.ts';
import { advanceReunion } from '../src/bangkok/reunion.ts';
const completed = ['intro', 'innkeeper', 'murmur', 'cook', 'ferry', 'keeper', 'departed'];
test('the agreed morning starts only after both actual invitations; older saves derive the same world', () => {
  let s = { ...freshAdventure(), flags: [...completed], position: { x: 1, z: -5.5 } };
  assert(!cityMorning(s.flags));
  s = advanceReunion(s, 'ferry', 'plan', 'tomorrow-ok');
  assert(!cityMorning(s.flags));
  for (const id of ['innkeeper', 'artisan'] as const) {
    const host = actors.find((a) => a.id === id)!;
    s = { ...s, position: { x: host.x, z: host.z } };
    s = advanceReunion(
      s,
      id,
      id === 'innkeeper' ? 'mali' : 'arun',
      id === 'innkeeper' ? 'go-together' : 'meet-where',
    );
    assert.equal(cityMorning(s.flags), id === 'artisan');
  }
  assert(cityMorning(normalizeAdventure(JSON.parse(JSON.stringify(s))).flags));
  assert(!cityMorning(s.flags.filter((f) => f !== 'departed')));
  assert(!cityMorning([...s.flags, 'reunion-evening']));
});
test('daylight blends sky, fog and real lights, follows the camera, and handles a late backdrop', () => {
  const scene = new T.Scene(),
    sun = new T.DirectionalLight(),
    ambient = new T.HemisphereLight(),
    skyline = new T.Group();
  scene.fog = new T.FogExp2();
  const sky = new CityAtmosphere(scene, sun, ambient, skyline),
    camera = new T.PerspectiveCamera();
  const plate = new T.Mesh(new T.PlaneGeometry(), new T.MeshBasicMaterial());
  sky.sync([]);
  sky.bindBackdrop(plate);
  camera.position.set(-57, 11, 34);
  sky.update(0.1, camera, false);
  const dusk = sun.color.clone();
  assert.equal(plate.material.opacity, 1);
  assert(!skyline.visible);
  sky.sync([...completed, 'reunion-tomorrow', 'reunion-mali', 'reunion-arun']);
  sky.update(0.2, camera, false);
  assert(sky.snapshot().daylight > 0 && sky.snapshot().daylight < 1);
  assert.notDeepEqual(sun.color.toArray(), dusk.toArray());
  assert.deepEqual(sky.sky.position.toArray(), camera.position.toArray());
  for (let i = 0; i < 60; i++) sky.update(0.2, camera, false);
  assert.equal(sky.snapshot().daylight, 1);
  assert(!plate.visible);
  assert(skyline.visible);
  assert.equal(scene.fog.density, 0.0045);
  assert.equal(ambient.intensity, 1.65);
  const late = new T.Mesh(new T.PlaneGeometry(), new T.MeshBasicMaterial());
  sky.bindBackdrop(late);
  assert(!late.visible);
  sky.sync([]);
  sky.update(0.016, camera, true);
  assert.equal(sky.snapshot().daylight, 0);
  assert(late.visible);
  sky.sky.geometry.dispose();
  sky.sky.material.dispose();
  plate.geometry.dispose();
  plate.material.dispose();
  late.geometry.dispose();
  late.material.dispose();
});
