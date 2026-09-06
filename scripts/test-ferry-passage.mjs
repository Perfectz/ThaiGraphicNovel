import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshAdventure, moveAdventure } from '../src/bangkok/adventure.ts';
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7),
  out = `artifacts/ferry-passage/browser${only ? '/' + only : ''}`;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  channel: 'chrome',
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
const report = { scenes: [], errors: [], finished: false };
let page;
const checkpoint = () => writeFile(`${out}/progress.json`, JSON.stringify(report, null, 2));
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')));
const training = () => page.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-training-v1')));
const passage = () => page.locator('.bk-world').evaluate((el) => JSON.parse(el.dataset.ferryPassage));
async function ready() {
  await page.waitForFunction(
    () => {
      const h = document.querySelector('.bk-world');
      return (
        h?.dataset.npcReady === '7' &&
        JSON.parse(h.dataset.riverBoats ?? '{}').state !== 'loading' &&
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
async function farewell(spoken = false) {
  await page.keyboard.press('e');
  await page.locator('.rpg-dialogue').waitFor();
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'Continue →', exact: true }).click();
  const thai = await page.locator('.rpg-thai').innerText(),
    row = page.locator('.thai-choice-list > button').filter({ hasText: thai });
  const meaning = await row.locator('.choice-meaning').innerText();
  assert.equal(meaning, 'See you then');
  const before = await saved();
  await row.click();
  await page.getByRole('heading', { name: meaning, exact: true }).waitFor();
  assert.deepEqual(await saved(), before);
  if (spoken) {
    await page.getByRole('button', { name: '◉ Record this line', exact: true }).click();
    await page.getByRole('button', { name: '■ Stop recording', exact: true }).waitFor();
    await page.waitForTimeout(700);
    await page.getByRole('button', { name: '■ Stop recording', exact: true }).click();
    await page.getByRole('button', { name: '▷ Play my recording', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Use my spoken reply →', exact: true }).click();
  } else await page.getByRole('button', { name: 'Use text only this time', exact: true }).click();
  await page.getByRole('button', { name: 'Board the ferry →', exact: true }).waitFor();
}
try {
  for (const c of [
    { name: 'full', spoken: true },
    { name: 'phone', phone: true, skip: true },
    { name: 'reduced', reduced: true },
    { name: 'fallback', fallback: true },
  ].filter((c) => !only || c.name === only)) {
    report.phase = c.name;
    await checkpoint();
    const ctx = await browser.newContext({
      viewport: c.phone ? { width: 390, height: 844 } : { width: 1280, height: 900 },
      isMobile: !!c.phone,
      hasTouch: !!c.phone,
      permissions: ['microphone'],
      reducedMotion: c.reduced ? 'reduce' : 'no-preference',
    });
    const s = moveAdventure(freshAdventure(), { x: 1, z: -5 });
    s.flags = ['intro', 'innkeeper', 'cook', 'ferry', 'murmur', 'keeper'];
    s.coins = 73;
    s.xp = 400;
    s.visited = ['hotel', 'riverside', 'lumphini', 'yaowarat', 'oldtown'];
    await ctx.addInitScript((s) => {
      if (!localStorage.getItem('bangkok-rift-adventure-v1'))
        localStorage.setItem('bangkok-rift-adventure-v1', JSON.stringify(s));
    }, s);
    if (c.fallback) await ctx.route('**/river-longtail.glb', (r) => r.abort());
    page = await ctx.newPage();
    page.setDefaultTimeout(120000);
    page.on('pageerror', (e) => report.errors.push({ scene: c.name, message: e.message }));
    page.on('console', (m) => {
      if (m.type() === 'error' && !(c.fallback && m.location().url.includes('river-longtail.glb')))
        report.errors.push({ scene: c.name, message: m.text() });
    });
    await page.goto('http://127.0.0.1:5188/');
    await page.getByRole('button', { name: /Continue adventure/ }).click();
    await ready();
    await farewell(!!c.spoken);
    assert(!(await saved()).flags.includes('departed'));
    await capture(c.name + '-farewell');
    if (c.name === 'full') {
      await page.getByRole('button', { name: 'Leave conversation', exact: true }).click();
      assert(!(await saved()).flags.includes('departed'));
      await farewell();
    }
    await page.getByRole('button', { name: 'Board the ferry →', exact: true }).click();
    await page.locator('.ferry-crossing').waitFor();
    await page.waitForFunction(
      () => JSON.parse(document.querySelector('.bk-world').dataset.ferryPassage).ready,
    );
    await page.waitForFunction(
      () => !JSON.parse(document.querySelector('.bk-world').dataset.riverBoats).boats[0].canopyVisible,
    );
    const aboard = await saved();
    assert(aboard.flags.includes('departed'));
    assert.equal(aboard.coins, 73);
    assert.equal(aboard.xp, 405);
    assert.equal((await training()).records['see-you'].spoken, c.spoken ? 1 : 0);
    const clock = await training();
    await capture(c.name + '-aboard');
    const p = await passage(),
      panel = await page.locator('.ferry-crossing').boundingBox();
    assert(p.visible && p.riders.length === 3);
    for (const r of p.riders)
      assert(
        r.x > 8 && r.x < (c.phone ? 390 : 1280) - 8 && r.y > 70 && r.y < panel.y,
        `rider visible ${r.id}: ${JSON.stringify(r)}`,
      );
    if (c.reduced) {
      assert.equal(p.progress, 0);
      await page.waitForTimeout(1500);
      assert.equal((await passage()).progress, 0);
      await page.getByRole('button', { name: 'Continue to chapter results →', exact: true }).click();
    } else if (c.skip) await page.getByRole('button', { name: 'Skip crossing →', exact: true }).click();
    await page.locator('.rpg-ending').waitFor();
    await page.waitForFunction(
      () => JSON.parse(document.querySelector('.bk-world').dataset.ferryPassage).progress === 1,
    );
    await capture(c.name + '-results');
    assert.equal((await passage()).progress, 1);
    assert.deepEqual(await saved(), aboard);
    assert.deepEqual((await training()).dailyPractice, clock.dailyPractice, 'crossing adds no practice time');
    assert((await page.locator('.rpg-ending').innerText()).includes('AREAS VISITED'));
    await page.getByRole('button', { name: 'Return to the riverside', exact: true }).click();
    await page.waitForFunction(
      () => JSON.parse(document.querySelector('.bk-world').dataset.ferryPassage).progress === null,
    );
    assert(!(await passage()).visible);
    await page.waitForFunction(
      () => JSON.parse(document.querySelector('.bk-world').dataset.riverBoats).boats[0].canopyVisible,
    );
    await capture(c.name + '-returned');
    assert.deepEqual(await saved(), aboard);
    await page.keyboard.down('s');
    await page.waitForTimeout(500);
    await page.keyboard.up('s');
    await page.waitForFunction(() => {
      const h = document.querySelector('.bk-world'),
        s = JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1'));
      return (
        Math.abs(Number(h.dataset.playerX) - s.position.x) < 0.015 &&
        Math.abs(Number(h.dataset.playerZ) - s.position.z) < 0.015
      );
    });
    const returned = await saved();
    assert(
      Math.hypot(returned.position.x - aboard.position.x, returned.position.z - aboard.position.z) > 0.1,
      'normal movement restored',
    );
    await page.reload();
    await page.getByRole('button', { name: /Continue adventure/ }).click();
    await ready();
    assert.deepEqual(await saved(), returned);
    assert.equal((await passage()).progress, null);
    if (c.phone) {
      await page.getByRole('button', { name: 'Open town map ↗', exact: true }).click();
      await page.locator('.city-map button[data-area="riverside"]').click();
      await page.locator('.city-contacts button').filter({ hasText: 'Niran' }).click();
      await page.locator('.rpg-dialogue').waitFor();
      await farewell();
      await page.getByRole('button', { name: 'Board the ferry →', exact: true }).click();
      await page.locator('.ferry-crossing').waitFor();
      await page.getByRole('button', { name: 'Skip crossing →', exact: true }).click();
      await page.locator('.rpg-ending').waitFor();
      assert.equal((await saved()).xp, 405);
      assert.equal((await saved()).coins, 73);
      await page.getByRole('button', { name: 'Practise your words at camp →', exact: true }).click();
      await page.getByRole('button', { name: /(Begin|Continue) your journey/ }).waitFor();
      await page.getByRole('button', { name: /Return to the adventure/ }).click();
      await page.getByRole('button', { name: /Continue adventure/ }).click();
      await ready();
      assert((await saved()).flags.includes('departed'));
      assert.equal((await passage()).progress, null);
    }
    assert.deepEqual(report.errors, []);
    report.scenes.push(c.name);
    await checkpoint();
    console.log('PASS', c.name);
    await ctx.close();
  }
  report.finished = true;
  await checkpoint();
} catch (e) {
  report.error = String(e);
  report.save = await saved().catch(() => null);
  await checkpoint();
  await page?.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  throw e;
} finally {
  await browser.close();
}
