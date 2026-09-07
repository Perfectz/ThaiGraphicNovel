import { chromium } from 'playwright-core';
import * as T from 'three';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshAdventure } from '../src/bangkok/adventure.ts';
const phone = process.argv.includes('--phone'),
  reduced = process.argv.includes('--reduced');
const base = process.env.PLAYTEST_BASE_URL ?? 'http://127.0.0.1:5188/';
const local = base.includes('127.0.0.1');
const out = `artifacts/exploration-camera/${local ? 'local' : 'public'}-${phone ? 'phone' : 'desktop'}${reduced ? '-reduced' : ''}`;
await mkdir(out, { recursive: true });
const report = { finished: false, base, phone, reduced, checks: [], errors: [] };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
let page;
try {
  const context = await browser.newContext({
    viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    isMobile: phone,
    hasTouch: phone,
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  });
  const s = { ...freshAdventure(), position: { x: 0, z: 13 }, flags: ['intro', 'innkeeper'] };
  await context.addInitScript((s) => {
    if (!localStorage.getItem('bangkok-rift-adventure-v1'))
      localStorage.setItem('bangkok-rift-adventure-v1', JSON.stringify(s));
  }, s);
  page = await context.newPage();
  page.setDefaultTimeout(90000);
  page.on('pageerror', (e) => report.errors.push(e.message));
  await page.goto(base);
  await page.getByRole('button', { name: /Continue adventure/ }).click();
  await page.waitForFunction(() => !document.querySelector('.bk-loading'));
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')));
  const camera = () => page.locator('.bk-world').evaluate((h) => JSON.parse(h.dataset.explorationCamera));
  async function expectCamera(custom, enabled = true) {
    if (local)
      await page.waitForFunction(
        ({ custom, enabled }) => {
          const c = JSON.parse(document.querySelector('.bk-world')?.dataset.explorationCamera ?? '{}');
          return c.custom === custom && c.enabled === enabled;
        },
        { custom, enabled },
      );
  }
  await expectCamera(false);
  const before = await saved();
  const { width: w, height: h } = page.viewportSize();
  const cdp = await context.newCDPSession(page);
  async function drag(button = 'left') {
    if (phone) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: w * 0.45, y: h * 0.43, id: 1 }],
      });
      for (let n = 1; n <= 12; n++)
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x: w * (0.45 + (0.25 * n) / 12), y: h * 0.43, id: 1 }],
        });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      await page.mouse.move(w * 0.4, h * 0.46);
      await page.mouse.down({ button });
      await page.mouse.move(w * 0.68, h * 0.46, { steps: 16 });
      await page.mouse.up({ button });
    }
  }
  if (phone) await page.getByRole('button', { name: 'Look around', exact: true }).click();
  await drag(phone ? 'left' : 'right');
  await expectCamera(true);
  assert.deepEqual((await saved()).position, before.position, 'looking must not start walking');
  await page.screenshot({ path: `${out}/look-around.png` });
  const chosen = local ? await camera() : null;
  if (chosen) assert(Math.abs(chosen.offset[0] - 8) > 2, 'actual camera direction changed');
  if (phone) await page.getByRole('button', { name: 'Return to walking', exact: true }).click();
  if (!phone) {
    await page.mouse.move(w * 0.5, h * 0.4);
    await page.mouse.down({ button: 'right' });
  }
  await page.keyboard.down('w');
  await page.waitForTimeout(350);
  await page.keyboard.up('w');
  if (!phone) await page.mouse.up({ button: 'right' });
  await page.waitForTimeout(900);
  const moved = await saved();
  const delta = { x: moved.position.x - before.position.x, z: moved.position.z - before.position.z };
  assert(Math.hypot(delta.x, delta.z) > 0.25);
  if (chosen)
    assert(delta.x * chosen.offset[0] + delta.z * chosen.offset[2] < 0, 'W moves into the chosen view');
  report.checks.push('Orbit does not walk; movement follows the chosen camera');
  await page.getByRole('button', { name: 'Talk to Su', exact: true }).click();
  await expectCamera(true, false);
  await page.getByRole('button', { name: 'Leave conversation', exact: true }).click();
  await expectCamera(true);
  if (chosen)
    assert(new T.Vector3(...(await camera()).offset).distanceTo(new T.Vector3(...chosen.offset)) < 1e-6);
  report.checks.push('Conversation framing suspends the custom view and restores it afterwards');
  const stationary = (await saved()).position;
  if (phone) {
    const points = (r) => [
      { x: w * 0.5 - r, y: h * 0.43, id: 1 },
      { x: w * 0.5 + r, y: h * 0.43, id: 2 },
    ];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(20) });
    for (let r = 25; r <= 55; r += 5)
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(r) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await page.mouse.move(w * 0.5, h * 0.4);
    await page.mouse.wheel(0, -240);
  }
  await page.waitForTimeout(900);
  assert.deepEqual((await saved()).position, stationary, 'zoom release must not produce a walking click');
  if (chosen)
    assert(
      Math.abs(
        new T.Vector3(...(await camera()).offset).length() - new T.Vector3(...chosen.offset).length(),
      ) > 0.4,
      'zoom changes actual camera distance',
    );
  await page.getByRole('button', { name: 'Reset view', exact: true }).click();
  await expectCamera(false);
  await page.waitForTimeout(1300);
  if (local) {
    const c = await camera(),
      p = (await saved()).position;
    const projection = new T.PerspectiveCamera(phone ? 54 : 43, w / h, 0.1, 200);
    projection.position.fromArray(c.position);
    projection.lookAt(new T.Vector3(...c.target));
    if (phone) projection.setViewOffset(w, h, 0, h * 0.08, w, h);
    projection.updateMatrixWorld(true);
    const point = new T.Vector3(p.x + 1, 0.1, p.z).project(projection);
    await page.mouse.click(((point.x + 1) * w) / 2, ((1 - point.y) * h) / 2);
    await page.waitForFunction((p) => {
      const s = JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1'));
      return Math.hypot(s.position.x - p.x, s.position.z - p.z) > 0.4;
    }, p);
  }
  report.checks.push('Pinch/wheel zoom is separate from walking; reset restores the guided view');
  await page.screenshot({ path: `${out}/reset.png` });
  // Enter a real world encounter with a chosen view, then return to that same view.
  await page.getByRole('button', { name: 'Look around', exact: true }).click();
  await drag();
  await expectCamera(true);
  await page.getByRole('button', { name: 'Return to walking', exact: true }).click();
  const battleView = local ? (await camera()).offset : null;
  await page.getByRole('button', { name: 'Walk to Murmur wisp ↗', exact: true }).click();
  await page.waitForFunction(() => {
    const s = JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1'));
    return Math.hypot(s.position.x + 16, s.position.z - 30) < 2.1;
  });
  await page.getByRole('button', { name: /^E · Murmur/ }).click();
  for (let n = 0; n < 8; n++) {
    const dialogue = page.getByRole('region', { name: 'Story conversation', exact: true });
    if (!(await dialogue.count())) break;
    await dialogue.getByRole('button', { name: /^(Continue|Face the)/ }).click();
  }
  await page.getByLabel('Battle location').waitFor();
  await expectCamera(true, false);
  await page.screenshot({ path: `${out}/story-battle.png` });
  await page.getByRole('button', { name: 'Retreat', exact: true }).click();
  await expectCamera(true);
  if (battleView) assert.deepEqual((await camera()).offset, battleView);
  report.checks.push(
    'A real story encounter uses its battle camera, then returns to the chosen exploration view',
  );
  assert.deepEqual((await saved()).flags, before.flags);
  assert.deepEqual(report.errors, []);
  report.finished = true;
  console.log(
    'Exploration camera: orbit, camera-relative walking, conversation return, zoom and reset passed',
  );
} catch (e) {
  report.failure = e.stack;
  await page?.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  throw e;
} finally {
  await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
