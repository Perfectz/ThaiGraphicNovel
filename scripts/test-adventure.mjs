import { finishFight } from './expedition-test-helpers.mjs';
import { actors } from '../src/bangkok/adventure.ts';
import { cityAreaAt } from '../src/bangkok/city.ts';
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const base = 'http://127.0.0.1:5188';
const out = 'artifacts/adventure-verification';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  permissions: ['microphone'],
});
const page = await context.newPage();
page.setDefaultTimeout(45000);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')));
async function walkTo(name, battle = false) {
  console.log('Walking to', name);
  await page.getByRole('button', { name: 'Open town map ↗', exact: true }).click();
  const actor = actors.find(a => a.name.includes(name));
  assert(actor, `Known contact: ${name}`);
  await page.locator(`.city-map button[data-area="${cityAreaAt(actor)}"]`).click();
  await page.locator('.city-contacts button').filter({ hasText: name }).click();
  await page.locator(battle ? '.exp-command-panel' : '.rpg-dialogue').waitFor({ timeout: 120000 });
}
let recorded = false,
  wrongConversation = false;
async function conversation() {
  for (let i = 0; i < 16; i++) {
    if (!(await page.locator('.rpg-dialogue').count())) return;
    const replies = page.locator('.rpg-dialogue .rpg-answers button');
    if (await replies.count()) {
      const thai = await page.locator('.rpg-thai').innerText();
      if (!wrongConversation) {
        await replies.filter({ hasNotText: thai }).first().click();
        await page.getByRole('button', { name: 'Use text only this time', exact: true }).click();
        await page.getByText(/That means something different/).waitFor();
        wrongConversation = true;
      }
      await replies.filter({ hasText: thai }).click();
      if (!recorded) {
        await page.getByRole('button', { name: '◉ Record this line', exact: true }).click();
        await page.getByRole('button', { name: '■ Stop recording', exact: true }).waitFor();
        await page.waitForTimeout(650);
        await page.getByRole('button', { name: '■ Stop recording', exact: true }).click();
        await page.getByRole('button', { name: '▷ Play my recording', exact: true }).click();
        await page.getByRole('button', { name: 'Use my spoken reply →', exact: true }).click();
        recorded = true;
      } else await page.getByRole('button', { name: 'Use text only this time', exact: true }).click();
    }
    await page
      .locator('.rpg-dialogue')
      .getByRole('button', { name: /^(Continue|Back to the adventure|Board the ferry)/ })
      .click();
  }
  throw new Error('Conversation did not finish');
}
async function fight(id) { await finishFight(page, id); }
try {
  await page.goto(base);
  await page.getByRole('button', { name: /Step through the rift/ }).waitFor();
  await page.waitForFunction(() => !document.querySelector('.bk-loading'));
  await page.screenshot({ path: `${out}/01-title.png` });
  await page.getByRole('button', { name: /Step through the rift/ }).click();
  const initial = (await state()).position;
  await page.keyboard.down('d');
  await page.waitForTimeout(1500);
  await page.keyboard.up('d');
  await page.waitForTimeout(800);
  const moved = (await state()).position;
  assert(Math.hypot(moved.x - initial.x, moved.z - initial.z) > 0.1);
  await page.getByRole('button', { name: 'Talk to Su', exact: true }).click();
  await conversation();
  assert((await state()).flags.includes('intro'));
  await walkTo('Old travel chest');
  await conversation();
  assert(!(await state()).flags.includes('chest'));
  await walkTo('Mali');
  await conversation();
  assert((await state()).flags.includes('innkeeper'));
  await walkTo('Old travel chest');
  await conversation();
  assert((await state()).flags.includes('chest'));
  const beforeReload = await state();
  await page.reload();
  await page.getByRole('button', { name: /Continue adventure/ }).click();
  assert.deepEqual((await state()).flags, beforeReload.flags);
  await walkTo('Uncle Lek');
  await conversation();
  assert((await state()).flags.includes('cook'));
  await page.screenshot({ path: `${out}/02-market-quest.png` });
  await walkTo('Niran');
  await conversation();
  assert((await state()).flags.includes('ferry'));
  await walkTo('Murmur wisp', true);
  await page.screenshot({ path: `${out}/03-battle.png` });
  await fight('murmur');
  await walkTo('Mali');
  await conversation();
  assert.equal((await state()).hp, 100);
  await walkTo('The river lantern', true);
  const battleCheckpoint = (await state()).battle;
  await page.reload();
  await page.getByRole('button', { name: /Continue adventure/ }).click();
  assert.deepEqual((await state()).battle, battleCheckpoint);
  await fight('keeper');
  await walkTo('Niran');
  await conversation();
  assert((await state()).flags.includes('departed'));
  await page.locator('.rpg-ending').waitFor();
  await page.screenshot({ path: `${out}/04-chapter-clear.png` });
  await page.getByRole('button', { name: /Practise your words at camp/ }).click();
  await page.getByRole('button', { name: /Continue your journey/ }).waitFor();
  await page.getByRole('button', { name: /Return to the adventure/ }).click();
  await page.getByRole('button', { name: /Continue adventure/ }).waitFor();
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
  const dpad = phone.getByRole('button', { name: 'Walk right', exact: true });
  const phoneStart = await phone.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')).position);
  const box = await dpad.boundingBox();
  assert(box);
  await phone.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await phone.mouse.down();
  await phone.waitForTimeout(1700);
  await phone.mouse.up();
  await phone.waitForTimeout(800);
  assert(
    await phone.evaluate(start => JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')).position.x > start.x + .1, phoneStart),
  );
  await phone.getByRole('button', { name: 'Talk to Su', exact: true }).click();
  await phone.locator('.rpg-dialogue').waitFor();
  await phone.screenshot({ path: `${out}/05-phone.png` });
  assert(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await phoneContext.close();
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      {
        chapter: 'complete',
        keyboardMovement: true,
        mapTravel: true,
        lockedChest: true,
        quests: 3,
        battles: 2,
        guardAndHealing: true,
        recording: recorded,
        wrongAnswerRecovery: wrongConversation,
        reload: true,
        phoneDpad: true,
        errors,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(
    await page
      .locator('body')
      .innerText()
      .catch(() => ''),
  );
  await page.screenshot({ path: `${out}/failure.png` }).catch(() => undefined);
  throw error;
} finally {
  await browser.close();
}
