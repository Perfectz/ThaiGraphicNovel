import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { actors, freshAdventure, walkable } from '../src/bangkok/adventure.ts';
const out = 'artifacts/close-conversations'; await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = { scenes: [], finished: false }, errors = []; let page;
const checkpoint = () => writeFile(`${out}/progress.json`, JSON.stringify(report, null, 2));
const ready = () => page.waitForFunction(() => document.querySelector('.bk-world')?.dataset.npcReady === '7' && !document.querySelector('.bk-loading'), null, { timeout: 120000 });
const settled = () => page.waitForFunction(() => { const c = JSON.parse(document.querySelector('.bk-world')?.dataset.conversationCast ?? 'null'); return c && !c.moving; });
const read = () => page.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')));
try {
  for (const [id, phone, reduced] of [['artisan', false, false], ['innkeeper', false, false], ['station', false, false], ['gardener', false, false], ['cook', false, false], ['ferry', false, false], ['artisan', true, false], ['innkeeper', true, true]]) {
    const label = id + (phone ? '-phone' : '') + (reduced ? '-reduced' : ''); report.step = label; await checkpoint();
    const actor = actors.find(a => a.id === id), save = freshAdventure();
    save.position = { x: actor.x, z: actor.z }; save.flags = ['intro', ...(id === 'innkeeper' ? [] : ['innkeeper']), ...(id === 'ferry' ? ['cook'] : [])];
    save.visited = ['hotel', 'sukhumvit', 'lumphini', 'yaowarat', 'riverside', 'oldtown'];
    const context = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 900 }, isMobile: phone, hasTouch: phone, reducedMotion: reduced ? 'reduce' : 'no-preference' });
    await context.addInitScript(save => { if (!localStorage.getItem('bangkok-rift-adventure-v1')) localStorage.setItem('bangkok-rift-adventure-v1', JSON.stringify(save)); }, save);
    page = await context.newPage(); page.setDefaultTimeout(60000);
    page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto('http://127.0.0.1:5188/'); await page.getByRole('button', { name: /Continue adventure/ }).click(); await ready();
    await page.keyboard.press('e'); await page.locator('.rpg-dialogue').waitFor(); await settled();
    await page.waitForTimeout(700);
    const cast = JSON.parse(await page.locator('.bk-world').getAttribute('data-conversation-cast'));
    const dialogue = await page.locator('.rpg-dialogue').boundingBox();
    for (let i = 0; i < cast.members.length; i++) {
      const a = cast.members[i]; assert(walkable(a));
      assert(a.screenX > 12 && a.screenX < (phone ? 390 : 1280) - 12 && a.screenY > 0 && a.screenY < dialogue.y);
      for (let j = i + 1; j < cast.members.length; j++) {
        const b = cast.members[j]; assert(Math.hypot(a.x - b.x, a.z - b.z) > 1.05, `${label} world overlap`);
        assert(Math.abs(a.screenX - b.screenX) > (phone ? 20 : 35), `${label} screen overlap`);
      }
    }
    assert(await page.locator('.choice-meaning').count() > 0); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: `${out}/${label}.png` });
    const spaced = await read(); assert(Math.hypot(spaced.position.x - actor.x, spaced.position.z - actor.z) >= 1.35);
    assert.deepEqual({ ...spaced, position: save.position }, save, 'staging changes position only');
    await page.getByRole('button', { name: 'Leave conversation', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.bk-world')?.dataset.conversationCast === 'null');
    assert.deepEqual((await read()).position, spaced.position);
    await page.keyboard.press('e'); await page.locator('.rpg-dialogue').waitFor(); await settled();
    assert.deepEqual((await read()).position, spaced.position, 'reopening from a safe distance does not move the player');
    await page.getByRole('button', { name: 'Leave conversation', exact: true }).click();
    if (phone) {
      await page.reload(); await page.getByRole('button', { name: /Continue adventure/ }).click(); await ready();
      assert.deepEqual(await read(), spaced);
      await page.getByRole('button', { name: 'Train at camp', exact: true }).click();
      await page.getByRole('button', { name: /(Begin|Continue) your journey/ }).waitFor();
      await page.getByRole('button', { name: /Return to the adventure/ }).click();
      await page.getByRole('button', { name: /Continue adventure/ }).click(); await ready();
      assert.deepEqual(await read(), spaced);
    }
    report.scenes.push({ label, position: spaced.position, cast }); await checkpoint(); console.log('PASS', label); await context.close();
  }
  assert.deepEqual(errors, []); report.finished = true; await checkpoint();
} catch (error) { report.error = String(error); await checkpoint(); await page?.screenshot({ path: `${out}/failure.png` }).catch(() => {}); throw error; }
finally { await browser.close(); }
