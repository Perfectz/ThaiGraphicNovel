import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshAdventure, actors } from '../src/bangkok/adventure.ts';
const gatherOnly = process.argv.includes('--gather-only');
const only = process.argv.find((a) => a.startsWith('--route='))?.split('=')[1];
const out = `artifacts/reunion/${gatherOnly ? 'gathering-check' : 'browser'}`;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  channel: 'chrome',
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
const report = { finished: false, cases: [], errors: [] };
let page;
const checkpoint = () => writeFile(`${out}/progress.json`, JSON.stringify(report, null, 2));
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')));
async function ready() {
  await page.waitForFunction(
    () =>
      document.querySelector('.bk-world')?.dataset.npcReady === '6' && !document.querySelector('.bk-loading'),
    null,
    { timeout: 120000 },
  );
}
async function walk(id) {
  report.step = `${report.route}:walk-${id}`;
  await checkpoint();
  const actor = actors.find((a) => a.id === id);
  await page.getByRole('button', { name: 'Journal', exact: true }).click();
  await page
    .locator('[data-quest="reunion"]')
    .getByRole('button', { name: `Walk to ${actor.name.split(' · ')[0]} ↗`, exact: true })
    .click();
  await page.waitForFunction(
    (a) => {
      const s = JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1'));
      return Math.hypot(s.position.x - a.x, s.position.z - a.z) < 2.1;
    },
    actor,
    { timeout: 180000 },
  );
  await page.getByRole('button', { name: 'Continue A Promise Kept', exact: true }).click();
  await page.getByRole('region', { name: 'A Promise Kept', exact: true }).waitFor();
}
async function reply(id, spoken = false) {
  await page.waitForFunction(() => {
    const c = JSON.parse(document.querySelector('.bk-world')?.dataset.conversationCast ?? 'null');
    return c && !c.moving;
  });
  const before = await saved();
  const row = page.locator(`[data-phrase-choice="${id}"]`);
  const meaning = await row.locator('.choice-meaning').innerText();
  assert(meaning.length > 2);
  await row.click();
  await page.locator('.speak-preview h3').waitFor();
  assert.equal(await page.locator('.speak-preview h3').innerText(), meaning);
  assert.deepEqual(await saved(), before, 'meaning preview has no story effect');
  if (spoken) {
    await page.getByRole('button', { name: '♫ Hear this line', exact: true }).click();
    await page.waitForFunction(() =>
      window.voiceSamples.some(
        (a) => a.currentSrc.includes('/bangkok/voices/') && !a.paused && a.currentTime > 0,
      ),
    );
    await page.getByRole('button', { name: '◉ Record this line', exact: true }).click();
    await page.getByRole('button', { name: '■ Stop recording', exact: true }).waitFor();
    await page.waitForTimeout(700);
    await page.getByRole('button', { name: '■ Stop recording', exact: true }).click();
    await page.getByRole('button', { name: 'Use my spoken reply →', exact: true }).click();
  } else await page.getByRole('button', { name: 'Use text only this time', exact: true }).click();
  assert.deepEqual((await saved()).flags, before.flags, 'reply needs explicit story confirmation');
}
async function capture(name, gathering = false) {
  await page.waitForFunction(() => {
    const c = JSON.parse(document.querySelector('.bk-world')?.dataset.conversationCast ?? 'null');
    return c && !c.moving;
  });
  if (gathering)
    await page.waitForFunction(
      () => JSON.parse(document.querySelector('.bk-world')?.dataset.reunionGathering ?? '{}').visible,
    );
  await page.waitForTimeout(500);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: `${out}/${name}.png` });
  if (gathering) {
    const frame = await page.evaluate(() => ({
      g: JSON.parse(document.querySelector('.bk-world').dataset.reunionGathering),
      cast: JSON.parse(document.querySelector('.bk-world').dataset.conversationCast),
      w: innerWidth,
      h: document.querySelector('.rpg-dialogue').getBoundingClientRect().top,
    }));
    assert.equal(frame.g.guests.length, 3);
    const people = [...frame.g.guests, ...frame.cast.members];
    for (const guest of people) {
      assert(guest.screenX > 10 && guest.screenX < frame.w - 10, `${guest.id} horizontal frame`);
      assert(
        guest.screenY > 70 && guest.screenY < frame.h - 12,
        `${guest.id} above dialogue ${guest.screenY}/${frame.h}`,
      );
    }
    for (let i = 0; i < people.length; i++)
      for (let j = i + 1; j < people.length; j++) {
        assert(
          Math.hypot(people[i].screenX - people[j].screenX, people[i].screenY - people[j].screenY) >
            (frame.w < 700 ? 20 : 40),
          `${people[i].id}/${people[j].id} silhouettes overlap`,
        );
      }
    report.gathering = frame;
    await checkpoint();
  }
}
try {
  for (const config of [
    { name: 'evening', phone: false, order: ['innkeeper', 'artisan'] },
    { name: 'tomorrow', phone: true, order: ['artisan', 'innkeeper'] },
  ].filter((c) => !only || c.name === only)) {
    report.route = config.name;
    await checkpoint();
    const s = {
      ...freshAdventure(),
      flags: ['intro', 'innkeeper', 'cook', 'ferry', 'murmur', 'keeper', 'departed'],
      position: { x: -57, z: 29 },
      xp: 350,
    };
    if (gatherOnly) {
      s.flags.push(`reunion-${config.name}`, 'reunion-mali', 'reunion-arun');
      s.trackedQuest = 'reunion';
      s.position = config.phone ? { x: -25, z: 27 } : { x: 35, z: 18 };
    }
    const context = await browser.newContext({
      viewport: config.phone ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      isMobile: config.phone,
      hasTouch: config.phone,
      permissions: ['microphone'],
    });
    await context.addInitScript((s) => {
      if (!localStorage.getItem('bangkok-rift-adventure-v1'))
        localStorage.setItem('bangkok-rift-adventure-v1', JSON.stringify(s));
      window.voiceSamples = [];
      const Native = window.Audio;
      window.Audio = class extends Native {
        constructor(...args) {
          super(...args);
          window.voiceSamples.push(this);
        }
      };
    }, s);
    page = await context.newPage();
    page.setDefaultTimeout(90000);
    page.on('pageerror', (e) => report.errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') report.errors.push(m.text());
    });
    await page.goto('http://127.0.0.1:5188/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /Continue adventure/ }).click();
    await ready();
    assert((await page.locator('.rpg-objective').innerText()).includes('A PROMISE KEPT'));
    if (!gatherOnly) {
      await walk('ferry');
      await capture(`${config.name}-niran`);
      await page
        .getByRole('button', { name: 'Hear Niran', exact: true })
        .count()
        .then(async (n) => {
          if (n) await page.getByRole('button', { name: 'Hear Niran', exact: true }).click();
        });
      await page.waitForFunction(() =>
        window.voiceSamples.some(
          (a) => a.currentSrc.includes('/bangkok/voices/line-') && !a.paused && a.currentTime > 0,
        ),
      );
      const plan = config.name === 'evening' ? 'free-evening' : 'tomorrow-ok';
      await reply(plan);
      await page.getByRole('button', { name: 'Leave reunion conversation', exact: true }).click();
      assert(!(await saved()).flags.some((f) => f.startsWith('reunion-')));
      await page.getByRole('button', { name: 'Continue A Promise Kept', exact: true }).click();
      await reply(plan, !config.phone);
      await page
        .getByRole('button', {
          name: config.phone ? 'Plan tomorrow in Lumphini' : 'Plan an evening in Yaowarat',
          exact: true,
        })
        .click();
      for (const actor of config.order) {
        await walk(actor);
        await reply(actor === 'innkeeper' ? 'go-together' : 'meet-where');
        await page
          .getByRole('button', {
            name: actor === 'innkeeper' ? 'Invite Mali' : 'Agree on the meeting place',
            exact: true,
          })
          .click();
        const partial = await saved();
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: /Continue adventure/ }).click();
        await ready();
        assert.deepEqual(await saved(), partial);
      }
    }
    await walk(config.phone ? 'gardener' : 'cook');
    await capture(`${config.name}-gathering`, true);
    await reply('water-please');
    await page.getByRole('button', { name: 'Share a moment with everyone', exact: true }).click();
    await capture(`${config.name}-farewell`, true);
    await page.getByRole('button', { name: 'Leave reunion conversation', exact: true }).click();
    const beforeReload = await saved();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /Continue adventure/ }).click();
    await ready();
    assert.deepEqual(await saved(), beforeReload);
    await page.keyboard.press('e');
    await page.getByRole('region', { name: 'A Promise Kept', exact: true }).waitFor();
    await reply('see-you');
    const before = await saved();
    await page.getByRole('button', { name: 'Keep this promise in our journal', exact: true }).click();
    const after = await saved();
    assert(after.flags.includes('reunion-complete'));
    assert.equal(after.xp, before.xp + 120);
    assert.equal(after.rice, before.rice + 2);
    assert.equal(after.tea, before.tea + 2);
    assert.equal(await page.getByRole('button', { name: 'Continue A Promise Kept', exact: true }).count(), 0);
    const training = await page.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-training-v1')));
    assert.equal(
      Object.values(training.records).reduce((n, r) => n + r.spoken, 0),
      config.phone || gatherOnly ? 0 : 1,
    );
    await page.getByRole('button', { name: 'Journal', exact: true }).click();
    await page.locator('.quest-completed > summary').click();
    assert(
      (await page.locator('[data-quest="reunion"]').innerText()).includes(
        config.phone ? 'Lumphini' : 'Yaowarat',
      ),
    );
    await page.screenshot({ path: `${out}/${config.name}-memory.png` });
    report.cases.push({
      route: config.name,
      walked: !gatherOnly,
      invitationOrder: config.order,
      reload: true,
      spoken: !config.phone && !gatherOnly,
      awardOnce: true,
    });
    await checkpoint();
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.finished = true;
} catch (error) {
  report.failure = error.stack;
  if (page) await page.screenshot({ path: `${out}/failure.png`, timeout: 10000 }).catch(() => {});
  throw error;
} finally {
  await checkpoint();
  await browser.close();
}
