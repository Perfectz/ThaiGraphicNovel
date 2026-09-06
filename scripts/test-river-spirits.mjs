import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshAdventure, flag, startBattle } from '../src/bangkok/adventure.ts';
import { settle, finishFight, adventureState as state } from './expedition-test-helpers.mjs';
const out = 'artifacts/blender-river-spirits/browser';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const report = { finished: false, cases: [], errors: [] };
let page;
const checkpoint = () => writeFile(`${out}/progress.json`, JSON.stringify(report, null, 2));
const spirits = () => page.locator('.bk-world').evaluate((h) => JSON.parse(h.dataset.riverSpirits));
async function capture(name) {
  await page.screenshot({ path: `${out}/${name}.png` });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
}
try {
  for (const label of ['desktop', 'phone', 'phone-keeper', 'reduced', 'fallback', 'waywarden']) {
    console.log(`Spirit flow ${label}`);
    const phone = label.startsWith('phone'),
      reduced = label === 'reduced',
      fallback = label === 'fallback',
      id =
        label === 'desktop' || label === 'phone-keeper'
          ? 'keeper'
          : label === 'waywarden'
            ? 'sentinel'
            : 'murmur';
    const context = await browser.newContext({
      viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      isMobile: phone,
      hasTouch: phone,
      reducedMotion: reduced ? 'reduce' : 'no-preference',
    });
    let s = freshAdventure();
    for (const f of [
      'intro',
      'innkeeper',
      'cook',
      'ferry',
      'chest',
      'station',
      ...(id === 'keeper' ? ['murmur'] : []),
    ])
      s = flag(s, f);
    if (id === 'sentinel') s.position = { x: 16, z: 15 };
    s = startBattle(s, id);
    assert.equal(s.battle?.id, id, 'fixture enters the intended encounter');
    await context.addInitScript((s) => {
      if (!localStorage.getItem('bangkok-rift-adventure-v1'))
        localStorage.setItem('bangkok-rift-adventure-v1', JSON.stringify(s));
    }, s);
    if (fallback)
      await context.route('**/bangkok/models/river-spirits.glb', (r) =>
        r.fulfill({
          status: 200,
          contentType: 'model/gltf+json',
          body: JSON.stringify({ asset: { version: '2.0' }, scenes: [{ nodes: [] }], scene: 0 }),
        }),
      );
    page = await context.newPage();
    page.setDefaultTimeout(90000);
    page.on('pageerror', (e) => report.errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') report.errors.push(m.text());
    });
    await page.goto('http://127.0.0.1:5188/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /Continue adventure/ }).click();
    await page.waitForFunction(
      (expected) =>
        JSON.parse(document.querySelector('.bk-world')?.dataset.riverSpirits ?? '{}').state === expected,
      fallback ? 'fallback' : 'ready',
    );
    await page.waitForTimeout(2200);
    await settle(page);
    const loaded = await spirits();
    assert(loaded.creatures.every((c) => c.blender === !fallback));
    assert.equal(loaded.creatures[0].visible, id !== 'sentinel');
    if (!fallback) {
      assert(loaded.creatures.reduce((sum, c) => sum + c.meshes, 0) <= 40);
      assert.equal(loaded.parts.length, id==='murmur'?3:4);
      assert.equal(loaded.creatures[0].model,id==='murmur'?'MurmurWisp':'RiverKeeper');
    }
    await capture(`${label}-arena`);
    if (phone) {
      const frame = await page.evaluate(() => ({
        hudBottom: document.querySelector('.exp-foes').getBoundingClientRect().bottom,
        panelTop: document.querySelector('.exp-command-panel').getBoundingClientRect().top,
        face: JSON.parse(document.querySelector('.bk-world').dataset.riverSpirits).face,
      }));
      console.log(label, JSON.stringify(frame));
      assert(
        frame.face.top > frame.hudBottom && frame.face.bottom < frame.panelTop,
        'enemy face is framed between status and commands',
      );
    }
    const posed = await spirits();
    await page.waitForTimeout(550);
    const moved = await spirits();
    if (reduced) assert.deepEqual(posed.parts, moved.parts);
    else if (!fallback) assert.notDeepEqual(posed.parts, moved.parts);
    const before = await state(page);
    await page.getByRole('button', { name: /^✦ Word arts/ }).click();
    await page.locator('.exp-word-grid button').filter({ hasText: 'First Light' }).click();
    await page.locator('.exp-target-list button').filter({ hasText: before.battle.foes[1].name }).click();
    await capture(`${label}-target`);
    assert.deepEqual((await state(page)).battle, before.battle);
    await page.evaluate(() => {
      window.spiritReactions = [];
      window.spiritTimer = setInterval(() => {
        const raw = document.querySelector('.bk-world')?.dataset.riverSpirits;
        if (raw) window.spiritReactions.push(JSON.parse(raw));
      }, 70);
    });
    await page.getByRole('button', { name: 'Use text only this time', exact: true }).click();
    await settle(page);
    const after = await state(page);
    assert(after.battle.foes[1].hp < before.battle.foes[1].hp);
    if (reduced) assert((await spirits()).creatures.every((c) => c.bodyRoll === 0 && c.bob === 0));
    else if (!fallback)
      assert(
        await page.evaluate(() =>
          window.spiritReactions.some((s) =>
            s.creatures.some((c) => c.id === 'echo' && Math.abs(c.bodyRoll) > 0.001),
          ),
        ),
        'visible hit reaction follows the damaged target',
      );
    await page.getByRole('button', { name: /^◇ Guard/ }).click();
    await settle(page);
    await capture(`${label}-defense`);
    await page.getByRole('button', { name: 'Steady guard · no timing', exact: true }).click();
    await settle(page);
    if (!reduced && !fallback && id !== 'sentinel')
      assert(
        await page.evaluate((name) =>
          window.spiritReactions.some((s) =>
            s.parts.some((p) => p.name === name && p.rotation[0] > 0.15),
          ), id==='murmur'?'MurmurVeils':'KeeperLeftArm',
        ),
        'the active creature gestures for its actual attack',
      );
    if (label === 'desktop') {
      await finishFight(page, 'keeper');
      assert((await state(page)).flags.includes('keeper'));
      assert(
        await page.evaluate(() =>
          window.spiritReactions.some((s) => s.creatures.some((c) => c.id === 'echo' && !c.visible)),
        ),
        'defeated echo leaves the battlefield',
      );
      await capture('desktop-victory-return');
    } else {
      const saved = (await state(page)).battle;
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: /Continue adventure/ }).click();
      await page.waitForFunction(
        (expected) =>
          JSON.parse(document.querySelector('.bk-world')?.dataset.riverSpirits ?? '{}').state === expected,
        fallback ? 'fallback' : 'ready',
      );
      await settle(page);
      assert.deepEqual((await state(page)).battle, saved);
    }
    report.cases.push({
      label,
      loaded,
      hitAndDefense: true,
      reducedMotion: reduced,
      fullVictory: label === 'desktop',
    });
    await checkpoint();
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.finished = true;
} catch (e) {
  report.failure = e.stack;
  if (page) await page.screenshot({ path: `${out}/failure.png`, timeout: 10000 }).catch(() => {});
  throw e;
} finally {
  await checkpoint();
  await browser.close();
}
