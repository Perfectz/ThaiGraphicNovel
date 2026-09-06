import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshAdventure, moveAdventure } from '../src/bangkok/adventure.ts';
import { beginJourney, freshJourneys, journeyPhrase, journeyCursor } from '../src/bangkok/cityJourneys.ts';
import { freshTraining, localDate } from '../src/bangkok/learning.ts';

const out = 'artifacts/journey-intentions/browser';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const report = { finished: false, cases: [], errors: [] };
let page;
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')));
const training = () => page.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-training-v1')));
async function enter() {
  await page.getByRole('button', { name: /Continue adventure/ }).click();
  await page.waitForFunction(
    () =>
      document.querySelector('.bk-world')?.dataset.npcReady === '6' && !document.querySelector('.bk-loading'),
    null,
    { timeout: 180000 },
  );
  await page.keyboard.press('e');
  await page.locator('.journey-intent').waitFor();
  await page.waitForFunction(() => {
    const host = document.querySelector('.bk-world');
    const cast = JSON.parse(host.dataset.conversationCast ?? 'null');
    const save = JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1'));
    return (
      cast &&
      !cast.moving &&
      Math.abs(Number(host.dataset.playerX) - save.position.x) < 0.015 &&
      Math.abs(Number(host.dataset.playerZ) - save.position.z) < 0.015
    );
  });
}
try {
  for (const phone of [false, true]) {
    const s = moveAdventure(freshAdventure(), { x: -50, z: 26 });
    s.flags = ['intro', 'innkeeper'];
    s.journeys = beginJourney(freshJourneys(), freshTraining(), localDate());
    s.journeys.active.step = 3;
    const context = await browser.newContext({
      viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 900 },
      isMobile: phone,
      hasTouch: phone,
    });
    await context.addInitScript((s) => {
      if (!localStorage.getItem('bangkok-rift-adventure-v1'))
        localStorage.setItem('bangkok-rift-adventure-v1', JSON.stringify(s));
    }, s);
    page = await context.newPage();
    page.setDefaultTimeout(120000);
    page.on('pageerror', (e) => report.errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') report.errors.push(m.text());
    });
    await page.goto('http://127.0.0.1:5188/');
    await enter();
    const before = await saved(),
      a = before.journeys.active,
      correct = journeyPhrase(a);
    assert.equal(await page.locator('.journey-intent-choices button[lang="en"]').count(), 3);
    assert.equal(await page.locator('.journey-visit [lang="th"]').count(), 0);
    await page.screenshot({ path: `${out}/${phone ? 'phone' : 'desktop'}-intent.png` });
    const wrong = a.queues[a.stop].find((id) => id !== correct);
    await page.locator(`[data-intention="${wrong}"]`).click();
    await page.getByText(/means something different/).waitFor();
    const supported = await saved();
    assert.deepEqual(supported, {
      ...before,
      journeys: { ...before.journeys, active: { ...a, meaningHelp: [journeyCursor(a)] } },
    });
    await page.reload();
    await enter();
    assert.deepEqual((await saved()).journeys.active.meaningHelp, [journeyCursor(a)]);
    await page.locator(`[data-intention="${correct}"]`).click();
    await page
      .getByRole('button', { name: 'I said it aloud · compare without a recording', exact: true })
      .click();
    assert(await page.getByRole('button', { name: 'I recalled it →', exact: true }).isDisabled());
    await page
      .getByText('You needed help choosing the meaning. This phrase will stay in your review list.')
      .waitFor();
    await page.screenshot({ path: `${out}/${phone ? 'phone' : 'desktop'}-support.png` });
    await page.getByRole('button', { name: 'Needs more practice →', exact: true }).click();
    assert.equal((await training()).records[correct].recalled, 0);
    assert.equal((await training()).records[correct].spoken, 0);
    assert.equal((await saved()).journeys.active.step, 4);
    for (let step = 4; step <= 5; step++) {
      const current = (await saved()).journeys.active;
      await page.locator(`[data-intention="${journeyPhrase(current)}"]`).click();
      await page
        .getByRole('button', { name: 'I said it aloud · compare without a recording', exact: true })
        .click();
      await page.getByRole('button', { name: 'I recalled it →', exact: true }).click();
    }
    const after = await saved();
    assert.equal(after.journeys.active.stop, 1);
    assert.equal(after.journeys.active.recalled, 2);
    assert.equal(after.journeys.active.spoken, 0);
    assert.equal(after.xp, before.xp);
    assert.equal(after.coins, before.coins);
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
