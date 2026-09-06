import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshAdventure } from '../src/bangkok/adventure.ts';
const out = 'artifacts/oldtown-court/escort-recovery'; await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true }); const errors = [];
const report = { recovered: false, following: false, reload: false, finished: false };
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const s = freshAdventure(); s.flags = ['intro', 'innkeeper']; s.position = { x: 24.2, z: 30 };
s.escort = { stage: 'following', position: { x: 24.2, z: 32 } }; s.coins = 81; s.xp = 160;
await context.addInitScript(s => { if (!localStorage.getItem('bangkok-rift-adventure-v1')) localStorage.setItem('bangkok-rift-adventure-v1', JSON.stringify(s)); }, s);
const page = await context.newPage(); page.setDefaultTimeout(60000);
page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')));
try {
  await page.goto('http://127.0.0.1:5188/'); await page.getByRole('button', { name: /Continue adventure/ }).click();
  await page.waitForFunction(() => !document.querySelector('.bk-loading') && JSON.parse(document.querySelector('.bk-world')?.dataset.escort ?? '{}').ready, null, { timeout: 120000 });
  const recovered = await saved(); assert.equal(recovered.escort.stage, 'following');
  assert(recovered.position.x >= 25 && recovered.escort.position.x >= 25); assert.equal(recovered.coins, 81); assert.equal(recovered.xp, 160); report.recovered = true;
  await page.keyboard.down('ArrowRight');
  try { await page.waitForFunction(() => Number(document.querySelector('.bk-world')?.dataset.playerX) >= 27); }
  finally { await page.keyboard.up('ArrowRight'); }
  await page.waitForFunction(before => { const now = JSON.parse(document.querySelector('.bk-world')?.dataset.escort ?? '{}'); return Math.hypot(now.position.x - before.x, now.position.z - before.z) > .25; }, recovered.escort.position);
  await page.getByRole('button', { name: 'Journal', exact: true }).click(); report.following = true;
  const paused = await saved(); assert.equal(paused.escort.stage, 'following');
  await page.reload(); await page.getByRole('button', { name: /Continue adventure/ }).waitFor();
  assert.deepEqual((await saved()).escort, paused.escort); report.reload = true;
  assert.deepEqual(errors, []); report.finished = true; console.log('PASS player and Nok recover locally, escort continues, and reload preserves its progress');
} catch (error) { report.error = String(error); await page.screenshot({ path: `${out}/failure.png` }).catch(() => {}); throw error; }
finally { await writeFile(`${out}/progress.json`, JSON.stringify(report, null, 2)); await browser.close(); }
