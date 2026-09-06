import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshAdventure } from '../src/bangkok/adventure.ts';
import { canalWalk, cityAreas } from '../src/bangkok/city.ts';
const accessOnly = process.argv.includes('--access-only');
const out = 'artifacts/city-connections' + (accessOnly ? '/access' : '');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = { milestones: [], phone: false, reload: false, remount: false, finished: false }, errors = [];
let page;
const checkpoint = () => writeFile(out + '/progress.json', JSON.stringify(report, null, 2));
async function mark(name) { report.milestones.push(name); await checkpoint(); console.log('PASS connection', name); }
async function ready() { await page.waitForFunction(() => document.querySelector('.bk-world')?.getAttribute('data-npc-ready') === '6' && document.querySelector('.bk-world')?.getAttribute('data-city-props') === 'ready' && !document.querySelector('.bk-loading'), null, { timeout: 120000 }); }
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')));
async function at(point) { await page.waitForFunction(point => { const p = JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')).position; return Math.hypot(p.x - point.x, p.z - point.z) < 0.15; }, point, { timeout: 300000 }); }
async function map() { await page.getByRole('button', { name: 'Open town map ↗', exact: true }).click(); }
async function canal() { await map(); await page.getByRole('button', { name: 'Walk to the canal', exact: true }).click(); }
async function district(id) {
  const a = cityAreas.find(a => a.id === id);
  await map(); await page.locator(`.city-map button[data-area="${id}"]`).click();
  await page.getByRole('button', { name: 'Walk to ' + a.name, exact: true }).click(); await at(a.center);
}
async function talk(id, name) {
  await map(); await page.locator(`.city-map button[data-area="${id}"]`).click();
  await page.locator('.city-contacts button').filter({ hasText: name }).click();
  await page.locator('.rpg-dialogue').waitFor({ timeout: 180000 });
  await page.waitForFunction(() => { const cast = JSON.parse(document.querySelector('.bk-world')?.getAttribute('data-conversation-cast') ?? 'null'); return cast && !cast.moving; });
  assert((await page.locator('.choice-meaning').first().innerText()).length > 0);
}
async function open(phone = false) {
  const context = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 900 }, isMobile: phone, hasTouch: phone });
  const save = freshAdventure(); save.flags = ['intro', 'innkeeper', 'station'];
  if (phone) save.position = accessOnly ? { x: -9, z: 13 } : canalWalk;
  await context.addInitScript(s => { if (!localStorage.getItem('bangkok-rift-adventure-v1')) localStorage.setItem('bangkok-rift-adventure-v1', JSON.stringify(s)); }, save);
  page = await context.newPage(); page.setDefaultTimeout(120000); page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:5188/'); await page.getByRole('button', { name: /Continue adventure/ }).click(); await ready();
  return context;
}
try {
  if (!accessOnly) {
  const desktop = await open(); await page.screenshot({ path: out + '/hotel-start.png' });
  await map(); await page.screenshot({ path: out + '/map.png' });
  await page.getByRole('button', { name: 'Walk to the canal', exact: true }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')).position.z >= 37, null, { timeout: 180000 });
  assert((await saved()).position.x < -30, 'Hotel route must enter the new western canal access');
  await page.screenshot({ path: out + '/western-access.png' }); await mark('hotel → western canal access');
  await at(canalWalk); await page.screenshot({ path: out + '/canal.png' }); await mark('canal destination reached');
  const before = await saved(); await page.reload(); await page.getByRole('button', { name: /Continue adventure/ }).click(); await ready(); assert.deepEqual(await saved(), before); report.reload = true;
  await district('oldtown'); await page.screenshot({ path: out + '/oldtown-arrival.png' });
  await talk('oldtown', 'Arun'); await page.screenshot({ path: out + '/artisan-dialogue.png' });
  await page.getByRole('button', { name: 'Leave conversation', exact: true }).click(); await mark('canal → Old Town → Arun');
  await canal(); await at(canalWalk); await talk('lumphini', 'Pim'); await page.screenshot({ path: out + '/park-dialogue.png' });
  await page.getByRole('button', { name: 'Leave conversation', exact: true }).click(); await mark('Old Town → canal → park');
  await district('sukhumvit'); await page.screenshot({ path: out + '/main-road.png' });
  await district('hotel'); assert((await saved()).visited.includes('oldtown')); assert((await saved()).visited.includes('lumphini'));
  await mark('park → main road → hotel'); await desktop.close();
  }
  const phone = await open(true);
  if (accessOnly) {
    await canal();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')).position.z > 26, null, { timeout: 180000 });
    const position = (await saved()).position;
    assert(position.x >= -11 && position.x <= -7, 'Direct access uses the new park-side street');
    await page.screenshot({ path: out + '/phone-side-street.png' });
    await at(canalWalk);
    assert.match(await page.locator('.rpg-location').innerText(), /CANAL WALK/);
    await mark('main road → canal via park-side street');
  }
  await page.screenshot({ path: out + '/phone-canal.png' });
  await map(); assert(await page.getByRole('button', { name: 'Walk to the canal', exact: true }).isVisible());
  await page.screenshot({ path: out + '/phone-map.png' }); await page.keyboard.press('Escape');
  await talk('lumphini', 'Pim'); await page.screenshot({ path: out + '/phone-park-dialogue.png' });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.getByRole('button', { name: 'Leave conversation', exact: true }).click(); report.phone = true;
  const savedPhone = await saved();
  await page.getByRole('button', { name: 'Train at camp', exact: true }).click();
  await page.getByRole('button', { name: /(Begin|Continue) your journey/ }).waitFor(); await page.waitForFunction(() => !document.querySelector('.bk-loading'));
  await page.getByRole('button', { name: /Return to the adventure/ }).click(); await page.getByRole('button', { name: /Continue adventure/ }).click(); await ready();
  assert.deepEqual(await saved(), savedPhone); report.remount = true; await phone.close();
  assert.deepEqual(errors, []); report.finished = true; await mark('phone route and camp return');
} catch (error) { report.error = String(error); report.errors = errors; await checkpoint(); await page?.screenshot({ path: out + '/failure.png' }).catch(() => {}); throw error; }
finally { await browser.close(); }
