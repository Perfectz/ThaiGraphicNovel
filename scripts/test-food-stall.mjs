import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshAdventure, moveAdventure, walkable } from '../src/bangkok/adventure.ts';
import { foodStallOrigin } from '../src/bangkok/city.ts';
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7);
const presentation = process.argv.includes('--presentation');
const out = `artifacts/blender-food-stall/browser${only ? '/' + only : presentation ? '/presentation' : ''}`;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = { scenes: [], errors: [], finished: false };
let page;
const checkpoint = () => writeFile(`${out}/progress.json`, JSON.stringify(report, null, 2));
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')));
const data = async (name) => JSON.parse(await page.locator('.bk-world').getAttribute('data-' + name));
const ready = () =>
  page.waitForFunction(
    () => {
      const h = document.querySelector('.bk-world');
      const s = JSON.parse(h?.dataset.cityFoodStall ?? 'null');
      return (
        h?.dataset.npcReady === '6' &&
        s &&
        s.state !== 'loading' &&
        !document.querySelector('.bk-loading') &&
        JSON.parse(h.dataset.cityEvening ?? '{}').state === 'ready'
      );
    },
    null,
    { timeout: 180000 },
  );
const castReady = () =>
  page.waitForFunction(() => {
    const c = JSON.parse(document.querySelector('.bk-world')?.dataset.conversationCast ?? 'null');
    return c && !c.moving;
  });
const at = (p) =>
  page.waitForFunction(
    (p) => {
      const h = document.querySelector('.bk-world');
      return h && Math.hypot(Number(h.dataset.playerX) - p.x, Number(h.dataset.playerZ) - p.z) < 0.15;
    },
    p,
    { timeout: 240000 },
  );
async function capture(name) {
  await page.screenshot({ path: `${out}/${name}.png` });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
}
async function walkTo(area, name, target) {
  await page.getByRole('button', { name: 'Open town map ↗', exact: true }).click();
  await page.locator(`.city-map button[data-area="${area}"]`).click();
  await page.getByRole('button', { name: `Walk to ${name}`, exact: true }).click();
  await at(target);
}
async function castCheck(phone) {
  const c = await data('conversation-cast'),
    panel = await page.locator('.rpg-dialogue').boundingBox();
  for (const m of c.members) {
    assert(walkable({ x: m.x, z: m.z }));
    assert(m.screenY < panel.y && m.screenX > 8 && m.screenX < (phone ? 390 : 1280) - 8);
  }
  const s = await data('city-food-stall');
  const canopy = s.parts.find((p) => p.name === 'Canopy');
  const sign = (await data('city-wayfinding')).mounts.find((m) => m.id === 'noodles');
  assert.equal((await data('city-life')).steamVisible, s.cookingVisible);
  if (canopy) {
    assert.equal(sign.supportVisible, canopy.visible);
    if (!canopy.visible) assert(!sign.visible);
  }
}
async function reply(meaning) {
  await page
    .locator('.thai-choice-list > button')
    .filter({ has: page.locator('.choice-meaning', { hasText: meaning }) })
    .click();
  await page.getByRole('heading', { name: meaning, exact: true }).waitFor();
  await page.getByRole('button', { name: 'Use text only this time', exact: true }).click();
}
try {
  for (const c of [
    { name: 'main-and-passage' },
    { name: 'meal-phone', phone: true, meal: true },
    { name: 'fallback', meal: true, fallback: true },
    { name: 'counter-recovery', recovery: true },
    { name: 'canopy-overview', overview: true },
    { name: 'canopy-reduced', overview: true, reduced: true },
  ].filter((c) => (only ? c.name === only : !presentation || c.overview || c.phone))) {
    report.phase = c.name;
    await checkpoint();
    const context = await browser.newContext({
      viewport: c.phone ? { width: 390, height: 844 } : { width: 1280, height: 900 },
      isMobile: !!c.phone,
      hasTouch: !!c.phone,
      reducedMotion: c.reduced ? 'reduce' : 'no-preference',
    });
    let s = moveAdventure(freshAdventure(), { x: 35, z: 15 });
    s.flags = ['intro', 'innkeeper'];
    s.coins = 51;
    s.xp = 90;
    if (c.meal) {
      s.flags.push('evening-food');
      s.trackedQuest = 'evening';
      s = moveAdventure(s, { x: 34, z: 16.5 });
    }
    if (c.recovery) s.position = { ...foodStallOrigin };
    if (c.overview) s = moveAdventure(s, { x: 29, z: 14 });
    await context.addInitScript((s) => {
      if (!localStorage.getItem('bangkok-rift-adventure-v1'))
        localStorage.setItem('bangkok-rift-adventure-v1', JSON.stringify(s));
    }, s);
    if (c.fallback) await context.route('**/bangkok/models/lek-food-stall.glb', (r) => r.abort());
    page = await context.newPage();
    page.setDefaultTimeout(120000);
    page.on('pageerror', (e) => report.errors.push({ scene: c.name, message: e.message }));
    page.on('console', (m) => {
      if (m.type() === 'error' && !(c.fallback && m.location().url.includes('lek-food-stall.glb')))
        report.errors.push({ scene: c.name, message: m.text() });
    });
    await page.goto('http://127.0.0.1:5188/');
    await page.getByRole('button', { name: /Continue adventure/ }).click();
    await ready();
    const stall = await data('city-food-stall');
    assert.equal(stall.state, c.fallback ? 'fallback' : 'ready');
    assert.equal(stall.fallback, !!c.fallback);
    assert.equal(stall.parts.length, c.fallback ? 0 : 3);
    await capture(c.name + '-world');
    if (c.overview) {
      await page.waitForFunction(() =>
        JSON.parse(document.querySelector('.bk-world').dataset.cityFoodStall).parts.every((p) => p.visible),
      );
      const life = await data('city-life');
      assert.equal(life.steamVisible, !c.reduced);
      if (!c.reduced) {
        assert(Math.abs(life.steamX - (foodStallOrigin.x - 1.52)) < 0.121);
        assert(Math.abs(life.steamZ - (foodStallOrigin.z - 0.09)) < 0.101);
        assert(life.steamY >= 1.449 && life.steamY <= 2.201);
      }
      await capture(c.name + '-canopy');
      assert.deepEqual(await saved(), s);
    } else if (c.recovery) {
      const recovered = await saved();
      assert(walkable(recovered.position));
      assert(Math.hypot(recovered.position.x - s.position.x, recovered.position.z - s.position.z) < 1.5);
      assert.equal(recovered.coins, 51);
      assert.equal(recovered.xp, 90);
      assert.deepEqual(recovered.flags, s.flags);
      await page.reload();
      await page.getByRole('button', { name: /Continue adventure/ }).click();
      await ready();
      assert.deepEqual(await saved(), recovered);
      await page.keyboard.press('e');
      await page.locator('.rpg-dialogue').waitFor();
      await castReady();
      await castCheck(false);
      await capture(c.name + '-conversation');
      await page.getByRole('button', { name: 'Leave conversation', exact: true }).click();
    } else if (c.meal) {
      await page.getByRole('button', { name: 'Continue our evening', exact: true }).click();
      await castReady();
      await castCheck(c.phone);
      const before = await data('city-evening');
      assert(!before.meal);
      await capture(c.name + '-order');
      await reply(c.phone ? 'Not spicy, please' : 'A little spicy');
      assert.deepEqual(await data('city-evening'), before);
      await page.getByRole('button', { name: 'Confirm my order', exact: true }).click();
      await page.waitForFunction(
        () => JSON.parse(document.querySelector('.bk-world').dataset.cityEvening).meal,
      );
      await castReady();
      await castCheck(c.phone);
      const display = await data('city-evening');
      assert.equal(display.chilli, !c.phone);
      await capture(c.name + '-served');
      await page.getByRole('button', { name: 'Leave evening conversation', exact: true }).click();
      const ordered = await saved();
      await page.reload();
      await page.getByRole('button', { name: /Continue adventure/ }).click();
      await ready();
      assert.deepEqual(await saved(), ordered);
      assert.deepEqual(await data('city-evening'), display);
      await page.getByRole('button', { name: 'Continue our evening', exact: true }).click();
      await castReady();
      await reply('Very delicious');
      const beforeFinish = await saved();
      await page.getByRole('button', { name: 'Keep this evening in our journal', exact: true }).click();
      const done = await saved();
      assert.equal(done.xp, beforeFinish.xp + 60);
      assert.equal(done.coins, 51);
      assert(done.flags.includes('evening-complete'));
      if (c.phone) {
        await page.getByRole('button', { name: 'Train at camp', exact: true }).click();
        await page.getByRole('button', { name: /(Begin|Continue) your journey/ }).waitFor();
        await page.getByRole('button', { name: /Return to the adventure/ }).click();
        await page.getByRole('button', { name: /Continue adventure/ }).click();
        await ready();
        assert.deepEqual(await saved(), done);
        assert.deepEqual(await data('city-evening'), display);
      }
      await capture(c.name + '-finished');
    } else {
      await page.keyboard.press('e');
      await page.locator('.rpg-dialogue').waitFor();
      await castReady();
      await castCheck(false);
      assert((await page.locator('.choice-meaning').count()) > 0);
      await capture(c.name + '-conversation');
      const first = page.locator('.thai-choice-list > button').first(),
        meaning = await first.locator('.choice-meaning').innerText();
      await first.click();
      await page.getByRole('heading', { name: meaning, exact: true }).waitFor();
      await capture(c.name + '-english');
      await page.getByRole('button', { name: 'Leave conversation', exact: true }).click();
      await page.keyboard.down('ArrowDown');
      try {
        await page.waitForFunction(
          () => Number(document.querySelector('.bk-world')?.dataset.playerZ) > 16.8,
          null,
          { timeout: 60000 },
        );
        await page.waitForTimeout(1200);
      } finally {
        await page.keyboard.up('ArrowDown');
      }
      const blocked = await saved();
      assert(blocked.position.z < 16.95 && walkable(blocked.position));
      await capture(c.name + '-solid-counter');
      await walkTo('oldtown', 'Old Town Lantern Court', { x: 37, z: 30 });
      await capture(c.name + '-oldtown');
      await walkTo('yaowarat', 'Yaowarat', { x: 35, z: 14 });
      await capture(c.name + '-return');
      const after = await saved();
      assert.equal(after.coins, 51);
      assert.equal(after.xp, 90);
      assert.deepEqual(after.flags, s.flags);
    }
    assert.deepEqual(report.errors, []);
    report.scenes.push(c.name);
    await checkpoint();
    console.log('PASS', c.name);
    await context.close();
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
