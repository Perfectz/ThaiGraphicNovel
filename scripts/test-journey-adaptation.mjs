import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { freshAdventure, moveAdventure } from '../src/bangkok/adventure.ts';
import { freshTraining, localDate, addDays, recordAttempt } from '../src/bangkok/learning.ts';
import {
  beginJourney,
  freshJourneys,
  journeyHosts,
  journeyPhrase,
  journeyIsRecall,
  recordJourneyPractice,
} from '../src/bangkok/cityJourneys.ts';
import ts from 'typescript';
// Erase inline type-only imports, which Node's type stripping leaves as empty imports.
const lessons = ts.transpileModule(await readFile('src/data/lessonScenarios.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { lessonScenarios } = await import(
  `data:text/javascript;base64,${Buffer.from(lessons.outputText).toString('base64')}`
);
const phrases = Object.fromEntries(
  lessonScenarios.flatMap((s) => s.chunks.flatMap((c) => c.phrases)).map((p) => [p.id, p]),
);
const today = localDate(),
  only = process.argv.find((a) => a.startsWith('--only='))?.slice(7);
const out = `artifacts/journey-adaptation/browser${only ? '/' + only : ''}`;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  channel: 'chrome',
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
const report = { scenes: [], errors: [], finished: false };
let page;
const checkpoint = () => writeFile(`${out}/progress.json`, JSON.stringify(report, null, 2));
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')));
const training = () => page.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-training-v1')));
const ready = () =>
  page.waitForFunction(
    () =>
      document.querySelector('.bk-world')?.dataset.npcReady === '6' && !document.querySelector('.bk-loading'),
    null,
    { timeout: 180000 },
  );
async function capture(name) {
  await page.screenshot({ path: `${out}/${name}.png` });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
}
async function visit() {
  await page.keyboard.press('e');
  await page.locator('.journey-visit').waitFor();
  await page.waitForFunction(() => {
    const cast = JSON.parse(document.querySelector('.bk-world').dataset.conversationCast ?? 'null');
    return cast && !cast.moving;
  });
}
async function reload() {
  await page.reload();
  await page.getByRole('button', { name: /Continue adventure/ }).click();
  await ready();
}
async function answer({ hint = false, spoken = false } = {}) {
  const before = await saved(),
    a = before.journeys.active,
    id = journeyPhrase(a),
    t = await training();
  assert(journeyIsRecall(a));
  if (a.step >= 3) await page.locator(`.journey-intent-choices button[data-intention="${id}"]`).click();
  assert.equal(await page.locator('.journey-recall [lang="th"]').count(), 0);
  assert.equal(await page.locator('.journey-recall [lang="en"]').innerText(), phrases[id].translation);
  assert((await page.locator('.journey-situation').innerText()).length > 35);
  if (hint) {
    await page.getByRole('button', { name: 'Show me the Thai first', exact: true }).click();
    assert(await page.getByRole('button', { name: 'I recalled it →', exact: true }).isDisabled());
  } else if (spoken) {
    await page.getByRole('button', { name: '◉ Say it from memory', exact: true }).click();
    await page.getByRole('button', { name: '■ Stop recording', exact: true }).waitFor();
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: '■ Stop recording', exact: true }).click();
    await page.getByRole('button', { name: 'Compare with the Thai →', exact: true }).waitFor();
    assert.deepEqual((await training()).records, t.records);
    await page.getByRole('button', { name: 'Compare with the Thai →', exact: true }).click();
    await page.getByRole('button', { name: '▷ Play my recording', exact: true }).waitFor();
  } else
    await page
      .getByRole('button', { name: 'I said it aloud · compare without a recording', exact: true })
      .click();
  assert.equal(await page.locator('.journey-recall [lang="th"]').innerText(), phrases[id].targetPhrase);
  const result = { spoken, recalled: !hint, hinted: hint },
    expected = recordJourneyPractice(t, a, result, today);
  await page
    .getByRole('button', { name: hint ? 'Needs more practice →' : 'I recalled it →', exact: true })
    .click();
  await page.waitForFunction(({ stop, step }) => {
    const a = JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')).journeys.active;
    return !a || a.stop !== stop || a.step !== step;
  }, a);
  const after = await training();
  assert.deepEqual(after.records, expected.records);
  assert.equal(after.xp, expected.xp);
  assert.equal(after.dailyPractice[today].spoken, expected.dailyPractice[today].spoken);
  assert.equal(after.dailyPractice[today].recalls, expected.dailyPractice[today].recalls);
  return id;
}
try {
  for (const c of [
    { name: 'familiar-hotel', familiar: true },
    { name: 'new-phone', phone: true },
    { name: 'legacy', legacy: true },
    { name: 'eighteen-recalls', familiar: true, ending: true },
  ].filter((c) => !only || c.name === only)) {
    report.phase = c.name;
    await checkpoint();
    let t = freshTraining();
    if (c.familiar)
      for (const id of new Set(Object.values(journeyHosts).flatMap((h) => h.pool)))
        for (const date of [addDays(today, -6), addDays(today, -3)])
          t = recordAttempt(t, id, 'recall', true, date);
    let s = moveAdventure(freshAdventure(), c.ending ? { x: 35, z: 15 } : { x: -50, z: 26 });
    s.flags = ['intro', 'innkeeper'];
    s.coins = 55;
    s.xp = 90;
    if (c.legacy || c.ending) {
      s.journeys = beginJourney(freshJourneys(), t, today);
      if (c.legacy) {
        delete s.journeys.active.challenge;
        s.journeys.active.step = 3;
      } else {
        s.journeys.active.stop = 2;
        s.journeys.active.step = 5;
        s.journeys.active.recalled = 17;
      }
    }
    const context = await browser.newContext({
      viewport: c.phone ? { width: 390, height: 844 } : { width: 1280, height: 900 },
      isMobile: !!c.phone,
      hasTouch: !!c.phone,
      permissions: ['microphone'],
    });
    await context.addInitScript(
      ({ s, t }) => {
        if (!localStorage.getItem('bangkok-rift-adventure-v1'))
          localStorage.setItem('bangkok-rift-adventure-v1', JSON.stringify(s));
        if (!localStorage.getItem('bangkok-rift-training-v1'))
          localStorage.setItem('bangkok-rift-training-v1', JSON.stringify(t));
      },
      { s, t },
    );
    page = await context.newPage();
    page.setDefaultTimeout(120000);
    page.on('pageerror', (e) => report.errors.push({ scene: c.name, message: e.message }));
    page.on('console', (m) => {
      if (m.type() === 'error') report.errors.push({ scene: c.name, message: m.text() });
    });
    await page.goto('http://127.0.0.1:5188/');
    await page.getByRole('button', { name: /Continue adventure/ }).click();
    await ready();
    if (!c.legacy && !c.ending) {
      await page.getByRole('button', { name: 'Journeys', exact: true }).click();
      await page.getByRole('button', { name: 'Begin this outing →', exact: true }).click();
    }
    const plan = (await saved()).journeys.active;
    await visit();
    await capture(c.name + '-first');
    if (c.ending) {
      await answer();
      await page.locator('.journey-stamp').waitFor();
      const done = await saved();
      assert.equal(done.journeys.completed[0].recalled, 18);
      assert.equal(done.coins, 75);
      assert.equal(done.xp, 150);
      assert.equal(done.rice, s.rice + 1);
      await capture(c.name + '-stamp');
      await reload();
      assert.equal((await saved()).journeys.completed[0].recalled, 18);
      assert.equal((await saved()).coins, 75);
    } else if (c.legacy) {
      assert.equal(journeyPhrase(plan), plan.queues[0][0]);
      await answer();
      await page.getByRole('button', { name: 'Leave travel conversation', exact: true }).click();
      const checkpointSave = await saved();
      await reload();
      assert.deepEqual(await saved(), checkpointSave);
      assert.equal((await saved()).journeys.active.challenge, undefined);
      await visit();
      assert.equal(journeyPhrase((await saved()).journeys.active), plan.queues[0][1]);
      await capture(c.name + '-resumed');
    } else if (c.phone) {
      assert(plan.challenge.firstRecall.flat().every((v) => !v));
      assert.equal(await page.locator('.journey-recall').count(), 0);
      const id = journeyPhrase(plan);
      assert.equal(await page.locator('.speak-preview h3[lang="en"]').innerText(), phrases[id].translation);
      await page.getByRole('button', { name: 'Use text only this time', exact: true }).click();
      assert.equal((await saved()).journeys.active.step, 1);
      assert.equal((await training()).dailyPractice[today].spoken, 0);
      assert.equal((await training()).dailyPractice[today].recalls, 0);
      await page.getByRole('button', { name: 'Leave travel conversation', exact: true }).click();
      await page.getByRole('button', { name: 'Journeys', exact: true }).click();
      await capture(c.name + '-passport');
      await page.getByRole('button', { name: 'Pause mission · return to story', exact: true }).click();
      const paused = await saved();
      assert(paused.journeys.active.paused);
      await page.getByRole('button', { name: 'Train at camp', exact: true }).click();
      await page.getByRole('button', { name: /(Begin|Continue) your journey/ }).waitFor();
      await page.getByRole('button', { name: /Return to the adventure/ }).click();
      await page.getByRole('button', { name: /Continue adventure/ }).click();
      await ready();
      assert.deepEqual(await saved(), paused);
    } else {
      assert(plan.challenge.firstRecall.flat().every(Boolean));
      for (let i = 0; i < 6; i++) {
        const a = (await saved()).journeys.active;
        assert.equal(a.step, i);
        assert.equal(a.stop, 0);
        if (i === 3) {
          assert.notDeepEqual(
            [3, 4, 5].map((step) => journeyPhrase({ ...a, step })),
            plan.queues[0],
          );
          await capture(c.name + '-shuffled');
        }
        const id = await answer({ spoken: i === 0, hint: i === 1 });
        if (i === 0) {
          const after = await training();
          assert.equal(after.records[id].recalled, t.records[id].recalled + 1);
          assert.equal(after.records[id].spoken, 1);
          await page.getByRole('button', { name: 'Leave travel conversation', exact: true }).click();
          const checkpointSave = await saved();
          await reload();
          assert.deepEqual(await saved(), checkpointSave);
          assert.deepEqual((await saved()).journeys.active.challenge, plan.challenge);
          await visit();
          await capture(c.name + '-resumed');
        }
        if (i === 1) {
          assert.equal((await training()).records[id].due, today);
          assert.equal((await training()).records[id].interval, 0);
        }
      }
      const after = await saved();
      assert.equal(after.journeys.active.stop, 1);
      assert.equal(after.journeys.active.recalled, 5);
      assert.equal(after.journeys.active.spoken, 1);
      assert.equal(after.coins, 55);
      assert.equal(after.xp, 90);
      await page.getByRole('button', { name: 'Journeys', exact: true }).click();
      await capture(c.name + '-next-stop');
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
