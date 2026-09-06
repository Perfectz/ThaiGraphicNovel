import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshAdventure, moveAdventure, walkable } from '../src/bangkok/adventure.ts';
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7);
const presentation = process.argv.includes('--presentation');
const out = `artifacts/blender-river-boat/browser${presentation ? '/presentation' : ''}${only ? '/' + only : ''}`;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = { scenes: [], errors: [], finished: false };
let page;
const checkpoint = () => writeFile(`${out}/progress.json`, JSON.stringify(report, null, 2));
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')));
const boats = () => page.locator('.bk-world').evaluate((el) => JSON.parse(el.dataset.riverBoats));
async function ready() {
  await page.waitForFunction(
    () => {
      const h = document.querySelector('.bk-world');
      const b = JSON.parse(h?.dataset.riverBoats ?? 'null');
      return (
        h?.dataset.npcReady === '7' && b && b.state !== 'loading' && !document.querySelector('.bk-loading')
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
  for (const c of [
    { name: 'pier' },
    { name: 'phone', phone: true },
    { name: 'fallback', fallback: true },
    { name: 'reduced', reduced: true },
  ].filter((c) => !only || c.name === only)) {
    report.phase = c.name;
    await checkpoint();
    const ctx = await browser.newContext({
      viewport: c.phone ? { width: 390, height: 844 } : { width: 1280, height: 900 },
      isMobile: !!c.phone,
      hasTouch: !!c.phone,
      reducedMotion: c.reduced ? 'reduce' : 'no-preference',
    });
    const s = moveAdventure(freshAdventure(), { x: 1, z: -5 });
    s.flags = ['intro', 'innkeeper', 'cook'];
    s.coins = 42;
    s.xp = 75;
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
    const initial = await boats();
    assert.equal(initial.state, c.fallback ? 'fallback' : 'ready');
    assert(initial.boats.every((b) => b.fallback === !!c.fallback));
    await capture(c.name + '-river');
    const rect = initial.boats[0].screen;
    assert(
      rect.right > 0 && rect.left < (c.phone ? 390 : 1280) && rect.top < 500 && rect.bottom > 0,
      'moored boat visible from ferry approach',
    );
    if (c.reduced) {
      await page.waitForTimeout(1500);
      const after = await boats();
      assert.deepEqual(
        after.boats.map(({ x, y, z, roll }) => ({ x, y, z, roll })),
        initial.boats.map(({ x, y, z, roll }) => ({ x, y, z, roll })),
      );
    } else
      await page.waitForFunction(
        (x) => JSON.parse(document.querySelector('.bk-world').dataset.riverBoats).boats[1].x > x + 0.05,
        initial.boats[1].x,
      );
    if (c.name === 'pier' || presentation) {
      await page.keyboard.down('w');
      await page.waitForFunction(() => Number(document.querySelector('.bk-world').dataset.playerZ) < -10.5);
      await page.keyboard.up('w');
      await capture(c.name + '-walked-out');
      assert.equal((await saved()).visited.includes('riverside'), true);
      if (presentation) {
        const frame=(await boats()).boats[0].screen;
        assert(frame.left>0 && frame.right<(c.phone?390:1280), `complete boat in ${c.name} pier view: ${JSON.stringify(frame)}`);
        assert(frame.top>0 && frame.bottom<(c.phone?730:830));
        assert.deepEqual(report.errors, []);
        report.scenes.push(c.name); await checkpoint(); console.log('PASS presentation',c.name);
        await ctx.close(); continue;
      }
      await page.getByRole('button', {name: 'Walk to Niran ↗', exact: true}).click();
      await page.waitForFunction(() => {
        const h=document.querySelector('.bk-world');
        return Math.hypot(Number(h.dataset.playerX)-1,Number(h.dataset.playerZ)+5.5)<.16;
      });
    }
    await page.keyboard.press('e');
    await page.locator('.rpg-dialogue').waitFor();
    const thai = await page.locator('.rpg-thai').innerText();
    const choice = page.locator('.thai-choice-list > button').filter({ hasText: thai });
    const meaning = await choice.locator('.choice-meaning').innerText();
    assert(meaning.length > 3);
    await choice.click();
    await page.getByRole('heading', { name: meaning, exact: true }).waitFor();
    await page.waitForFunction(() => {
      const c = JSON.parse(document.querySelector('.bk-world')?.dataset.conversationCast ?? 'null');
      return c && !c.moving;
    });
    const cast = await page.locator('.bk-world').evaluate((el) => JSON.parse(el.dataset.conversationCast));
    const panel = await page.locator('.rpg-dialogue').boundingBox();
    for (const m of cast.members) {
      assert(walkable({ x: m.x, z: m.z }));
      assert(m.screenY < panel.y && m.screenX > 0 && m.screenX < (c.phone ? 390 : 1280));
    }
    await capture(c.name + '-conversation');
    await page.getByRole('button', { name: 'Use text only this time', exact: true }).click();
    await page.getByRole('button', { name: 'Leave conversation', exact: true }).click();
    assert(!(await saved()).flags.includes('ferry'));
    const before = await saved();
    await page.reload();
    await page.getByRole('button', { name: /Continue adventure/ }).click();
    await ready();
    assert.deepEqual(await saved(), before);
    assert.equal((await boats()).state, c.fallback ? 'fallback' : 'ready');
    if (c.phone) {
      await page.getByRole('button', { name: 'Train at camp', exact: true }).click();
      await page.getByRole('button', { name: /(Begin|Continue) your journey/ }).waitFor();
      await page.getByRole('button', { name: /Return to the adventure/ }).click();
      await page.getByRole('button', { name: /Continue adventure/ }).click();
      await ready();
      assert.deepEqual(await saved(), before);
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
  await checkpoint();
  await page?.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  throw e;
} finally {
  await browser.close();
}
