import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshAdventure, flag, startBattle } from '../src/bangkok/adventure.ts';
import { adventureState, settle, word } from './expedition-test-helpers.mjs';
const phone = process.argv.includes('--phone'),
  reduced = process.argv.includes('--reduced');
const out = `artifacts/battle-gestures/${phone ? 'phone' : 'desktop'}${reduced ? '-reduced' : ''}`;
await mkdir(out, { recursive: true });
const report = { finished: false, phone, reduced, gestures: [], errors: [] };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
let page;
try {
  const context = await browser.newContext({
    viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    isMobile: phone,
    hasTouch: phone,
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  });
  let s = flag(flag(freshAdventure(), 'intro'), 'innkeeper');
  s.hp = 50;
  s = startBattle(s, 'murmur');
  await context.addInitScript((s) => {
    if (!sessionStorage.getItem('gesture-fixture')) {
      localStorage.setItem('bangkok-rift-adventure-v1', JSON.stringify(s));
      sessionStorage.setItem('gesture-fixture', '1');
    }
  }, s);
  page = await context.newPage();
  page.setDefaultTimeout(90000);
  page.on('pageerror', (e) => report.errors.push(e.message));
  await page.goto('http://127.0.0.1:5188/');
  await page.getByRole('button', { name: /Continue adventure/ }).click();
  await page.waitForFunction(() => !document.querySelector('.bk-loading'));
  await page.waitForFunction(
    () =>
      JSON.parse(document.querySelector('.bk-world')?.dataset.battleGestures ?? '[]').filter(
        (g) => g.joints === 24,
      ).length === 2,
  );
  await settle(page);
  async function pose(id, name) {
    await page.waitForFunction(
      ({ id, name }) =>
        JSON.parse(document.querySelector('.bk-world')?.dataset.battleGestures ?? '[]').some(
          (g) => g.id === id && g.name === name && g.weight > 0.4,
        ),
      { id, name },
      { timeout: 10000 },
    );
    const data = await page.locator('.bk-world').evaluate((h) => JSON.parse(h.dataset.battleGestures));
    report.gestures.push(data);
    await page.screenshot({ path: `${out}/${report.gestures.length}-${name}.png` });
  }
  await pose('patrick', 'ready');
  async function cast(move, target, id, name) {
    await settle(page);
    await page.getByRole('button', { name: /^✦ Word arts/ }).click();
    await page.locator('.exp-word-grid button').filter({ hasText: move }).click();
    await page.locator('.exp-target-list button').filter({ hasText: target }).click();
    await page.getByRole('button', { name: 'Use text only this time', exact: true }).click();
    await pose(id, reduced ? 'ready' : name);
    await settle(page);
  }
  await cast('First Light', 'Murmur Wisp', 'patrick', 'cast');
  await cast('Make Amends', 'Patrick', 'su', 'support');
  assert.equal((await adventureState(page)).battle.heroes[0].hp, 88);
  while ((await adventureState(page)).battle.phase === 'defense') {
    await page.getByRole('button', { name: 'Steady guard · no timing', exact: true }).click();
    if (!reduced) {
      const b = (await adventureState(page)).battle;
      await pose(b.event.target, 'guard');
    }
    await settle(page);
  }
  await page.getByRole('button', { name: /^◇ Guard/ }).click();
  await settle(page);
  await pose('patrick', 'guard');
  await page.reload();
  await page.getByRole('button', { name: /Continue adventure/ }).click();
  await page.waitForFunction(() => !document.querySelector('.bk-loading'));
  await pose('patrick', 'guard');
  await word(page, 'Kindred Spark', 'Murmur Wisp');
  while ((await adventureState(page)).battle.phase === 'defense') {
    await page.getByRole('button', { name: 'Steady guard · no timing', exact: true }).click();
    await settle(page);
  }
  await page.getByRole('button', { name: 'Retreat', exact: true }).click();
  await page.waitForFunction(() =>
    JSON.parse(document.querySelector('.bk-world')?.dataset.battleGestures ?? '[]').every(
      (g) => g.name === null,
    ),
  );
  assert.equal((await adventureState(page)).battle, null);
  await page.screenshot({ path: `${out}/returned.png` });
  assert.deepEqual(report.errors, []);
  report.finished = true;
  console.log(
    'Actual party rigs: cast, support, blocks, persistent guard, reload and exploration return passed',
  );
} catch (e) {
  report.failure = e.stack;
  await page?.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  throw e;
} finally {
  await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
