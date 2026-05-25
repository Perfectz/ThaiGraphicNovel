// Focused single-stage smoke test. Usage:
//   node scripts/test-3d-stage-one.mjs <index> [--base URL]
// where <index> is the lessonScenarios index (e.g. 5 = stage 6 clinic).

import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const screenshotDir = resolve(__dirname, '..', 'tmp', '3d-stage-screens');

const args = process.argv.slice(2);
const index = Number.parseInt(args[0] ?? '5', 10);
const baseArgIdx = args.indexOf('--base');
const baseUrl = baseArgIdx >= 0 ? args[baseArgIdx + 1] : 'http://127.0.0.1:5173';

async function main() {
  await mkdir(screenshotDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto(baseUrl, { waitUntil: 'load' });
  await page.evaluate((i) => window.sessionStorage.setItem('isekai-debug-stage-3d-index', String(i)), index);
  await page.reload({ waitUntil: 'load' });

  await page.waitForSelector('canvas[data-testid="stage-3d-adventure-canvas"]', { timeout: 25_000 });
  // Wait for the load overlay to fade out (sceneReady)
  await page.waitForSelector('.adventure-3d-load-overlay--hidden', { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(1500);

  const room1Path = resolve(screenshotDir, `solo-stage-${String(index + 1).padStart(2, '0')}-room1.png`);
  await page.screenshot({ path: room1Path });

  const navButtons = page.locator('nav.adventure-3d-room-nav button.adventure-3d-room-pill');
  const count = await navButtons.count();
  console.log(`nav rooms: ${count}`);
  if (count >= 2) {
    await navButtons.nth(1).click();
    await page.waitForTimeout(1200);
    const room2Path = resolve(screenshotDir, `solo-stage-${String(index + 1).padStart(2, '0')}-room2.png`);
    await page.screenshot({ path: room2Path });
    console.log(`captured both rooms for index ${index}`);
  } else {
    console.log(`only one room captured for index ${index}`);
  }

  console.log(`console errors: ${errors.length}`);
  errors.forEach((e) => console.log(`  ${e}`));

  await browser.close();
}

main().catch((err) => { console.error(err); process.exit(1); });
