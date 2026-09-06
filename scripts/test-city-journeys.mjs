import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshAdventure, actors } from '../src/bangkok/adventure.ts';
import { cityAreaAt } from '../src/bangkok/city.ts';
import { beginJourney, freshJourneys, journeyPhrase } from '../src/bangkok/cityJourneys.ts';
import { freshTraining } from '../src/bangkok/learning.ts';

const out = 'artifacts/journey-intentions/full-route';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  channel: 'chrome',
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
let page, hintedPhrase, recalledPhrase;
const errors = [],
  audio = [],
  report = { stops: [], recorded: false, reloaded: false, phone: false, finished: false };
const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')));
const training = () => page.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-training-v1')));
async function checkpoint() {
  await writeFile(`${out}/progress.json`, JSON.stringify(report, null, 2));
}
async function start(context, fixture) {
  await context.addInitScript((s) => {
    if (!localStorage.getItem('bangkok-rift-adventure-v1'))
      localStorage.setItem('bangkok-rift-adventure-v1', JSON.stringify(s));
  }, fixture);
  page = await context.newPage();
  page.setDefaultTimeout(45000);
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('response', (r) => {
    if (r.url().includes('/bangkok/voices/') && r.ok()) audio.push({ url: r.url(), status: r.status() });
  });
  await page.goto('http://127.0.0.1:5188/');
  await page.getByRole('button', { name: /Continue adventure/ }).click();
  await page.waitForFunction(() => !document.querySelector('.bk-loading'));
  assert.equal(await page.locator('vite-error-overlay').count(), 0);
}
async function walk(id) {
  const npc = actors.find((a) => a.id === id);
  await page.getByRole('button', { name: 'Open town map ↗', exact: true }).click();
  await page.locator(`.city-map button[data-area="${cityAreaAt(npc)}"]`).click();
  await page.locator('.city-contacts button').filter({ hasText: npc.name }).click();
  await page.locator('.journey-visit').waitFor({ timeout: 240000 });
  assert.equal(cityAreaAt((await state()).position), cityAreaAt(npc));
}
async function record(name) {
  await page.getByRole('button', { name, exact: true }).click();
  await page.getByRole('button', { name: '■ Stop recording', exact: true }).waitFor();
  await page.waitForTimeout(550);
  await page.getByRole('button', { name: '■ Stop recording', exact: true }).click();
}
async function waitStep(step) {
  await page.waitForFunction(
    (step) => JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')).journeys.active?.step === step,
    step,
  );
}
try {
  await checkpoint();
  const fixture = freshAdventure();
  fixture.flags = ['intro', 'innkeeper'];
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    permissions: ['microphone'],
  });
  await start(context, fixture);
  await page.getByRole('button', { name: 'Journeys', exact: true }).click();
  await page.screenshot({ path: `${out}/01-passport.png` });
  await page.getByRole('button', { name: 'Begin this outing →', exact: true }).click();
  await page.getByRole('button', { name: 'Journeys', exact: true }).click();
  await page.getByRole('button', { name: 'Pause mission · return to story', exact: true }).click();
  assert((await state()).journeys.active.paused);
  assert((await page.locator('.rpg-objective').innerText()).includes('MAIN STORY'));
  await page.getByRole('button', { name: 'Journeys', exact: true }).click();
  await page.getByRole('button', { name: 'Resume mission · open map', exact: true }).click();
  await page.getByRole('button', { name: /Close/ }).last().click();
  assert.equal((await state()).journeys.active.paused, false);
  const before = await state();
  for (const [stop, id] of ['innkeeper', 'station', 'cook'].entries()) {
    console.log('Walking to journey stop', stop + 1, id);
    await walk(id);
    for (let step = 0; step < 3; step++) {
      assert((await page.locator('.speak-preview h3[lang="en"]').innerText()).length > 1);
      if (stop === 0 && step === 0) {
        const referenceReady = page.waitForResponse(
          (r) => r.url().includes('/bangkok/voices/hello.mp3') && r.ok(),
        );
        await page.getByRole('button', { name: '♫ Hear this line', exact: true }).click();
        await referenceReady;
        await record('◉ Record this line');
        await page.getByRole('button', { name: '▷ Play my recording', exact: true }).click();
        await page.getByRole('button', { name: 'Use my spoken reply →', exact: true }).click();
        report.recorded = true;
      } else await page.getByRole('button', { name: 'Use text only this time', exact: true }).click();
      await waitStep(step + 1);
      if (stop === 0 && step === 1) {
        const saved = await state();
        await page.reload();
        await page.getByRole('button', { name: /Continue adventure/ }).click();
        assert.deepEqual((await state()).journeys, saved.journeys);
        await page.waitForFunction(() => !document.querySelector('.bk-loading'));
        await walk(id);
        report.reloaded = true;
      }
    }
    for (let step = 3; step < 6; step++) {
      const intention = journeyPhrase((await state()).journeys.active);
      await page.locator(`.journey-intent-choices button[data-intention="${intention}"]`).click();
      assert.equal(
        await page.locator('.journey-recall [lang="th"]').count(),
        0,
        'Thai must be hidden until the attempt',
      );
      assert((await page.locator('.journey-recall [lang="en"]').innerText()).length > 1);
      if (stop === 0 && step === 3) {
        hintedPhrase = journeyPhrase((await state()).journeys.active);
        await page.screenshot({ path: `${out}/02-memory-before-reveal.png` });
        await page.getByRole('button', { name: 'Show me the Thai first', exact: true }).click();
        assert(await page.getByRole('button', { name: 'I recalled it →', exact: true }).isDisabled());
        await page.getByRole('button', { name: 'Needs more practice →', exact: true }).click();
      } else {
        if (stop === 0 && step === 4) {
          recalledPhrase = journeyPhrase((await state()).journeys.active);
          await record('◉ Say it from memory');
          await page.getByRole('button', { name: 'Compare with the Thai →', exact: true }).click();
          await page.screenshot({ path: `${out}/03-memory-comparison.png` });
        } else
          await page
            .getByRole('button', { name: 'I said it aloud · compare without a recording', exact: true })
            .click();
        await page.getByRole('button', { name: 'I recalled it →', exact: true }).click();
      }
      if (step < 5) await waitStep(step + 1);
    }
    await page.locator('.journey-visit').waitFor({ state: 'hidden' });
    report.stops.push(id);
    await checkpoint();
  }
  await page.locator('.journey-passport .journey-stamp').waitFor();
  const after = await state(),
    learned = await training();
  assert.deepEqual(
    after.journeys.completed.map((c) => ({ id: c.id, spoken: c.spoken, recalled: c.recalled })),
    [{ id: 1, spoken: 2, recalled: 8 }],
  );
  assert.equal(after.xp, before.xp + 60);
  assert.equal(after.coins, before.coins + 20);
  assert.equal(after.rice, before.rice + 1);
  assert.equal(learned.records[hintedPhrase].recalled, 0);
  assert.equal(learned.records[hintedPhrase].interval, 0);
  assert.equal(learned.records[recalledPhrase].recalled, 1);
  for (const id of new Set(['hello', recalledPhrase]))
    assert.equal(learned.records[id].spoken, Number(id === 'hello') + Number(id === recalledPhrase));
  assert(audio.length > 0);
  await page.screenshot({ path: `${out}/04-reward.png` });
  await page.getByRole('button', { name: 'Rehearse my last outing', exact: true }).click();
  assert((await state()).journeys.active.replay);
  assert.equal((await state()).coins, after.coins);
  await page.reload();
  await page.getByRole('button', { name: /Continue adventure/ }).click();
  assert.equal((await state()).journeys.completed.length, 1);
  await context.close();

  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await phone.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException('Test microphone denial', 'NotAllowedError');
    };
  });
  const pf = freshAdventure();
  pf.flags = ['intro', 'innkeeper'];
  pf.position = { x: -50, z: 26 };
  pf.journeys = beginJourney(freshJourneys(), freshTraining(), '2026-09-04');
  pf.journeys.active.step = 3;
  await start(phone, pf);
  await walk('innkeeper');
  await page
    .locator(
      `.journey-intent-choices button[data-intention="${journeyPhrase((await state()).journeys.active)}"]`,
    )
    .tap();
  await page.getByRole('button', { name: '◉ Say it from memory', exact: true }).tap();
  await page
    .getByText('Microphone unavailable or permission denied. Phrase choices keep the session playable.', {
      exact: true,
    })
    .waitFor();
  await page.screenshot({ path: `${out}/05-phone-memory.png` });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.getByRole('button', { name: 'Show me the Thai first', exact: true }).tap();
  await page.getByRole('button', { name: 'Needs more practice →', exact: true }).tap();
  await waitStep(4);
  await page.getByRole('button', { name: 'Leave travel conversation', exact: true }).tap();
  await page.getByRole('button', { name: 'Journeys', exact: true }).tap();
  await page.screenshot({ path: `${out}/06-phone-passport.png` });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  report.phone = true;
  await phone.close();
  assert.deepEqual(errors, []);
  report.finished = true;
  report.errors = errors;
  await checkpoint();
  console.log('PASS city journey', JSON.stringify(report));
} catch (e) {
  report.error = String(e);
  await checkpoint();
  console.error(
    await page
      ?.locator('body')
      .innerText()
      .catch(() => ''),
  );
  await page?.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  throw e;
} finally {
  await browser.close();
}
