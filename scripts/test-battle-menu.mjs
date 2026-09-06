import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const baseArgIdx = args.indexOf('--base');
const baseUrl = baseArgIdx >= 0 ? args[baseArgIdx + 1] : 'http://127.0.0.1:5188';
const route = `${baseUrl.replace(/\/$/, '')}/battle-demo`;

const ERROR_FILTERS = [
  /Failed to load resource.*api\/(whisper|realtime)/i,
  /Failed to load resource: the server responded with a status of 502/i,
  /favicon/i,
  /vite-hmr/i,
  /AudioContext.*resume/i,
  /getUserMedia|MediaError/i,
];

function normalize(text) {
  return text?.replace(/\s+/g, ' ').trim() ?? '';
}

function isRealError(text) {
  return !ERROR_FILTERS.some((pattern) => pattern.test(text));
}

function expectIncludes(haystack, expected, label) {
  const missing = expected.filter((item) => !haystack.some((entry) => entry.includes(item)));
  if (missing.length) {
    throw new Error(`${label} missing: ${missing.join(', ')}. Saw: ${JSON.stringify(haystack)}`);
  }
}

async function buttonLabels(page) {
  return page
    .locator('.bd-command-panel button')
    .evaluateAll((buttons) => buttons.map((button) => button.textContent?.replace(/\s+/g, ' ').trim() ?? ''));
}

async function openPane(page, label) {
  await page.locator('.bd-command-panel button').filter({ hasText: label }).first().click();
  await page.waitForTimeout(120);
}

async function verifyViewport(viewport, isMobile = false) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport, isMobile });
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && isRealError(message.text())) errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(route, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1700);
  await page.waitForSelector('button:has-text("Attack")', { timeout: 15000 });

  const root = await buttonLabels(page);
  expectIncludes(root, ['Attack', 'Magic', 'Skills', 'Items', 'Retreat'], `${viewport.width} root menu`);

  // The menu now surfaces the round's authored lesson moves directly. For the
  // demo's first turn (greeting) that is the simple "Polite Hello" + a safe
  // repeat under Attack, and the super/heal/defend trio under Magic.
  await openPane(page, 'Attack');
  expectIncludes(await buttonLabels(page), ['Polite Hello', 'Safe Repeat'], `${viewport.width} Attack`);
  await page.getByRole('button', { name: /Back/ }).click();

  await openPane(page, 'Magic');
  expectIncludes(
    await buttonLabels(page),
    ['Warm Introduction', 'Su: Hello Drill', 'Beginner Shield'],
    `${viewport.width} Magic`,
  );
  await page.getByRole('button', { name: /Back/ }).click();

  await openPane(page, 'Skills');
  expectIncludes(await buttonLabels(page), ['Listen', 'Coach'], `${viewport.width} Skills`);
  await page.getByRole('button', { name: /Back/ }).click();

  await openPane(page, 'Items');
  expectIncludes(
    await buttonLabels(page),
    ['Phrase Card x2', 'Confidence Drink x1', 'Focus Tea x1', 'Lucky Amulet x1'],
    `${viewport.width} Items`,
  );
  await page.getByRole('button', { name: /Back/ }).click();

  await page.locator('.bd-command-panel button').filter({ hasText: 'Retreat' }).first().click();
  await page.waitForTimeout(120);
  const panelText = normalize(await page.locator('.bd-command-panel').textContent());
  if (!panelText.includes('You ended the conversation early.') || !panelText.includes('Conversation Ended')) {
    throw new Error(`${viewport.width} Retreat did not resolve early: ${panelText}`);
  }

  await browser.close();

  if (errors.length) {
    throw new Error(`${viewport.width} browser errors:\n${errors.join('\n')}`);
  }

  return { viewport, root };
}

const desktop = await verifyViewport({ width: 1440, height: 900 });
const mobile = await verifyViewport({ width: 390, height: 844 }, true);

console.log('Battle menu smoke passed');
console.log(`desktop root: ${JSON.stringify(desktop.root)}`);
console.log(`mobile root: ${JSON.stringify(mobile.root)}`);
