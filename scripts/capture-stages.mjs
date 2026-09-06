import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '..', 'tmp', 'stage-art');
const base = process.argv[2] || 'http://127.0.0.1:5173';
const chromePath =
  process.env.CHROME_PATH || String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`;

// index → label (lessonScenarios order: 0 lobby, 1 front desk, 2 night market)
const stages = [
  { index: 0, name: 'stage1-lobby' },
  { index: 1, name: 'stage2-front-desk' },
  { index: 2, name: 'stage3-night-market' },
];

async function launch() {
  try {
    return await chromium.launch({
      executablePath: chromePath,
      headless: true,
      args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--ignore-gpu-blocklist'],
    });
  } catch {
    return chromium.launch({ headless: true });
  }
}

const browser = await launch();
await mkdir(outDir, { recursive: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();

for (const stage of stages) {
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.evaluate((idx) => {
    window.sessionStorage.setItem('isekai-debug-stage-3d-index', String(idx));
  }, stage.index);
  await page.reload({ waitUntil: 'domcontentloaded' });
  // Let the scene build, models load, and a few frames render.
  await page.waitForSelector('canvas', { timeout: 20000 }).catch(() => {});
  // Skip the pre-roll cinematic so the 3D scene is visible.
  for (let i = 0; i < 3; i += 1) {
    const skip = await page.$('[aria-label="Skip intro video"]');
    if (skip) {
      await skip.click().catch(() => {});
      await page.waitForTimeout(800);
    }
  }
  await page.waitForTimeout(6000);
  const file = resolve(outDir, `${stage.name}.png`);
  await page.screenshot({ path: file });
  console.log('captured', file);
}

await browser.close();
console.log('done');
