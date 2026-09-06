import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { freshAdventure, flag, startBattle } from '../src/bangkok/adventure.ts';
const browser = await chromium.launch({ headless: true });
const base = 'http://127.0.0.1:5188';
const out = 'artifacts/adventure-verification';
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  let fixture = freshAdventure();
  for (const f of ['intro', 'innkeeper', 'cook', 'ferry', 'chest', 'murmur']) fixture = flag(fixture, f);
  fixture = startBattle(fixture, 'keeper');
  await context.addInitScript(
    (s) => localStorage.setItem('bangkok-rift-adventure-v1', JSON.stringify(s)),
    fixture,
  );
  const p = await context.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(base);
  await p.getByRole('button', { name: /Continue adventure/ }).click();
  await p.waitForFunction(() => !document.querySelector('.bk-loading'));
  await p.waitForTimeout(2200);
  await p.screenshot({ path: `${out}/06-final-boss.png` });
  await p.getByRole('button', { name: /^◇ Guard/ }).click();
  await p.getByRole('button', { name: /^Retreat$/ }).click();
  await p.getByRole('button', { name: 'Open town map ↗', exact: true }).click();
  await p.locator('.city-map button[data-area="hotel"]').click();
  await p.locator('.city-contacts button').filter({ hasText: 'Mali' }).click();
  await p.locator('.rpg-dialogue').waitFor({ timeout: 120000 });
  await p.getByRole('button', { name: /Back to the adventure/ }).click();
  assert.equal(await p.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')).hp), 100);
  await p.waitForTimeout(5200);
  assert(
    await p.evaluate(() =>
      Object.values(JSON.parse(localStorage.getItem('bangkok-rift-training-v1')).minutes).some((n) => n >= 5),
    ),
  );
  await context.close();
  const phoneContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const phone = await phoneContext.newPage();
  phone.on('pageerror', (e) => errors.push(e.message));
  await phone.goto(base);
  await phone.getByRole('button', { name: /Step through the rift/ }).click();
  await phone.getByRole('button', { name: 'Open town map ↗', exact: true }).click();
  await phone.locator('.city-map button[data-area="hotel"]').click();
  await phone.locator('.city-contacts button').filter({ hasText: 'Mali' }).click();
  await phone.locator('.rpg-thai').waitFor({ timeout: 120000 });
  await phone.waitForTimeout(2500);
  await phone.screenshot({ path: `${out}/07-final-phone-conversation.png` });
  assert(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await phone.locator('.rpg-answers button').filter({ hasText: 'สวัสดีครับ' }).click();
  await phone.getByRole('button', { name: 'Use text only this time', exact: true }).click();
  await phone.getByRole('button', { name: /^Continue/ }).click();
  assert(
    await phone
      .locator('.rpg-thai')
      .innerText()
      .then((t) => t.includes('ผมชื่อ')),
  );
  await phoneContext.close();
  assert.deepEqual(errors, []);
  console.log(
    'PASS: final boss scene, guarding, retreat/rest, movement after combat, active learning time, phone conversation and answer controls.',
  );
} finally {
  await browser.close();
}
