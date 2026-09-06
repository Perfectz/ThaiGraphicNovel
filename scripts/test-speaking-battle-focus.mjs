import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshAdventure, flag, startBattle } from '../src/bangkok/adventure.ts';
import { adventureState as state, settle } from './expedition-test-helpers.mjs';

const out = 'artifacts/speaking-choice-focus/battle';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const report = { finished: false, cases: [], errors: [] };
let page;
try {
  for (const phone of [false, true]) {
    let save = freshAdventure();
    for (const f of ['intro', 'innkeeper', 'cook', 'ferry', 'chest', 'murmur']) save = flag(save, f);
    save = startBattle(save, 'keeper');
    const context = await browser.newContext({
      viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 900 },
      isMobile: phone,
      hasTouch: phone,
    });
    await context.addInitScript(
      (save) => localStorage.setItem('bangkok-rift-adventure-v1', JSON.stringify(save)),
      save,
    );
    page = await context.newPage();
    page.setDefaultTimeout(120000);
    page.on('pageerror', (e) => report.errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') report.errors.push(m.text());
    });
    await page.goto('http://127.0.0.1:5188/');
    await page.getByRole('button', { name: /Continue adventure/ }).click();
    await page.waitForFunction(() => !document.querySelector('.bk-loading'));
    await settle(page);
    const before = (await state(page)).battle;
    async function preview() {
      await page.getByRole('button', { name: /^✦ Word arts/ }).click();
      await page.locator('.exp-word-grid button').filter({ hasText: 'First Light' }).click();
      await page.locator('.exp-target-list button').filter({ hasText: 'Lantern Echo' }).click();
      await page.locator('.speak-preview').waitFor();
      assert.equal(
        await page.evaluate(() => document.activeElement === document.querySelector('.speak-preview h3')),
        true,
      );
      assert.deepEqual((await state(page)).battle, before);
    }
    await preview();
    await page.getByRole('button', { name: '← Commands', exact: true }).click();
    assert.deepEqual((await state(page)).battle, before, 'cancelled rehearsal spends no AP or turn');
    await preview();
    await page.screenshot({ path: `${out}/${phone ? 'phone' : 'desktop'}.png` });
    await page.getByRole('button', { name: 'Use text only this time', exact: true }).click();
    await settle(page);
    const after = (await state(page)).battle;
    assert.equal(after.turn, 1);
    assert(after.foes[1].hp < before.foes[1].hp, 'the chosen target receives the word art');
    assert.equal(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem('bangkok-rift-training-v1')).records.hello.spoken,
      ),
      0,
    );
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    report.cases.push(phone ? 'phone' : 'desktop');
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.finished = true;
} catch (e) {
  report.error = String(e);
  await page?.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  throw e;
} finally {
  await writeFile(`${out}/progress.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
