import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshAdventure, actors, flag } from '../src/bangkok/adventure.ts';
import { archiveFlags } from '../src/bangkok/archiveQuest.ts';
import { canalApproach } from '../src/bangkok/canalErrand.ts';
import { worldArts } from '../src/bangkok/worldArts.ts';
import { adventureState as saved, settle, word } from './expedition-test-helpers.mjs';

const phone = process.argv.includes('--phone');
const base = process.env.PLAYTEST_BASE_URL ?? 'http://127.0.0.1:5188/';
const out = `artifacts/world-arts/${base.includes('127.0.0.1') ? 'local' : 'public'}-${phone ? 'phone' : 'desktop'}`;
await mkdir(out, { recursive: true });
const report = { finished: false, base, phone, cases: [], errors: [] };
const browser = await chromium.launch({
  headless: true,
  channel: 'chrome',
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
let page;
async function record() {
  assert((await page.locator('.speak-preview h3[lang=en]').innerText()).length > 0);
  await page.getByRole('button', { name: '♫ Hear this line', exact: true }).click();
  await page.getByRole('button', { name: '◉ Record this line', exact: true }).click();
  await page.getByRole('button', { name: '■ Stop recording', exact: true }).waitFor();
  await page.waitForTimeout(650);
  await page.getByRole('button', { name: '■ Stop recording', exact: true }).click();
  await page.getByRole('button', { name: '▷ Play my recording', exact: true }).click();
  await page.getByRole('button', { name: 'Use my spoken reply →', exact: true }).click();
}
async function story() {
  for (let n = 0; n < 12; n++) {
    const panel = page.getByLabel('Story conversation', { exact: true });
    if (!(await panel.count())) return;
    if (await panel.locator('[data-phrase-choice]').count()) {
      const thai = await panel.locator('.rpg-thai').innerText();
      await panel.locator('[data-phrase-choice]').filter({ hasText: thai }).click();
      await record();
    }
    await panel
      .getByRole('button', { name: /^(Continue|Back to the adventure|Face the|Restore the canal lantern)/ })
      .click();
  }
  throw Error('Story did not finish');
}
try {
  for (const art of worldArts) {
    const context = await browser.newContext({
      viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      isMobile: phone,
      hasTouch: phone,
      permissions: ['microphone'],
    });
    let s = flag(flag(freshAdventure(), 'intro'), 'innkeeper');
    // Focused integration fixture: prerequisite exploration is complete, final reply is not.
    if (art.id === 'shelter') {
      s.flags.push('canal-accepted', 'canal-paper', 'canal-frame');
      s.position = canalApproach('canal-lantern');
    } else {
      s.flags.push(...archiveFlags.filter((f) => f !== 'archive-complete'));
      const host = actors.find((a) => a.id === 'archivist');
      s.position = { x: host.x, z: host.z };
    }
    s.trackedQuest = art.quest;
    await context.addInitScript((s) => {
      if (!sessionStorage.getItem('world-art-fixture')) {
        localStorage.setItem('bangkok-rift-adventure-v1', JSON.stringify(s));
        sessionStorage.setItem('world-art-fixture', '1');
      }
    }, s);
    page = await context.newPage();
    page.setDefaultTimeout(90000);
    page.on('pageerror', (e) => report.errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') report.errors.push(m.text());
    });
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /Continue adventure/ }).click();
    await page.waitForFunction(() => !document.querySelector('.bk-loading'));
    await page.locator('.rpg-party-panel button').click();
    const card = page.locator(`[data-world-art="${art.id}"]`);
    assert.equal(await card.getAttribute('data-unlocked'), 'false');
    await card.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${out}/${art.id}-discovery.png` });
    await card.getByRole('button', { name: `Track ${art.source} ↗`, exact: true }).click();
    assert.equal((await saved(page)).trackedQuest, art.quest);
    await page.getByRole('button', { name: /^E ·/ }).click();
    if (art.id === 'shelter') await story();
    else {
      await page
        .getByLabel('The House of Returning Maps', { exact: true })
        .locator('[data-phrase-choice]')
        .click();
      await record();
      await page.getByRole('button', { name: 'Thank Kanya · complete the visit', exact: true }).click();
    }
    assert((await saved(page)).flags.includes(art.unlock));
    await page.locator('.rpg-party-panel button').click();
    assert.equal(await card.getAttribute('data-unlocked'), 'true');
    await card.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${out}/${art.id}-learned.png` });
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    // Walk back into the standard story; the earned art is used in a real Murmur encounter.
    await page.getByRole('button', { name: 'Walk to Murmur wisp ↗', exact: true }).click();
    const wisp = actors.find((a) => a.id === 'wisp');
    await page.waitForFunction(
      (a) => {
        const p = JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')).position;
        return Math.hypot(p.x - a.x, p.z - a.z) < 0.3;
      },
      wisp,
      { timeout: 180000 },
    );
    await page.getByRole('button', { name: /^E ·/ }).click();
    await story();
    await settle(page);
    assert.equal((await saved(page)).battle.practice, false);
    assert.deepEqual((await saved(page)).battle.arts, [art.id]);
    if (art.owner === 'su') await word(page, 'First Light', 'Murmur Wisp');
    const before = (await saved(page)).battle;
    await page.getByRole('button', { name: /^✦ Word arts/ }).click();
    const move = page.locator('.exp-word-grid button').filter({ hasText: art.name });
    assert(await move.isEnabled());
    await move.click();
    await page
      .locator('.exp-target-list button')
      .filter({ hasText: art.owner === 'su' ? 'Patrick' : 'Murmur Wisp' })
      .click();
    assert.deepEqual((await saved(page)).battle, before, 'English preview spends no turn');
    await page.screenshot({ path: `${out}/${art.id}-english.png` });
    await record();
    await settle(page);
    const after = (await saved(page)).battle;
    if (art.id === 'shelter') {
      assert(after.heroes[0].guard);
      assert.equal(after.heroes[0].ap, Math.min(6, before.heroes[0].ap + 1));
      assert.equal(after.heroes[0].hp, before.heroes[0].hp);
    } else {
      assert(after.foes[0].exposed && after.foes[0].weakened);
      assert(after.foes[0].hp < before.foes[0].hp);
    }
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /Continue adventure/ }).click();
    await page.waitForFunction(() => !document.querySelector('.bk-loading'));
    assert.deepEqual((await saved(page)).battle, after, 'earned art and effects survive battle reload');
    report.cases.push({ id: art.id, unlockedThroughFinalReply: true, usedInStory: true, reloaded: true });
    console.log(
      `${art.name}: final quest reply → party art → walked to story battle → spoken command → reload passed`,
    );
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.finished = true;
} catch (e) {
  report.failure = e.stack;
  await page?.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  throw e;
} finally {
  await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
