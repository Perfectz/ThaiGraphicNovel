import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshAdventure } from '../src/bangkok/adventure.ts';
const out = 'artifacts/station-escort'; await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
let page; const errors = [], report = { accepted: false, walked: false, reload: false, battlePause: false, speech: false, rewarded: false, repeat: false, phone: false, finished: false };
const checkpoint = () => writeFile(`${out}/progress.json`, JSON.stringify(report, null, 2));
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')));
const ready = () => page.waitForFunction(() => !document.querySelector('.bk-loading') && JSON.parse(document.querySelector('.bk-world')?.dataset.escort ?? '{}').ready, null, { timeout: 120000 });
async function open(phone = false) {
  const c = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 900 }, isMobile: phone, hasTouch: phone, permissions: ['microphone'] });
  const s = freshAdventure(); s.flags = ['intro', 'innkeeper', 'station']; s.visited = ['hotel', 'sukhumvit', 'lumphini']; s.position = phone ? { x: -39.5, z: 17 } : { x: -19, z: 17.5 };
  if (phone) s.escort = { stage: 'arrived', position: { x: -41.5, z: 17 } };
  await c.addInitScript(s => { if (!localStorage.getItem('bangkok-rift-adventure-v1')) localStorage.setItem('bangkok-rift-adventure-v1', JSON.stringify(s)); }, s);
  page = await c.newPage(); page.setDefaultTimeout(45000); page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:5188/'); await page.getByRole('button', { name: /Continue adventure/ }).click(); await ready(); return c;
}
async function reply(spoken = false) {
  const thai = await page.locator('.rpg-thai').innerText(); const choice = page.locator('.thai-choice-list > button').filter({ hasText: thai });
  assert((await choice.locator('.choice-meaning').innerText()).length > 1); await choice.click();
  if (spoken) {
    await page.getByRole('button', { name: '♫ Hear this line', exact: true }).click();
    await page.getByRole('button', { name: '◉ Record this line', exact: true }).click();
    await page.getByRole('button', { name: '■ Stop recording', exact: true }).waitFor(); await page.waitForTimeout(650);
    await page.getByRole('button', { name: '■ Stop recording', exact: true }).click();
    await page.getByRole('button', { name: '▷ Play my recording', exact: true }).click();
    await page.getByRole('button', { name: 'Use my spoken reply →', exact: true }).click();
  } else await page.getByRole('button', { name: 'Use text only this time', exact: true }).click();
}
async function route(checkPass = true) {
  await page.getByRole('button', { name: 'Open town map ↗', exact: true }).click();
  if (checkPass) assert(await page.getByRole('button', { name: /Use city pass/ }).isDisabled());
  await page.getByRole('button', { name: 'Walk together to Dao', exact: true }).click();
}
async function arrival() {
  await page.getByRole('button', { name: 'Ask Dao about Nok’s route', exact: true }).click();
  await reply(); await page.getByRole('button', { name: /^Continue/ }).click();
  await reply(); await page.getByRole('button', { name: /^Continue/ }).click();
}
try {
  const desktop = await open(); await page.keyboard.press('e'); await page.getByRole('button', { name: /^Continue/ }).click();
  await page.getByRole('button', { name: 'Leave conversation', exact: true }).click(); assert.equal((await saved()).escort.stage, 'waiting');
  await page.keyboard.press('e'); await page.getByRole('button', { name: /^Continue/ }).click();
  await page.screenshot({ path: `${out}/invitation.png` }); await reply(true);
  assert.equal((await saved()).escort.stage, 'waiting'); await page.getByRole('button', { name: /Walk with Nok/ }).click(); assert.equal((await saved()).escort.stage, 'following'); report.accepted = true;
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-training-v1')).records['go-together'].spoken), 1); report.speech = true;
  await page.getByRole('button',{name:'Party growth',exact:true}).click();await page.getByRole('button', { name: 'Battle practice', exact: true }).click(); await page.getByRole('button', { name: 'Retreat', exact: true }).waitFor();
  const frozen = (await saved()).escort; await page.waitForTimeout(1600); assert.deepEqual((await saved()).escort, frozen);
  await page.getByRole('button', { name: 'Retreat', exact: true }).click(); report.battlePause = true;
  await route(); await page.waitForFunction(() => JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')).escort.position.x < -24, null, { timeout: 180000 });
  await page.screenshot({ path: `${out}/walking.png` });
  await page.getByRole('button', { name: 'Journal', exact: true }).click();
  const partial = (await saved()).escort; await page.waitForTimeout(1600); assert.deepEqual((await saved()).escort, partial);
  await page.reload(); await page.getByRole('button', { name: /Continue adventure/ }).waitFor(); assert.deepEqual((await saved()).escort, partial); report.reload = true;
  await page.getByRole('button', { name: /Continue adventure/ }).click(); await ready();
  await route(false); await page.waitForFunction(() => JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')).escort.stage === 'arrived', null, { timeout: 180000 }); report.walked = true;
  await page.screenshot({ path: `${out}/station-arrival.png` }); await arrival();
  await page.getByRole('button', { name: 'Leave conversation', exact: true }).click(); assert.equal((await saved()).escort.stage, 'arrived');
  await arrival(); const before = await saved(); await page.getByRole('button', { name: /Complete the escort/ }).click(); const after = await saved();
  assert.equal(after.xp, before.xp + 70); assert.equal(after.coins, before.coins + 20); assert.equal(after.tea, before.tea + 1); assert.equal(after.escort.stage, 'complete'); report.rewarded = true;
  await page.reload(); await page.getByRole('button', { name: /Continue adventure/ }).click(); await ready(); assert.equal((await saved()).escort.stage, 'complete');
  await page.getByRole('button', { name: 'Open town map ↗', exact: true }).click(); await page.getByRole('button', { name: 'Visit Nok at the station', exact: true }).click();
  await page.getByRole('button', { name: 'E · Nok · fellow traveller', exact: true }).waitFor(); await page.keyboard.press('e'); await page.getByRole('button', { name: /Back to the adventure/ }).click();
  assert.equal((await saved()).coins, after.coins); assert.equal((await saved()).xp, after.xp); report.repeat = true; await checkpoint(); console.log('PASS full escort, recording, route, reload, battle pause, arrival cancellation, reward and repeat visit'); await desktop.close();
  const phone = await open(true); await arrival(); await page.screenshot({ path: `${out}/phone-completion.png` });
  await page.getByRole('button', { name: /Complete the escort/ }).click(); assert.equal((await saved()).escort.stage, 'complete');
  assert.equal(await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('bangkok-rift-training-v1')).records).reduce((n, r) => n + r.spoken, 0)), 0);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); report.phone = true; await phone.close();
  assert.deepEqual(errors, []); report.finished = true; await checkpoint(); console.log('PASS phone completion, text/speech separation and no browser errors');
} catch (error) { report.error = String(error); await checkpoint(); console.error(await page?.locator('body').innerText().catch(() => '')); await page?.screenshot({ path: `${out}/failure.png` }).catch(() => {}); throw error; }
finally { await browser.close(); }
