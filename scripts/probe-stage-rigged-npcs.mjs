// Headless probe to verify that rigged NPCs render at the expected world
// position (the npcRig bug fix) and that the cinematic two-shot fires when
// the player clicks any rigged-person hotspot across stages 1, 2, 3, and 10.

import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const screenshotDir = resolve(__dirname, '..', 'tmp', 'stage-rigged-npcs');

// Stages to verify: index, expected rigged hotspot id, and the room with that
// hotspot. We click the hotspot and confirm Patrick walks to its standPosition
// and the camera lands on the right midpoint.
const targets = [
  { idx: 0, label: 'Stage 1 lobby — Su', hotspotId: 'su' },
  { idx: 1, label: 'Stage 2 front desk — clerk', hotspotId: 'clerk', roomIndex: 1 },
  { idx: 2, label: 'Stage 3 stalls — street-food-vendor', hotspotId: 'street-food-vendor', roomIndex: 0 },
  { idx: 9, label: 'Stage 10 courtyard — su-companion', hotspotId: 'su-companion', roomIndex: 0 },
];

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

async function probeStage(browser, { idx, label, hotspotId, roomIndex }) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('http://127.0.0.1:5173', { waitUntil: 'load' });
  await page.evaluate((stageIdx) => {
    window.sessionStorage.setItem('isekai-debug-stage-3d-index', String(stageIdx));
  }, idx);
  await page.reload({ waitUntil: 'load' });

  await page.waitForSelector('canvas[data-testid="stage-3d-adventure-canvas"]', { timeout: 25_000 });
  await page.waitForSelector('.adventure-3d-load-overlay--hidden', { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(700);
  await skipIntros(page);

  // Switch room if the target hotspot is in a later room.
  if (typeof roomIndex === 'number' && roomIndex > 0) {
    // The MusicToggle button at top-right has the same z-index as the room
    // nav and overlaps it visually, so a Playwright pointer-click misses.
    // Programmatic dispatch on the button element clicks the React handler
    // directly.
    await page.evaluate((idx) => {
      const buttons = document.querySelectorAll(
        'nav.adventure-3d-room-nav button.adventure-3d-room-pill',
      );
      const btn = buttons[idx];
      if (btn) btn.click();
    }, roomIndex);
    await page.waitForTimeout(1200);
  }

  await page.waitForFunction(
    (id) => !!window.__sceneDebug?.npcs?.[id],
    hotspotId,
    { timeout: 8000 },
  ).catch(() => {});

  const sceneBefore = await page.evaluate(() => window.__sceneDebug ?? null);
  console.log(`\n=== ${label} ===`);
  console.log(`scene before click: ${JSON.stringify(sceneBefore?.npcs?.[hotspotId])}`);

  const npc = sceneBefore?.npcs?.[hotspotId];
  if (!npc?.ndc) {
    console.log(`SKIP — no NDC for hotspot ${hotspotId}`);
    await page.screenshot({ path: resolve(screenshotDir, `${label.replace(/\W+/g, '_')}-no-hotspot.png`) });
    await context.close();
    return;
  }

  const canvasBox = await page.locator('canvas[data-testid="stage-3d-adventure-canvas"]').boundingBox();
  const clickX = canvasBox.x + ((npc.ndc.x + 1) / 2) * canvasBox.width;
  const clickY = canvasBox.y + ((1 - npc.ndc.y) / 2) * canvasBox.height;
  console.log(`clicking at (${clickX.toFixed(0)}, ${clickY.toFixed(0)})`);
  await page.mouse.click(clickX, clickY);
  await page.waitForTimeout(300);
  await page.screenshot({ path: resolve(screenshotDir, `${label.replace(/\W+/g, '_')}-clicked.png`) });

  // Wait for Patrick to settle near the standPosition (or 5s timeout)
  const start = Date.now();
  while (Date.now() - start < 7000) {
    await page.waitForTimeout(250);
    const p = await page.evaluate(() => window.__patrickPos ?? null);
    const sc = await page.evaluate(() => window.__sceneDebug ?? null);
    if (sc?.cinematicActive) continue;
    if (!sc) continue;
    if (p && sc.target) {
      const dxTarget = Math.abs(p.x - sc.target.x);
      const dzTarget = Math.abs(p.z - sc.target.z);
      // Settled when not moving + cinematic done + target near midpoint
      if (dxTarget < 4 && dzTarget < 4) break;
    }
  }

  const final = await page.evaluate(() => ({
    patrick: window.__patrickPos ?? null,
    scene: window.__sceneDebug ?? null,
  }));
  const f = final;
  const p = f.patrick;
  const sc = f.scene;
  const npcF = sc?.npcs?.[hotspotId];
  console.log(
    `final patrick=(${p?.x.toFixed(2)}, ${p?.z.toFixed(2)}) ry=${p?.ry?.toFixed(2)} pNDC=(${sc?.patrickNdc?.x.toFixed(2)}, ${sc?.patrickNdc?.y.toFixed(2)})`,
  );
  console.log(`final ${hotspotId} world=(${npcF?.groupX.toFixed(2)}, ${npcF?.groupZ.toFixed(2)}) ry=${npcF?.modelRy.toFixed(2)} ndc=(${npcF?.ndc.x.toFixed(2)}, ${npcF?.ndc.y.toFixed(2)})`);
  console.log(`camera=(${sc?.cameraPos.x.toFixed(2)}, ${sc?.cameraPos.y.toFixed(2)}, ${sc?.cameraPos.z.toFixed(2)})  target=(${sc?.target.x.toFixed(2)}, ${sc?.target.y.toFixed(2)}, ${sc?.target.z.toFixed(2)})`);

  await page.screenshot({ path: resolve(screenshotDir, `${label.replace(/\W+/g, '_')}-settled.png`) });
  if (errors.length) {
    console.log(`!!! ${errors.length} console errors:`);
    errors.forEach((e) => console.log(`  ${e}`));
  }
  await context.close();
}

async function main() {
  await mkdir(screenshotDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const t of targets) {
      await probeStage(browser, t);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
