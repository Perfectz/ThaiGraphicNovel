import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshAdventure } from '../src/bangkok/adventure.ts';
const baseline = process.argv.includes('--baseline');
const rounds = Number(process.argv.find((a) => a.startsWith('--rounds='))?.slice(9) ?? (baseline ? 1 : 4));
const out = `artifacts/world-lifetime/${baseline ? 'baseline' : 'verified'}`;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const save = freshAdventure();
save.flags = ['intro', 'innkeeper', 'evening-park', 'evening-water'];
save.position = { x: -25, z: 27 };
save.trackedQuest = 'evening';
await context.addInitScript((save) => {
  localStorage.setItem('bangkok-rift-adventure-v1', JSON.stringify(save));
  const original = HTMLCanvasElement.prototype.getContext,
    seen = new WeakSet(),
    entries = [];
  HTMLCanvasElement.prototype.getContext = function (...args) {
    const gl = original.apply(this, args);
    if (!gl || !String(args[0]).startsWith('webgl') || seen.has(gl)) return gl;
    seen.add(gl);
    const canvas = this,
      live = {};
    for (const name of [
      'Texture',
      'Buffer',
      'Program',
      'Shader',
      'Framebuffer',
      'Renderbuffer',
      'VertexArray',
    ]) {
      const create = gl[`create${name}`]?.bind(gl),
        remove = gl[`delete${name}`]?.bind(gl);
      if (!create || !remove) continue;
      const set = new Set();
      live[name] = set;
      gl[`create${name}`] = (...a) => {
        const value = create(...a);
        if (value) set.add(value);
        return value;
      };
      gl[`delete${name}`] = (value) => {
        set.delete(value);
        return remove(value);
      };
    }
    // Keep the old contexts reachable so the check cannot pass merely because GC happened quickly.
    entries.push(() => ({
      connected: canvas.isConnected,
      lost: gl.isContextLost(),
      live: Object.fromEntries(Object.entries(live).map(([k, v]) => [k, v.size])),
    }));
    return gl;
  };
  window.__worldGpuAudit = () => entries.map((read) => read());
}, save);
const page = await context.newPage();
page.setDefaultTimeout(120000);
const errors = [];
let phase = 'start';
page.on('pageerror', (e) => errors.push({ phase, message: e.message }));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push({ phase, message: m.text() });
});
const report = { rounds: [], finished: false, errors };
const checkpoint = () => writeFile(`${out}/progress.json`, JSON.stringify(report, null, 2));
const audit = () => page.evaluate(() => window.__worldGpuAudit());
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')));
const ready = () =>
  page.waitForFunction(
    () => {
      const h = document.querySelector('.bk-world');
      return (
        h?.dataset.npcReady === '7' &&
        JSON.parse(h.dataset.cityEvening ?? '{}').state === 'ready' &&
        !document.querySelector('.bk-loading')
      );
    },
    null,
    { timeout: 180000 },
  );
try {
  await page.goto('http://127.0.0.1:5188/');
  await page.getByRole('button', { name: /Continue adventure/ }).click();
  await ready();
  const initial = await saved();
  report.initialGpu = await audit();
  await checkpoint();
  for (let round = 1; round <= rounds; round++) {
    phase = `round ${round}: camp`;
    report.phase = phase;
    await checkpoint();
    await page.getByRole('button', { name: 'Train at camp', exact: true }).click();
    await page.getByRole('button', { name: /(Begin|Continue) your journey/ }).waitFor();
    await page.waitForTimeout(250);
    const atCamp = await audit();
    report.rounds.push({ round, atCamp });
    await checkpoint();
    if (!baseline)
      assert(
        atCamp.filter((c) => !c.connected).every((c) => c.lost),
        'removed worlds must release their WebGL context even while reachable',
      );
    phase = `round ${round}: city`;
    report.phase = phase;
    await checkpoint();
    await page.getByRole('button', { name: /Return to the adventure/ }).click();
    await page.getByRole('button', { name: /Continue adventure/ }).click();
    await ready();
    assert.deepEqual(await saved(), initial);
    const restored = JSON.parse(await page.locator('.bk-world').getAttribute('data-city-evening'));
    assert.equal(restored.drink, 'water');
    const atCity = await audit();
    report.rounds.at(-1).atCity = atCity;
    if (!baseline) {
      assert(atCity.filter((c) => !c.connected).every((c) => c.lost));
      assert.equal(atCity.filter((c) => c.connected && !c.lost).length, 1);
    }
    await page.getByRole('button', { name: 'Continue our evening', exact: true }).click();
    await page.locator('.choice-meaning').first().waitFor();
    await page.waitForFunction(() => {
      const c = JSON.parse(document.querySelector('.bk-world')?.dataset.conversationCast ?? 'null');
      return c && !c.moving;
    });
    assert((await page.locator('.choice-meaning').count()) > 0);
    if (round === rounds) await page.screenshot({ path: `${out}/final-conversation.png` });
    await page.getByRole('button', { name: 'Leave evening conversation', exact: true }).click();
    // Conversation staging may move the party once; compare subsequent round trips to that valid checkpoint.
    Object.assign(initial, await saved());
    assert.deepEqual(errors, []);
    await checkpoint();
    console.log('PASS round', round, JSON.stringify(atCity));
  }
  report.finished = true;
  await checkpoint();
} catch (e) {
  report.error = String(e);
  await checkpoint();
  await page.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  throw e;
} finally {
  await browser.close();
}
