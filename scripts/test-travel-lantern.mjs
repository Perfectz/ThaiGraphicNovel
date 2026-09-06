import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshAdventure, moveAdventure, walkable } from '../src/bangkok/adventure.ts';
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7);
const out = `artifacts/travel-lantern/browser${only ? '/' + only : ''}`;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
const report = { scenes: [], errors: [], finished: false };
let page;
const checkpoint = () => writeFile(`${out}/progress.json`, JSON.stringify(report, null, 2));
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')));
const lamp = async () => JSON.parse(await page.locator('.bk-world').getAttribute('data-travel-lantern'));
const training = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-training-v1') ?? 'null'));
const ready = () =>
  page.waitForFunction(
    () => {
      const h = document.querySelector('.bk-world'),
        l = JSON.parse(h?.dataset.travelLantern ?? 'null');
      return (
        h?.dataset.npcReady === '7' && l && l.state !== 'loading' && !document.querySelector('.bk-loading')
      );
    },
    null,
    { timeout: 180000 },
  );
const meanings = {
  'how-much': 'How much is it?',
  'little-cheaper': 'Can it be cheaper than this?',
  'too-expensive': 'That is too expensive',
  'i-will-buy': 'I will take this one',
  'not-today': 'Not today, thanks',
  'think-first': 'Let me think first',
};
async function practise(id, spoken = false) {
  const before = await saved();
  await page
    .locator('.thai-choice-list > button')
    .filter({ has: page.locator('.choice-meaning', { hasText: meanings[id] }) })
    .click();
  await page.getByRole('heading', { name: meanings[id], exact: true }).waitFor();
  assert.deepEqual((await saved()).lantern, before.lantern);
  assert.equal((await saved()).coins, before.coins);
  if (spoken) {
    const old = (await training())?.records?.[id]?.spoken ?? 0;
    await page.getByRole('button', { name: '◉ Record this line', exact: true }).click();
    await page.getByRole('button', { name: '■ Stop recording', exact: true }).waitFor();
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: '■ Stop recording', exact: true }).click();
    await page.getByRole('button', { name: '▷ Play my recording', exact: true }).waitFor();
    assert.equal((await training())?.records?.[id]?.spoken ?? 0, old);
    await page.getByRole('button', { name: 'Use my spoken reply →', exact: true }).click();
    assert.equal((await training()).records[id].spoken, old + 1);
  } else await page.getByRole('button', { name: 'Use text only this time', exact: true }).click();
  assert.deepEqual((await saved()).lantern, before.lantern);
  assert.equal((await saved()).coins, before.coins);
}
async function confirm(reply) {
  await page
    .getByRole('button', {
      name:
        reply === 'how-much'
          ? 'Ask Arun’s price'
          : reply === 'not-today' || reply === 'think-first'
            ? 'Leave with my coins'
            : 'Confirm my request',
      exact: true,
    })
    .click();
}
async function shop() {
  await page.getByRole('button', { name: 'Browse Arun’s lanterns', exact: true }).click();
  await page.getByRole('region', { name: 'Arun’s lantern workshop' }).waitFor();
}
async function capture(name) {
  await page.screenshot({ path: `${out}/${name}.png` });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
}
try {
  for (const c of [
    { name: 'full-price', price: 30, coins: 50 },
    { name: 'discount-spoken', price: 24, coins: 50, discount: true, spoken: true },
    { name: 'paper-phone', price: 18, coins: 20, paper: true, phone: true },
    { name: 'walk-away', coins: 50, leave: true },
    { name: 'no-money', coins: 17, poor: true },
    { name: 'fallback', price: 18, coins: 20, paper: true, fallback: true },
    { name: 'radius-without', radius: true },
    { name: 'radius-owned', radius: true, owned: true },
  ].filter((c) => !only || c.name === only)) {
    report.phase = c.name;
    await checkpoint();
    const context = await browser.newContext({
      viewport: c.phone ? { width: 390, height: 844 } : { width: 1280, height: 900 },
      isMobile: !!c.phone,
      hasTouch: !!c.phone,
      permissions: ['microphone'],
    });
    let s = moveAdventure(freshAdventure(), c.radius ? { x: 37, z: 28 } : { x: 29, z: 27.5 });
    s.flags = ['intro', 'innkeeper', 'artisan'];
    s.coins = c.coins ?? 20;
    if (c.poor) s.lantern.offer = 'paper';
    if (c.owned) s.lantern = { offer: 'discount', owned: 'carved', paid: 24 };
    await context.addInitScript((s) => {
      if (!localStorage.getItem('bangkok-rift-adventure-v1'))
        localStorage.setItem('bangkok-rift-adventure-v1', JSON.stringify(s));
    }, s);
    if (c.fallback) await context.route('**/bangkok/models/travel-lanterns.glb', (r) => r.abort());
    page = await context.newPage();
    page.setDefaultTimeout(120000);
    page.on('pageerror', (e) => report.errors.push({ fixture: c.name, message: e.message }));
    page.on('console', (m) => {
      if (m.type() === 'error' && !(c.fallback && m.location().url.includes('travel-lanterns.glb')))
        report.errors.push({ fixture: c.name, message: m.text() });
    });
    await page.goto('http://127.0.0.1:5188/');
    await page.getByRole('button', { name: /Continue adventure/ }).click();
    await ready();
    assert.equal((await lamp()).state, c.fallback ? 'fallback' : 'ready');
    if (c.radius) {
      await page.waitForFunction(
        (owned) =>
          JSON.parse(document.querySelector('.bk-world').dataset.visibleMemories).includes(
            'artisan-lantern',
          ) === owned,
        !!c.owned,
      );
      assert.equal((await lamp()).visible, !!c.owned);
      await capture(c.name);
    } else {
      assert.equal((await lamp()).visible, false);
      assert.equal((await lamp()).stock.length, 2);
      await shop();
      await capture(`${c.name}-offer`);
      if (!c.poor) {
        await practise('how-much');
        await confirm('how-much');
        await page.getByText('Current offer · 30 game coins', { exact: true }).waitFor();
      }
      if (c.discount || c.leave) {
        await practise('little-cheaper', c.spoken);
        await confirm('little-cheaper');
        await page.getByText('Current offer · 24 game coins', { exact: true }).waitFor();
      }
      if (c.paper) {
        await practise('i-will-buy');
        assert(
          await page.getByRole('button', { name: 'Buy this lantern · 30 coins', exact: true }).isDisabled(),
        );
        await page.getByRole('button', { name: 'Choose another reply', exact: true }).click();
        await practise('too-expensive');
        await confirm('too-expensive');
        await page.getByText('Current offer · 18 game coins', { exact: true }).waitFor();
      }
      if (c.leave || c.poor) {
        if (c.poor) {
          await practise('i-will-buy');
          assert(
            await page.getByRole('button', { name: 'Buy this lantern · 18 coins', exact: true }).isDisabled(),
          );
          await page.getByRole('button', { name: 'Choose another reply', exact: true }).click();
        }
        await practise(c.leave ? 'not-today' : 'think-first');
        await confirm(c.leave ? 'not-today' : 'think-first');
        const declined = await saved();
        assert.equal(declined.coins, c.coins);
        assert.equal(declined.lantern.owned, null);
        await page.reload();
        await page.getByRole('button', { name: /Continue adventure/ }).click();
        await ready();
        await shop();
        assert.equal((await saved()).lantern.offer, c.leave ? 'discount' : 'paper');
        await capture(`${c.name}-returned`);
        await page.getByRole('button', { name: 'Leave lantern workshop', exact: true }).click();
      } else {
        await practise('i-will-buy');
        const before = await saved();
        await capture(`${c.name}-confirm`);
        await page.getByRole('button', { name: `Buy this lantern · ${c.price} coins`, exact: true }).click();
        await page.waitForFunction(
          () => !!JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')).lantern.owned,
        );
        const bought = await saved();
        assert.equal(bought.coins, c.coins - c.price);
        assert.equal(bought.xp, before.xp + 40);
        assert.equal(bought.lantern.owned, c.paper ? 'paper' : 'carved');
        await page.waitForFunction(
          () => JSON.parse(document.querySelector('.bk-world').dataset.travelLantern).visible,
        );
        const held = await lamp();
        assert.equal(held.stock.length, 1);
        assert.equal(held.stock[0], c.paper ? 'Carved' : 'Paper');
        assert(Math.hypot(held.position[0] - held.hand[0], held.position[2] - held.hand[2]) < 0.001);
        assert(Math.abs(held.position[1] + 0.438 - held.hand[1]) < 0.08);
        await capture(`${c.name}-carried`);
        await page.keyboard.down('ArrowRight');
        await page.waitForFunction(
          (start) => {
            const h = document.querySelector('.bk-world');
            return (
              h && Math.hypot(Number(h.dataset.playerX) - start.x, Number(h.dataset.playerZ) - start.z) > 2.5
            );
          },
          bought.position,
          { timeout: 45000 },
        );
        await page.keyboard.up('ArrowRight');
        await page.waitForFunction((old) => {
          const current = JSON.parse(document.querySelector('.bk-world')?.dataset.travelLantern ?? 'null');
          return current && Math.hypot(...current.position.map((n, i) => n - old[i])) > 0.1;
        }, held.position);
        const walked = await saved();
        assert(walkable(walked.position));
        assert(
          Math.hypot(walked.position.x - bought.position.x, walked.position.z - bought.position.z) > 0.1,
        );
        const moved = await lamp();
        assert(Math.hypot(...moved.position.map((n, i) => n - held.position[i])) > 0.1);
        if (c.phone || c.name === 'full-price') {
          await page.reload();
          await page.getByRole('button', { name: /Continue adventure/ }).click();
          await ready();
          assert.deepEqual((await saved()).lantern, bought.lantern);
          assert.equal((await saved()).coins, bought.coins);
        }
        if (c.phone) {
          const checkpointSave = await saved();
          await page.getByRole('button', { name: 'Train at camp', exact: true }).click();
          await page.getByRole('button', { name: /(Begin|Continue) your journey/ }).waitFor();
          await page.getByRole('button', { name: /Return to the adventure/ }).click();
          await page.getByRole('button', { name: /Continue adventure/ }).click();
          await ready();
          assert.deepEqual(await saved(), checkpointSave);
          assert.equal((await lamp()).owned, 'paper');
        }
        await page.getByRole('button', { name: /^Bag/ }).click();
        await page.getByText(/carried by Su · reveal city memories/).waitFor();
        await capture(`${c.name}-bag`);
      }
    }
    assert.deepEqual(report.errors, []);
    report.scenes.push(c.name);
    await checkpoint();
    console.log('PASS', c.name);
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
