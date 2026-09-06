import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { freshAdventure } from '../src/bangkok/adventure.ts';
const out = 'artifacts/city-ground-light'; await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = { scenes: [], remount: false, finished: false }, errors = []; let page;
const checkpoint = () => writeFile(`${out}/progress.json`, JSON.stringify(report, null, 2));
try {
  for (const [name, position, phone] of [
    ['sukhumvit', { x: -39, z: 17.5 }, false], ['canal', { x: -9, z: 39 }, false],
    ['hotel', { x: -57, z: 29 }, false], ['park', { x: -21, z: 28 }, false],
    ['yaowarat', { x: 34, z: 16 }, false], ['oldtown-phone', { x: 30, z: 29 }, true],
  ]) {
    const context = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 900 }, isMobile: phone, hasTouch: phone });
    const save = freshAdventure(); save.flags = ['intro', 'innkeeper']; save.position = position;
    await context.addInitScript(save => { if (!localStorage.getItem('bangkok-rift-adventure-v1')) localStorage.setItem('bangkok-rift-adventure-v1', JSON.stringify(save)); }, save);
    page = await context.newPage(); page.setDefaultTimeout(45000);
    page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto('http://127.0.0.1:5188/'); await page.getByRole('button', { name: /Continue adventure/ }).click();
    await page.waitForFunction(() => !document.querySelector('.bk-loading') && document.querySelector('.bk-world')?.dataset.cityProps === 'ready' && document.querySelector('.bk-world')?.dataset.npcReady === '6', null, { timeout: 120000 });
    await page.waitForTimeout(1800);
    const detail = JSON.parse(await page.locator('.bk-world').getAttribute('data-ground-light'));
    assert(detail.patches > 70 && detail.visible > 0 && detail.batches <= 12);
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')).position);
    await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(500); await page.keyboard.up('ArrowLeft');
    await page.waitForFunction(before => { const p = JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')).position; return Math.hypot(p.x - before.x, p.z - before.z) > .1; }, before);
    await page.screenshot({ path: `${out}/${name}.png` });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    if (phone) {
      await page.keyboard.press('e'); await page.locator('.rpg-dialogue').waitFor(); assert(await page.locator('.choice-meaning').count() > 0);
      await page.screenshot({ path: `${out}/phone-conversation.png` }); await page.getByRole('button', { name: 'Leave conversation', exact: true }).click();
      const beforeCamp = await page.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')));
      await page.getByRole('button', { name: 'Train at camp', exact: true }).click(); await page.getByRole('button', { name: /(Begin|Continue) your journey/ }).waitFor();
      await page.waitForFunction(() => !document.querySelector('.bk-loading'));
      await page.getByRole('button', { name: /Return to the adventure/ }).click(); await page.getByRole('button', { name: /Continue adventure/ }).click();
      await page.waitForFunction(() => !!document.querySelector('.bk-world')?.dataset.groundLight && !document.querySelector('.bk-loading'));
      assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1'))), beforeCamp); report.remount = true;
    }
    report.scenes.push({ name, ...detail }); await checkpoint(); console.log('PASS', name, detail); await context.close();
  }
  assert.deepEqual(errors, []); report.finished = true; await checkpoint();
} catch (error) { report.error = String(error); await checkpoint(); await page?.screenshot({ path: `${out}/failure.png` }).catch(() => {}); throw error; }
finally { await browser.close(); }
