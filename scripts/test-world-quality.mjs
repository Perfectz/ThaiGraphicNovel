import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const baseline = process.argv.includes('--baseline');
const phone = process.argv.includes('--phone');
const out = `artifacts/world-quality/${baseline ? 'baseline' : 'browser'}${phone ? '/phone' : ''}`;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({
  viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 900 },
  deviceScaleFactor: phone ? 2 : 1,
  isMobile: phone,
  hasTouch: phone,
});
const report = { finished: false, errors: [], samples: [], phases: [] };
const checkpoint = () => writeFile(`${out}/progress.json`, JSON.stringify(report, null, 2));
page.on('pageerror', (e) => report.errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') report.errors.push(m.text());
});
if (!baseline)
  await page.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window),
      cancel = window.cancelAnimationFrame.bind(window),
      pending = new Map();
    let next = 0;
    window.__qualityDelay = 0;
    window.requestAnimationFrame = (callback) => {
      const id = ++next,
        entry = { raf: 0, timer: 0 };
      pending.set(id, entry);
      const fire = (time) => {
        if (pending.delete(id)) callback(time);
      };
      entry.raf = raf((time) => {
        if (window.__qualityDelay)
          entry.timer = setTimeout(() => fire(performance.now()), window.__qualityDelay);
        else fire(time);
      });
      return id;
    };
    window.cancelAnimationFrame = (id) => {
      const entry = pending.get(id);
      if (entry) {
        cancel(entry.raf);
        clearTimeout(entry.timer);
        pending.delete(id);
      }
    };
  });
const sample = async (label) => {
  const s = await page.locator('.bk-world').evaluate((h) => ({
    quality: h.dataset.graphicsQuality,
    shadows: h.dataset.shadowsEnabled,
    frameMs: h.dataset.frameMs,
    windowMs: h.dataset.qualityFrameMs,
    pixelRatio: h.dataset.renderPixelRatio,
  }));
  report.samples.push({ label, ...s });
  await checkpoint();
  return s;
};
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')));
try {
  await page.goto('http://127.0.0.1:5188/');
  await page.getByRole('button', { name: /Step through the rift/ }).click();
  await page.waitForFunction(
    () =>
      document.querySelector('.bk-world')?.dataset.npcReady === '7' && !document.querySelector('.bk-loading'),
    null,
    { timeout: 180000 },
  );
  const initial = await saved();
  for (let i = 0; i < 5; i++) {
    await sample('startup-' + i);
    await page.waitForTimeout(2000);
  }
  await page.screenshot({ path: `${out}/hotel-high.png` });
  if (!baseline) {
    assert.equal((await sample('settled')).quality, 'high');
    assert.equal((await sample('lit')).shadows, 'true');
    assert.equal((await sample('resolution')).pixelRatio, phone ? '1.25' : '1');
    report.phases.push('startup-retains-shadows');
    await checkpoint();
    await page.evaluate(() => {
      window.__qualityDelay = 70;
    });
    await page.waitForFunction(
      () => document.querySelector('.bk-world')?.dataset.graphicsQuality === 'low',
      null,
      { timeout: 45000 },
    );
    assert.equal((await sample('sustained-slow')).shadows, 'false');
    assert.equal((await sample('lower-resolution')).pixelRatio, '1');
    await page.screenshot({ path: `${out}/hotel-low.png` });
    report.phases.push('sustained-slow-reduces');
    await checkpoint();
    await page.evaluate(() => {
      window.__qualityDelay = 0;
    });
    await page.waitForFunction(
      () => document.querySelector('.bk-world')?.dataset.graphicsQuality === 'high',
      null,
      { timeout: 45000 },
    );
    assert.equal((await sample('recovered')).shadows, 'true');
    assert.equal((await sample('restored-resolution')).pixelRatio, phone ? '1.25' : '1');
    report.phases.push('recovery-restores-shadows');
    await checkpoint();
    assert.deepEqual(await saved(), initial, 'quality changes never change adventure state');
    await page.screenshot({ path: `${out}/hotel-recovered.png` });
    await page.getByRole('button', { name: 'Open town map ↗', exact: true }).click();
    await page.locator('.city-map button[data-area="sukhumvit"]').click();
    await page.locator('.city-contacts button[data-area="station"]').click();
    await page.locator('.rpg-thai').waitFor({ timeout: 120000 });
    assert((await page.locator('.choice-meaning').first().innerText()).length > 3);
    await page.screenshot({ path: `${out}/station.png` });
    report.phases.push('walk-and-conversation');
    assert((await saved()).visited.includes('sukhumvit'));
    assert.deepEqual(report.errors, []);
  }
  report.finished = true;
  await checkpoint();
  console.log(JSON.stringify(report));
} catch (e) {
  report.error = String(e);
  await checkpoint();
  await page.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  throw e;
} finally {
  await browser.close();
}
