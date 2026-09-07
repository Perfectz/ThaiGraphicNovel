import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { freshAdventure } from '../src/bangkok/adventure.ts';
const base = process.env.PLAYTEST_BASE_URL ?? 'http://127.0.0.1:5188/';
const phone = process.argv.includes('--phone'), fallback = process.argv.includes('--fallback');
const local = base.includes('127.0.0.1');
const out = `artifacts/canal-houses/${local ? 'local' : 'public'}-${phone ? 'phone' : 'desktop'}${fallback ? '-fallback' : ''}`;
await mkdir(out, { recursive: true });
const report = { base, phone, fallback, finished: false, errors: [], snapshots: [] };
const hash = b => createHash('sha256').update(b).digest('hex');
const expected = hash(await readFile('public/bangkok/models/thonburi-canal-house.glb'));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 950 }, isMobile: phone, hasTouch: phone });
await context.addInitScript(s => localStorage.setItem('bangkok-rift-adventure-v1', JSON.stringify(s)), {
  ...freshAdventure(), position: { x: -5.5, z: -68 }, visited: ['hotel', 'thonburi'],
  flags: ['intro', 'innkeeper', 'murmur', 'cook', 'ferry', 'keeper', 'departed', 'canal-post', 'canal-junction'], xp: 380,
});
if (fallback) await context.route('**/thonburi-canal-house.glb', route => route.abort());
const page = await context.newPage(); page.setDefaultTimeout(90000);
page.on('pageerror', e => report.errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !(fallback && m.text().includes('ERR_FAILED'))) report.errors.push(m.text()); });
async function snapshot(label) {
  await page.waitForTimeout(2600);
  const state = await page.locator('.bk-world').getAttribute('data-canal-houses');
  if (state) report.snapshots.push({ label, ...JSON.parse(state) });
  await page.screenshot({ path: `${out}/${label}.png` });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
}
try {
  const response = fallback ? null : page.waitForResponse(r => r.url().endsWith('/thonburi-canal-house.glb'));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Continue adventure/ }).click();
  await page.waitForFunction(() => !document.querySelector('.bk-loading'));
  if (response) { const r = await response; assert.equal(r.status(), 200); report.modelHash = hash(await r.body()); assert.equal(report.modelHash, expected); }
  if (local) await page.waitForFunction(f => {
    const el = document.querySelector('[data-canal-houses]');
    return el && JSON.parse(el.dataset.canalHouses).state === (f ? 'fallback' : 'ready');
  }, fallback);
  await snapshot('approach');
  await page.getByRole('button', { name: 'Open town map ↗', exact: true }).click();
  await page.locator('.city-map button[data-area="thonburi"]').click();
  const chart = page.getByRole('group', { name: 'Choose a walking destination on the city chart', exact: true });
  await chart.scrollIntoViewIfNeeded();
  const p = await chart.evaluate(svg => { const p = new DOMPoint(3, -68.5).matrixTransform(svg.getScreenCTM()); return { x: p.x, y: p.y }; });
  await page.mouse.click(p.x, p.y); assert.equal(await chart.getAttribute('data-route-status'), 'ready');
  await page.getByRole('button', { name: 'Walk this route →', exact: true }).click();
  await page.waitForFunction(() => { const s = JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')); return Math.hypot(s.position.x - 3, s.position.z + 68.5) < .3; });
  await page.getByRole('button', { name: /^E · / }).click();
  await page.getByRole('region', { name: 'Story conversation', exact: true }).waitFor();
  await snapshot('conversation');
  if (local && !fallback) for (const state of report.snapshots) {
    assert.equal(state.houses.length, 4); assert(state.houses.every(h => !h.fallback && h.parts.HouseBase));
    const blue = state.houses.find(h => h.id === 'blue');
    assert(blue.parts.HouseFront, `${state.label}: blue shutters stay recognizable`);
  }
  assert.deepEqual(report.errors, []); report.finished = true;
} catch (e) { report.failure = e.stack; await page.screenshot({ path: `${out}/failure.png` }).catch(() => {}); throw e; }
finally { await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); }
