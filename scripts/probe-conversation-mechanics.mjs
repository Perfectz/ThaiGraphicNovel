// Verify three conversation mechanics on Stage 1 Su:
//   1. Patrick faces Su after the walk
//   2. Re-clicking Su resumes the conversation at the last unfinished turn
//   3. "Try Previous Phrase" button is visible + disabled appropriately

import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const screenshotDir = resolve(__dirname, '..', 'tmp', 'conversation-mechanics');

async function skipIntros(page) {
  const skipMovie = page.locator('button[aria-label="Skip intro video"]');
  if (await skipMovie.isVisible().catch(() => false)) {
    await skipMovie.click();
    await page.waitForTimeout(250);
  }
  for (let i = 0; i < 12; i += 1) {
    const finalCta = page.locator('button:has-text("Tap to start exploring")');
    if (await finalCta.isVisible().catch(() => false)) {
      await finalCta.click();
      await page.waitForTimeout(220);
      break;
    }
    await page.mouse.click(720, 760);
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(500);
}

async function clickHotspot(page, hotspotId) {
  const npc = await page.evaluate(
    (id) => window.__sceneDebug?.npcs?.[id] ?? null,
    hotspotId,
  );
  if (!npc?.ndc) throw new Error(`No NDC for ${hotspotId}`);
  const canvasBox = await page
    .locator('canvas[data-testid="stage-3d-adventure-canvas"]')
    .boundingBox();
  const cx = canvasBox.x + ((npc.ndc.x + 1) / 2) * canvasBox.width;
  const cy = canvasBox.y + ((1 - npc.ndc.y) / 2) * canvasBox.height;
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(150);
}

async function waitForPatrickArrival(page, targetX, targetZ) {
  // Wait for Patrick to come fully to rest at the target — the
  // arrival-facing logic only fires once distance drops below ~0.035 and
  // the loop hits its idle branch, so settle within a tight tolerance
  // before sampling rotation.
  const start = Date.now();
  while (Date.now() - start < 12000) {
    await page.waitForTimeout(200);
    const p = await page.evaluate(() => window.__patrickPos ?? null);
    if (!p) continue;
    if (Math.hypot(p.x - targetX, p.z - targetZ) < 0.08) {
      await page.waitForTimeout(300); // let arrival-facing apply on next frame
      return await page.evaluate(() => window.__patrickPos ?? null);
    }
  }
  return await page.evaluate(() => window.__patrickPos ?? null);
}

async function main() {
  await mkdir(screenshotDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(`pageerror: ${e.message}`));

  await page.goto('http://127.0.0.1:5173', { waitUntil: 'load' });
  await page.evaluate(() => window.sessionStorage.setItem('isekai-debug-stage-3d-index', '0'));
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('canvas[data-testid="stage-3d-adventure-canvas"]', { timeout: 30000 });
  await page.waitForSelector('.adventure-3d-load-overlay--hidden', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(700);
  await skipIntros(page);
  await page.waitForFunction(() => !!window.__sceneDebug?.npcs?.su, { timeout: 5000 }).catch(() => {});

  console.log('\n=== Test 1: facing on arrival ===');
  await clickHotspot(page, 'su');
  const arrived = await waitForPatrickArrival(page, 4.4, -0.5);
  const expectedFacing = Math.atan2(6.0 - arrived.x, -0.5 - arrived.z);
  console.log(`Patrick position: (${arrived.x.toFixed(2)}, ${arrived.z.toFixed(2)})`);
  console.log(`Patrick rotation.y: ${arrived.ry.toFixed(3)}  expected ~${expectedFacing.toFixed(3)}`);
  const facingDelta = Math.abs(arrived.ry - expectedFacing);
  console.log(`facing delta: ${facingDelta.toFixed(3)} rad  ${facingDelta < 0.1 ? 'PASS' : 'FAIL'}`);
  await page.screenshot({ path: resolve(screenshotDir, '1-arrival.png') });

  console.log('\n=== Test 2: resume conversation at saved turn ===');
  // Advance to turn 2 via Skip button (simulates 2 successful turns).
  for (let i = 0; i < 2; i += 1) {
    await page.locator('button:has-text("Skip Phrase")').click({ force: true });
    await page.waitForTimeout(400);
  }
  const turnAfterSkips = await page.evaluate(() => {
    const eyebrow = document.querySelector('.adventure-3d-card__eyebrow');
    return eyebrow?.textContent ?? null;
  });
  console.log(`cue card eyebrow after 2 skips: ${turnAfterSkips}`);

  // Walk away by clicking the floor on the far side
  const canvasBox = await page.locator('canvas[data-testid="stage-3d-adventure-canvas"]').boundingBox();
  await page.mouse.click(canvasBox.x + canvasBox.width * 0.2, canvasBox.y + canvasBox.height * 0.7);
  await page.waitForTimeout(2500);
  // Click back on Su
  await clickHotspot(page, 'su');
  await page.waitForTimeout(1500);
  const turnAfterResume = await page.evaluate(() => {
    const eyebrow = document.querySelector('.adventure-3d-card__eyebrow');
    return eyebrow?.textContent ?? null;
  });
  console.log(`cue card eyebrow after re-click: ${turnAfterResume}`);
  console.log(
    `resume ${turnAfterSkips && turnAfterResume === turnAfterSkips ? 'PASS — same turn' : 'FAIL — turn changed'}`,
  );
  await page.screenshot({ path: resolve(screenshotDir, '2-resume.png') });

  console.log('\n=== Test 3: Try Previous Phrase button ===');
  const tryPrevBtn = page.locator('button:has-text("Try Previous Phrase")');
  const tryPrevVisible = await tryPrevBtn.isVisible().catch(() => false);
  const tryPrevDisabled = await tryPrevBtn.isDisabled().catch(() => true);
  console.log(`Try Previous Phrase button visible: ${tryPrevVisible}`);
  console.log(`Try Previous Phrase button disabled (should be FALSE — we're past turn 0): ${tryPrevDisabled}`);
  if (tryPrevVisible && !tryPrevDisabled) {
    await tryPrevBtn.click({ force: true });
    await page.waitForTimeout(500);
    const eyebrowAfterReview = await page.evaluate(() => {
      const eyebrow = document.querySelector('.adventure-3d-card__eyebrow');
      return eyebrow?.textContent ?? null;
    });
    console.log(`eyebrow after Try Prev click: ${eyebrowAfterReview}`);
    const isInReview = eyebrowAfterReview?.includes('Review') ?? false;
    console.log(`review mode active: ${isInReview} ${isInReview ? 'PASS' : 'FAIL'}`);
    await page.screenshot({ path: resolve(screenshotDir, '3-reviewing.png') });
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
