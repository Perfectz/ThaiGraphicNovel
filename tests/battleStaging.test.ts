import test from 'node:test';
import assert from 'node:assert/strict';
import { battleSite, battleMark, battleWorldPoint, battleCamera } from '../src/bangkok/battleStaging.ts';
import {
  walkable,
  actors,
  freshAdventure,
  flag,
  startBattle,
  leaveBattle,
  normalizeAdventure,
} from '../src/bangkok/adventure.ts';
import { cityAreaAt } from '../src/bangkok/city.ts';

test('story formations and their moving party stay on real traversable ground near each encounter', () => {
  for (const [id, contact, area] of [
    ['murmur', 'wisp', 'lumphini'],
    ['keeper', 'shrine', 'oldtown'],
    ['sentinel', 'waystone', 'sukhumvit'],
  ] as const) {
    const b = { id, practice: false },
      site = battleSite(b);
    const npc = actors.find((a) => a.id === contact)!;
    assert(Math.hypot(site.origin.x - npc.x, site.origin.z - npc.z) < 4);
    if (id !== 'sentinel') assert.equal(cityAreaAt(site.origin), area);
    for (const who of ['patrick', 'su', id, 'echo']) {
      const mark = battleMark(b, who);
      const paths =
        who === 'patrick' || who === 'su'
          ? [
              [0, 0],
              [0.9, 0],
              [0, 1.4],
            ]
          : [[0, 0]];
      for (const [dx, dz] of paths.flatMap(([x, z]) =>
        Array.from({ length: 11 }, (_, n) => [(x * n) / 10, (z * n) / 10]),
      ))
        for (const [sx, sz] of [
          [0, 0],
          [0.28, 0],
          [-0.28, 0],
          [0, 0.28],
          [0, -0.28],
        ]) {
          const point = battleWorldPoint(site, { ...mark, x: mark.x + dx + sx, z: mark.z + dz + sz });
          assert(
            walkable(point),
            `${id}/${who} must not stand or dodge into water, furniture, or buildings: ${JSON.stringify(point)}`,
          );
        }
    }
  }
});

test('presentation is deterministic across saved turns and never teleports the saved traveller', () => {
  let save = freshAdventure();
  for (const f of ['intro', 'innkeeper', 'cook', 'ferry', 'murmur']) save = flag(save, f);
  save.position = { x: 36, z: 30 };
  const before = structuredClone(save),
    fighting = startBattle(save, 'keeper');
  const resumed = normalizeAdventure(JSON.parse(JSON.stringify(fighting)));
  for (const narrow of [false, true]) {
    assert.deepEqual(
      battleCamera(battleSite(resumed.battle!), narrow),
      battleCamera(battleSite(fighting.battle!), narrow),
    );
    const frame = battleCamera(battleSite(resumed.battle!), narrow);
    assert(Math.hypot(frame.position.x - frame.look.x, frame.position.z - frame.look.z) < 24);
  }
  assert.deepEqual(leaveBattle(resumed).position, before.position);
  assert.deepEqual(save, before);
  assert.equal(battleSite({ id: 'murmur', practice: true }).id, 'practice');
  assert.notDeepEqual(
    battleSite({ id: 'murmur', practice: false }).origin,
    battleSite({ id: 'keeper', practice: false }).origin,
  );
});
