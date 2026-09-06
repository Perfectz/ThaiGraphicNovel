import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshAdventure } from '../src/bangkok/adventure.ts';
const out = 'artifacts/adventure-score'; await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const report = { milestones: [], finished: false }, errors = []; let page;
const checkpoint = () => writeFile(`${out}/progress.json`, JSON.stringify(report, null, 2));
async function step(name) { report.step = name; await checkpoint(); console.log('CHECK', name); }
async function mark(name) { report.milestones.push(name); await checkpoint(); console.log('PASS', name); }
const playing = track => page.waitForFunction(track => window.__scoreAudio.some(a => a.dataset.gameMusic && a.src.includes(track) && !a.paused && a.volume > .08 && a.currentTime > .2 && a.readyState >= 2), track);
const silent = () => page.waitForFunction(() => window.__scoreAudio.filter(a => a.dataset.gameMusic).every(a => a.paused && a.volume === 0));
const snapshot = () => page.evaluate(() => window.__scoreAudio.filter(a => a.dataset.gameMusic && a.src).map(a => ({ src: a.src.split('/').at(-1), time: a.currentTime, paused: a.paused, volume: a.volume, error: a.error?.code })));
const ready = () => page.waitForFunction(() => !document.querySelector('.bk-loading') && document.querySelector('.bk-world')?.dataset.npcReady === '6', null, { timeout: 120000 });
async function open(phone = false) {
  const context = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 900 }, isMobile: phone, hasTouch: phone, permissions: ['microphone'] });
  const save = freshAdventure(); save.flags = ['intro', 'innkeeper']; save.position = phone ? { x: 34, z: 16 } : { x: -46, z: 23.5 };
  await context.addInitScript(save => {
    if (!localStorage.getItem('bangkok-rift-adventure-v1')) localStorage.setItem('bangkok-rift-adventure-v1', JSON.stringify(save));
    window.__scoreAudio = []; const NativeAudio = window.Audio;
    window.Audio = function(...args) { const audio = new NativeAudio(...args); window.__scoreAudio.push(audio); return audio; };
    window.Audio.prototype = NativeAudio.prototype;
  }, save);
  page = await context.newPage(); page.setDefaultTimeout(60000); page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:5188/');
  assert.equal(await page.evaluate(() => window.__scoreAudio.filter(a => a.dataset.gameMusic && !a.paused).length), 0);
  await page.getByRole('button', { name: /Continue adventure/ }).click(); await ready(); return context;
}
async function map() { await page.getByRole('button', { name: 'Open town map ↗', exact: true }).click(); }
try {
  await checkpoint(); const desktop = await open(); await playing('stage-01');
  await map(); await page.locator('.city-map button[data-area="sukhumvit"]').click();
  await page.getByRole('button', { name: 'Walk to Sukhumvit', exact: true }).click(); await playing('stage-02');
  await page.waitForFunction(() => { const p = JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')).position; return Math.hypot(p.x + 40, p.z - 14) < .1; }, null, { timeout: 180000 });
  report.travel = await snapshot(); await mark('hotel and Sukhumvit tracks decode and play during actual travel');
  await map(); await page.locator('.city-map button[data-area="sukhumvit"]').click(); await page.locator('.city-contacts button').filter({ hasText: 'Dao' }).click();
  await page.locator('.rpg-thai').waitFor(); await silent(); const paused = await snapshot();
  const thai = await page.locator('.rpg-thai').innerText(), choice = page.locator('.thai-choice-list > button').filter({ hasText: thai });
  assert((await choice.locator('.choice-meaning').innerText()).length > 0); await choice.click();
  await page.getByRole('button', { name: '♫ Hear this line', exact: true }).click();
  await page.waitForFunction(() => window.__scoreAudio.some(a => !a.dataset.gameMusic && !a.paused && a.currentTime > 0)); await silent();
  await page.getByRole('button', { name: '◉ Record this line', exact: true }).click(); await page.getByRole('button', { name: '■ Stop recording', exact: true }).waitFor(); await silent();
  await page.waitForTimeout(700); await page.getByRole('button', { name: '■ Stop recording', exact: true }).click();
  await page.getByRole('button', { name: '▷ Play my recording', exact: true }).click(); await silent();
  await page.getByRole('button', { name: 'Use my spoken reply →', exact: true }).click(); await silent();
  await page.getByRole('button', { name: 'Leave conversation', exact: true }).click(); await playing('stage-02');
  assert((await snapshot()).find(a => a.src.includes('stage-02')).time >= paused.find(a => a.src.includes('stage-02')).time);
  await mark('English-first reference playback, recording and playback stay music-free; exploration resumes its position');
  await step('mute and unmute');
  await page.getByRole('button', { name: 'Mute music', exact: true }).click(); await silent();
  await page.getByRole('button', { name: 'Play music', exact: true }).click(); await playing('stage-02');
  await step('battle entry and retreat');
  await page.getByRole('button',{name:'Party growth',exact:true}).click();await page.getByRole('button', { name: 'Battle practice', exact: true }).click(); await page.getByRole('button', { name: 'Retreat', exact: true }).waitFor(); await playing('stage-03');
  await page.getByRole('button', { name: 'Retreat', exact: true }).click(); await playing('stage-02');
  await step('camp entry music');
  await page.getByRole('button', { name: 'Train at camp', exact: true }).click(); await page.getByRole('button', { name: /(Begin|Continue) your journey/ }).waitFor();
  await playing('stage-01');
  await page.waitForFunction(() => window.__scoreAudio.filter(a => a.dataset.gameMusic && !a.paused && a.volume > 0).length === 1);
  await step('camp practice focus');
  await page.getByRole('button', { name: /(Begin|Continue) your journey/ }).click();
  await page.getByRole('button', { name: /Listen & echo/ }).click(); await silent();
  await step('return from camp');
  await page.getByRole('button', { name: /Return to the adventure/ }).click(); await page.getByRole('button', { name: /Continue adventure/ }).click(); await ready(); await playing('stage-02');
  await mark('mute, battle music, camp practice focus and unmount cleanup'); await desktop.close();
  await step('phone practice and mute persistence');
  const phone = await open(true); await playing('stage-03');
  await page.getByRole('button', { name: /E · Uncle Lek/ }).click(); await page.locator('.rpg-thai').waitFor(); await silent();
  await page.screenshot({ path: `${out}/phone-practice.png` });
  await page.getByRole('button', { name: 'Leave conversation', exact: true }).click(); await playing('stage-03');
  await page.getByRole('button', { name: 'Mute music', exact: true }).click(); await silent();
  await page.reload(); await page.getByRole('button', { name: /Continue adventure/ }).click(); await ready(); await silent();
  await page.getByRole('button', { name: 'Play music', exact: true }).click(); await playing('stage-03');
  report.phone = await snapshot(); await phone.close(); assert.deepEqual(errors, []); await mark('phone market music, practice pause and saved mute preference');
  report.finished = true; await checkpoint();
} catch (error) { report.error = String(error); await checkpoint(); console.error(await snapshot().catch(() => [])); console.error(await page?.locator('body').innerText().catch(() => '')); throw error; }
finally { await browser.close(); }
