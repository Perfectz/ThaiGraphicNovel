import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshAdventure, actors } from '../src/bangkok/adventure.ts';

const out = 'artifacts/city-garden';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = { scenes: [], walks: [], remount: false, finished: false }, errors = [];
let page;
const checkpoint = () => writeFile(out + '/progress.json', JSON.stringify(report, null, 2));
async function ready() {
  await page.waitForFunction(() => document.querySelector('.bk-world')?.getAttribute('data-npc-ready') === '6' && document.querySelector('.bk-world')?.getAttribute('data-city-props') === 'ready' && !document.querySelector('.bk-loading'), null, { timeout: 120000 });
}
async function walk(id, area) {
  await page.getByRole('button', { name: 'Open town map ↗', exact: true }).click();
  await page.locator(`.city-map button[data-area="${area}"]`).click();
  await page.locator('.city-contacts button').filter({ hasText: actors.find(a => a.id === id).name }).click();
  await page.locator('.rpg-dialogue').waitFor({ timeout: 180000 });
  if (id === 'gardener') await page.waitForFunction(() => { const cast = JSON.parse(document.querySelector('.bk-world')?.getAttribute('data-conversation-cast') ?? 'null'); return cast && !cast.moving; });
}
try {
  for (const [id, phone] of [['lake', false], ['station', false], ['artisan', false], ['innkeeper', false], ['waystone', false], ['lake', true]]) {
    const actor = actors.find(a => a.id === id), save = freshAdventure();
    save.flags = id === 'innkeeper' ? ['intro'] : ['intro', 'innkeeper', 'station', 'park-basket'];
    save.position = id === 'lake' ? { x: -21, z: 28 } : { x: actor.x - 1.5, z: actor.z - 0.5 };
    const context = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 900 }, isMobile: phone, hasTouch: phone });
    await context.addInitScript(s => localStorage.setItem('bangkok-rift-adventure-v1', JSON.stringify(s)), save);
    page = await context.newPage(); page.setDefaultTimeout(120000); page.on('pageerror', e => errors.push(e.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto('http://127.0.0.1:5188/'); await page.getByRole('button', { name: /Continue adventure/ }).click(); await ready();
    const name = id + (phone ? '-phone' : '');
    await page.screenshot({ path: `${out}/${name}-explore.png` });
    if (id === 'lake') await walk('gardener', 'lumphini');
    else { await page.keyboard.press('e'); await page.locator('.rpg-dialogue').waitFor(); }
    await page.waitForFunction(() => { const c = JSON.parse(document.querySelector('.bk-world')?.getAttribute('data-conversation-cast') ?? 'null'); return c && !c.moving; });
    assert((await page.locator('.choice-meaning').first().innerText()).length > 0);
    await page.screenshot({ path: `${out}/${name}-dialogue.png` });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const cast = JSON.parse(await page.locator('.bk-world').getAttribute('data-conversation-cast'));
    const dialogue = await page.locator('.rpg-dialogue').boundingBox();
    for (const member of cast.members) {
      assert(member.screenX > 10 && member.screenX < (phone ? 390 : 1280) - 10, name + ' cast horizontal');
      assert(member.screenY > 0 && member.screenY < dialogue.y, name + ' cast above dialogue');
    }
    await page.getByRole('button', { name: 'Leave conversation', exact: true }).click();
    if (id === 'lake') {
      await walk('park-basket', 'lumphini');
      await page.screenshot({ path: `${out}/${name}-basket.png` });
      await page.getByRole('button', { name: 'Leave conversation', exact: true }).click();
      report.walks.push({ phone, route: 'lake → Pim → picnic basket' });
      if (phone) {
        const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')));
        await page.getByRole('button', { name: 'Train at camp', exact: true }).click();
        await page.getByRole('button', { name: /(Begin|Continue) your journey/ }).waitFor();
        await page.waitForFunction(() => !document.querySelector('.bk-loading'));
        await page.getByRole('button', { name: /Return to the adventure/ }).click();
        await page.getByRole('button', { name: /Continue adventure/ }).click(); await ready();
        assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1'))), saved);
        report.remount = true;
      }
    }
    report.scenes.push({ name, drawCalls: Number(await page.locator('.bk-world').getAttribute('data-draw-calls')), triangles: Number(await page.locator('.bk-world').getAttribute('data-triangles')) });
    await checkpoint(); console.log('PASS garden', name); await context.close();
  }
  assert.deepEqual(errors, []); report.finished = true; await checkpoint();
} catch (error) { report.error = String(error); await checkpoint(); await page?.screenshot({ path: out + '/failure.png' }).catch(() => {}); throw error; }
finally { await browser.close(); }
