import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { actors, freshAdventure, flag, startBattle, startPracticeBattle } from '../src/bangkok/adventure.ts';
import { battleSite } from '../src/bangkok/battleStaging.ts';
import { adventureState, word, settle } from './expedition-test-helpers.mjs';
const phone = process.argv.includes('--phone'),
  reduced = process.argv.includes('--reduced');
const base = process.env.PLAYTEST_BASE_URL ?? 'http://127.0.0.1:5188/';
const local = base.includes('127.0.0.1');
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7);
const out = `artifacts/battle-sites/${local ? 'local' : 'public'}-${phone ? 'phone' : 'desktop'}${reduced ? '-reduced' : ''}${only ? '-' + only : ''}`;
await mkdir(out, { recursive: true });
const report = { finished: false, base, phone, reduced, cases: [], errors: [] };
const browser = await chromium.launch({
  headless: true,
  channel: 'chrome',
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
let page;
try {
  for (const id of ['murmur', 'keeper', 'sentinel', 'practice'].filter((id) => !only || id === only)) {
    const context = await browser.newContext({
      viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      isMobile: phone,
      hasTouch: phone,
      permissions: ['microphone'],
      reducedMotion: reduced ? 'reduce' : 'no-preference',
    });
    let s = freshAdventure();
    for (const f of [
      'intro',
      'innkeeper',
      'cook',
      'ferry',
      'station',
      ...(id === 'keeper' ? ['murmur'] : []),
    ])
      s = flag(s, f);
    const contact = actors.find(
      (a) =>
        a.id ===
        (id === 'murmur'
          ? 'wisp'
          : id === 'keeper'
            ? 'shrine'
            : id === 'sentinel'
              ? 'waystone'
              : 'innkeeper'),
    );
    s.position = { x: contact.x - 0.8, z: contact.z };
    s = id === 'practice' ? startPracticeBattle(s) : startBattle(s, id);
    const expectedSite = battleSite(s.battle);
    await context.addInitScript((s) => {
      if (!sessionStorage.getItem('battle-site-fixture')) {
        localStorage.setItem('bangkok-rift-adventure-v1', JSON.stringify(s));
        sessionStorage.setItem('battle-site-fixture', '1');
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
    await page.getByLabel('Battle location').filter({ hasText: expectedSite.name }).waitFor();
    await settle(page);
    if (local)
      await page.waitForFunction(
        (id) => JSON.parse(document.querySelector('.bk-world')?.dataset.battleSite ?? '{}').site?.id === id,
        expectedSite.id,
      );
    await page.waitForTimeout(2200);
    const snapshot = local
      ? await page.locator('.bk-world').evaluate((h) => JSON.parse(h.dataset.battleSite))
      : null;
    if (snapshot) {
      assert.equal(snapshot.practiceEnvironment, id === 'practice');
      assert.deepEqual(snapshot.site, expectedSite);
      assert.equal(snapshot.cast.length, 4);
      if (id === 'murmur') assert(snapshot.districts.includes('lumphini'));
      if (id === 'keeper') assert(snapshot.districts.includes('oldtown'));
      for (const member of snapshot.cast) {
        assert(
          member.screen.x > 0 && member.screen.x < (phone ? 390 : 1440),
          `${id}/${member.id} horizontally framed`,
        );
        assert(
          member.screen.y > 90 && member.screen.y < (phone ? 844 : 900),
          `${id}/${member.id} vertically framed`,
        );
      }
      if (phone) {
        const patrick = snapshot.cast.find((c) => c.id === 'patrick').screen,
          su = snapshot.cast.find((c) => c.id === 'su').screen;
        assert(
          Math.hypot(patrick.x - su.x, patrick.y - su.y) > 42,
          'party silhouettes must have separate screen space',
        );
      }
    }
    await page.screenshot({ path: `${out}/${id}-formation.png` });
    const before = await adventureState(page);
    await page.getByRole('button', { name: /^✦ Word arts/ }).click();
    await page.locator('.exp-word-grid button').filter({ hasText: 'First Light' }).click();
    await page.locator('.exp-target-list button').filter({ hasText: before.battle.foes[1].name }).click();
    assert((await page.locator('.speak-preview h3[lang=en]').innerText()).length > 0);
    assert.deepEqual(
      (await adventureState(page)).battle,
      before.battle,
      'preview does not spend a combat turn',
    );
    await page.screenshot({ path: `${out}/${id}-english.png` });
    await page.getByRole('button', { name: 'Use text only this time', exact: true }).click();
    await settle(page);
    const acted = await adventureState(page);
    assert(acted.battle.foes[1].hp < before.battle.foes[1].hp);
    assert.deepEqual(acted.position, before.position, 'fighting does not teleport the saved traveller');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /Continue adventure/ }).click();
    await page.getByLabel('Battle location').filter({ hasText: expectedSite.name }).waitFor();
    await page.waitForFunction(() => !document.querySelector('.bk-loading'));
    assert.deepEqual((await adventureState(page)).battle, acted.battle);
    await word(page, 'Kindred Spark', acted.battle.foes[0].name, id === 'murmur');
    await page.getByRole('button', { name: 'Steady guard · no timing', exact: true }).waitFor();
    await page.screenshot({ path: `${out}/${id}-defense.png` });
    await page.getByRole('button', { name: 'Steady guard · no timing', exact: true }).click();
    await settle(page);
    for (let n = 0; n < 3 && (await adventureState(page)).battle.phase === 'defense'; n++) {
      await page.getByRole('button', { name: 'Steady guard · no timing', exact: true }).click();
      await settle(page);
    }
    // Retreat returns to the exact saved approach; no victory flags can be granted.
    const leave = page.getByRole('button', { name: 'Retreat', exact: true });
    await leave.click();
    await page.locator('.rpg-screen-world').waitFor();
    const after = await adventureState(page);
    assert.equal(after.battle, null);
    assert.deepEqual(after.position, before.position);
    assert.deepEqual(after.flags, before.flags);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${out}/${id}-returned.png` });
    report.cases.push({ id, site: expectedSite, snapshot, restoredPosition: after.position });
    console.log(`${id}: world formation, English preview, reload, defense and return passed`);
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
