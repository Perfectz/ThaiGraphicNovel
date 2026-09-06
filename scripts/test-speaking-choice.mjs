import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshAdventure } from '../src/bangkok/adventure.ts';
const base = 'http://127.0.0.1:5188',
  out = 'artifacts/speaking-choice-focus';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  channel: 'chrome',
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
const errors = [];
const report = { finished: false, cases: [], visibility: [], errors };
const checkpoint = () => writeFile(`${out}/progress.json`, JSON.stringify(report, null, 2));
let lastPage;
// Exercise the real MediaRecorder with a synthetic browser audio track. This is not a
// physical-microphone or pronunciation-quality test; permissions are covered separately.
function installTestAudio() {
  window.micRequests = 0;
  window.testMicMode = 'available';
  window.makeTestStream = () => {
    const audio = new AudioContext();
    const destination = audio.createMediaStreamDestination();
    const oscillator = audio.createOscillator();
    oscillator.connect(destination);
    oscillator.start();
    void audio.resume();
    return destination.stream;
  };
  navigator.mediaDevices.getUserMedia = () => {
    window.micRequests++;
    return window.testMicMode === 'pending'
      ? new Promise((resolve) => {
          window.resolvePendingMic = resolve;
        })
      : Promise.resolve(window.makeTestStream());
  };
}
function observe(page) {
  lastPage = page;
  page.setDefaultTimeout(120000);
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
}
async function checkSpeakingViewport(page, name) {
  const result = await page.locator('.rpg-dialogue').evaluate((dialogue) => {
    const body = dialogue.querySelector('.rpg-conversation-body');
    const frame = body.getBoundingClientRect();
    return {
      scrollTop: body.scrollTop,
      headingFocused: document.activeElement === dialogue.querySelector('.speak-preview h3'),
      worldHeight: dialogue.getBoundingClientRect().top,
      fields: [
        '.speak-preview h3',
        '.speak-thai',
        '.speak-roman',
        '.speak-listen-controls',
        '.speak-record',
      ].map((selector) => {
        const r = dialogue.querySelector(selector).getBoundingClientRect();
        return {
          selector,
          top: r.top,
          bottom: r.bottom,
          visible: r.top >= frame.top && r.bottom <= Math.min(frame.bottom, innerHeight),
        };
      }),
    };
  });
  report.visibility.push({ name, ...result });
  await checkpoint();
  assert(
    result.fields.every((f) => f.visible),
    JSON.stringify(result),
  );
  assert(result.headingFocused, 'selecting a reply focuses its English meaning');
  assert(result.worldHeight > 140, 'the phone still shows the world above the conversation');
  assert.equal(result.scrollTop, 0);
  await page.screenshot({ path: `${out}/${name}.png` });
}
async function meanings(page) {
  const rows = page.locator('.thai-choice-list>button');
  assert.equal(await rows.count(), 3);
  for (const row of await rows.all()) {
    assert((await row.locator('.choice-meaning').innerText()).length > 1);
    assert.equal(await row.locator('.choice-meaning').getAttribute('lang'), 'en');
    assert((await row.locator('strong[lang=th]').innerText()).length > 1);
  }
}
async function record(page) {
  await page.getByRole('button', { name: '◉ Record this line', exact: true }).click();
  await page.getByRole('button', { name: '■ Stop recording', exact: true }).waitFor();
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: '■ Stop recording', exact: true }).click();
  await page.getByRole('button', { name: '▷ Play my recording', exact: true }).click();
}
await checkpoint();
try {
  const c2 = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    permissions: ['microphone'],
  });
  const q = await c2.newPage();
  observe(q);
  await q.goto(base);
  await q.getByRole('button', { name: /Step through the rift/ }).click();
  await q.getByRole('button', { name: 'Open town map ↗', exact: true }).click();
  await q.locator('.city-map button[data-area="hotel"]').click();
  await q.locator('.city-contacts button').filter({ hasText: 'Mali' }).click();
  await q.locator('.thai-choice-list').waitFor({ timeout: 120000 });
  await meanings(q);
  await q.locator('.thai-choice-list>button').filter({ hasText: 'สวัสดีครับ' }).click();
  assert.equal(await q.locator('.rpg-dialogue-heading>small').innerText(), '1 / 4');
  await record(q);
  await q.getByRole('button', { name: 'Use my spoken reply →', exact: true }).click();
  await q.getByRole('button', { name: 'Continue →', exact: true }).click();
  assert.equal(await q.locator('.rpg-dialogue-heading>small').innerText(), '2 / 4');
  report.cases.push('desktop spoken conversation');
  await checkpoint();
  await c2.close();
  console.log('Conversation: selecting, recording and using a reply advances the story.');
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    permissions: ['microphone'],
  });
  await mobile.addInitScript(installTestAudio);
  await mobile.addInitScript(
    (save) => {
      localStorage.setItem('bangkok-rift-adventure-v1', JSON.stringify(save));
    },
    { ...freshAdventure(), flags: ['intro', 'hotel-journal'] },
  );
  const story = await mobile.newPage();
  observe(story);
  await story.goto(base);
  await story.getByRole('button', { name: /Continue adventure/ }).click();
  await story.getByRole('button', { name: 'Open town map ↗', exact: true }).click();
  await story.locator('.city-map button[data-area="hotel"]').click();
  await story.locator('.city-contacts button[data-area="innkeeper"]').click();
  for (let line = 0; line < 3; line++) {
    await story.locator('.thai-choice-list').waitFor();
    await meanings(story);
    if (line > 0) await story.setViewportSize({ width: 320, height: 568 });
    const thai = await story.locator('.rpg-thai').innerText();
    const chosen = story.locator('.thai-choice-list>button').filter({ hasText: thai });
    const phraseId = await chosen.getAttribute('data-phrase-choice');
    const meaning = await chosen.locator('.choice-meaning').innerText();
    const saveBefore = await story.evaluate(() => localStorage.getItem('bangkok-rift-adventure-v1'));
    await chosen.click();
    await checkSpeakingViewport(story, `phone-line-${line + 1}`);
    assert.equal(await story.locator('.speak-preview h3').innerText(), meaning);
    assert.equal(
      await story.evaluate(() => localStorage.getItem('bangkok-rift-adventure-v1')),
      saveBefore,
      'preview does not submit a turn',
    );
    if (line === 0) {
      assert.equal(
        await story.evaluate(() => window.micRequests),
        0,
        'selection never starts the microphone',
      );
      const context = story.locator('.rpg-speaking-context');
      await context.locator('summary').click();
      assert((await context.locator('p').innerText()).length > 10);
      await context.locator('summary').click();
      await story.getByRole('button', { name: '← Choose a different meaning', exact: true }).click();
      assert.equal(
        await story.evaluate(() => document.activeElement?.getAttribute('data-phrase-choice')),
        phraseId,
      );
      await chosen.click();
      await checkSpeakingViewport(story, 'phone-reselected');
      await story.evaluate(() => {
        window.testMicMode = 'pending';
      });
      await story.getByRole('button', { name: '◉ Record this line', exact: true }).click();
      await story.getByText('Opening microphone…', { exact: true }).waitFor();
      await story.getByText(/Microphone access is still pending/).waitFor();
      assert(await story.getByRole('button', { name: 'Use my spoken reply →', exact: true }).isDisabled());
      assert(await story.getByRole('button', { name: 'Leave conversation', exact: true }).isEnabled());
      assert(await story.getByRole('button', { name: 'Use text only this time', exact: true }).isEnabled());
      await story.evaluate(() => {
        window.lateTestStream = window.makeTestStream();
        window.resolvePendingMic(window.lateTestStream);
        window.testMicMode = 'available';
      });
      await story.waitForFunction(() =>
        window.lateTestStream.getTracks().every((track) => track.readyState === 'ended'),
      );
      await record(story);
      await story.getByRole('button', { name: 'Use my spoken reply →', exact: true }).click();
      assert.equal(
        await story.evaluate(
          () => JSON.parse(localStorage.getItem('bangkok-rift-training-v1')).records.hello.spoken,
        ),
        1,
      );
    } else {
      await story.getByRole('button', { name: 'Use text only this time', exact: true }).click();
    }
    await story.getByRole('button', { name: 'Continue →', exact: true }).click();
  }
  await story.getByRole('button', { name: 'Back to the adventure →', exact: true }).click();
  assert(
    await story.evaluate(() =>
      JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')).flags.includes('innkeeper'),
    ),
  );
  report.cases.push('390px speaking and context; 320px long phrases; check-in completion');
  await checkpoint();
  await mobile.close();
  const c3 = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await c3.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException('Denied', 'NotAllowedError');
    };
  });
  const phone = await c3.newPage();
  observe(phone);
  await phone.goto(`${base}/training`);
  await phone.getByRole('button', { name: /Begin your journey/ }).click();
  await phone.locator('.bk-activity').nth(2).click();
  await meanings(phone);
  await phone.screenshot({ path: `${out}/03-phone-meanings.png` });
  await phone.locator('.thai-choice-list>button').filter({ hasText: 'สวัสดีครับ' }).click();
  await phone.getByRole('button', { name: '◉ Record this line', exact: true }).click();
  await phone.getByText(/Microphone unavailable or permission denied/).waitFor();
  assert(await phone.getByRole('button', { name: 'Use my spoken reply →', exact: true }).isDisabled());
  await phone.screenshot({ path: `${out}/04-phone-preview.png` });
  await phone.getByRole('button', { name: 'Use text only this time', exact: true }).click();
  await phone.getByRole('button', { name: 'Continue →', exact: true }).click();
  assert.equal(
    await phone.evaluate(
      () => JSON.parse(localStorage.getItem('bangkok-rift-training-v1')).records.hello.spoken,
    ),
    0,
  );
  assert(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await c3.close();
  assert.deepEqual(errors, []);
  report.cases.push('phone camp microphone denial and text fallback');
  report.finished = true;
  await checkpoint();
  console.log(
    'PASS: adventure dialogue and phone camp flows (battle covered by test:expedition:browser); denied mic fallback; no page errors.',
  );
} catch (e) {
  report.error = String(e);
  await checkpoint();
  console.error(
    await lastPage
      ?.locator('body')
      .innerText()
      .catch(() => ''),
  );
  await lastPage?.screenshot({ path: `${out}/failure.png` }).catch(() => undefined);
  throw e;
} finally {
  await browser.close();
}
