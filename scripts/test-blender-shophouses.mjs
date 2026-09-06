import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshAdventure, walkable } from '../src/bangkok/adventure.ts';
const only = process.argv.find(a => a.startsWith('--only='))?.slice(7);
const out = `artifacts/blender-shophouses/browser${only ? '/' + only : ''}`; await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = { scenes: [], finished: false }, errors = []; let page;
const checkpoint = () => writeFile(`${out}/progress.json`, JSON.stringify(report, null, 2));
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')));
const ready = () => page.waitForFunction(() => {
  const host = document.querySelector('.bk-world');
  const shops = JSON.parse(host?.dataset.cityShophouses ?? '[]');
  return host?.dataset.npcReady === '6' && !document.querySelector('.bk-loading') && shops.length === 14 && shops.every(s => s.state !== 'loading');
}, null, { timeout: 120000 });
try {
  for (const config of [
    { name: 'sukhumvit', position: { x: -40, z: 14 }, actor: 'Dao', quest: 'routes' },
    { name: 'yaowarat', position: { x: 35, z: 14.4 }, actor: 'Uncle Lek', quest: 'ferry' },
    { name: 'yaowarat-phone', position: { x: 35, z: 14.4 }, actor: 'Uncle Lek', quest: 'ferry', phone: true },
    { name: 'fallback', position: { x: 35, z: 14.4 }, actor: 'Uncle Lek', quest: 'ferry', fallback: true },
  ].filter(c => !only || c.name === only)) {
    report.step = config.name; await checkpoint();
    const context = await browser.newContext({ viewport: config.phone ? { width: 390, height: 844 } : { width: 1280, height: 900 }, isMobile: !!config.phone, hasTouch: !!config.phone });
    const s = freshAdventure(); s.flags = ['intro', 'innkeeper']; s.position = config.position; s.trackedQuest = config.quest;
    await context.addInitScript(s => { if (!localStorage.getItem('bangkok-rift-adventure-v1')) localStorage.setItem('bangkok-rift-adventure-v1', JSON.stringify(s)); }, s);
    if (config.fallback) await context.route('**/bangkok/models/*-shophouse.glb', route => route.abort());
    page = await context.newPage(); page.setDefaultTimeout(120000);
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !(config.fallback && m.location().url.includes('-shophouse.glb'))) errors.push(m.text()); });
    await page.goto('http://127.0.0.1:5188/'); await page.getByRole('button', { name: /Continue adventure/ }).click(); await ready();
    const shops = JSON.parse(await page.locator('.bk-world').getAttribute('data-city-shophouses'));
    assert.equal(shops.filter(s => s.style === 'modern').length, 6);
    assert.equal(shops.filter(s => s.style === 'market').length, 8);
    assert(shops.every(s => s.state === (config.fallback ? 'fallback' : 'ready') && s.fallback === !!config.fallback));
    assert(shops.some(s => !s.visible) && shops.some(s => s.visible), 'party cutaways remain active');
    await page.screenshot({ path: `${out}/${config.name}.png` });
    if (config.name === 'sukhumvit') {
      const before = (await saved()).position;
      await page.keyboard.down('ArrowRight'); await page.waitForTimeout(800); await page.keyboard.up('ArrowRight'); await page.waitForTimeout(900);
      const after = (await saved()).position; assert(walkable(after)); assert(Math.hypot(after.x - before.x, after.z - before.z) > .1);
    }
    if (config.name === 'sukhumvit') await page.getByRole('button', { name: `Walk to ${config.actor} ↗`, exact: true }).click();
    await page.getByRole('button', { name: new RegExp(`^E · ${config.actor} ·`) }).waitFor({ timeout: 180000 });
    await page.keyboard.press('e'); await page.locator('.rpg-dialogue').waitFor();
    await page.waitForFunction(() => { const cast = JSON.parse(document.querySelector('.bk-world')?.dataset.conversationCast ?? 'null'); return cast && !cast.moving; });
    assert(await page.locator('.choice-meaning').count() > 0, 'English meaning remains visible before speaking');
    const cast = JSON.parse(await page.locator('.bk-world').getAttribute('data-conversation-cast'));
    const dialogue = await page.locator('.rpg-dialogue').boundingBox();
    for (const member of cast.members) assert(member.screenX > 8 && member.screenX < (config.phone ? 390 : 1280) - 8 && member.screenY < dialogue.y);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: `${out}/${config.name}-conversation.png` });
    await page.getByRole('button', { name: 'Leave conversation', exact: true }).click();
    const before = await saved();
    if (config.phone) {
      await page.getByRole('button', { name: 'Train at camp', exact: true }).click();
      await page.getByRole('button', { name: /(Begin|Continue) your journey/ }).waitFor();
      await page.getByRole('button', { name: /Return to the adventure/ }).click();
      await page.getByRole('button', { name: /Continue adventure/ }).click(); await ready();
      assert.deepEqual(await saved(), before);
      assert(JSON.parse(await page.locator('.bk-world').getAttribute('data-city-shophouses')).every(s => s.state === 'ready' && !s.fallback));
    }
    assert.equal(before.xp, 0); assert.deepEqual(before.flags, ['intro', 'innkeeper']);
    const drawCalls = Number(await page.locator('.bk-world').getAttribute('data-draw-calls'));
    if (config.fallback) assert(drawCalls > 0 && drawCalls < 500, 'fallback facades retain their material batching');
    report.scenes.push({ name: config.name, shops, drawCalls });
    await checkpoint(); console.log('PASS', config.name); await context.close();
  }
  assert.deepEqual(errors, []); report.finished = true; await checkpoint();
} catch (error) {
  report.error = String(error); report.errors = errors; await checkpoint();
  await page?.screenshot({ path: `${out}/failure.png` }).catch(() => {}); throw error;
} finally { await browser.close(); }
