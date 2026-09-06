import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshAdventure, flag, startBattle } from '../src/bangkok/adventure.ts';
import { settle, word, adventureState as state } from './expedition-test-helpers.mjs';
const out = 'artifacts/battle-audio/browser';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const report = { finished: false, cases: [], errors: [] };
let page;
async function capture(name) {
  await page.screenshot({ path: `${out}/${name}.png` });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
}
const cues = () => page.evaluate(() => window.battleCues);
try {
  for (const phone of [false, true]) {
    const label = phone ? 'phone' : 'desktop';
    let s = freshAdventure();
    for (const f of ['intro', 'innkeeper', 'cook', 'ferry', 'chest', 'murmur']) s = flag(s, f);
    s = startBattle(s, 'keeper');
    s.battle.foes[0].break = 40;
    const context = await browser.newContext({
      viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 900 },
      isMobile: phone,
      hasTouch: phone,
    });
    await context.addInitScript((s) => {
      if (!localStorage.getItem('bangkok-rift-adventure-v1'))
        localStorage.setItem('bangkok-rift-adventure-v1', JSON.stringify(s));
      window.battleCues = [];
      window.effectStarts = 0;
      window.effectContexts = [];
      window.addEventListener('bangkok-battle-cue', (e) => window.battleCues.push(e.detail));
      const Native = window.AudioContext;
      window.AudioContext = class extends Native {
        constructor(...args) {
          super(...args);
          window.effectContexts.push(this);
        }
        createBufferSource() {
          const source = super.createBufferSource(),
            start = source.start.bind(source);
          source.start = (...args) => {
            window.effectStarts++;
            start(...args);
          };
          return source;
        }
      };
    }, s);
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
    assert.deepEqual(await cues(), []);
    assert.equal(await page.evaluate(() => window.effectStarts), 0);
    const before = await state(page);
    await page.getByRole('button', { name: /^✦ Word arts/ }).click();
    await page.locator('.exp-word-grid button').filter({ hasText: 'First Light' }).click();
    await page.locator('.exp-target-list button').filter({ hasText: 'Keeper of Unsaid Words' }).click();
    const audio = page.waitForResponse((r) => r.url().endsWith('/bangkok/voices/hello.mp3'));
    await page.getByRole('button', { name: '♫ Hear this line', exact: true }).click();
    assert((await audio).ok());
    assert.equal(await page.evaluate(() => window.effectStarts), 0, 'Thai playback is free of battle cues');
    assert.deepEqual((await state(page)).battle, before.battle);
    await page.getByRole('button', { name: 'Use text only this time', exact: true }).click();
    await settle(page);
    assert.deepEqual((await cues()).at(-1), {
      cue: 'strike',
      played: true,
      seq: (await state(page)).battle.event.seq,
    });
    const count = await page.evaluate(() => window.effectStarts);
    await page.getByRole('button', { name: 'Battle sound on', exact: true }).click();
    await page.getByRole('button', { name: /^◇ Guard/ }).click();
    await settle(page);
    assert.equal((await cues()).at(-1).played, false);
    assert.equal(await page.evaluate(() => window.effectStarts), count);
    const saved = (await state(page)).battle;
    await page.reload();
    await page.getByRole('button', { name: /Continue adventure/ }).click();
    await page.waitForFunction(() => !document.querySelector('.bk-loading'));
    await settle(page);
    assert.deepEqual((await state(page)).battle, saved);
    assert.deepEqual(await cues(), [], 'resuming never replays the saved effect');
    await page.getByRole('button', { name: 'Battle sound off', exact: true }).click();
    for (let i = 0; i < 2; i++) {
      await page.getByRole('button', { name: 'Steady guard · no timing', exact: true }).click();
      await settle(page);
      assert.equal((await cues()).at(-1).played, true);
    }
    await word(page, 'Still the River', 'Keeper of Unsaid Words');
    assert.equal((await cues()).at(-1).cue, 'break');
    assert.equal((await cues()).at(-1).played, true);
    await word(page, 'Make Amends', 'Patrick');
    assert.equal((await cues()).at(-1).cue, 'heal');
    await capture(label + '-feedback');
    while ((await state(page)).battle.phase === 'defense') {
      await page.getByRole('button', { name: 'Steady guard · no timing', exact: true }).click();
      await settle(page);
    }
    await page.getByRole('button', { name: 'Retreat', exact: true }).click();
    await page.waitForFunction(() => window.effectContexts.every((c) => c.state === 'closed'));
    report.cases.push({
      label,
      cues: await cues(),
      contextsClosed: await page.evaluate(() => window.effectContexts.length),
    });
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
