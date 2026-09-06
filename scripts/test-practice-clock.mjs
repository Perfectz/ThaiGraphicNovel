import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { freshAdventure, flag, startBattle } from '../src/bangkok/adventure.ts';
import { freshTraining, localDate, recordAttempt } from '../src/bangkok/learning.ts';
import { beginJourney } from '../src/bangkok/cityJourneys.ts';
const out = 'artifacts/practice-clock'; await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const errors = [], report = { walking: false, story: false, modal: false, speech: false, camp: false, recall: false, persistence: false, battle: false, journey: false, phone: false, finished: false };
const phoneOnly = process.argv.includes('--phone-only');
if (phoneOnly) Object.assign(report, JSON.parse(await readFile(`${out}/progress.json`, 'utf8')), { battle: false, journey: false, phone: false, finished: false });
let page;
const daily = async () => (await page.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-training-v1')))).dailyPractice[localDate()] ?? { seconds: 0, spoken: 0, recalls: 0 };
const seconds = async () => (await daily()).seconds;
const checkpoint = () => writeFile(`${out}/progress.json`, JSON.stringify(report, null, 2));
async function open(save, phone = false) {
  const context = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 900 }, isMobile: phone, hasTouch: phone, permissions: ['microphone'] });
  const training = recordAttempt(freshTraining(), 'want-this', 'choice', true); training.minutes[localDate()] = 120;
  await context.addInitScript(({ save, training }) => {
    if (!localStorage.getItem('bangkok-rift-adventure-v1')) localStorage.setItem('bangkok-rift-adventure-v1', JSON.stringify(save));
    if (!localStorage.getItem('bangkok-rift-training-v1')) localStorage.setItem('bangkok-rift-training-v1', JSON.stringify(training));
  }, { save, training });
  page = await context.newPage(); page.setDefaultTimeout(45000);
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:5188/'); await page.getByRole('button', { name: /Continue adventure/ }).click();
  await page.waitForFunction(battle => !document.querySelector('.bk-loading') && (battle || document.querySelector('.bk-world')?.dataset.npcReady === '7'), !!save.battle, { timeout: 120000 });
  return context;
}
async function pauses() { const before = await seconds(); await page.waitForTimeout(3300); assert.equal(await seconds(), before); }
async function counts() { const before = await seconds(); await page.waitForTimeout(4200); const delta = await seconds() - before; assert(delta > 0 && delta < 7, `Expected a single active clock, got ${delta}s`); }
try {
  if (!phoneOnly) {
  const s = flag(freshAdventure(), 'intro'); s.position = { x: -39, z: 17.5 };
  const desktop = await open(s);
  await pauses(); await page.keyboard.press('ArrowRight'); await pauses(); report.walking = true;
  await page.keyboard.press('e'); await page.locator('.thai-choice-list').waitFor(); await counts(); report.story = true;
  await page.getByRole('button', { name: 'Journal', exact: true }).click(); await pauses(); report.modal = true;
  await checkpoint(); console.log('PASS exploration, phrase clock and Journal overlay pause');
  await page.keyboard.press('Escape');
  const thai = await page.locator('.rpg-thai').innerText(); await page.locator('.thai-choice-list > button').filter({ hasText: thai }).click();
  assert((await page.locator('.speak-preview h3').innerText()).length > 1);
  await page.getByRole('button', { name: '◉ Record this line', exact: true }).click();
  await page.getByRole('button', { name: '■ Stop recording', exact: true }).waitFor(); await page.waitForTimeout(650);
  await page.getByRole('button', { name: '■ Stop recording', exact: true }).click();
  await page.getByRole('button', { name: '▷ Play my recording', exact: true }).click();
  await page.getByRole('button', { name: 'Use my spoken reply →', exact: true }).click();
  assert.equal((await daily()).spoken, 1); await pauses(); report.speech = true;
  await page.getByRole('button', { name: 'Leave conversation', exact: true }).click();
  await page.getByRole('button', { name: 'Journeys', exact: true }).click();
  await page.locator('.today-practice').getByText('Earlier activity time: 2 minutes.', { exact: false }).waitFor();
  await page.locator('.today-practice').scrollIntoViewIfNeeded(); await page.screenshot({ path: `${out}/desktop-summary.png` });
  await page.keyboard.press('Escape');
  const beforeCamp = await daily(); await page.getByRole('button', { name: 'Train at camp', exact: true }).click();
  await page.getByRole('button', { name: /Continue your journey/ }).click(); await page.waitForFunction(() => !document.querySelector('.bk-loading'));
  await pauses(); assert.deepEqual(await daily(), beforeCamp);
  await page.getByRole('button', { name: /Phrase journal ·/ }).click();
  await page.locator('.today-practice').getByRole('button', { name: /phrases due/ }).click();
  const queue = await page.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-training-v1')).session.queue);
  assert(queue.includes('want-this'), 'City phrases ahead of the camp day must join due review');
  await counts(); report.camp = true;
  await page.getByRole('button', { name: /Reveal & compare/ }).click(); await page.getByRole('button', { name: /I recalled it/ }).click();
  await pauses(); await page.getByRole('button', { name: 'Continue →', exact: true }).click();
  assert.equal((await daily()).recalls, 1); assert.equal((await daily()).spoken, 1); report.recall = true;
  await page.getByRole('button', { name: /Save & rest/ }).click(); await pauses();
  const preserved = await daily();
  await page.getByRole('button', { name: /Return to the adventure/ }).click(); await page.getByRole('button', { name: /Continue adventure/ }).click();
  await page.getByRole('button', { name: 'Journeys', exact: true }).click(); await pauses(); assert.deepEqual(await daily(), preserved);
  await page.reload(); await page.getByRole('button', { name: /Continue adventure/ }).click(); assert.deepEqual(await daily(), preserved); report.persistence = true;
  await checkpoint(); console.log('PASS world, story, modal, recorded reply, camp review, day totals and reload'); await desktop.close();
  }
  let fight = freshAdventure(); for (const f of ['intro', 'innkeeper', 'cook', 'ferry', 'chest', 'murmur']) fight = flag(fight, f); fight = startBattle(fight, 'keeper');
  const phone = await open(fight, true); await pauses();
  await page.getByRole('button', { name: /^✦ Word arts/ }).click(); await pauses();
  await page.locator('.exp-word-grid button').filter({ hasText: 'First Light' }).click(); await page.locator('.exp-target-list button').filter({ hasText: 'Lantern Echo' }).click();
  await counts(); await page.screenshot({ path: `${out}/phone-battle-practice.png` });
  await page.getByRole('button', { name: 'Use text only this time', exact: true }).click();
  await page.getByRole('button', { name: /^✦ Word arts/ }).waitFor(); await pauses(); assert.equal((await daily()).spoken, 0); report.battle = true;
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); report.phone = true;
  await phone.close(); await checkpoint(); console.log('PASS phone battle command pause, speech practice clock and text-only separation');
  const outing = flag(flag(freshAdventure(), 'intro'), 'innkeeper'); outing.position = { x: -48, z: 26.5 };
  outing.journeys = beginJourney(outing.journeys, freshTraining(), localDate()); outing.journeys.active.step = 3;
  const journey = await open(outing, true); await page.keyboard.press('e'); await page.locator('.journey-recall').waitFor();
  await counts(); await page.getByRole('button', { name: 'I said it aloud · compare without a recording', exact: true }).click();
  await page.getByRole('button', { name: 'Needs more practice →', exact: true }).click();
  assert.equal((await daily()).recalls, 1); assert.equal((await daily()).spoken, 0);
  await page.getByRole('button', { name: 'Leave travel conversation', exact: true }).click(); await pauses();
  await page.getByRole('button', { name: 'Journeys', exact: true }).click(); await page.locator('.today-practice').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${out}/phone-summary.png` }); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  report.journey = true; await journey.close(); assert.deepEqual(errors, []); report.finished = true; await checkpoint(); console.log('PASS city recall timing, missed self-check, phone daily summary and no browser errors');
} catch (error) {
  await checkpoint(); await page?.screenshot({ path: `${out}/failure.png` }).catch(() => {}); console.error(await page?.locator('body').innerText().catch(() => '')); throw error;
} finally { await browser.close(); }
