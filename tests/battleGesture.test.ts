import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { BattleGesture, battleGesture } from '../src/bangkok/BattleGesture.ts';
import { createBattle, defend, performMove, partyAction } from '../src/bangkok/expeditionCombat.ts';

test('word, healing, guard and defense events choose the actor that actually performs them', () => {
  const b = createBattle('keeper', 60, 2, 1, false);
  const cast = performMove(b, 'greet', 'keeper');
  assert.equal(battleGesture(cast, 'patrick', 0.5).name, 'cast');
  const heal = performMove(cast, 'mend', 'patrick');
  assert.equal(battleGesture(heal, 'su', 0.5).name, 'support');
  for (const defense of ['block', 'parry', 'dodge', 'miss'] as const) {
    const next = defend(heal, defense);
    const id = defense === 'parry' ? next.event.source : next.event.target;
    assert.equal(
      battleGesture(next, id as 'patrick', 0.5).name,
      { block: 'guard', parry: 'parry', dodge: 'dodge', miss: 'hurt' }[defense],
    );
  }
  const guarded = partyAction(b, 'guard');
  for (const age of [0, 0.01, 0.5, 1.04, 1.05, 5])
    assert.deepEqual(battleGesture(guarded, 'patrick', age), { name: 'guard', weight: 1 });
  assert.equal(battleGesture(guarded, 'patrick', 10).name, 'guard');
  guarded.heroes[0].hp = 0;
  assert.equal(battleGesture(guarded, 'patrick', 0.5).name, 'down');
});

test('additive poses do not accumulate, move the feet, or leak into exploration', () => {
  const root = new T.Group(),
    spine = new T.Bone(),
    foot = new T.Bone();
  spine.name = 'Spine02';
  foot.name = 'LeftFoot';
  spine.rotation.set(0.1, 0.2, 0.3);
  foot.position.set(1, 2, 3);
  root.add(spine, foot);
  const original = spine.quaternion.clone(),
    footMatrix = foot.matrix.clone();
  const pose = new BattleGesture(root, 'patrick');
  const b = partyAction(createBattle('keeper', 100, 2, 1, false), 'guard');
  pose.apply(b, 0, true);
  const first = spine.quaternion.clone();
  assert(first.angleTo(original) > 0.1, 'guard must visibly change the actual rig, not only its state label');
  for (let n = 0; n < 1000; n++) {
    pose.clear();
    pose.apply(b, n / 60, true);
  }
  assert(spine.quaternion.angleTo(first) < 1e-7);
  assert.deepEqual(foot.position.toArray(), [1, 2, 3]);
  assert(foot.matrix.equals(footMatrix));
  pose.clear();
  pose.apply(null, 20, false);
  assert(spine.quaternion.angleTo(original) < 1e-7);
  assert.equal(pose.name, null);
});

test('a loaded save never replays its last hit; new events blend out and reduced motion keeps a static stance', () => {
  const body = new T.Group(),
    bone = new T.Bone();
  bone.name = 'RightArm';
  body.add(bone);
  const pose = new BattleGesture(body, 'patrick');
  const b = createBattle('keeper', 100, 2, 1, false),
    cast = performMove(b, 'greet', 'keeper');
  pose.apply(cast, 0, false);
  assert.equal(pose.name, 'ready');
  pose.apply(null, 0, false);
  pose.apply(b, 0, false);
  pose.apply(cast, 1, false);
  pose.apply(cast, 1.5, false);
  assert.equal(pose.name, 'cast');
  assert(pose.weight > 0.99);
  pose.apply(cast, 2.1, false);
  assert.equal(pose.name, 'ready');
  pose.apply(cast, 1.5, true);
  assert.equal(pose.name, 'ready');
});
