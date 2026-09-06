import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const screenshotDir = resolve(__dirname, '..', 'tmp', 'mobile-screens');

const args = process.argv.slice(2);
const baseArgIdx = args.indexOf('--base');
const baseUrl = baseArgIdx >= 0 ? args[baseArgIdx + 1] : 'http://127.0.0.1:5188';
const chromePath = process.env.CHROME_PATH || String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`;

const viewports = [
  { name: 'iphone-12-portrait', width: 390, height: 844 },
  { name: 'iphone-plus-portrait', width: 430, height: 932 },
  { name: 'android-small-portrait', width: 360, height: 780 },
  { name: 'phone-landscape', width: 844, height: 390 },
];

const ERROR_FILTERS = [
  /Failed to load resource.*api\/(whisper|realtime)/i,
  /Failed to load resource: the server responded with a status of 502/i,
  /favicon/i,
  /vite-hmr/i,
  /ResizeObserver loop/i,
];

function isRealError(text) {
  return !ERROR_FILTERS.some((re) => re.test(text));
}

async function launchBrowser() {
  try {
    return await chromium.launch({
      executablePath: chromePath,
      headless: true,
      args: ['--autoplay-policy=no-user-gesture-required'],
    });
  } catch {
    return chromium.launch({
      headless: true,
      args: ['--autoplay-policy=no-user-gesture-required'],
    });
  }
}

function cleanText(text) {
  return String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

async function assertNoHorizontalOverflow(page, label) {
  const result = await page.evaluate(() => {
    const width = window.innerWidth;
    const docWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    const offenders = Array.from(document.body.querySelectorAll('*'))
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          tag: el.tagName.toLowerCase(),
          className: typeof el.className === 'string' ? el.className : '',
          text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        };
      })
      .filter((item) => item.width > 0 && (item.left < -3 || item.right > width + 3))
      .slice(0, 8);
    return { width, docWidth, offenders };
  });

  if (result.docWidth > result.width + 3 || result.offenders.length > 0) {
    throw new Error(
      `${label}: horizontal overflow width=${result.width} doc=${result.docWidth} offenders=${JSON.stringify(
        result.offenders,
      )}`,
    );
  }
}

async function assertTouchTargets(page, label) {
  const badTargets = await page.evaluate(() => {
    const isVisible = (el) => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return (
        style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom >= 0 &&
        rect.right >= 0 &&
        rect.top <= window.innerHeight &&
        rect.left <= window.innerWidth
      );
    };

    return Array.from(document.querySelectorAll('button, a, summary, [role="button"]'))
      .filter(isVisible)
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const minSide = Math.min(rect.width, rect.height);
        return {
          tag: el.tagName.toLowerCase(),
          text:
            el.getAttribute('aria-label') ||
            (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          minSide: Math.round(minSide),
        };
      })
      .filter((item) => item.minSide < 42)
      .slice(0, 10);
  });

  if (badTargets.length > 0) {
    throw new Error(`${label}: small touch targets ${JSON.stringify(badTargets)}`);
  }
}

async function assertVisible(locator, label) {
  await locator.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
  if (!(await locator.isVisible().catch(() => false))) {
    throw new Error(`${label}: expected visible element was missing`);
  }
}

async function tap(page, x, y) {
  if (page.touchscreen) {
    await page.touchscreen.tap(x, y);
  } else {
    await page.mouse.click(x, y);
  }
}

async function dismissStageIntro(page) {
  const skipMovie = page.locator('button[aria-label="Skip intro video"]');
  if (await skipMovie.isVisible().catch(() => false)) {
    await skipMovie.click();
    await page.waitForTimeout(300);
  }

  for (let i = 0; i < 12; i += 1) {
    const finalCta = page.locator('button:has-text("Tap to start exploring")');
    if (await finalCta.isVisible().catch(() => false)) {
      await finalCta.click();
      await page.waitForTimeout(250);
      return;
    }

    const dialogue = page
      .locator('[role="dialog"], .character-debug-intro, .jrpg-intro-dialogue, .dialogue-panel')
      .first();
    if (await dialogue.isVisible().catch(() => false)) {
      await dialogue.click();
      await page.waitForTimeout(220);
    } else {
      return;
    }
  }
}

async function selectHotspotAndVerb(page, label) {
  const canvas = page.locator('canvas[data-testid="stage-3d-adventure-canvas"]');
  const box = await canvas.boundingBox();
  if (!box) throw new Error(`${label}: canvas had no bounding box`);

  const debugPoint = await page.evaluate(() => {
    const scene = window.__sceneDebug;
    const npcs = scene?.npcs && typeof scene.npcs === 'object' ? Object.values(scene.npcs) : [];
    for (const npc of npcs) {
      const ndc = npc?.ndc;
      if (
        ndc &&
        Number.isFinite(ndc.x) &&
        Number.isFinite(ndc.y) &&
        ndc.x >= -0.95 &&
        ndc.x <= 0.95 &&
        ndc.y >= -0.85 &&
        ndc.y <= 0.85
      ) {
        return { x: ndc.x, y: ndc.y };
      }
    }
    return null;
  });

  if (debugPoint) {
    await tap(
      page,
      box.x + ((debugPoint.x + 1) / 2) * box.width,
      box.y + ((1 - debugPoint.y) / 2) * box.height,
    );
    await page.waitForTimeout(500);
    const contextualActionCount = await page.locator('.adventure-3d-context-action').count();
    if (contextualActionCount > 0) {
      await page.locator('.adventure-3d-context-action').first().click();
      await page.waitForTimeout(250);
      return;
    }
    const enabledVerbCount = await page.locator('.adventure-3d-verb:not([disabled])').count();
    if (enabledVerbCount > 0) {
      await page.locator('.adventure-3d-verb:not([disabled])').first().click();
      await page.waitForTimeout(250);
      return;
    }
  }

  const points = [
    [0.86, 0.49],
    [0.58, 0.48],
    [0.66, 0.48],
    [0.5, 0.5],
    [0.42, 0.5],
    [0.72, 0.55],
    [0.34, 0.55],
    [0.5, 0.62],
  ];

  for (const [rx, ry] of points) {
    await tap(page, box.x + box.width * rx, box.y + box.height * ry);
    await page.waitForTimeout(450);
    const contextualActionCount = await page.locator('.adventure-3d-context-action').count();
    if (contextualActionCount > 0) {
      await page.locator('.adventure-3d-context-action').first().click();
      await page.waitForTimeout(250);
      return;
    }
    const enabledVerbCount = await page.locator('.adventure-3d-verb:not([disabled])').count();
    if (enabledVerbCount > 0) {
      await page.locator('.adventure-3d-verb:not([disabled])').first().click();
      await page.waitForTimeout(250);
      return;
    }
  }

  throw new Error(`${label}: no hotspot selection enabled a verb`);
}

async function runTitleProbe(page, viewportName) {
  await page.goto(baseUrl, { waitUntil: 'load', timeout: 30_000 });
  await assertVisible(page.locator('nav[aria-label="Title menu"]').first(), `${viewportName} title menu`);
  await page.locator('button:has-text("More")').first().click();
  await assertVisible(page.locator('[role="menu"] button:has-text("Microgames")').first(), `${viewportName} microgames CTA`);
  await assertVisible(page.locator('.title-three-scene[data-su-ready="true"]').first(), `${viewportName} title Su model`);
  await assertNoHorizontalOverflow(page, `${viewportName} title`);
  await assertTouchTargets(page, `${viewportName} title`);
  await page.screenshot({ path: resolve(screenshotDir, `${viewportName}-01-title.png`) });
}

async function runStageProbe(page, viewportName) {
  await page.goto(baseUrl, { waitUntil: 'load', timeout: 30_000 });
  await page.evaluate(() => {
    window.sessionStorage.setItem('isekai-debug-stage-3d-index', '0');
  });
  await page.reload({ waitUntil: 'load', timeout: 30_000 });
  await page.waitForSelector('canvas[data-testid="stage-3d-adventure-canvas"]', { timeout: 30_000 });
  await page.waitForSelector('.adventure-3d-load-overlay--hidden', { timeout: 35_000 }).catch(() => {});
  await dismissStageIntro(page);
  await page.waitForTimeout(600);

  await assertVisible(page.locator('.adventure-3d-header').first(), `${viewportName} stage header`);
  await assertVisible(page.locator('.adventure-3d-mic').first(), `${viewportName} mic button`);
  await assertVisible(page.locator('button:has-text("Skip Phrase")').first(), `${viewportName} skip phrase`);
  await selectHotspotAndVerb(page, `${viewportName} stage`);
  await assertNoHorizontalOverflow(page, `${viewportName} stage`);
  await assertTouchTargets(page, `${viewportName} stage`);
  await page.screenshot({ path: resolve(screenshotDir, `${viewportName}-02-stage.png`) });
}

async function runMicrogameProbe(page, viewportName) {
  await page.goto(`${baseUrl}/microgames`, { waitUntil: 'load', timeout: 30_000 });
  await assertVisible(page.locator('text=Thai Microgames').first(), `${viewportName} microgame hub`);
  await page.locator('button:has-text("Hotel Lobby Basics")').first().click();
  await page.waitForSelector('text=Make it polite!', { timeout: 8_000 });
  await page.waitForTimeout(1_100);
  await assertNoHorizontalOverflow(page, `${viewportName} microgames`);
  await assertTouchTargets(page, `${viewportName} microgames`);
  await page.screenshot({ path: resolve(screenshotDir, `${viewportName}-03-microgames.png`) });
}

async function runBattleDemoProbe(page, viewportName) {
  await page.goto(`${baseUrl}/battle-demo`, { waitUntil: 'load', timeout: 30_000 });
  await assertVisible(page.locator('main[aria-label="Phantasy Star 4 style battle demo"]'), `${viewportName} battle demo`);
  await assertVisible(page.locator('button:has-text("Title")').first(), `${viewportName} battle exit`);
  await assertNoHorizontalOverflow(page, `${viewportName} battle demo`);
  await assertTouchTargets(page, `${viewportName} battle demo`);
  await page.screenshot({ path: resolve(screenshotDir, `${viewportName}-04-battle-demo.png`) });
}

async function main() {
  await mkdir(screenshotDir, { recursive: true });
  const browser = await launchBrowser();
  const failures = [];

  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });
    const page = await context.newPage();
    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (isRealError(text)) errors.push(`console: ${text}`);
      }
    });
    page.on('pageerror', (err) => errors.push(`page: ${err.message}`));

    try {
      console.log(`\n-- ${viewport.name} ${viewport.width}x${viewport.height} --`);
      await runTitleProbe(page, viewport.name);
      await runStageProbe(page, viewport.name);
      await runMicrogameProbe(page, viewport.name);
      await runBattleDemoProbe(page, viewport.name);

      if (errors.length > 0) {
        throw new Error(errors.map(cleanText).join(' | '));
      }
      console.log(`pass ${viewport.name}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failures.push(`${viewport.name}: ${message}`);
      console.log(`fail ${viewport.name}: ${message}`);
    } finally {
      await page.close().catch(() => {});
      await context.close().catch(() => {});
    }
  }

  await browser.close();

  console.log(`\nScreenshots: ${screenshotDir}`);
  if (failures.length > 0) {
    console.error('\nMobile smoke failures:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log('\nMobile smoke passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
