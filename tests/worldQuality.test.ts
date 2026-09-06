import test from 'node:test';
import assert from 'node:assert/strict';
import { WorldQuality } from '../src/bangkok/WorldQuality.ts';

function run(q: WorldQuality, duration: number, frameMs: number, ready = true) {
  for (let t = 0; t < duration; t += frameMs) q.sample(frameMs, ready);
}
test('asset loading and isolated stalls do not permanently remove shadows', () => {
  const q = new WorldQuality();
  run(q, 10000, 160, false);
  run(q, 4000, 160);
  run(q, 4000, 16.7);
  q.sample(800, true);
  run(q, 8000, 16.7);
  assert.equal(q.level, 'high');
  assert(q.percentileMs < 17);
});
test('sustained slow rendering reduces quality and sustained recovery restores it', () => {
  const q = new WorldQuality();
  run(q, 4000, 16.7);
  run(q, 4100, 60);
  assert.equal(q.level, 'high', 'two slow windows are not sufficient');
  run(q, 2200, 60);
  assert.equal(q.level, 'low');
  run(q, 16000, 16.7);
  assert.equal(q.level, 'low', 'recovery needs its cooldown and six healthy windows');
  run(q, 2500, 16.7);
  assert.equal(q.level, 'high');
});
test('tab gaps and invalid samples do not count as poor rendering', () => {
  const q = new WorldQuality();
  run(q, 8000, 16.7);
  for (const value of [NaN, Infinity, -3, 0, 45000]) q.sample(value, true);
  q.pause();
  run(q, 12000, 16.7);
  assert.equal(q.level, 'high');
});
test('a failed restoration backs off instead of repeatedly changing quality', () => {
  const q = new WorldQuality();
  run(q, 11000, 60);
  assert.equal(q.level, 'low');
  run(q, 19000, 16.7);
  assert.equal(q.level, 'high');
  run(q, 12500, 60);
  assert.equal(q.level, 'low');
  run(q, 45000, 16.7);
  assert.equal(q.level, 'low', 'no second restoration during the longer cooldown');
  run(q, 29000, 16.7);
  assert.equal(q.level, 'high');
});

test('a timed defense defers a quality change until a safe frame window', () => {
  const q = new WorldQuality();
  run(q, 4000, 16.7);
  for (let t = 0; t < 10000; t += 60) q.sample(60, true, false);
  assert.equal(q.level, 'high', 'no shader/resolution switch during the reaction');
  run(q, 2200, 60);
  assert.equal(q.level, 'low', 'the accumulated performance problem is handled afterward');
});
