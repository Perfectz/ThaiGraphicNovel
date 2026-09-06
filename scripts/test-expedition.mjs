import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshAdventure, flag, startBattle, updateBattle } from '../src/bangkok/adventure.ts';
import { partyAction } from '../src/bangkok/expeditionCombat.ts';
import { adventureState as state, settle, word, finishFight } from './expedition-test-helpers.mjs';
const out = 'artifacts/battle-audio/full-combat',
  base = 'http://127.0.0.1:5188/';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  channel: 'chrome',
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
const errors = [],
  cues = [];
let last,
  finished = false;
function fixture(id) {
  let s = freshAdventure();
  for (const f of ['intro', 'innkeeper', 'cook', 'ferry', 'chest', ...(id === 'keeper' ? ['murmur'] : [])])
    s = flag(s, f);
  return startBattle(s, id);
}
async function open(s, phone = false, mic = true) {
  const c = await browser.newContext({
    viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    permissions: mic ? ['microphone'] : [],
    isMobile: phone,
    hasTouch: phone,
  });
  await c.addInitScript((s) => {
    if (!sessionStorage.getItem('fixture')) {
      localStorage.setItem('bangkok-rift-adventure-v1', JSON.stringify(s));
      sessionStorage.setItem('fixture', '1');
    }
  }, s);
  if (!mic)
    await c.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = async () => {
        throw new DOMException('Denied', 'NotAllowedError');
      };
    });
  const p = await c.newPage();
  last = p;
  p.setDefaultTimeout(45000);
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await p.exposeFunction('reportBattleCue', (cue) => cues.push(cue));
  await p.addInitScript(() =>
    window.addEventListener('bangkok-battle-cue', (e) => window.reportBattleCue(e.detail)),
  );
  await p.goto(base);
  await p.getByRole('button', { name: /Continue adventure/ }).click();
  await p.waitForFunction(() => !document.querySelector('.bk-loading'));
  await settle(p);
  return { p, c };
}
try {
  const { p, c } = await open(fixture('keeper'));
  await p.waitForTimeout(2000);
  await p.screenshot({ path: `${out}/01-arena.png` });
  await p.getByRole('button', { name: /^✦ Word arts/ }).click();
  assert.equal(await p.locator('.exp-word-grid strong[lang=en]').count(), 4);
  await p.screenshot({ path: `${out}/02-word-arts.png` });
  const before = await state(p);
  await p.locator('.exp-word-grid button').filter({ hasText: 'First Light' }).click();
  await p.locator('.exp-target-list button').filter({ hasText: 'Lantern Echo' }).click();
  assert.deepEqual((await state(p)).battle, before.battle);
  assert((await p.locator('.speak-preview h3').innerText()).length > 1);
  assert(await p.getByRole('button', { name: 'Use my spoken reply →', exact: true }).isDisabled());
  const audio = p.waitForResponse((r) => r.url().endsWith('/bangkok/voices/hello.mp3'));
  await p.getByRole('button', { name: '♫ Hear this line', exact: true }).click();
  assert((await audio).ok());
  await p.getByRole('button', { name: '◉ Record this line', exact: true }).click();
  await p.getByRole('button', { name: '■ Stop recording', exact: true }).waitFor();
  assert(await p.getByRole('button', { name: '← Commands', exact: true }).isDisabled());
  await p.waitForTimeout(600);
  await p.getByRole('button', { name: '■ Stop recording', exact: true }).click();
  await p.getByRole('button', { name: '▷ Play my recording', exact: true }).click();
  await p.screenshot({ path: `${out}/03-thai-rehearsal.png` });
  await p.getByRole('button', { name: 'Use my spoken reply →', exact: true }).click();
  await settle(p);
  assert.equal((await state(p)).battle.turn, 1);
  assert.equal((await state(p)).battle.foes[1].hp, 58);
  assert.equal((await state(p)).hp, 100);
  assert.equal(
    await p.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-training-v1')).records.hello.spoken),
    1,
  );
  await word(p, 'Echo Lens', 'Keeper of Unsaid Words');
  assert((await state(p)).battle.foes[0].exposed);
  assert.equal((await state(p)).battle.phase, 'defense');
  await p.screenshot({ path: `${out}/04-defense.png` });
  const checkpoint = await state(p);
  await p.reload();
  await p.getByRole('button', { name: /Continue adventure/ }).click();
  await settle(p);
  assert.deepEqual((await state(p)).battle, checkpoint.battle);
  // Drive the actual keyboard handler from the visible timing meter (no model injection).
  await p.getByRole('button', { name: 'Face the attack', exact: true }).click();
  await p.waitForFunction(
    () => Number(document.querySelector('.exp-timing')?.getAttribute('aria-valuenow')) >= 82,
    {},
    { polling: 'raf' },
  );
  await p.keyboard.press('f');
  await settle(p);
  assert.equal((await state(p)).battle.event.kind, 'parry');
  assert.equal((await state(p)).hp, 100);
  await p.getByRole('button', { name: 'Face the attack', exact: true }).click();
  await p.waitForFunction(
    () => Number(document.querySelector('.exp-timing')?.getAttribute('aria-valuenow')) >= 69,
    {},
    { polling: 'raf' },
  );
  await p.keyboard.press('Space');
  await settle(p);
  assert.equal((await state(p)).battle.event.kind, 'dodge');
  assert.equal((await state(p)).battle.round, 2);
  await word(p, 'Clear Intent', 'Keeper of Unsaid Words');
  assert.equal((await state(p)).battle.event.value, 63);
  await finishFight(p, 'keeper');
  assert((await state(p)).flags.includes('keeper'));
  await p.screenshot({ path: `${out}/05-victory-world.png` });
  await c.close();
  console.log(
    'PASS desktop: English move meanings, safe preview, selected Thai audio, recording/playback, party turns, exposure combo, real keyboard parry/dodge, reload and full Keeper victory.',
  );
  const { p: phone, c: pc } = await open(fixture('murmur'), true, false);
  await phone.waitForTimeout(1500);
  await phone.screenshot({ path: `${out}/06-phone-arena.png` });
  await phone.getByRole('button', { name: /^✦ Word arts/ }).click();
  await phone.locator('.exp-word-grid button').filter({ hasText: 'First Light' }).click();
  await phone.locator('.exp-target-list button').filter({ hasText: 'Lantern Echo' }).click();
  await phone.getByRole('button', { name: '◉ Record this line', exact: true }).click();
  await phone.getByText(/Microphone unavailable or permission denied/).waitFor();
  assert(await phone.getByRole('button', { name: 'Use my spoken reply →', exact: true }).isDisabled());
  await phone.screenshot({ path: `${out}/07-phone-phrase.png` });
  await phone.getByRole('button', { name: 'Use text only this time', exact: true }).click();
  await settle(phone);
  assert.equal(
    await phone.evaluate(
      () => JSON.parse(localStorage.getItem('bangkok-rift-training-v1')).records.hello.spoken,
    ),
    0,
  );
  await word(phone, 'Kindred Spark', 'Lantern Echo');
  await phone.getByRole('button', { name: 'Face the attack', exact: true }).click();
  await phone.getByRole('button', { name: /SPACE · Dodge/ }).click();
  await settle(phone);
  assert.equal((await state(phone)).battle.event.kind, 'strike');
  assert((await state(phone)).hp < 100);
  await phone.getByRole('button', { name: 'Steady guard · no timing', exact: true }).click();
  await settle(phone);
  await phone.getByRole('button', { name: /^▣ Provisions/ }).click();
  await phone.locator('.exp-word-grid button').filter({ hasText: 'Rice parcel' }).click();
  await phone.locator('.exp-target-list button').filter({ hasText: 'Patrick' }).click();
  await settle(phone);
  assert.equal((await state(phone)).battle.heroes[0].hp, 100);
  assert.equal((await state(phone)).rice, 0);
  assert(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await finishFight(phone, 'murmur');
  await pc.close();
  console.log(
    'PASS phone: target selection, denied mic/text-only separation, early dodge misses, no-timing defense, targeted provisions, complete Murmur encounter, no overflow.',
  );
  let doomed = fixture('murmur');
  doomed.battle.heroes.forEach((h) => (h.hp = 1));
  doomed = updateBattle(doomed, partyAction(partyAction(doomed.battle, 'guard'), 'guard'));
  const { p: d, c: dc } = await open(doomed);
  await d.getByRole('button', { name: 'Steady guard · no timing', exact: true }).click();
  await settle(d);
  await d.getByRole('button', { name: 'Steady guard · no timing', exact: true }).click();
  await settle(d);
  assert.equal((await state(d)).battle.phase, 'defeat');
  await d.getByRole('button', { name: 'Return to the inn', exact: true }).click();
  assert.equal((await state(d)).hp, 35);
  assert((await state(d)).flags.includes('chest'));
  await dc.close();
  assert.deepEqual(errors, []);
  for (const cue of ['parry', 'dodge', 'victory', 'defeat', 'heal', 'hurt'])
    assert(
      cues.some((c) => c.cue === cue && c.played),
      `Played ${cue} during actual combat`,
    );
  finished = true;
  console.log('PASS defeat recovery and no browser errors.');
} catch (e) {
  console.error(
    await last
      ?.locator('body')
      .innerText()
      .catch(() => ''),
  );
  await last?.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  throw e;
} finally {
  await writeFile(`${out}/progress.json`, JSON.stringify({ finished, errors, cues }, null, 2));
  await browser.close();
}
