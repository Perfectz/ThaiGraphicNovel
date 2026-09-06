import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';

const base = process.env.TRAINING_BASE_URL || 'http://127.0.0.1:5188';
const out = 'artifacts/bangkok-verification';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['microphone'] });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
try {
  await page.goto(`${base}/training`); await page.getByRole('button', { name: /Begin your journey/ }).waitFor();
  await page.waitForFunction(() => !document.querySelector('.bk-loading'), { timeout: 30000 });
  await page.screenshot({ path: `${out}/01-title.png` });
  await page.getByRole('button', { name: /Begin your journey/ }).click();
  await page.waitForTimeout(1400); await page.screenshot({ path: `${out}/02-camp.png` });
  const curriculum = await page.evaluate(async () => {
    const m = await import('/src/bangkok/curriculum.ts');
    return { days: m.days, phraseIds: Object.keys(m.phrases), phrases: m.phrases, activities: m.activities };
  });
  assert.equal(curriculum.days.length, 30);
  assert.equal(curriculum.activities.reduce((n, a) => n + a.minutes, 0), 60);
  assert(curriculum.days.every(d => d.phraseIds.length > 0 && d.phraseIds.every(id => curriculum.phrases[id])));
  const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-training-v1')));
  let didReload = false;
  for (let activity = 0; activity < 6; activity++) {
    console.log(`Starting activity ${activity + 1}: ${curriculum.activities[activity].name}`);
    await page.locator('.bk-activity').nth(activity).click();
    let guard = 0;
    while ((await state()).session) {
      if (++guard > 35) throw new Error(`Activity ${activity} did not terminate`);
      const s = (await state()).session;
      console.log(`  phrase ${s.index + 1}/${s.queue.length}: ${s.queue[s.index]}`);
      if (activity === 0 && s.index === 1 && !didReload) {
        await page.reload(); await page.getByRole('button', { name: /Continue your journey/ }).click();
        assert.equal((await state()).session.index, 1); didReload = true;
      }
      if (activity === 2) {
        if (s.index === 0) {
          const wrong = page.locator('.bk-choice-list button').filter({ hasNotText: curriculum.phrases[s.queue[s.index]].targetPhrase }).first();
          await wrong.click(); await page.getByRole('button', { name: 'Use text only this time', exact: true }).click(); assert.equal((await state()).session.index, 0);
          await page.getByText('Su’s hint', { exact: true }).waitFor();
        }
        await page.locator('.bk-choice-list button').filter({ hasText: curriculum.phrases[s.queue[s.index]].targetPhrase }).click();
        await page.getByRole('button', { name: 'Use text only this time', exact: true }).click();
      } else if (activity === 1) {
        await page.getByRole('button', { name: '♫ Listen', exact: true }).click();
        if (s.index === 0) {
          const duration = await page.evaluate(async id => { const a = new Audio(`/bangkok/voices/${id}.mp3`); await new Promise((resolve, reject) => { a.onloadedmetadata = resolve; a.onerror = reject; a.load(); }); return a.duration; }, s.queue[s.index]);
          assert(duration > .3 && Number.isFinite(duration));
        }
        await page.getByRole('button', { name: /I’ve listened & practised/ }).click();
      } else if (activity === 3) {
        await page.getByRole('button', { name: '◉ Record myself', exact: true }).click();
        await page.getByRole('button', { name: '■ Stop recording', exact: true }).waitFor();
        await page.waitForTimeout(500);
        await page.getByRole('button', { name: '■ Stop recording', exact: true }).click();
        await page.getByRole('button', { name: '▷ My recording', exact: true }).waitFor();
        await page.getByRole('button', { name: '▷ My recording', exact: true }).click();
        await page.getByRole('button', { name: /Log speaking practice/ }).click();
      } else {
        await page.getByRole('button', { name: /Reveal & compare/ }).click();
        await page.getByRole('button', { name: s.index === 0 && activity === 5 ? 'Needs more practice' : /I recalled it/ }).click();
      }
      if (activity === 4 && s.index === 0) { await page.waitForTimeout(1000); await page.screenshot({ path: `${out}/03-rift-trial.png` }); }
      await page.getByRole('button', { name: 'Continue →', exact: true }).click();
    }
    await page.getByRole('button', { name: /Return to camp/ }).waitFor();
    if (activity === 5) await page.screenshot({ path: `${out}/04-daily-complete.png` });
    await page.getByRole('button', { name: /Return to camp/ }).click();
    console.log(`Activity ${activity + 1} completed`);
  }
  const result = await state();
  assert.equal(result.completed['1'].length, 6);
  assert(Object.values(result.records).some(r => r.spoken > 0));
  await page.getByRole('button', { name: /Day 1 of 30/ }).click();
  await page.locator('.bk-route-grid button').nth(28).click();
  await page.locator('.bk-activity').nth(2).click();
  await page.waitForTimeout(1200); await page.screenshot({ path: `${out}/05-market.png` });
  await page.getByRole('button', { name: /Save & rest/ }).click();
  await page.getByRole('button', { name: /Phrase journal ·/ }).click();
  await page.getByRole('textbox', { name: 'Search phrases' }).fill('Not spicy');
  assert(await page.locator('.bk-journal-list').innerText().then(t => t.includes('ไม่เผ็ดครับ')));
  await page.keyboard.press('Escape');
  // All recorded references exist and are nonempty, not just the first lesson.
  const rows = JSON.parse(await readFile('public/bangkok/audio/phrases.json', 'utf8'));
  for (const row of rows) { const r = await context.request.get(`${base}/bangkok/voices/${row.id}.mp3`); assert(r.ok(), row.id); assert((await r.body()).length > 1000, row.id); }
  // Phone flow, complete actual button clicks and no horizontal overflow.
  const phoneContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const phone = await phoneContext.newPage(); phone.on('pageerror', e => errors.push(e.message));
  await phone.goto(`${base}/training`); await phone.getByRole('button', { name: /Begin your journey/ }).click();
  await phone.locator('.bk-activity').nth(2).click();
  await phone.waitForTimeout(1800); await phone.screenshot({ path: `${out}/06-phone.png` });
  assert(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await phone.locator('.bk-choice-list button').filter({ hasText: 'สวัสดีครับ' }).click();
  await phone.getByRole('button', { name: 'Use text only this time', exact: true }).click();
  await phone.getByRole('button', { name: 'Continue →', exact: true }).click();
  assert.equal(await phone.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-training-v1')).session.index), 1);
  await phoneContext.close();
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ completedActivities: result.completed['1'], phrasesWithSpeakingPractice: Object.values(result.records).filter(r => r.spoken > 0).length, checkedAudio: rows.length, checkpointReload: didReload, phoneFlow: 'passed', browserErrors: errors, screenshots: out }, null, 2));
} catch (error) {
  await page.screenshot({ path: `${out}/failure.png`, timeout: 10000 }).catch(() => undefined);
  console.error('Failed at', await page.locator('body').innerText({ timeout: 5000 }).catch(() => 'unavailable'));
  throw error;
} finally { await browser.close(); }
