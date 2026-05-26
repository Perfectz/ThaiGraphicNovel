// Multi-engine smoke for the tech demo. Boots stages 1-3 across all three
// Playwright engines (chromium, firefox, webkit) and reports load success,
// per-stage console errors, and a screenshot per engine/stage.
//
// Why this exists: the demo target is broader than Chromium — Safari/iOS
// users matter, Firefox users matter. The headless WebKit engine is the
// closest CI-friendly approximation of Safari we can run.
//
// Usage:
//   npm run dev                           # in another terminal
//   node scripts/test-multi-engine.mjs    # runs all three engines
//   node scripts/test-multi-engine.mjs --engine=webkit --headed
//   node scripts/test-multi-engine.mjs --base http://127.0.0.1:5173
//
// Exit code: 0 if every (engine, stage) pair loaded cleanly. 1 if any
// pair surfaced a real console error or failed to mount the canvas.

import { chromium, firefox, webkit } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const screenshotDir = resolve(__dirname, '..', 'tmp', 'multi-engine');

const args = process.argv.slice(2);
const headed = args.includes('--headed');
const engineArg = args.find((a) => a.startsWith('--engine='))?.split('=')[1];
const baseArgIdx = args.indexOf('--base');
const baseUrl = baseArgIdx >= 0 ? args[baseArgIdx + 1] : 'http://127.0.0.1:5173';

// Stages 1-3 only — this is a tech-demo smoke, not a full QA pass.
const stages = [
  { index: 0, label: 'Stage 01 — Hotel Lobby' },
  { index: 1, label: 'Stage 02 — Front Desk' },
  { index: 2, label: 'Stage 03 — Night Market' },
];

const allEngines = [
  { name: 'chromium', launch: chromium },
  { name: 'firefox', launch: firefox },
  { name: 'webkit', launch: webkit },
];

const engines = engineArg ? allEngines.filter((e) => e.name === engineArg) : allEngines;
if (!engines.length) {
  console.error(`Unknown --engine=${engineArg}. Choose one of: chromium, firefox, webkit.`);
  process.exit(2);
}

// Common-noise filter — same ignore list as the existing 3D smoke script,
// plus a few WebKit-specific warnings that don't indicate a real problem.
const ERROR_FILTERS = [
  /Failed to load resource.*api\/(whisper|realtime)/i, // local services optional
  /favicon/i,
  /vite-hmr/i,
  /MediaError|getUserMedia/i, // mic permission noise we expect headless
  /AudioContext.*resume/i, // browser autoplay nag — handled by intro overlay
  /WebGL warning/i, // chatty WebKit warning that isn't actionable
];
function isRealError(text) {
  return !ERROR_FILTERS.some((re) => re.test(text));
}

async function runStage(page, stage, engineName) {
  const consoleErrors = [];
  const pageErrors = [];
  const onConsole = (message) => {
    if (message.type() === 'error' && isRealError(message.text())) {
      consoleErrors.push(message.text());
    }
  };
  const onPageError = (error) => {
    pageErrors.push(error.message);
  };
  page.on('console', onConsole);
  page.on('pageerror', onPageError);

  await page.addInitScript((index) => {
    window.sessionStorage.setItem('isekai-debug-stage-3d-index', String(index));
  }, stage.index);

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });

  // Wait for the stage canvas to mount. The Stage3DAdventureDispatcher sets
  // a data-testid on the renderer.domElement once the engine bootstraps.
  let canvasMounted = false;
  try {
    await page.waitForSelector('[data-testid="stage-3d-adventure-canvas"]', {
      timeout: 15000,
    });
    canvasMounted = true;
  } catch {
    // Fall through with canvasMounted=false; the report will surface it.
  }

  // Give the GLBs + room geometry a few seconds to settle so the screenshot
  // captures the actual playable scene, not the load overlay.
  await page.waitForTimeout(4000);

  const screenshotPath = resolve(screenshotDir, `${engineName}-stage-${String(stage.index + 1).padStart(2, '0')}.png`);
  try {
    await page.screenshot({ path: screenshotPath, fullPage: false });
  } catch (error) {
    consoleErrors.push(`screenshot failed: ${error?.message || error}`);
  }

  page.off('console', onConsole);
  page.off('pageerror', onPageError);

  return {
    canvasMounted,
    consoleErrors,
    pageErrors,
    screenshotPath,
  };
}

async function runEngine(engine) {
  console.log(`\n━━ ${engine.name.toUpperCase()} ━━`);
  const browser = await engine.launch.launch({ headless: !headed });
  const context = await browser.newContext({
    // Mid-range desktop default — matches the dev target. Multi-engine
    // smoke isn't trying to catch responsive issues; that's a separate
    // mobile-emulation pass.
    viewport: { width: 1440, height: 900 },
    // Grant mic permission so the no-mic auto-fallback path doesn't
    // mask other failures. (Actual playback isn't exercised here.)
    permissions: ['microphone'],
  });

  const results = [];
  for (const stage of stages) {
    const page = await context.newPage();
    const result = await runStage(page, stage, engine.name);
    await page.close();
    const ok = result.canvasMounted && result.consoleErrors.length === 0 && result.pageErrors.length === 0;
    results.push({ engine: engine.name, stage, ok, ...result });

    const tag = ok ? '✓' : '✗';
    console.log(`  ${tag} ${stage.label}`);
    if (!result.canvasMounted) console.log(`      ! canvas never mounted`);
    if (result.pageErrors.length) {
      console.log(`      ! page errors:`);
      for (const err of result.pageErrors) console.log(`        - ${err}`);
    }
    if (result.consoleErrors.length) {
      console.log(`      ! console errors:`);
      for (const err of result.consoleErrors) console.log(`        - ${err}`);
    }
    console.log(`      → ${result.screenshotPath}`);
  }

  await context.close();
  await browser.close();
  return results;
}

async function main() {
  await mkdir(screenshotDir, { recursive: true });
  const allResults = [];
  for (const engine of engines) {
    const results = await runEngine(engine);
    allResults.push(...results);
  }

  console.log('\n━━ SUMMARY ━━');
  const failures = allResults.filter((r) => !r.ok);
  console.log(`  ${allResults.length - failures.length}/${allResults.length} passed`);
  if (failures.length) {
    console.log('  Failures:');
    for (const f of failures) {
      console.log(`    - [${f.engine}] ${f.stage.label}`);
    }
    process.exit(1);
  }
  process.exit(0);
}

main().catch((error) => {
  console.error('Smoke crashed:', error);
  process.exit(1);
});
