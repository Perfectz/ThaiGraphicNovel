import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { freshTraining } from '../src/bangkok/learning.ts';

const base = process.env.TRAINING_BASE_URL || 'http://127.0.0.1:5188';
const browser = await chromium.launch({ headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const errors = [];
let latestPage;
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['microphone'] });
  const page = await context.newPage(); latestPage = page; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/training`);
  await page.getByRole('button', { name: /Begin your journey/ }).click();
  await page.locator('.bk-activity').nth(3).click();
  await page.getByRole('button', { name: /Practise with choices instead/ }).click();
  await page.locator('.bk-choice-list button').first().waitFor();
  await page.getByRole('button', { name: /Use my microphone/ }).click();
  await page.getByRole('button', { name: '◉ Record myself', exact: true }).click();
  await page.getByRole('button', { name: '■ Stop recording', exact: true }).waitFor();
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: '■ Stop recording', exact: true }).click();
  await page.getByRole('button', { name: '▷ My recording', exact: true }).click();
  await page.getByRole('button', { name: /Log speaking practice/ }).click();
  await page.getByRole('button', { name: 'Continue →', exact: true }).click();
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-training-v1')).records.hello.spoken), 1);
  // Fixture models returning to camp on an already completed day.
  const completed = freshTraining(); completed.completed['1'] = [0, 1, 2, 3, 4, 5]; completed.xp = 100;
  await page.addInitScript(s => localStorage.setItem('bangkok-rift-training-v1', JSON.stringify(s)), completed);
  await page.reload(); await page.getByRole('button', { name: /Continue your journey/ }).click();
  await page.getByRole('button', { name: /Continue to day 2/ }).click();
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-training-v1')).day), 2);
  await page.waitForFunction(() => Number(document.querySelector('.bk-world')?.dataset.frameMs) > 0);
  console.log('Render sample:', await page.locator('.bk-world').evaluate(el => ({ ...el.dataset })));
  await page.screenshot({ path: 'artifacts/bangkok-verification/07-final-camp.png' });
  await context.close();

  const phoneContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  // Explicit permission-denial injection tests recovery deterministically.
  await phoneContext.addInitScript(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Permission denied', 'NotAllowedError'); }; });
  const phone = await phoneContext.newPage(); latestPage = phone; phone.on('pageerror', e => errors.push(e.message));
  await phone.goto(`${base}/training`); await phone.getByRole('button', { name: /Begin your journey/ }).click();
  await phone.locator('.bk-activity').nth(3).click();
  await phone.getByRole('button', { name: '◉ Record myself', exact: true }).click();
  await phone.getByText(/Microphone unavailable or permission denied/).waitFor();
  await phone.getByRole('button', { name: /Practise with choices instead/ }).click();
  await phone.locator('.bk-choice-list button').filter({ hasText: 'สวัสดีครับ' }).click();
  await phone.getByRole('button', { name: 'Use text only this time', exact: true }).click();
  await phone.getByRole('button', { name: 'Continue →', exact: true }).click();
  assert.equal(await phone.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-training-v1')).records.hello.spoken), 0);
  await phone.waitForFunction(() => !document.querySelector('.bk-loading'));
  await phone.waitForTimeout(2000);
  await phone.screenshot({ path: 'artifacts/bangkok-verification/08-final-phone.png' });
  assert(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await phoneContext.close();
  assert.deepEqual(errors, []);
  console.log('PASS: microphone round-trip, choice/mic switching, next-day camp, denied-mic recovery, phone layout, no browser errors.');
} catch (error) {
  console.error(await latestPage?.locator('body').innerText().catch(() => 'Page unavailable'));
  throw error;
} finally { await browser.close(); }
