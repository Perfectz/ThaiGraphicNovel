import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshAdventure } from '../src/bangkok/adventure.ts';
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7);
const out = `artifacts/blender-hotel-wall/browser${only ? '/' + only : ''}`;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const report = { scenes: [], errors: [], finished: false, browser: browser.version(), graphics: [] };
let page;
const checkpoint = () => writeFile(`${out}/progress.json`, JSON.stringify(report, null, 2));
const save = () => page.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')));
const furniture = () => page.locator('.bk-world').evaluate((h) => JSON.parse(h.dataset.hotelFurnishings));
const ready = () =>
  page.waitForFunction(
    () => {
      const h = document.querySelector('.bk-world');
      return (
        h?.dataset.npcReady === '7' &&
        h.dataset.cityProps !== 'loading' &&
        JSON.parse(h.dataset.hotelFurnishings ?? '{}').state !== 'loading' &&
        !document.querySelector('.bk-loading')
      );
    },
    null,
    { timeout: 180000 },
  );
async function capture(name) {
  await page.screenshot({ path: `${out}/${name}.png` });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
}
async function walk(id, area = 'hotel') {
  await page.getByRole('button', { name: 'Open town map ↗', exact: true }).click();
  await page.locator(`.city-map button[data-area="${area}"]`).click();
  await page.locator(`.city-contacts button[data-area="${id}"]`).click();
  await page.locator('.rpg-dialogue').waitFor();
}
async function preview() {
  const thai = await page.locator('.rpg-thai').innerText();
  const row = page.locator('.thai-choice-list > button').filter({ hasText: thai });
  const meaning = await row.locator('.choice-meaning').innerText();
  assert(meaning.length > 3);
  await row.click();
  await page.getByRole('heading', { name: meaning, exact: true }).waitFor();
  await page.waitForFunction(() => {
    const cast = JSON.parse(document.querySelector('.bk-world').dataset.conversationCast ?? 'null');
    return cast && !cast.moving;
  });
  return meaning;
}
try {
  for (const c of [
    { name: 'desktop' },
    { name: 'phone', phone: true },
    { name: 'fallback', fallback: true },
    { name: 'missing-bed', fallback: true, missingBed: true },
  ].filter((c) => !only || only === c.name)) {
    report.phase = c.name;
    await checkpoint();
    const ctx = await browser.newContext({
      viewport: c.phone ? { width: 390, height: 844 } : { width: 1280, height: 900 },
      isMobile: !!c.phone,
      hasTouch: !!c.phone,
    });
    // Desktop is an actual fresh start. Returning fixtures can revisit the optional journal.
    if (c.name !== 'desktop')
      await ctx.addInitScript(
        (s) => {
          if (!localStorage.getItem('bangkok-rift-adventure-v1'))
            localStorage.setItem('bangkok-rift-adventure-v1', JSON.stringify(s));
        },
        { ...freshAdventure(), flags: ['intro', 'hotel-journal'] },
      );
    if (c.fallback) await ctx.route('**/hotel-furnishings.glb', (r) => r.abort());
    if (c.missingBed)
      await ctx.route('**/Bed.glb*', (r) =>
        r.request().resourceType() === 'fetch' ? r.abort() : r.continue(),
      );
    page = await ctx.newPage();
    page.setDefaultTimeout(120000);
    page.on('pageerror', (e) => report.errors.push({ scene: c.name, message: e.message }));
    page.on('console', (m) => {
      if (
        m.type() === 'error' &&
        !(c.fallback && m.location().url.includes('hotel-furnishings.glb')) &&
        !(c.missingBed && m.location().url.includes('Bed.glb'))
      )
        report.errors.push({ scene: c.name, message: m.text() });
    });
    await page.goto('http://127.0.0.1:5188/');
    await page
      .getByRole('button', { name: c.name === 'desktop' ? /Step through the rift/ : /Continue adventure/ })
      .click();
    await ready();
    report.graphics.push(
      await page.evaluate(() => {
        const gl = document.querySelector('.bk-world canvas').getContext('webgl2');
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      }),
    );
    assert.deepEqual((await save()).position, { x: -57, z: 29 });
    const f = await furniture();
    assert.equal(f.state, c.fallback ? 'fallback' : 'ready');
    assert.equal(f.fallback, !!c.fallback);
    assert.equal(f.parts.length, c.fallback ? 0 : 5);
    assert.equal(f.wallFallback, !!c.fallback);
    assert(f.wallFallbackMeshes > 0, 'fallback meshes remain inside their hideable group after batching');
    if (!c.fallback) {
      const wall = f.parts.find((p) => p.name === 'BedroomWallCraft');
      assert(wall && wall.min.x > -61.9 && wall.max.x < -61.1);
      assert(wall.min.y > 1.35 && wall.max.y < 3.15);
    }
    await capture(c.name + '-room');
    if (c.name !== 'desktop') {
      await walk('hotel-journal');
      // A previously discovered memory presents its story, without a new lesson or reward.
      assert((await page.locator('.rpg-dialogue').innerText()).includes('A guest has left a journal'));
      await page.waitForFunction(() => {
        const cast = JSON.parse(document.querySelector('.bk-world').dataset.conversationCast ?? 'null');
        return cast && !cast.moving;
      });
      await capture(c.name + '-journal');
      await page.getByRole('button', { name: 'Leave conversation', exact: true }).click();
    }
    await walk('innkeeper');
    await preview();
    await capture(c.name + '-reception');
    assert(!(await save()).flags.includes('innkeeper'));
    // Complete all three first check-in lines, each with meaning before submission.
    for (let i = 0; i < 3; i++) {
      if (i) await preview();
      await page.getByRole('button', { name: 'Use text only this time', exact: true }).click();
      await page.getByRole('button', { name: 'Continue →', exact: true }).click();
    }
    await page.getByRole('button', { name: 'Back to the adventure →', exact: true }).click();
    await page.waitForFunction(() =>
      JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')).flags.includes('innkeeper'),
    );
    const checkedIn = await save();
    assert(checkedIn.learned.includes('reservation-have'));
    await walk('chest');
    await capture(c.name + '-chest-route');
    await page.getByRole('button', { name: 'Leave conversation', exact: true }).click();
    await walk('station', 'sukhumvit');
    await page.locator('.rpg-thai').waitFor();
    await capture(c.name + '-outside');
    assert((await save()).visited.includes('sukhumvit'));
    await page.getByRole('button', { name: 'Leave conversation', exact: true }).click();
    await page.waitForFunction(() => {
      const h = document.querySelector('.bk-world'),
        s = JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1'));
      return (
        Math.abs(Number(h.dataset.playerX) - s.position.x) < 0.015 &&
        Math.abs(Number(h.dataset.playerZ) - s.position.z) < 0.015
      );
    });
    const end = await save();
    assert.equal(end.xp, checkedIn.xp);
    assert.equal(end.coins, checkedIn.coins + 25);
    assert.equal(end.tea, checkedIn.tea + 1);
    assert(end.flags.includes('chest'));
    await page.reload();
    await page.getByRole('button', { name: /Continue adventure/ }).click();
    await ready();
    assert.deepEqual(await save(), end);
    if (c.phone) {
      await page.getByRole('button', { name: 'Train at camp', exact: true }).click();
      await page.getByRole('button', { name: /(Begin|Continue) your journey/ }).waitFor();
      await page.getByRole('button', { name: /Return to the adventure/ }).click();
      await page.getByRole('button', { name: /Continue adventure/ }).click();
      await ready();
      assert.deepEqual(await save(), end);
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
  report.save = await save().catch(() => null);
  await checkpoint();
  await page?.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  throw e;
} finally {
  await browser.close();
}
