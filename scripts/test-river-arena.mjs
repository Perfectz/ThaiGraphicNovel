import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshAdventure, flag, startBattle } from '../src/bangkok/adventure.ts';
import { settle, word, finishFight, adventureState as state } from './expedition-test-helpers.mjs';
const out = 'artifacts/blender-river-arena/browser';
await mkdir(out, { recursive: true });
console.log('Launching arena verifier');
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const report = { finished: false, cases: [], errors: [] };
let page;
const checkpoint = () => writeFile(`${out}/progress.json`, JSON.stringify(report, null, 2));
const arena = () => page.locator('.bk-world').evaluate((h) => JSON.parse(h.dataset.riverArena));
async function ready() {
  await page.waitForFunction(
    () => {
      const h = document.querySelector('.bk-world');
      return (
        JSON.parse(h?.dataset.riverArena ?? '{}').state === 'ready' &&
        !document.querySelector('.bk-loading')
      );
    },
    null,
    { timeout: 180000 },
  );
}
async function capture(name) {
  await page.screenshot({ path: `${out}/${name}.png` });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
}
try {
  for (const label of ['desktop', 'phone', 'fallback']) {
    console.log(`Opening ${label}`);
    const phone = label === 'phone';
    const context = await browser.newContext({
      viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      isMobile: phone,
      hasTouch: phone,
    });
    let s = freshAdventure();
    for (const f of ['intro', 'innkeeper', 'cook', 'ferry', 'chest', 'murmur']) s = flag(s, f);
    s = startBattle(s, 'keeper');
    await context.addInitScript((s) => {
      if (!localStorage.getItem('bangkok-rift-adventure-v1'))
        localStorage.setItem('bangkok-rift-adventure-v1', JSON.stringify(s));
    }, s);
    if (label === 'fallback')
      await context.route('**/bangkok/models/river-arena.glb', (r) =>
        r.fulfill({
          status: 200,
          contentType: 'model/gltf+json',
          body: JSON.stringify({ asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [] }] }),
        }),
      );
    page = await context.newPage();
    page.setDefaultTimeout(120000);
    page.on('pageerror', (e) => report.errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') report.errors.push(m.text());
    });
    console.log(`Navigating ${label}`);
    await page.goto('http://127.0.0.1:5188/', {waitUntil:'domcontentloaded'});
    console.log(`Starting ${label}`);
    await page.getByRole('button', { name: /Continue adventure/ }).click();
    console.log(`Waiting for models ${label}`);
    if (label === 'fallback')
      await page.waitForFunction(
        () =>
          JSON.parse(document.querySelector('.bk-world')?.dataset.riverArena ?? '{}').state === 'fallback',
      );
    else await ready();
    await settle(page);
    console.log(`Models ready ${label}`);
    const loaded = await arena();
    assert.equal(loaded.fallback, label === 'fallback');
    if (label !== 'fallback') assert(loaded.meshes > 0 && loaded.meshes <= 20);
    await capture(`${label}-arena`);
    const before = await state(page);
    await page.getByRole('button', { name: /^✦ Word arts/ }).click();
    await page.locator('.exp-word-grid button').filter({ hasText: 'First Light' }).click();
    await page.locator('.exp-target-list button').filter({ hasText: 'Keeper of Unsaid Words' }).click();
    await capture(`${label}-target`);
    assert.deepEqual((await state(page)).battle, before.battle, 'selecting a target spends nothing');
    await page.getByRole('button', { name: 'Use text only this time', exact: true }).click();
    await settle(page);
    assert((await state(page)).battle.foes[0].hp < before.battle.foes[0].hp);
    await page.getByRole('button', { name: /^◇ Guard/ }).click();
    await settle(page);
    await capture(`${label}-defense`);
    await page.getByRole('button', { name: 'Steady guard · no timing', exact: true }).click();
    await settle(page);
    const saved = (await state(page)).battle;
    await page.reload();
    await page.getByRole('button', { name: /Continue adventure/ }).click();
    if (label !== 'fallback') await ready();
    else
      await page.waitForFunction(
        () =>
          JSON.parse(document.querySelector('.bk-world')?.dataset.riverArena ?? '{}').state === 'fallback',
      );
    await settle(page);
    assert.deepEqual((await state(page)).battle, saved);
    if (label === 'desktop') {
      await finishFight(page, 'keeper');
      assert((await state(page)).flags.includes('keeper'));
      await capture('desktop-victory-return');
    }
    report.cases.push({ label, loaded, reloadPreserved: true, finishedBattle: label === 'desktop' });
    await checkpoint();
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.finished = true;
} catch (error) {
  report.failure = error.stack;
  if (page) await page.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  throw error;
} finally {
  await checkpoint();
  await browser.close();
}
