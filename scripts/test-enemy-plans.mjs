import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshAdventure, flag, startBattle } from '../src/bangkok/adventure.ts';
import { settle, word, finishFight, adventureState as saved } from './expedition-test-helpers.mjs';
const out = 'artifacts/enemy-plans/browser';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const report = { finished: false, cases: [], errors: [] };
let page;
const checkpoint = () => writeFile(`${out}/progress.json`, JSON.stringify(report, null, 2));
async function capture(name) {
  await page.waitForTimeout(1200);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: `${out}/${name}.png` });
}
async function plans() {
  const before = await saved(page);
  await page.getByRole('button', { name: 'Read enemy plans · free', exact: true }).click();
  await page.getByRole('region', { name: 'Battle commands', exact: true }).locator('.exp-intel').waitFor();
  assert.deepEqual(await saved(page), before);
}
async function back() {
  await page.getByRole('button', { name: '← Commands', exact: true }).click();
}
async function open(s, phone) {
  const context = await browser.newContext({
    viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    isMobile: phone,
    hasTouch: phone,
  });
  await context.addInitScript((s) => {
    if (!localStorage.getItem('bangkok-rift-adventure-v1'))
      localStorage.setItem('bangkok-rift-adventure-v1', JSON.stringify(s));
  }, s);
  page = await context.newPage();
  page.setDefaultTimeout(90000);
  page.on('pageerror', (e) => report.errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') report.errors.push(m.text());
  });
  await page.goto('http://127.0.0.1:5188/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Continue adventure/ }).click();
  await page.waitForFunction(() => !document.querySelector('.bk-loading'));
  await page.waitForFunction(
    () => JSON.parse(document.querySelector('.bk-world')?.dataset.riverSpirits ?? '{}').state === 'ready',
  );
  await settle(page);
  return context;
}
function fixture(id) {
  let s = freshAdventure();
  for (const f of ['intro', 'innkeeper', 'cook', 'ferry', ...(id === 'keeper' ? ['murmur'] : [])])
    s = flag(s, f);
  s = startBattle(s, id);
  s.battle.round = id === 'keeper' ? 3 : 2;
  return s;
}
try {
  for (const phone of [false, true]) {
    const label = phone ? 'phone-siphon' : 'desktop-weaken';
    report.step = label;
    await checkpoint();
    const context = await open(fixture('murmur'), phone);
    if (!phone) {
      const before = await saved(page);
      await page.evaluate(async () => {
        await import('/src/main.tsx?root-recheck=1');
        await import('/src/main.tsx?root-recheck=2');
      });
      assert.deepEqual(
        await saved(page),
        before,
        'entry re-evaluation keeps the existing game root and save',
      );
    }
    await plans();
    assert((await page.locator('[data-enemy-plan="murmur"]').innerText()).includes('Mist Siphon'));
    if (phone) {
      const before = await saved(page);
      await page.getByRole('button', { name: 'Lantern Echo', exact: true }).click();
      assert(await page.locator('[data-enemy-plan="echo"]').isVisible());
      assert.equal(await page.locator('[data-enemy-plan="murmur"]').isVisible(), false);
      assert.deepEqual(await saved(page), before);
      await capture('phone-echo-plan');
      await page.getByRole('button', { name: 'Murmur Wisp', exact: true }).click();
    }
    assert((await page.locator('[data-enemy-plan="echo"]').innerText()).includes('Parry interrupts'));
    await capture(`${label}-plans`);
    if (phone)
      assert(
        await page.locator('.exp-command-panel').evaluate((el) => el.getBoundingClientRect().top > 420),
        'plans preserve room for the arena',
      );
    await back();
    const beforeReload = await saved(page);
    await page.reload();
    await page.getByRole('button', { name: /Continue adventure/ }).click();
    await settle(page);
    assert.deepEqual(await saved(page), beforeReload);
    await word(page, phone ? 'First Light' : 'Gentle Flame', 'Murmur Wisp');
    await word(page, 'Kindred Spark', phone ? 'Murmur Wisp' : 'Lantern Echo');
    await page.getByRole('heading', { name: 'Mist Siphon', exact: true }).waitFor();
    await capture(`${label}-attack`);
    const before = (await saved(page)).battle;
    if (phone) {
      await page.getByRole('button', { name: 'Face the attack', exact: true }).click();
      await page.keyboard.press('Space');
    } else await page.getByRole('button', { name: 'Steady guard · no timing', exact: true }).click();
    await settle(page);
    const after = (await saved(page)).battle;
    assert.equal(after.heroes[1].ap, before.heroes[1].ap - (phone ? 2 : 0));
    assert.equal(after.heroes[1].hp, before.heroes[1].hp - (phone ? 14 : 4));
    if (phone) {
      const hp = after.foes[0].hp,
        echoHp = after.foes[1].hp;
      await page.getByRole('button', { name: 'Face the attack', exact: true }).click();
      await page.evaluate(
        () =>
          new Promise((resolve) => {
            function tick() {
              const meter = document.querySelector('[aria-label="Attack timing"]');
              if (Number(meter?.getAttribute('aria-valuenow')) >= 83) {
                window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', code: 'KeyF', bubbles: true }));
                resolve();
              } else requestAnimationFrame(tick);
            }
            requestAnimationFrame(tick);
          }),
      );
      await settle(page);
      const counter = (await saved(page)).battle;
      assert.equal(counter.foes[0].hp, hp);
      assert.equal(counter.foes[1].hp, echoHp - 22);
      assert(counter.event.text.includes('restoration interrupted'));
    } else {
      await page.getByRole('button', { name: 'Steady guard · no timing', exact: true }).click();
      await settle(page);
    }
    await finishFight(page, 'murmur');
    assert((await saved(page)).flags.includes('murmur'));
    report.cases.push({
      label,
      freePreview: true,
      reload: true,
      drain: phone ? 2 : 0,
      parryInterrupt: phone,
      victory: true,
    });
    await checkpoint();
    await context.close();
  }
  const s = fixture('keeper');
  s.battle.foes[0].break = 40;
  const context = await open(s, true);
  report.step = 'keeper-break';
  await checkpoint();
  await plans();
  assert((await page.locator('[data-enemy-plan="keeper"]').innerText()).includes('Tidal Requiem'));
  await capture('keeper-heavy-plan');
  await back();
  await word(page, 'Still the River', 'Keeper of Unsaid Words');
  await plans();
  assert((await page.locator('[data-enemy-plan="keeper"]').innerText()).includes('Turn cancelled'));
  await capture('keeper-cancelled');
  await back();
  await word(page, 'Kindred Spark', 'Lantern Echo');
  assert.equal((await saved(page)).battle.order[(await saved(page)).battle.turn], 'echo');
  report.cases.push({ label: 'keeper-break', heavyForecast: true, cancelled: true });
  await context.close();
  assert.deepEqual(report.errors, []);
  report.finished = true;
} catch (e) {
  report.failure = e.stack;
  if (page) await page.screenshot({ path: `${out}/failure.png`, timeout: 10000 }).catch(() => {});
  throw e;
} finally {
  await checkpoint();
  await browser.close();
}
