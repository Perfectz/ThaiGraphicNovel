import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { discoveries } from '../src/bangkok/discoveries.ts';
import { freshAdventure, walkable } from '../src/bangkok/adventure.ts';
const only = process.argv.find((arg) => arg.startsWith('--only='))?.slice(7);
const framing = process.argv.includes('--framing-only');
const out = `artifacts/blender-discoveries/${framing ? 'framing' : 'browser'}${only ? '/' + only : ''}`;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = { scenes: [], errors: [], finished: false, framingOnly: framing };
let page;
const checkpoint = () => writeFile(`${out}/progress.json`, JSON.stringify(report, null, 2));
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')));
const ready = () =>
  page.waitForFunction(
    () => {
      const h = document.querySelector('.bk-world');
      return (
        h?.dataset.npcReady === '7' &&
        h?.dataset.discoveryModels !== 'loading' &&
        !document.querySelector('.bk-loading')
      );
    },
    null,
    { timeout: 180000 },
  );
try {
  for (const config of [
    ...discoveries.map((site) => ({ site, name: site.id })),
    { site: discoveries[1], name: 'phone', phone: true },
    { site: discoveries[3], name: 'fallback', fallback: true },
  ].filter((config) => !only || config.name === only)) {
    report.phase = config.name;
    await checkpoint();
    const d = config.site;
    const context = await browser.newContext({
      viewport: config.phone ? { width: 390, height: 844 } : { width: 1280, height: 900 },
      isMobile: !!config.phone,
      hasTouch: !!config.phone,
    });
    const s = freshAdventure();
    s.flags = ['intro', 'innkeeper'];
    s.position = { x: d.x, z: d.z + (d.id === 'park-basket' ? -1.2 : 1.2) };
    assert(walkable(s.position));
    await context.addInitScript((s) => {
      if (!localStorage.getItem('bangkok-rift-adventure-v1'))
        localStorage.setItem('bangkok-rift-adventure-v1', JSON.stringify(s));
    }, s);
    if (config.fallback) await context.route('**/bangkok/models/city-memories.glb', (r) => r.abort());
    page = await context.newPage();
    page.setDefaultTimeout(120000);
    page.on('pageerror', (e) => report.errors.push({ fixture: config.name, message: e.message }));
    page.on('console', (m) => {
      if (m.type() === 'error' && !(config.fallback && m.location().url.includes('city-memories.glb')))
        report.errors.push({ fixture: config.name, message: m.text() });
    });
    await page.goto('http://127.0.0.1:5188/');
    await page.getByRole('button', { name: /Continue adventure/ }).click();
    await ready();
    assert.equal(
      await page.locator('.bk-world').getAttribute('data-discovery-models'),
      config.fallback ? 'fallback' : 'ready',
    );
    await page.screenshot({ path: `${out}/${config.name}-world.png` });
    await page.keyboard.press('e');
    await page.locator('.rpg-dialogue').waitFor();
    assert(
      await page
        .locator('.rpg-dialogue')
        .innerText()
        .then((t) => t.includes(d.story)),
    );
    await page.getByRole('button', { name: 'Leave conversation', exact: true }).click();
    assert(!(await saved()).flags.includes(d.id));
    await page.keyboard.press('e');
    const thai = await page.locator('.rpg-thai').innerText();
    const choice = page.locator('.rpg-dialogue .thai-choice-list button').filter({ hasText: thai });
    assert((await choice.locator('.choice-meaning').innerText()).length > 1);
    await choice.click();
    await page.waitForFunction(() => {
      const cast = JSON.parse(document.querySelector('.bk-world')?.dataset.conversationCast ?? 'null');
      return cast && !cast.moving;
    });
    await page.waitForTimeout(700);
    if (d.id === 'soi-route')
      assert.equal(await page.locator('.bk-world').getAttribute('data-hotel-north-wall'), 'false');
    const cast = JSON.parse(await page.locator('.bk-world').getAttribute('data-conversation-cast'));
    const panel = await page.locator('.rpg-dialogue').boundingBox();
    assert(cast.objectFrame, 'discovery geometry has projected bounds');
    assert(cast.objectFrame.bottom < panel.y - 8, `${config.name}: entire prop above the practice panel`);
    assert(
      cast.objectFrame.left > 8 && cast.objectFrame.right < (config.phone ? 390 : 1280) - 8,
      `${config.name}: entire prop within the frame`,
    );
    for (const member of cast.members) {
      assert(
        member.screenX > 8 && member.screenX < (config.phone ? 390 : 1280) - 8,
        `${config.name}: ${member.id} in frame`,
      );
      assert(member.screenY < panel.y, `${config.name}: ${member.id} above dialogue`);
      assert(walkable(member), `${config.name}: ${member.id} on walkable ground`);
    }
    await page.screenshot({ path: `${out}/${config.name}-conversation.png` });
    if (framing) {
      assert.deepEqual(report.errors, []);
      report.scenes.push(config.name);
      await checkpoint();
      console.log('PASS framing', config.name);
      await context.close();
      continue;
    }
    await page.getByRole('button', { name: 'Use text only this time', exact: true }).click();
    await page
      .locator('.rpg-dialogue')
      .getByRole('button', { name: /^Continue/ })
      .click();
    await page.getByRole('button', { name: /Back to the adventure/ }).click();
    await page.waitForFunction(
      (id) => JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')).flags.includes(id),
      d.id,
    );
    const complete = await saved();
    assert.equal(complete.xp, 30);
    assert.equal(complete.coins, s.coins + d.coins);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.reload();
    await page.getByRole('button', { name: /Continue adventure/ }).click();
    await ready();
    assert.deepEqual(await saved(), complete);
    if (config.phone) {
      await page.getByRole('button', { name: 'Train at camp', exact: true }).click();
      await page.getByRole('button', { name: /(Begin|Continue) your journey/ }).waitFor();
      await page.getByRole('button', { name: /Return to the adventure/ }).click();
      await page.getByRole('button', { name: /Continue adventure/ }).click();
      await ready();
      assert.deepEqual(await saved(), complete);
    }
    report.scenes.push(config.name);
    await checkpoint();
    assert.deepEqual(report.errors, []);
    console.log('PASS', config.name);
    await context.close();
  }
  report.finished = true;
  await checkpoint();
} catch (e) {
  report.error = String(e);
  await checkpoint();
  await page?.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  throw e;
} finally {
  await browser.close();
}
