import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshAdventure } from '../src/bangkok/adventure.ts';
const phone = process.argv.includes('--phone'),
  reduced = process.argv.includes('--reduced'),
  fallback = process.argv.includes('--fallback');
const crossing = process.argv.includes('--crossing');
const base = process.env.PLAYTEST_BASE_URL ?? 'http://127.0.0.1:5188/',
  local = base.includes('127.0.0.1');
const out = `artifacts/city-morning/${local ? 'local' : 'public'}-${phone ? 'phone' : 'desktop'}${reduced ? '-reduced' : ''}${fallback ? '-fallback' : ''}${crossing ? '-crossing' : ''}`;
await mkdir(out, { recursive: true });
const report = { finished: false, base, phone, reduced, fallback, crossing, stops: [], errors: [] };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
let page;
try {
  const context = await browser.newContext({
    viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    isMobile: phone,
    hasTouch: phone,
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  });
  if (fallback) await context.route('**/bangkok/river-skyline.png', (r) => r.abort());
  const initial = {
    ...freshAdventure(),
    ...(crossing ? { position: { x: 1, z: -5.5 } } : {}),
    flags: [
      'intro',
      'innkeeper',
      'murmur',
      'cook',
      'ferry',
      'keeper',
      'departed',
      'reunion-tomorrow',
      'reunion-mali',
      'reunion-arun',
      'reunion-welcome',
      'reunion-complete',
    ],
  };
  await context.addInitScript((s) => {
    if (!localStorage.getItem('bangkok-rift-adventure-v1'))
      localStorage.setItem('bangkok-rift-adventure-v1', JSON.stringify(s));
  }, initial);
  page = await context.newPage();
  page.setDefaultTimeout(90000);
  page.on('pageerror', (e) => report.errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('net::ERR_FAILED')) report.errors.push(m.text());
  });
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')));
  async function capture(id) {
    await page.waitForTimeout(1200);
    let atmosphere = null;
    if (local) {
      await page.waitForFunction(
        () => JSON.parse(document.querySelector('.bk-world')?.dataset.cityAtmosphere ?? '{}').daylight === 1,
      );
      atmosphere = await page.locator('.bk-world').evaluate((h) => ({
        lighting: JSON.parse(h.dataset.cityAtmosphere),
        drawCalls: h.dataset.drawCalls,
        frameMs: h.dataset.frameMs,
      }));
      assert(atmosphere.lighting.skylineVisible);
      assert(!atmosphere.lighting.backdropVisible);
    }
    await page.screenshot({ path: `${out}/${id}.png` });
    report.stops.push({ id, atmosphere });
    assert.deepEqual((await saved()).flags, initial.flags);
  }
  await page.goto(base);
  if (crossing && !phone) {
    await page.waitForFunction(() => !document.querySelector('.bk-loading'));
    const { width, height } = page.viewportSize();
    await page.mouse.move(width * 0.8, height * 0.65);
    await page.mouse.down();
    await page.mouse.move(width * 0.8, height * 0.25, { steps: 16 });
    await page.mouse.up();
    await capture('morning-sky');
  }
  await page.getByRole('button', { name: /Continue adventure/ }).click();
  await page.waitForFunction(() => !document.querySelector('.bk-loading'));
  await capture(crossing ? 'pier' : 'hotel');
  if (crossing) {
    await page.getByRole('button', { name: /^E · / }).click();
    for (let n = 0; n < 12; n++) {
      const dialogue = page.getByRole('region', { name: 'Story conversation', exact: true });
      if (!(await dialogue.count())) break;
      if (await dialogue.locator('[data-phrase-choice]').count()) {
        await dialogue.locator('[data-phrase-choice="see-you"]').click();
        await page.getByRole('button', { name: 'Use text only this time', exact: true }).click();
      }
      await dialogue
        .getByRole('button', { name: /^(Continue|Back to the adventure|Board the ferry)/ })
        .click();
    }
    await page.getByRole('region', { name: 'The last ferry crossing', exact: true }).waitFor();
    await capture('river-lighting');
    assert((await saved()).passage === 'thonburi');
  }
  for (const [area, x, z] of crossing
    ? []
    : [
        ['riverside', 1, 4],
        ['lumphini', -13.5, 35],
      ]) {
    await page.getByRole('button', { name: 'Open town map ↗', exact: true }).click();
    await page.locator(`.city-map button[data-area="${area}"]`).click();
    const chart = page.getByRole('group', {
      name: 'Choose a walking destination on the city chart',
      exact: true,
    });
    await chart.scrollIntoViewIfNeeded();
    const p = await chart.evaluate(
      (svg, p) => {
        const v = new DOMPoint(p.x, p.z).matrixTransform(svg.getScreenCTM());
        return { x: v.x, y: v.y };
      },
      { x, z },
    );
    await page.mouse.click(p.x, p.y);
    await page.getByRole('button', { name: 'Walk this route →', exact: true }).click();
    await page.waitForFunction(
      (p) => {
        const s = JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1'));
        return Math.hypot(s.position.x - p.x, s.position.z - p.z) < 0.25;
      },
      { x, z },
      { timeout: 180000 },
    );
    await capture(area);
    await page.reload();
    await page.getByRole('button', { name: /Continue adventure/ }).click();
    await page.waitForFunction(() => !document.querySelector('.bk-loading'));
    await capture(`${area}-reloaded`);
  }
  assert.deepEqual(report.errors, []);
  report.finished = true;
  console.log(
    crossing
      ? 'Morning ferry: boarded through the story and rendered the daylight horizon'
      : 'Morning: hotel → riverside → Lumphini on foot, stable daylight, reload and unchanged story progress passed',
  );
} catch (e) {
  report.failure = e.stack;
  await page?.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  throw e;
} finally {
  await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
