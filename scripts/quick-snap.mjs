import { chromium } from 'playwright-core';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto('http://127.0.0.1:5173', { waitUntil: 'load' });
await page.evaluate(() => window.sessionStorage.setItem('isekai-debug-stage-3d-index', '1'));
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('canvas[data-testid="stage-3d-adventure-canvas"]', { timeout: 30000 });
await page.waitForSelector('.adventure-3d-load-overlay--hidden', { timeout: 30000 }).catch(()=>{});
await page.waitForTimeout(700);
// skip intro movie
const skipMovie = page.locator('button[aria-label="Skip intro video"]');
if (await skipMovie.isVisible().catch(()=>false)) {
  await skipMovie.click();
  await page.waitForTimeout(300);
}
// skip VN
for (let i=0;i<12;i++){
  const cta = page.locator('button:has-text("Tap to start exploring")');
  if (await cta.isVisible().catch(()=>false)){ await cta.click(); break; }
  await page.mouse.click(720, 760);
  await page.waitForTimeout(220);
}
await page.waitForTimeout(800);
// Check what hotspots are in current room
const r0 = await page.evaluate(() => Object.keys(window.__sceneDebug?.npcs ?? {}));
console.log('room0 npcs:', r0);
// Click second room nav button (Desk)
const navBtns = page.locator('nav.adventure-3d-room-nav button.adventure-3d-room-pill');
const count = await navBtns.count();
console.log('nav count:', count);
await navBtns.nth(1).click({ force: true });
console.log('clicked Desk nav');
await page.waitForTimeout(2000);
const r1 = await page.evaluate(() => Object.keys(window.__sceneDebug?.npcs ?? {}));
console.log('room1 npcs:', r1);
const clerkInfo = await page.evaluate(() => window.__sceneDebug?.npcs?.clerk ?? null);
console.log('clerk:', JSON.stringify(clerkInfo));
// wait longer for clerk model load
for (let i=0;i<10;i++){
  await page.waitForTimeout(800);
  const c = await page.evaluate(() => window.__sceneDebug?.npcs?.clerk ?? null);
  if (c) { console.log(`clerk after ${(i+1)*0.8}s:`, JSON.stringify(c)); break; }
}
await page.screenshot({ path: 'tmp/stage2-snapshot.png' });
if (errors.length) console.log('ERRORS:', errors);
await browser.close();
