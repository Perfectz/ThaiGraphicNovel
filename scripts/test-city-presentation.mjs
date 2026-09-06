import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { freshAdventure, actors, walkable } from '../src/bangkok/adventure.ts';
import { cityAreas } from '../src/bangkok/city.ts';

// Visual fixtures isolate camera obstruction; test-city.mjs proves the actual journey.
const out = 'artifacts/city-presentation';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
const phone = process.argv.includes('--phone');
const only = process.argv.find(a => a.startsWith('--only='))?.split('=')[1];
try {
  for (const id of (phone ? ['cook'] : ['innkeeper', 'station', 'gardener', 'cook', 'artisan', 'ferry']).filter(id => !only || id === only)) {
    const actor = actors.find(a => a.id === id);
    const fixture = freshAdventure();
    fixture.position = [[-1,-1],[0,1],[1,-1],[-1,0]].map(([x,z])=>({x:actor.x+x,z:actor.z+z})).find(walkable);
    assert(fixture.position, `Walkable visual fixture near ${id}`);
    fixture.flags = ['intro', ...(id === 'ferry' ? ['cook'] : [])];
    fixture.visited = cityAreas.map(a => a.id);
    const context = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 900 }, isMobile: phone, hasTouch: phone });
    await context.addInitScript(s => localStorage.setItem('bangkok-rift-adventure-v1', JSON.stringify(s)), fixture);
    const page = await context.newPage();
    page.setDefaultTimeout(45000);
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:5188/');
    await page.getByRole('button', { name: /Continue adventure/ }).click();
    await page.waitForFunction(() => !document.querySelector('.bk-loading'));
    await page.waitForFunction(() => Number(document.querySelector('.bk-world')?.getAttribute('data-npc-ready')) === 6);
    await page.waitForFunction(() => document.querySelector('.bk-world')?.getAttribute('data-city-props') === 'ready');
    await page.waitForTimeout(2200);
    await page.screenshot({ path: `${out}/${phone ? 'phone-' : ''}${id}-explore.png` });
    await page.keyboard.press('e');
    await page.locator('.rpg-dialogue').waitFor();
    await page.waitForTimeout(1700);
    await page.screenshot({ path: `${out}/${phone ? 'phone-' : ''}${id}-dialogue.png` });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    console.log('Captured', id, 'exploration and dialogue');
    await context.close();
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
