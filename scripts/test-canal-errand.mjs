import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshAdventure } from '../src/bangkok/adventure.ts';
const approachOnly = process.argv.includes('--approach-only');
const out = 'artifacts/canal-errand' + (approachOnly ? '/approach' : ''); await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
let page; const errors = [], report = { accepted: false, paper: false, frame: false, speech: false, restored: false, reload: false, phone: false, finished: false };
const checkpoint = () => writeFile(out + '/progress.json', JSON.stringify(report, null, 2));
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')));
const light = () => page.locator('.bk-world').getAttribute('data-canal-lantern').then(JSON.parse);
async function ready() { await page.waitForFunction(() => document.querySelector('.bk-world')?.getAttribute('data-npc-ready') === '6' && document.querySelector('.bk-world')?.getAttribute('data-city-props') === 'ready' && !document.querySelector('.bk-loading'), null, { timeout: 120000 }); }
async function open(phone = false) {
  const context = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 900 }, isMobile: phone, hasTouch: phone, permissions: ['microphone'] });
  const s = freshAdventure(); s.flags = ['intro', 'innkeeper', 'gardener', 'artisan', ...(phone || approachOnly ? ['canal-accepted', 'canal-frame'] : [])]; s.position = approachOnly ? { x: -9, z: 39 } : phone ? { x: -25, z: 27 } : { x: -5, z: 38 };
  await context.addInitScript(s => { if (!localStorage.getItem('bangkok-rift-adventure-v1')) localStorage.setItem('bangkok-rift-adventure-v1', JSON.stringify(s)); }, s);
  page = await context.newPage(); page.setDefaultTimeout(120000); page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:5188/'); await page.getByRole('button', { name: /Continue adventure/ }).click(); await ready(); return context;
}
async function reply(spoken = false) {
  const thai = await page.locator('.rpg-thai').innerText(), row = page.locator('.thai-choice-list>button').filter({ hasText: thai });
  assert((await row.locator('.choice-meaning').innerText()).length > 1); await row.click();
  if (spoken) {
    await page.getByRole('button', { name: '◉ Record this line', exact: true }).click();
    await page.getByRole('button', { name: '■ Stop recording', exact: true }).waitFor(); await page.waitForTimeout(650);
    await page.getByRole('button', { name: '■ Stop recording', exact: true }).click();
    await page.getByRole('button', { name: '▷ Play my recording', exact: true }).click();
    await page.getByRole('button', { name: 'Use my spoken reply →', exact: true }).click();
  } else await page.getByRole('button', { name: 'Use text only this time', exact: true }).click();
}
async function visit(label) {
  await page.getByRole('button', { name: 'Open town map ↗', exact: true }).click();
  await page.getByRole('button', { name: label, exact: true }).click();
  if (label === 'Visit the canal lantern') await page.getByRole('button', { name: 'E · Canal lantern', exact: true }).waitFor({ timeout: 240000 });
  else await page.getByRole('button', { name: 'Talk about the canal lantern', exact: true }).waitFor({ timeout: 240000 });
}
async function part(kind, spoken = false, suffix = '') {
  await page.getByRole('button', { name: 'Talk about the canal lantern', exact: true }).click();
  await page.waitForFunction(() => { const c = JSON.parse(document.querySelector('.bk-world')?.getAttribute('data-conversation-cast') ?? 'null'); return c && !c.moving; });
  await page.screenshot({ path: `${out}/${kind}${spoken ? '-spoken' : ''}${suffix}.png` });
  await reply(spoken); await page.getByRole('button', { name: /^Continue/ }).click(); await reply();
  await page.getByRole('button', { name: kind === 'paper' ? /Receive the paper shade/ : /Receive the bamboo frame/ }).click();
}
async function restoration() {
  await page.getByRole('button', { name: 'E · Canal lantern', exact: true }).click(); await reply();
  await page.getByRole('button', { name: /^Continue/ }).click();
}
try {
  if (!approachOnly) {
  const desktop = await open(); assert.deepEqual(await light(), { shade: false, intensity: 0 });
  await page.keyboard.press('e'); await page.getByRole('button', { name: /^Continue/ }).click();
  await page.getByRole('button', { name: 'Leave conversation', exact: true }).click(); assert(!(await saved()).flags.includes('canal-accepted'));
  await page.keyboard.press('e'); await page.getByRole('button', { name: /^Continue/ }).click();
  await page.getByRole('button', { name: /Accept the errand/ }).click(); report.accepted = true;
  await visit('Visit Pim for paper'); await part('paper', true);
  assert((await saved()).flags.includes('canal-paper')); assert(!(await saved()).flags.includes('canal-frame'));
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-training-v1')).records['speak-slowly'].spoken), 1);
  report.paper = report.speech = true; await checkpoint(); console.log('PASS errand acceptance, canal-to-Pim walk, recorded reply and paper');
  await page.keyboard.press('e'); await page.getByRole('button', { name: 'Leave local services', exact: true }).waitFor(); await page.getByRole('button', { name: 'Leave local services', exact: true }).click();
  const partial = await saved(); await page.reload(); await page.getByRole('button', { name: /Continue adventure/ }).click(); await ready(); assert.deepEqual(await saved(), partial); assert.equal((await light()).shade, false);
  await visit('Visit Arun for a frame'); await part('frame'); assert((await saved()).flags.includes('canal-frame')); report.frame = true; await checkpoint(); console.log('PASS errand reload, Pim services and walk to Arun');
  await visit('Visit the canal lantern'); await restoration();
  await page.getByRole('button', { name: 'Leave conversation', exact: true }).click(); assert.equal((await light()).shade, false); assert(!(await saved()).flags.includes('canal-restored'));
  await restoration(); const before = await saved(); await page.getByRole('button', { name: /Restore the canal lantern/ }).click();
  await page.waitForFunction(() => JSON.parse(document.querySelector('.bk-world').getAttribute('data-canal-lantern')).shade);
  const after = await saved(); assert.equal(after.xp, before.xp + 80); assert.equal(after.coins, before.coins + 25); assert.equal(after.rice, before.rice + 1); assert.equal(after.tea, before.tea + 1); assert.equal((await light()).intensity, 7);
  await page.screenshot({ path: out + '/restored.png' }); report.restored = true;
  await page.reload(); await page.getByRole('button', { name: /Continue adventure/ }).click(); await ready(); assert.deepEqual(await saved(), after); assert.equal((await light()).shade, true);
  await page.keyboard.press('e'); await page.getByRole('button', { name: /Back to the adventure/ }).click(); assert.deepEqual(await saved(), after); report.reload = true;
  await page.getByRole('button', { name: 'Journal', exact: true }).click(); assert.match(await page.locator('.rpg-modal').innerText(), /A Light for Late Walkers/); await page.screenshot({ path: out + '/journal.png' }); await desktop.close(); await checkpoint(); console.log('PASS errand return, cancellation, light, exact reward and no-farm reload');
  }
  for (const isPhone of (approachOnly ? [false, true] : [true])) {
  const phone = await open(isPhone), label = isPhone ? 'phone' : 'desktop';
  if (approachOnly) {
    await visit('Visit Pim for paper');
    await page.waitForFunction(() => { const p = JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')).position; return Math.hypot(p.x + 25, p.z - 27) < 0.1; });
    await page.screenshot({ path: `${out}/${label}-approach.png` });
  }
  await part('paper', false, '-' + label); assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-training-v1')).records['speak-slowly'].spoken), 0);
  await visit('Visit the canal lantern'); await page.screenshot({ path: `${out}/${label}-dark.png` });
  await restoration(); await page.getByRole('button', { name: /Restore the canal lantern/ }).click();
  await page.waitForFunction(() => JSON.parse(document.querySelector('.bk-world').getAttribute('data-canal-lantern')).shade);
  await page.screenshot({ path: `${out}/${label}-restored.png` }); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); report.phone = true;
  await phone.close(); console.log('PASS canal approach and restoration', label);
  }
  assert.deepEqual(errors, []); report.finished = true; await checkpoint(); console.log('PASS complete canal errand verification');
} catch (error) { report.error = String(error); report.errors = errors; await checkpoint(); await page?.screenshot({ path: out + '/failure.png' }).catch(() => {}); throw error; }
finally { await browser.close(); }
