import { chromium } from 'playwright-core';

/**
 * Smoke test for the Thai microgame mode. Drives the actual dev server at
 * http://127.0.0.1:5188/ — assumes `npm run dev` (or equivalent) is already
 * running. Used as the manual verification step for AGENTS.md's
 * "browser-visible UI changes" gate.
 */

const exe = process.env.CHROME_PATH || String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`;
const browser = await chromium.launch({ executablePath: exe, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('PAGE: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('CON: ' + m.text()); });

async function probeStage(stageLabel, leadCommand, screenshotPrefix) {
  console.log(`— /microgames → ${stageLabel} —`);
  await page.goto('http://127.0.0.1:5188/microgames', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=Thai Microgames', { timeout: 8000 });
  await page.locator(`button:has-text("${stageLabel}")`).first().click();
  await page.waitForSelector(`text=${leadCommand}`, { timeout: 6000 });
  await page.waitForTimeout(1100); // intro 900ms + safety
  await page.screenshot({ path: `${screenshotPrefix}-play.png` });
  const buttonCount = await page.$$eval('button', (els) => els.length);
  console.log(`  mounted, ${buttonCount} buttons on screen`);
}

// Stage 1 — full round trip + verdict.
await probeStage('Hotel Lobby Basics', 'Make it polite!', 'microgame-s1');
const ok = await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('button'));
  const target = btns.find((b) => b.innerText.includes('ครับ') && /\bkhrap\b/.test(b.innerText));
  if (!target) return false;
  target.click();
  return true;
});
console.log('  s1 clicked khrap:', ok);
await page.waitForTimeout(800);
const got = await page.locator('text=GOT IT!').count();
console.log('  s1 GOT IT! count:', got);

// Stage 2 — just mount the Stack Check-In mechanic, no interaction.
await probeStage('Front Desk Check-In', 'Build the line!', 'microgame-s2');

// Stage 3 — just mount the Point And Order mechanic, no interaction.
await probeStage('Street Food Order', 'Order this!', 'microgame-s3');

// Title screen — confirm the Microgames entry is wired.
console.log('— title screen —');
await page.goto('http://127.0.0.1:5188/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('text=Microgames', { timeout: 6000 });
console.log('  title-screen Microgames button present');
await page.screenshot({ path: 'microgame-title.png' });

console.log('— errors —');
console.log(errors.length ? errors.join('\n') : '  (none)');
console.log('— done —');

await browser.close();
process.exit(errors.length ? 1 : 0);
