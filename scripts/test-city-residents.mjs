import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshAdventure } from '../src/bangkok/adventure.ts';
const only = process.argv.find(arg => arg.startsWith('--only='))?.slice(7);
const out = only ? `artifacts/city-residents/${only}-recheck` : 'artifacts/city-residents'; await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = { scenes: [], finished: false }, errors = []; let page;
const checkpoint = () => writeFile(`${out}/progress.json`, JSON.stringify(report, null, 2));
const residents = () => page.evaluate(() => JSON.parse(document.querySelector('.bk-world').dataset.cityResidents));
const ready = () => page.waitForFunction(() => !document.querySelector('.bk-loading') && document.querySelector('.bk-world')?.dataset.npcReady === '7' && JSON.parse(document.querySelector('.bk-world')?.dataset.cityResidents ?? '[]').filter(r => r.ready).length === 6, null, { timeout: 120000 });
try {
  for (const [name, position, phone, reduced] of [
    ['sukhumvit', { x: -39, z: 17.5 }, false, false],
    ['yaowarat', { x: 34, z: 16 }, false, false],
    ['lumphini', { x: -24, z: 25 }, false, false],
    ['oldtown', { x: 29, z: 29 }, false, false],
    ['phone-market', { x: 34, z: 16 }, true, false],
    ['reduced-market', { x: 34, z: 16 }, false, true],
  ].filter(([name]) => !only || name === only)) {
    report.step = name; await checkpoint();
    const context = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 900 }, isMobile: phone, hasTouch: phone, reducedMotion: reduced ? 'reduce' : 'no-preference' });
    const save = freshAdventure(); save.flags = ['intro', 'innkeeper']; save.position = position;
    await context.addInitScript(save => { if (!localStorage.getItem('bangkok-rift-adventure-v1')) localStorage.setItem('bangkok-rift-adventure-v1', JSON.stringify(save)); }, save);
    page = await context.newPage(); page.setDefaultTimeout(60000);
    page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto('http://127.0.0.1:5188/'); await page.getByRole('button', { name: /Continue adventure/ }).click(); await ready();
    const initial = await residents(); assert(initial.some(r => r.visible));
    if (!reduced) await page.waitForFunction(initial => {
      const current = JSON.parse(document.querySelector('.bk-world').dataset.cityResidents);
      return current.some(r => { const before = initial.find(b => b.id === r.id); return r.visible && Math.hypot(r.x - before.x, r.z - before.z) > .25 && r.animationTime > before.animationTime; });
    }, initial);
    else { await page.waitForTimeout(1400); assert.deepEqual(await residents(), initial); }
    const moving = await residents();
    for (const resident of moving.filter(r => !r.visible)) {
      const before = initial.find(r => r.id === resident.id);
      assert.deepEqual(resident, before, 'distant residents must not animate');
    }
    await page.screenshot({ path: `${out}/${name}.png` });
    await page.keyboard.press('e'); await page.locator('.rpg-dialogue').waitFor();
    await page.waitForFunction(() => JSON.parse(document.querySelector('.bk-world').dataset.cityResidents).every(r => !r.moving));
    const paused = await residents(); await page.waitForTimeout(1400); assert.deepEqual(await residents(), paused);
    assert(await page.locator('.choice-meaning').count() > 0);
    await page.waitForFunction(() => { const cast = JSON.parse(document.querySelector('.bk-world')?.dataset.conversationCast ?? 'null'); return cast && !cast.moving; });
    await page.screenshot({ path: `${out}/${name}-conversation.png` });
    const cast = JSON.parse(await page.locator('.bk-world').getAttribute('data-conversation-cast'));
    const dialogue = await page.locator('.rpg-dialogue').boundingBox();
    for (const member of cast.members) assert(member.screenX > 10 && member.screenX < (phone ? 390 : 1280) - 10 && member.screenY < dialogue.y);
    await page.getByRole('button', { name: 'Leave conversation', exact: true }).click();
    const beforeMove = await page.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')).position);
    await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(450); await page.keyboard.up('ArrowLeft');
    await page.waitForFunction(before => { const p = JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')).position; return Math.hypot(p.x - before.x, p.z - before.z) > .1; }, beforeMove);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    if (phone) {
      await page.getByRole('button',{name:'Party growth',exact:true}).click();await page.getByRole('button', { name: 'Battle practice', exact: true }).click();
      await page.getByRole('button', { name: 'Retreat', exact: true }).waitFor();
      await page.waitForFunction(() => JSON.parse(document.querySelector('.bk-world').dataset.cityResidents).every(r => !r.visible && !r.moving));
      await page.getByRole('button', { name: 'Retreat', exact: true }).click(); await ready();
      await page.waitForTimeout(1000);
      const beforeCamp = await page.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')));
      await page.getByRole('button', { name: 'Train at camp', exact: true }).click();
      await page.getByRole('button', { name: /(Begin|Continue) your journey/ }).waitFor();
      await page.waitForFunction(() => document.querySelector('.bk-world')?.dataset.cityResidents === '[]');
      await page.getByRole('button', { name: /Return to the adventure/ }).click();
      await page.getByRole('button', { name: /Continue adventure/ }).click(); await ready();
      assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1'))), beforeCamp);
    }
    report.scenes.push({ name, visible: moving.filter(r => r.visible).map(r => r.id), reduced });
    await checkpoint(); console.log('PASS', name); await context.close();
  }
  assert.deepEqual(errors, []); report.finished = true; await checkpoint();
} catch (error) { report.error = String(error); await checkpoint(); await page?.screenshot({ path: `${out}/failure.png` }).catch(() => {}); throw error; }
finally { await browser.close(); }
