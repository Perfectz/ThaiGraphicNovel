import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshAdventure } from '../src/bangkok/adventure.ts';
const out = 'artifacts/oldtown-court'; await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true }); let page;
const report = { desktop: false, phone: false, remount: false, finished: false }, errors = [];
const checkpoint = () => writeFile(`${out}/progress.json`, JSON.stringify(report, null, 2));
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')));
const ready = () => page.waitForFunction(() => !document.querySelector('.bk-loading') && document.querySelector('.bk-world')?.dataset.npcReady === '6' && document.querySelector('.bk-world')?.dataset.cityProps === 'ready', null, { timeout: 120000 });
const at = point => page.waitForFunction(point => { const p = JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')).position; return Math.hypot(p.x - point.x, p.z - point.z) < .15; }, point, { timeout: 180000 });
async function open(phone = false) {
  const context = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 900 }, isMobile: phone, hasTouch: phone });
  const s = freshAdventure(); s.flags = ['intro', 'innkeeper', 'station']; s.position = phone ? { x: 24.2, z: 30 } : { x: 20, z: 39 }; s.xp = 160; s.coins = 81;
  await context.addInitScript(s => { if (!localStorage.getItem('bangkok-rift-adventure-v1')) localStorage.setItem('bangkok-rift-adventure-v1', JSON.stringify(s)); }, s);
  page = await context.newPage(); page.setDefaultTimeout(60000); page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:5188/'); await page.getByRole('button', { name: /Continue adventure/ }).click(); await ready(); return context;
}
async function map() { await page.getByRole('button', { name: 'Open town map ↗', exact: true }).click(); }
async function court() {
  await map(); await page.locator('.city-map button[data-area="oldtown"]').click();
  await page.getByRole('button', { name: 'Walk to Old Town Lantern Court', exact: true }).click(); await at({ x: 37, z: 30 });
}
async function talk() {
  await map(); await page.locator('.city-map button[data-area="oldtown"]').click();
  await page.locator('.city-contacts button').filter({ hasText: 'Arun' }).click();
  await page.locator('.rpg-dialogue').waitFor();
  await page.waitForFunction(() => { const c = JSON.parse(document.querySelector('.bk-world')?.dataset.conversationCast ?? 'null'); return c && !c.moving; });
  assert((await page.locator('.choice-meaning').first().innerText()).length > 0);
}
async function move(key, axis, target, greater) {
  await page.keyboard.down(key);
  try { await page.waitForFunction(({ axis, target, greater }) => { const value = Number(document.querySelector('.bk-world')?.dataset[axis]); return greater ? value >= target : value <= target; }, { axis, target, greater }, { timeout: 90000 }); }
  finally { await page.keyboard.up(key); }
}
try {
  await checkpoint(); const desktop = await open(); await court(); await talk();
  await page.screenshot({ path: `${out}/workshop.png` }); await page.getByRole('button', { name: 'Leave conversation', exact: true }).click();
  await court(); await move('ArrowDown', 'playerZ', 38.9, true); await move('ArrowRight', 'playerX', 42.8, true);
  await page.keyboard.down('ArrowDown'); await page.waitForTimeout(1800); await page.keyboard.up('ArrowDown');
  assert(Number(await page.locator('.bk-world').getAttribute('data-player-z')) < 39.5, 'Wall blocks the player');
  await page.screenshot({ path: `${out}/rear-path.png` });
  await move('ArrowLeft', 'playerX', 37.1, false); await move('ArrowDown', 'playerZ', 40.45, true);
  await page.screenshot({ path: `${out}/canal-gate.png` });
  await map(); await page.getByRole('button', { name: 'Walk to the canal', exact: true }).click(); await at({ x: -9, z: 39 });
  report.desktop = true; await checkpoint(); console.log('PASS west entry, workshop, rear path, solid wall, south gate and canal return'); await desktop.close();
  const phone = await open(true); const migrated = await saved();
  assert(migrated.position.x >= 25 && migrated.position.x < 26); assert.equal(migrated.coins, 81); assert.equal(migrated.xp, 160);
  await talk(); await page.screenshot({ path: `${out}/phone-workshop.png` });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.getByRole('button', { name: 'Leave conversation', exact: true }).click(); await court();
  await page.screenshot({ path: `${out}/phone-court.png` });
  const before = await saved(); await page.getByRole('button', { name: 'Train at camp', exact: true }).click();
  await page.getByRole('button', { name: /(Begin|Continue) your journey/ }).waitFor(); await page.waitForFunction(() => !document.querySelector('.bk-loading'));
  await page.getByRole('button', { name: /Return to the adventure/ }).click(); await page.getByRole('button', { name: /Continue adventure/ }).click(); await ready();
  assert.deepEqual(await saved(), before); report.remount = true; report.phone = true;
  await phone.close(); assert.deepEqual(errors, []); report.finished = true; await checkpoint(); console.log('PASS phone wall-save recovery, conversation, navigation, camp round trip and no browser errors');
} catch (error) { report.error = String(error); await checkpoint(); console.error(await page?.locator('body').innerText().catch(() => '')); await page?.screenshot({ path: `${out}/failure.png` }).catch(() => {}); throw error; }
finally { await browser.close(); }
