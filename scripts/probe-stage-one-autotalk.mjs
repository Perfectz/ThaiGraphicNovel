// Headless probe of Stage 1's autoTalk click flow. Uses the dev __sceneDebug
// hook to find Su's actual on-screen NDC position, clicks her exactly once,
// then samples + screenshots over the next ~6s to verify the cinematic +
// two-shot framing.

import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const screenshotDir = resolve(__dirname, '..', 'tmp', 'stage-one-autotalk');

async function main() {
  await mkdir(screenshotDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('http://127.0.0.1:5173', { waitUntil: 'load' });
  await page.evaluate(() => window.sessionStorage.setItem('isekai-debug-stage-3d-index', '0'));
  await page.reload({ waitUntil: 'load' });

  await page.waitForSelector('canvas[data-testid="stage-3d-adventure-canvas"]', { timeout: 25_000 });
  await page
    .waitForSelector('.adventure-3d-load-overlay--hidden', { timeout: 30_000 })
    .catch(() => {});
  await page.waitForTimeout(800);

  const skipMovie = page.locator('button[aria-label="Skip intro video"]');
  if (await skipMovie.isVisible().catch(() => false)) {
    await skipMovie.click();
    await page.waitForTimeout(300);
  }

  // VN dialogue — advance 4 lines by clicking the dialogue area.
  for (let i = 0; i < 12; i += 1) {
    const finalCta = page.locator('button:has-text("Tap to start exploring")');
    if (await finalCta.isVisible().catch(() => false)) {
      await finalCta.click();
      await page.waitForTimeout(250);
      break;
    }
    await page.mouse.click(720, 760);
    await page.waitForTimeout(220);
  }
  await page.waitForTimeout(700);

  // Wait for __sceneDebug to be populated by the dev animate-loop hook.
  await page.waitForFunction(() => !!window.__sceneDebug?.npcs?.su, { timeout: 5000 }).catch(() => {});

  await page.screenshot({ path: resolve(screenshotDir, 'loaded.png') });

  const canvasBox = await page.locator('canvas[data-testid="stage-3d-adventure-canvas"]').boundingBox();
  if (!canvasBox) throw new Error('canvas missing');

  // Convert Su's NDC to viewport pixel coordinates and click exactly once.
  const suNdc = await page.evaluate(() => window.__sceneDebug?.npcs?.su?.ndc ?? null);
  if (!suNdc) throw new Error('Su NDC not available — scene debug never populated');
  const clickX = canvasBox.x + ((suNdc.x + 1) / 2) * canvasBox.width;
  const clickY = canvasBox.y + ((1 - suNdc.y) / 2) * canvasBox.height;
  console.log(`Su NDC: ${JSON.stringify(suNdc)} -> click at (${clickX.toFixed(0)}, ${clickY.toFixed(0)})`);

  await page.mouse.click(clickX, clickY);
  await page.waitForTimeout(150);
  await page.screenshot({ path: resolve(screenshotDir, 'clicked.png') });

  const samples = [];
  const captureTimes = [500, 1300, 2500, 5000];
  let captured = 0;
  for (let i = 0; i < 32; i += 1) {
    await page.waitForTimeout(200);
    const elapsed = (i + 1) * 200;
    if (captured < captureTimes.length && elapsed >= captureTimes[captured]) {
      await page.screenshot({
        path: resolve(screenshotDir, `t${captureTimes[captured]}ms.png`),
      });
      captured += 1;
    }
    const data = await page.evaluate(() => ({
      patrick: window.__patrickPos ?? null,
      scene: window.__sceneDebug ?? null,
    }));
    samples.push(data);
  }
  await page.screenshot({ path: resolve(screenshotDir, 'settled.png') });

  console.log('walk samples (200ms each):');
  samples.forEach((s, i) => {
    const p = s.patrick;
    const sc = s.scene;
    const patrickStr = p
      ? `P (${p.x.toFixed(2)},${p.z.toFixed(2)}) ry=${p.ry?.toFixed(2) ?? '?'}`
      : 'P null';
    const cam = sc?.cameraPos
      ? `cam=(${sc.cameraPos.x.toFixed(1)},${sc.cameraPos.y.toFixed(1)},${sc.cameraPos.z.toFixed(1)})`
      : 'cam=?';
    const tgt = sc?.target
      ? `tgt=(${sc.target.x.toFixed(1)},${sc.target.y.toFixed(1)},${sc.target.z.toFixed(1)})`
      : 'tgt=?';
    const pndc = sc?.patrickNdc ? `pNDC=(${sc.patrickNdc.x.toFixed(2)},${sc.patrickNdc.y.toFixed(2)})` : '';
    const su = sc?.npcs?.su;
    const suStr = su
      ? `S model_local=(${su.modelX.toFixed(2)},${su.modelZ.toFixed(2)}) ry=${su.modelRy.toFixed(2)} ndc=(${su.ndc.x.toFixed(2)},${su.ndc.y.toFixed(2)})`
      : 'S=?';
    console.log(
      `  t=${((i + 1) * 0.2).toFixed(1)}s ${patrickStr} ${pndc} | ${cam} ${tgt} | ${suStr}${sc?.cinematicActive ? ' [CINE]' : ''}`,
    );
  });

  console.log(`console errors: ${errors.length}`);
  errors.forEach((e) => console.log(`  ${e}`));

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
