import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshAdventure, startBattle } from '../src/bangkok/adventure.ts';

const base = process.env.PLAYTEST_BASE_URL ?? 'http://127.0.0.1:5188/';
const out = `artifacts/phone-playability/${base.includes('127.0.0.1') ? 'local' : 'public'}`;
await mkdir(out, { recursive: true });
const report = { base, finished: false, cases: [], errors: [] };
const browser = await chromium.launch({ channel: 'chrome', headless: true,
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
let page;
try {
  for (const viewport of [{ width: 360, height: 640 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    const name = `${viewport.width}x${viewport.height}`;
    const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true, permissions: ['microphone'] });
    const save = { ...freshAdventure(), position: { x: 0, z: 13 }, flags: ['intro', 'innkeeper'] };
    await context.addInitScript(save => {
      if (!localStorage.getItem('bangkok-rift-adventure-v1')) localStorage.setItem('bangkok-rift-adventure-v1', JSON.stringify(save));
    }, save);
    page = await context.newPage();
    page.setDefaultTimeout(60000);
    page.on('pageerror', e => report.errors.push(e.message));
    await page.addInitScript(() => {
      window.phoneEvents = [];
      for (const type of ['pointerdown', 'pointerup', 'click']) document.addEventListener(type, e => {
        window.phoneEvents.push({type, target: e.target.closest('button')?.textContent ?? e.target.tagName});
      }, true);
    });
    await page.goto(base);
    await page.getByRole('button', { name: /Continue adventure/ }).tap();
    await page.waitForFunction(() => !document.querySelector('.bk-loading'));
    const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')));
    async function tap(locator) { await locator.scrollIntoViewIfNeeded(); await locator.tap(); }
    async function shot(label) {
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name} ${label}: horizontal overflow`);
      await page.screenshot({ path: `${out}/${name}-${label}.png` });
    }
    const cdp = await context.newCDPSession(page);
    const pad = page.getByRole('button', { name: 'Walk up', exact: true });
    const rect = await pad.boundingBox();
    assert(rect && rect.width >= 44 && rect.height >= 44 && rect.y + rect.height <= viewport.height, 'reachable thumb-sized movement pad');
    const before = (await state()).position;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }] });
    await page.waitForTimeout(500);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(900);
    const after = (await state()).position;
    assert(Math.hypot(after.x - before.x, after.z - before.z) > .3, 'touch hold moves the player');
    await page.waitForTimeout(600);
    assert.deepEqual((await state()).position, after, 'release stops movement');
    await tap(page.getByRole('button', { name: 'Look around', exact: true }));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: viewport.width * .4, y: viewport.height * .48 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: viewport.width * .6, y: viewport.height * .48 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.deepEqual((await state()).position, after, 'camera drag does not walk');
    await tap(page.getByRole('button', { name: 'Reset view', exact: true }));
    await page.getByRole('button', { name: 'Look around', exact: true }).waitFor();
    const geometry = await page.evaluate(() => {
      const objective = document.querySelector('.rpg-objective').getBoundingClientRect();
      const controls = document.querySelector('.rpg-explore-bar').getBoundingClientRect();
      return {
        overlap: objective.right > controls.left && objective.left < controls.right && objective.bottom > controls.top && objective.top < controls.bottom,
        clippedMenu: [...document.querySelectorAll('.rpg-header button')].some(b => {
          const r = b.getBoundingClientRect();
          return r.width > 0 && (r.top < 0 || r.bottom > innerHeight || r.left < 0 || r.right > innerWidth);
        }),
      };
    });
    assert(!geometry.overlap, 'objective does not cover exploration controls');
    assert(!geometry.clippedMenu, 'header controls stay inside the screen');
    await shot('exploring');
    await tap(page.getByRole('button', { name: /Quest details/ }));
    assert(await page.locator('.rpg-objective h2').isVisible(), 'quest details expand on touch');
    await tap(page.locator('.rpg-objective-toggle'));
    await tap(page.getByRole('button', { name: 'Talk to Su', exact: true }));
    await shot('conversation');
    await tap(page.getByRole('button', { name: 'Leave conversation', exact: true }));

    const battleSave = startBattle(await state(), 'murmur');
    await page.evaluate(s => localStorage.setItem('bangkok-rift-adventure-v1', JSON.stringify(s)), battleSave);
    await page.reload();
    await tap(page.getByRole('button', { name: /Continue adventure/ }));
    await page.waitForFunction(() => !document.querySelector('.bk-loading'));
    const battleBefore = (await state()).battle;
    await shot('battle');
    await tap(page.getByRole('button', { name: /^✦ Word arts/ }));
    await tap(page.locator('.exp-word-grid button').filter({ hasText: 'First Light' }));
    await tap(page.locator('.exp-target-list button').filter({ hasText: battleBefore.foes[1].name }));
    assert((await page.locator('.speak-preview h3[lang=en]').innerText()).length > 0, 'English before speaking');
    assert.deepEqual((await state()).battle, battleBefore, 'preview does not spend a turn');
    await shot('speaking');
    await tap(page.getByRole('button', { name: '♫ Hear this line', exact: true }));
    await tap(page.getByRole('button', { name: '◉ Record this line', exact: true }));
    await page.getByRole('button', { name: '■ Stop recording', exact: true }).waitFor();
    await page.waitForTimeout(650);
    await tap(page.getByRole('button', { name: '■ Stop recording', exact: true }));
    await tap(page.getByRole('button', { name: '▷ Play my recording', exact: true }));
    await tap(page.getByRole('button', { name: 'Use my spoken reply →', exact: true }));
    await page.locator('.exp-resolving').waitFor({ state: 'hidden' });
    assert((await state()).battle.foes[1].hp < battleBefore.foes[1].hp);
    await tap(page.getByRole('button', { name: /^✦ Word arts/ }));
    await tap(page.locator('.exp-word-grid button').filter({ hasText: 'Kindred Spark' }));
    await tap(page.locator('.exp-target-list button').filter({ hasText: battleBefore.foes[1].name }));
    await tap(page.getByRole('button', { name: 'Use text only this time', exact: true }));
    await page.locator('.exp-resolving').waitFor({ state: 'hidden' });
    await tap(page.getByRole('button', { name: 'Steady guard · no timing', exact: true }));
    await page.locator('.exp-resolving').waitFor({ state: 'hidden' });
    const persisted = (await state()).battle;
    await page.reload();
    await tap(page.getByRole('button', { name: /Continue adventure/ }));
    assert.deepEqual((await state()).battle, persisted, 'battle survives reload');
    report.cases.push({ viewport, touchMovement: true, camera: true, dialogue: true, recordedBattleTurn: true, textFallback: true, defense: true, reload: true });
    console.log(`${name}: touch exploration, conversation, spoken/text battle turns, defense and reload passed`);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.finished = true;
} catch (error) {
  report.failure = error.stack;
  report.events = await page?.evaluate(() => window.phoneEvents).catch(() => []);
  await page?.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  throw error;
} finally {
  await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
