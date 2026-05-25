// Visual + runtime smoke test for the new 3D adventure stages (3-10).
// Launches a headed/headless Chromium against the running vite dev server,
// jumps into each stage via the App's `isekai-debug-stage-3d-index` bootstrap,
// waits for the canvas + Patrick GLB rig to load, screenshots, and reports
// per-stage status + console errors.
//
// Usage: `node scripts/test-3d-stages.mjs [--headed] [--base http://127.0.0.1:5188]`

import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const screenshotDir = resolve(__dirname, '..', 'tmp', '3d-stage-screens');

const args = process.argv.slice(2);
const headed = args.includes('--headed');
const baseArgIdx = args.indexOf('--base');
const baseUrl = baseArgIdx >= 0 ? args[baseArgIdx + 1] : 'http://127.0.0.1:5188';

// Scenario indices 2..9 correspond to stages 3..10 in the lessonScenarios array.
const stages = [
  { index: 2, label: 'Stage 03 — Night Market' },
  { index: 3, label: 'Stage 04 — Taxi Stand' },
  { index: 4, label: 'Stage 05 — Floating Market' },
  { index: 5, label: 'Stage 06 — Clinic & Pharmacy' },
  { index: 6, label: 'Stage 07 — Riverside Cafe' },
  { index: 7, label: 'Stage 08 — Lost Alley' },
  { index: 8, label: 'Stage 09 — Embassy Archive' },
  { index: 9, label: 'Stage 10 — Rift Gate Finale' },
];

const ERROR_FILTERS = [
  /Failed to load resource.*api\/(whisper|realtime)/i, // local services not running is OK for visual test
  /favicon/i,
  /vite-hmr/i,
];
function isRealError(text) {
  return !ERROR_FILTERS.some((re) => re.test(text));
}

async function main() {
  await mkdir(screenshotDir, { recursive: true });
  const browser = await chromium.launch({ headless: !headed });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  const report = [];

  for (const stage of stages) {
    const consoleErrors = [];
    const pageErrors = [];
    const page = await context.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (isRealError(text)) consoleErrors.push(text);
      }
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    let canvasOk = false;
    let badgeText = '';
    let loadStatus = '';
    let hotspotCount = 0;
    let firstError = '';

    try {
      // Seed sessionStorage on the origin before App boots, then navigate normally.
      await page.goto(baseUrl, { waitUntil: 'load', timeout: 30_000 });
      await page.evaluate((index) => {
        window.sessionStorage.setItem('isekai-debug-stage-3d-index', String(index));
      }, stage.index);
      await page.reload({ waitUntil: 'load', timeout: 30_000 });

      // Wait for the canvas to mount
      await page.waitForSelector('canvas[data-testid="stage-3d-adventure-canvas"]', { timeout: 20_000 });
      canvasOk = true;

      // Give the GLB + room build a moment to settle
      await page.waitForFunction(
        () => {
          const status = document.querySelector('p.font-display.text-\\[10px\\].font-black.uppercase.tracking-\\[0\\.12em\\].text-cyan-100\\/70');
          return status && /ready/i.test(status.textContent ?? '');
        },
        { timeout: 25_000 },
      ).catch(() => {
        /* fall through — we'll still screenshot */
      });

      // Pull the badge ("Stage X/10 · 3D") and room title for the report
      badgeText = (await page.textContent('p.font-display.text-\\[10px\\].text-cyan-200').catch(() => '')) ?? '';
      loadStatus = (await page.textContent('p.font-display.text-cyan-100\\/70').catch(() => '')) ?? '';

      // Count room-nav buttons (one per room) as a sanity check.
      hotspotCount = await page
        .locator('nav button[type="button"]')
        .count()
        .catch(() => 0);

      // Capture room 1
      const room1Path = resolve(screenshotDir, `stage-${String(stage.index + 1).padStart(2, '0')}-room1.png`);
      await page.screenshot({ path: room1Path, fullPage: false });

      // Navigate to room 2 and capture
      const navButtons = page.locator('nav button[type="button"]');
      const navCount = await navButtons.count();
      if (navCount >= 2) {
        await navButtons.nth(1).click();
        await page.waitForTimeout(800); // let GLB action stabilize + new room build
        const room2Path = resolve(screenshotDir, `stage-${String(stage.index + 1).padStart(2, '0')}-room2.png`);
        await page.screenshot({ path: room2Path, fullPage: false });
      }
    } catch (err) {
      firstError = err instanceof Error ? err.message : String(err);
    } finally {
      await page.close();
    }

    const pass = canvasOk && pageErrors.length === 0 && consoleErrors.length === 0 && !firstError;
    report.push({
      label: stage.label,
      pass,
      canvasOk,
      badgeText: badgeText.trim(),
      loadStatus: loadStatus.trim(),
      roomNavCount: hotspotCount,
      consoleErrors,
      pageErrors,
      firstError,
    });
  }

  await browser.close();

  // Render report
  console.log('\n=== 3D Stage Smoke Test ===\n');
  for (const r of report) {
    const flag = r.pass ? '✓' : '✗';
    console.log(`${flag} ${r.label}`);
    console.log(`    canvas=${r.canvasOk ? 'mounted' : 'MISSING'} | nav rooms=${r.roomNavCount} | badge="${r.badgeText}"`);
    if (r.loadStatus) console.log(`    status: ${r.loadStatus}`);
    if (r.firstError) console.log(`    !! ${r.firstError}`);
    for (const e of r.pageErrors) console.log(`    page error: ${e}`);
    for (const e of r.consoleErrors) console.log(`    console: ${e}`);
  }
  const allPass = report.every((r) => r.pass);
  console.log(`\nResult: ${allPass ? 'ALL STAGES PASS' : 'SOME STAGES FAILED'}`);
  console.log(`Screenshots: ${screenshotDir}`);
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
