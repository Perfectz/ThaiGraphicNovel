import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshAdventure } from '../src/bangkok/adventure.ts';
const only = process.argv.find(a => a.startsWith('--only='))?.split('=')[1];
const out = `artifacts/evening-outing${only ? '/' + only : ''}`; await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const report = { scenes: [], finished: false }, errors = []; let page;
const checkpoint = () => writeFile(`${out}/progress.json`, JSON.stringify(report, null, 2));
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')));
const training = () => page.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-training-v1')));
const ready = () => page.waitForFunction(() => document.querySelector('.bk-world')?.dataset.npcReady === '7' && !document.querySelector('.bk-loading'), null, { timeout: 120000 });
async function reply(meaning, spoken = false) {
  const row = page.locator('.thai-choice-list > button').filter({ has: page.locator('.choice-meaning', { hasText: meaning }) });
  assert((await row.locator('.choice-meaning').innerText()).length > 0); await row.click();
  await page.getByRole('heading', { name: meaning, exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Use my spoken reply →', exact: true }).isDisabled(), true);
  if (spoken) {
    await page.getByRole('button', { name: '♫ Hear this line', exact: true }).click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: '◉ Record this line', exact: true }).click();
    await page.getByRole('button', { name: '■ Stop recording', exact: true }).waitFor(); await page.waitForTimeout(700);
    await page.getByRole('button', { name: '■ Stop recording', exact: true }).click();
    await page.getByRole('button', { name: '▷ Play my recording', exact: true }).click();
    await page.getByRole('button', { name: 'Use my spoken reply →', exact: true }).click();
  } else await page.getByRole('button', { name: 'Use text only this time', exact: true }).click();
}
async function capture(label) {
  await page.waitForFunction(() => { const c = JSON.parse(document.querySelector('.bk-world')?.dataset.conversationCast ?? 'null'); return c && !c.moving; });
  await page.waitForTimeout(500);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: `${out}/${label}.png` });
}
try {
  for (const config of [
    { name: 'market', route: 'food', order: 'little-spicy', meaning: 'A little spicy', phone: false, travel: true, spoken: true },
    { name: 'park-phone', route: 'park', order: 'evening-water', meaning: 'Water, please', phone: true, travel: true },
    { name: 'mild', route: 'food', order: 'evening-mild', meaning: 'Not spicy, please', phone: false },
    { name: 'tea', route: 'park', order: 'evening-tea', meaning: 'I will take this one', phone: false },
  ].filter(c => !only || c.name === only)) {
    report.step = config.name; await checkpoint();
    const s = freshAdventure(); s.flags = ['intro','innkeeper']; s.position = { x: -48, z: 26.5 };
    if (!config.travel) { s.flags.push(`evening-${config.route}`); s.trackedQuest = 'evening'; s.position = config.route === 'food' ? { x: 34, z: 16.5 } : { x: -25, z: 27 }; }
    const context = await browser.newContext({ viewport: config.phone ? { width: 390, height: 844 } : { width: 1280, height: 900 }, isMobile: !!config.phone, hasTouch: !!config.phone, permissions: ['microphone'] });
    await context.addInitScript(s => { if (!localStorage.getItem('bangkok-rift-adventure-v1')) localStorage.setItem('bangkok-rift-adventure-v1', JSON.stringify(s)); }, s);
    page = await context.newPage(); page.setDefaultTimeout(120000);
    page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto('http://127.0.0.1:5188/'); await page.getByRole('button', { name: /Continue adventure/ }).click(); await ready();
    if (config.travel) {
      await page.getByRole('button', { name: 'Plan an evening with Su', exact: true }).click();
      await capture(`${config.name}-plan`);
      const meaning = config.route === 'food' ? 'I like Thai food' : 'I am thirsty';
      await reply(meaning); await page.getByRole('button', { name: 'Leave evening conversation', exact: true }).click();
      assert(!(await saved()).flags.some(f => f.startsWith('evening-')), 'cancelled preview must not pick a route');
      await page.getByRole('button', { name: 'Plan an evening with Su', exact: true }).click();
      await reply(meaning, !!config.spoken);
      const beforePlan = await saved();
      await page.getByRole('button', { name: `Make a plan for ${config.route === 'food' ? 'Yaowarat' : 'Lumphini'}`, exact: true }).click();
      assert((await saved()).flags.includes(`evening-${config.route}`));
      assert.deepEqual((await saved()).position, beforePlan.position, 'planning keeps you at the hotel');
      const partial = await saved(); await page.reload(); await page.getByRole('button', { name: /Continue adventure/ }).click(); await ready(); assert.deepEqual(await saved(), partial);
      report.step = config.name + ': walking'; await checkpoint();
      await page.getByRole('button', { name: `Walk to ${config.route === 'food' ? 'Uncle Lek' : 'Pim'} ↗`, exact: true }).click();
      await page.getByRole('button', { name: 'Continue our evening', exact: true }).waitFor({ timeout: 300000 });
    }
    report.step = config.name + ': ordering'; await checkpoint();
    await page.getByRole('button', { name: 'Continue our evening', exact: true }).click(); await capture(`${config.name}-order`);
    await reply(config.meaning); await page.getByRole('button', { name: 'Confirm my order', exact: true }).click();
    assert((await saved()).flags.includes(config.order === 'little-spicy' ? 'evening-chilli' : config.order));
    await capture(`${config.name}-moment`);
    await page.getByRole('button', { name: 'Leave evening conversation', exact: true }).click();
    report.step = config.name + ': reload order'; await checkpoint();
    const ordered = await saved(); assert(!ordered.flags.includes('evening-complete')); assert.equal(ordered.rice, 1); assert.equal(ordered.tea, 1);
    await page.reload(); await page.getByRole('button', { name: /Continue adventure/ }).click(); await ready(); assert.deepEqual(await saved(), ordered);
    await page.keyboard.press('e'); await page.getByRole('region', { name: 'An Evening of Our Own', exact: true }).waitFor();
    await reply(config.route === 'food' ? 'Very delicious' : 'Thank you');
    const before = await saved(); await page.getByRole('button', { name: 'Keep this evening in our journal', exact: true }).click();
    const after = await saved(); assert(after.flags.includes('evening-complete')); assert.equal(after.xp, before.xp + 60);
    assert.equal(after.rice, before.rice + (config.route === 'food' ? 2 : 0)); assert.equal(after.tea, before.tea + (config.route === 'park' ? 2 : 0)); assert.equal(after.coins, before.coins);
    const records = (await training()).records;
    assert.equal(Object.values(records).reduce((n,r) => n + r.spoken, 0), config.spoken ? 1 : 0);
    await page.getByRole('button', { name: 'Journal', exact: true }).click(); await page.locator('.quest-completed > summary').click();
    assert((await page.locator('[data-quest="evening"]').innerText()).includes(config.route === 'food' ? 'Yaowarat' : 'Lumphini'));
    await page.screenshot({ path: `${out}/${config.name}-memory.png` });
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    if (config.phone) {
      await page.getByRole('button', { name: 'Train at camp', exact: true }).click();
      await page.getByRole('button', { name: /(Begin|Continue) your journey/ }).waitFor();
      await page.getByRole('button', { name: /Return to the adventure/ }).click();
      await page.getByRole('button', { name: /Continue adventure/ }).click(); await ready();
      assert.deepEqual(await saved(), after);
    }
    report.scenes.push({ name: config.name, flags: after.flags, spoken: !!config.spoken }); await checkpoint(); console.log('PASS', config.name); await context.close();
  }
  assert.deepEqual(errors, []); report.finished = true; await checkpoint();
} catch (error) { report.error = String(error); report.errors = errors; await checkpoint(); await page?.screenshot({ path: `${out}/failure.png` }).catch(() => {}); throw error; }
finally { await browser.close(); }
