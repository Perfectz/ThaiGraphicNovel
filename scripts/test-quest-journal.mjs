import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { freshAdventure } from '../src/bangkok/adventure.ts';
import { beginJourney } from '../src/bangkok/cityJourneys.ts';
import { freshTraining } from '../src/bangkok/learning.ts';
const out = 'artifacts/quest-journal'; await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = { milestones: [], finished: false }, errors = []; let page;
const phoneOnly = process.argv.includes('--phone-only');
if (phoneOnly) {
  const prior = JSON.parse(await readFile(`${out}/progress.json`, 'utf8'));
  assert.equal(prior.milestones.length, 2, 'The desktop checkpoints must already have passed');
  report.milestones = prior.milestones;
}
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')));
async function mark(name) { report.milestones.push(name); await writeFile(`${out}/progress.json`, JSON.stringify(report, null, 2)); console.log('PASS', name); }
const ready = () => page.waitForFunction(() => document.querySelector('.bk-world')?.dataset.npcReady === '6' && !document.querySelector('.bk-loading'), null, { timeout: 120000 });
const journal = () => page.getByRole('button', { name: 'Journal', exact: true }).click();
const card = id => page.locator(`.quest-card[data-quest="${id}"]`);
const at = point => page.waitForFunction(point => { const p = JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')).position; return Math.hypot(p.x - point.x, p.z - point.z) < .2; }, point, { timeout: 180000 });
async function open(phone = false) {
  const context = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 900 }, isMobile: phone, hasTouch: phone });
  const s = freshAdventure(); s.flags = ['intro', 'innkeeper'];
  if (phone) { s.position = { x: -19, z: 17.5 }; s.journeys = beginJourney(s.journeys, freshTraining(), '2026-09-04'); }
  await context.addInitScript(s => { if (!localStorage.getItem('bangkok-rift-adventure-v1')) localStorage.setItem('bangkok-rift-adventure-v1', JSON.stringify(s)); }, s);
  page = await context.newPage(); page.setDefaultTimeout(60000);
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:5188/'); await page.getByRole('button', { name: /Continue adventure/ }).click(); await ready(); return context;
}
async function reply() {
  const thai = await page.locator('.rpg-thai').innerText();
  const choice = page.locator('.thai-choice-list > button').filter({ hasText: thai });
  assert((await choice.locator('.choice-meaning').innerText()).length > 1);
  await choice.click(); await page.getByRole('button', { name: 'Use text only this time', exact: true }).click();
}
try {
  if (!phoneOnly) {
  const desktop = await open(); await journal();
  assert.equal(await card('escort').count(), 1); assert.equal(await card('waywarden').count(), 0);
  await card('routes').getByRole('button', { name: 'Track this story', exact: true }).click();
  assert.equal((await saved()).trackedQuest, 'routes'); await card('routes').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${out}/desktop-journal.png` });
  await page.keyboard.press('Escape'); await page.reload(); await page.getByRole('button', { name: /Continue adventure/ }).click(); await ready();
  assert((await page.locator('.rpg-objective').innerText()).includes('A CITY OF POSSIBILITIES'));
  await page.locator('.rpg-objective').getByRole('button', { name: 'Walk to Dao ↗', exact: true }).click();
  await at({ x: -40, z: 17.5 }); await page.keyboard.press('e');
  for (let i = 0; i < 3; i++) { await reply(); await page.getByRole('button', { name: i < 2 ? /^Continue/ : /Back to the adventure/ }).click(); }
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')).flags.includes('station'));
  assert((await page.locator('.rpg-objective').innerText()).includes('THE LAST FERRY'));
  await journal(); assert.equal(await card('routes').count(), 0); assert.equal(await card('waywarden').count(), 1);
  await page.locator('.quest-completed summary').click(); assert((await page.locator('.quest-completed').innerText()).includes('A City of Possibilities'));
  await mark('track, reload, walk from hotel, English-first conversation, completion and main-story fallback');
  await card('canal').getByRole('button', { name: 'Track this story', exact: true }).click();
  await card('canal').getByRole('button', { name: 'Walk to Canal lantern ↗', exact: true }).click();
  await at({ x: -4, z: 39 }); await page.keyboard.press('e');
  await page.getByRole('button', { name: /^Continue/ }).click();
  await page.getByRole('button', { name: /Accept the errand/ }).click();
  await journal(); assert.equal(await card('canal').getByRole('button', { name: 'Walk to Pim ↗', exact: true }).count(), 1);
  assert.equal(await card('canal').getByRole('button', { name: 'Walk to Arun ↗', exact: true }).count(), 1);
  await card('canal').scrollIntoViewIfNeeded(); await page.screenshot({ path: `${out}/two-destinations.png` });
  await card('canal').getByRole('button', { name: 'Walk to Pim ↗', exact: true }).click(); await at({ x: -25, z: 27 });
  await page.getByRole('button', { name: 'Talk about the canal lantern', exact: true }).click();
  assert((await page.locator('.choice-meaning').first().innerText()).length > 0);
  await page.getByRole('button', { name: 'Leave conversation', exact: true }).click();
  assert(!(await saved()).flags.includes('canal-paper')); await mark('canal acceptance updates both destinations; journal route reaches Pim and cancellation preserves state'); await desktop.close();
  }
  const phone = await open(true); await journal();
  assert(await card('escort').getByRole('button', { name: 'Track this story', exact: true }).isDisabled());
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'Journeys', exact: true }).click();
  await page.getByRole('button', { name: 'Pause mission · return to story', exact: true }).click(); await journal();
  await card('escort').getByRole('button', { name: 'Track this story', exact: true }).click();
  await card('escort').scrollIntoViewIfNeeded(); await page.screenshot({ path: `${out}/phone-journal.png` });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await card('escort').getByRole('button', { name: 'Walk to Nok ↗', exact: true }).click(); await at({ x: -20, z: 18 });
  await page.getByRole('button', { name: /E · Nok/ }).click();
  await page.getByRole('button', { name: /^Continue/ }).click(); await reply();
  await page.getByRole('button', { name: /^Walk with Nok/ }).click();
  assert.equal((await saved()).escort.stage, 'following');
  assert((await page.locator('.rpg-objective').innerText()).includes('Walk to Dao with Nok'));
  await journal(); await card('escort').scrollIntoViewIfNeeded(); await page.screenshot({ path: `${out}/phone-following.png` });
  assert.equal(Object.values(await page.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-training-v1')).records)).reduce((n, r) => n + r.spoken, 0), 0);
  await mark('phone mission priority, pause, quest selection, physical approach and escort objective advancement');
  await phone.close(); assert.deepEqual(errors, []); report.finished = true; await mark('no browser errors');
} catch (error) { report.error = String(error); await writeFile(`${out}/progress.json`, JSON.stringify(report, null, 2)); console.error(await page?.locator('body').innerText().catch(() => '')); await page?.screenshot({ path: `${out}/failure.png` }).catch(() => {}); throw error; }
finally { await browser.close(); }
