import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  freshAdventure,
  moveAdventure,
  normalizeAdventure,
  startPracticeBattle,
} from '../src/bangkok/adventure.ts';
import {
  advanceLanternTrade,
  freshLanternTrade,
  lanternChoices,
  lanternReplyReason,
  lanternTradeReason,
  lanternRevealRadius,
  normalizeLanternTrade,
} from '../src/bangkok/lanternTrade.ts';
import { questJournal } from '../src/bangkok/questJournal.ts';
const visiting = (coins = 50) => ({
  ...moveAdventure(freshAdventure(), { x: 29, z: 27.5 }),
  flags: ['intro', 'innkeeper', 'artisan'],
  position: { x: 29, z: 27.5 },
  coins,
});

test('asking, bargaining and switching designs create persistent offers without spending', () => {
  let s = visiting();
  assert.equal(advanceLanternTrade(s, 'new', 'i-will-buy'), s);
  s = advanceLanternTrade(s, 'new', 'how-much');
  assert.equal(s.lantern.offer, 'carved');
  const quoted = s;
  s = advanceLanternTrade(s, 'carved', 'little-cheaper');
  assert.equal(s.lantern.offer, 'discount');
  assert.equal(advanceLanternTrade(s, 'carved', 'i-will-buy'), s, 'stale confirmation rejected');
  assert.equal(advanceLanternTrade(s, 'discount', 'little-cheaper'), s, 'cannot bargain indefinitely');
  s = advanceLanternTrade(s, 'discount', 'too-expensive');
  assert.equal(s.lantern.offer, 'paper');
  assert.equal(
    advanceLanternTrade(s, 'paper', 'how-much').lantern.offer,
    'carved',
    'design can be reconsidered before buying',
  );
  assert.equal(s.coins, 50);
  assert.equal(s.xp, 0);
  assert.equal(s.lantern.owned, null);
  for (const state of [quoted, s])
    assert.deepEqual(normalizeAdventure(JSON.parse(JSON.stringify(state))), state);
});

test('each valid purchase pays its exact quote and awards its item and XP only once', () => {
  for (const [offer, price, owned] of [
    ['carved', 30, 'carved'],
    ['discount', 24, 'carved'],
    ['paper', 18, 'paper'],
  ] as const) {
    const before = { ...visiting(), lantern: { ...freshLanternTrade(), offer } };
    const after = advanceLanternTrade(before, offer, 'i-will-buy');
    assert.equal(after.coins, 50 - price);
    assert.equal(after.xp, 40);
    assert.deepEqual(after.lantern, { offer, owned, paid: price });
    assert.equal(advanceLanternTrade(after, offer, 'i-will-buy'), after);
    assert.deepEqual(normalizeAdventure(JSON.parse(JSON.stringify(after))), after);
    assert.equal(questJournal(after).find((q) => q.id === 'travel-lantern')?.complete, true);
    assert.equal(lanternRevealRadius(after.lantern), 14);
  }
  assert.equal(lanternRevealRadius(freshLanternTrade()), 8);
});

test('walking away keeps the quote and money; low funds permit a cheaper option but never a negative balance', () => {
  let s = { ...visiting(20), lantern: { ...freshLanternTrade(), offer: 'carved' as const } };
  assert.equal(advanceLanternTrade(s, 'carved', 'not-today'), s);
  assert(lanternReplyReason(s, 'i-will-buy')?.includes('10 more'));
  assert.equal(advanceLanternTrade(s, 'carved', 'i-will-buy'), s);
  const cheaper = advanceLanternTrade(s, 'carved', 'too-expensive');
  assert.equal(advanceLanternTrade(cheaper, 'paper', 'think-first'), cheaper);
  const bought = advanceLanternTrade(cheaper, 'paper', 'i-will-buy');
  assert.equal(bought.coins, 2);
  const poor = { ...cheaper, coins: 17 };
  assert.equal(advanceLanternTrade(poor, 'paper', 'i-will-buy'), poor);
});

test('trading requires a local introduction, proximity and a free adventure turn', () => {
  const base = visiting();
  for (const state of [
    freshAdventure(),
    { ...base, position: { x: 0, z: 0 } },
    startPracticeBattle(base),
    { ...base, journeys: { ...base.journeys, active: { id: 1, paused: false } } },
  ]) {
    assert(lanternTradeReason(state as typeof base));
    assert.equal(advanceLanternTrade(state as typeof base, 'new', 'how-much'), state);
  }
  assert.equal(lanternTradeReason(base), null);
});

test('old saves and invalid ownership records normalize without inventing an item', () => {
  const old: Record<string, unknown> = { ...visiting() };
  delete old.lantern;
  assert.deepEqual(normalizeAdventure(old).lantern, freshLanternTrade());
  assert.equal(normalizeLanternTrade({ owned: 'carved', paid: -5 }).owned, null);
  assert.equal(normalizeLanternTrade({ owned: 'paper', paid: 30 }).owned, null);
  assert.deepEqual(normalizeLanternTrade({ offer: 'other' }), freshLanternTrade());
  for (const offer of ['new', 'carved', 'discount', 'paper'] as const)
    for (const id of lanternChoices(offer)) assert(existsSync(`public/bangkok/audio/${id}.mp3`), id);
});

test('the exported Blender lamps fit the workbench and hand-held scale without scene lights', async () => {
  const bytes = readFileSync('public/bangkok/models/travel-lanterns.glb');
  assert(bytes.length < 600000);
  const { scene } = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  let triangles = 0;
  for (const name of ['Carved', 'Paper']) {
    const part = scene.getObjectByName(name);
    assert(part, name);
    const bounds = new T.Box3().setFromObject(part);
    assert(bounds.min.y >= -0.001 && bounds.max.y < 0.76 && bounds.max.y > 0.7);
    assert(bounds.min.x > -0.21 && bounds.max.x < 0.21 && bounds.min.z > -0.21 && bounds.max.z < 0.21);
    part.traverse((o) => {
      assert(!(o instanceof T.Light || o instanceof T.Camera));
      if (o instanceof T.Mesh)
        triangles += (o.geometry.index?.count ?? o.geometry.getAttribute('position').count) / 3;
    });
  }
  assert(triangles > 1000 && triangles < 16000);
});
