import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { freshAdventure } from '../src/bangkok/adventure.ts';
const backdrop = process.argv.includes('--backdrop');
const wayfinding = process.argv.includes('--wayfinding');
const recheck = process.argv.includes('--mounted-recheck');
const out = recheck ? 'artifacts/city-wayfinding/recheck' : wayfinding ? 'artifacts/city-wayfinding' : backdrop ? 'artifacts/city-backdrop' : 'artifacts/district-facades'; await mkdir(out, { recursive: true });
const only = process.argv.find(arg => arg.startsWith('--only='))?.slice(7);
const browser = await chromium.launch({ headless: true });
const report = { scenes: [], remount: false, finished: false }, errors = []; let page;
const checkpoint = () => writeFile(`${out}/progress.json`, JSON.stringify(report, null, 2));
const ready = () => page.waitForFunction(() => !document.querySelector('.bk-loading') && document.querySelector('.bk-world')?.dataset.cityProps === 'ready' && document.querySelector('.bk-world')?.dataset.npcReady === '7', null, { timeout: 120000 });
try {
  for (const [name, position, phone, conversation] of [
    ...(backdrop ? [['hotel', { x: -57, z: 29 }, false, false], ['river', { x: 1, z: -2 }, false, false]] : []),
    ['sukhumvit', { x: -39, z: 17.5 }, false, true],
    ...(wayfinding ? [['park-sign', { x: -24, z: 25 }, false, true], ['canal-signs', { x: -19, z: 38 }, false, false], ['court-gate', { x: 31.5, z: 38.5 }, false, false], ['artisan-sign', { x: 29, z: 29 }, false, true]] : []),
    ['yaowarat', { x: 34, z: 16 }, false, true],
    ['canal-timber', { x: 8, z: 39 }, false, false],
    ['oldtown-gables', { x: 43, z: 38.4 }, false, false],
    ['yaowarat-phone', { x: 34, z: 16 }, true, true],
  ].filter(([name]) => (!only || name.includes(only)) && (!recheck || ['sukhumvit', 'park-sign', 'court-gate', 'artisan-sign'].includes(name)))) {
    const context = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 900 }, isMobile: phone, hasTouch: phone });
    const save = freshAdventure(); save.flags = ['intro', 'innkeeper']; save.position = position;
    await context.addInitScript(save => { if (!localStorage.getItem('bangkok-rift-adventure-v1')) localStorage.setItem('bangkok-rift-adventure-v1', JSON.stringify(save)); }, save);
    page = await context.newPage(); page.setDefaultTimeout(45000);
    page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto('http://127.0.0.1:5188/'); await page.getByRole('button', { name: /Continue adventure/ }).click(); await ready();
    await page.waitForTimeout(1800);
    const profiles = JSON.parse(await page.locator('.bk-world').getAttribute('data-city-architecture'));
    assert(profiles.modern >= 6 && profiles.market >= 8 && profiles.timber >= 3);
    if (wayfinding) {
      const signs = JSON.parse(await page.locator('.bk-world').getAttribute('data-city-wayfinding'));
      assert.equal(signs.signs, 10); assert(signs.rearFacades >= 20);
      for (const mount of signs.mounts) {
        if (mount.supportVisible === false) assert(!mount.visible);
        if (['coffee', 'chinatown'].includes(mount.id)) assert.equal(typeof mount.supportVisible, 'boolean');
      }
    }
    const skyline = backdrop ? JSON.parse(await page.locator('.bk-world').getAttribute('data-city-backdrop')) : null;
    if (backdrop) { assert.equal(skyline.buildings, 20); assert(skyline.visible.length > 0); }
    await page.screenshot({ path: `${out}/${name}.png` });
    if (conversation) {
      await page.keyboard.press('e'); await page.locator('.rpg-dialogue').waitFor();
      await page.waitForFunction(() => { const cast = JSON.parse(document.querySelector('.bk-world')?.dataset.conversationCast ?? 'null'); return cast && !cast.moving; });
      assert(await page.locator('.choice-meaning').count() > 0);
      await page.screenshot({ path: `${out}/${name}-conversation.png` });
      const cast = JSON.parse(await page.locator('.bk-world').getAttribute('data-conversation-cast')), dialogue = await page.locator('.rpg-dialogue').boundingBox();
      for (const member of cast.members) assert(member.screenX > 10 && member.screenX < (phone ? 390 : 1280) - 10 && member.screenY < dialogue.y);
      await page.getByRole('button', { name: 'Leave conversation', exact: true }).click();
    }
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')).position);
    await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(500); await page.keyboard.up('ArrowLeft');
    await page.waitForFunction(before => { const p = JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')).position; return Math.hypot(p.x - before.x, p.z - before.z) > .1; }, before);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    if (phone) {
      // Position checkpoints arrive periodically; compare the settled save, not an earlier movement report.
      await page.waitForFunction(() => {
        const current = JSON.stringify(JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')).position);
        const previous = window.__facadePosition;
        window.__facadePosition = current;
        return previous === current;
      }, null, { polling: 900 });
      const beforeCamp = await page.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')));
      await page.getByRole('button', { name: 'Train at camp', exact: true }).click(); await page.getByRole('button', { name: /(Begin|Continue) your journey/ }).waitFor();
      await page.waitForFunction(() => !document.querySelector('.bk-loading'));
      await page.getByRole('button', { name: /Return to the adventure/ }).click(); await page.getByRole('button', { name: /Continue adventure/ }).click(); await ready();
      assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1'))), beforeCamp); report.remount = true;
    }
    report.scenes.push({ name, profiles, ...(skyline ? { skyline } : {}) }); await checkpoint(); console.log('PASS', name); await context.close();
  }
  assert.deepEqual(errors, []); report.finished = true; await checkpoint();
} catch (error) { report.error = String(error); await checkpoint(); await page?.screenshot({ path: `${out}/failure.png` }).catch(() => {}); throw error; }
finally { await browser.close(); }
