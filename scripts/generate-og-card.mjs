#!/usr/bin/env node
/**
 * Generate the social-share preview card (`public/og-card.png`) using
 * Playwright + a small HTML template. Run after major visual changes so
 * the social preview stays current.
 *
 * Usage: npm run promo:og-card
 *
 * Output: public/og-card.png (1200×630 — the size Twitter/Facebook/
 * Slack/Discord etc. all crop to).
 */

import { chromium } from 'playwright-core';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(__dirname, '..', 'public', 'og-card.png');

// Pure-HTML template — no app dependencies. Renders in any browser, so
// the same template produces the same image whether you generate it on
// macOS Chrome, Linux CI, or in Playwright headless WebKit.
const html = `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: 1200px; height: 630px; overflow: hidden; }
      body {
        font-family: 'Inter', system-ui, sans-serif;
        color: #f4f1eb;
        background:
          radial-gradient(circle at 18% 20%, rgba(103, 232, 249, 0.30), transparent 50%),
          radial-gradient(circle at 82% 78%, rgba(244, 114, 182, 0.30), transparent 50%),
          linear-gradient(135deg, #0a0a0b 0%, #15171b 100%);
        position: relative;
      }
      .grid {
        position: absolute;
        inset: 0;
        background-image:
          linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px);
        background-size: 40px 40px;
      }
      .container {
        position: relative;
        display: grid;
        grid-template-rows: auto 1fr auto;
        gap: 24px;
        height: 100%;
        padding: 56px 72px;
      }
      .eyebrow {
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 0.32em;
        text-transform: uppercase;
        color: #67e8f9;
      }
      .title {
        font-size: 96px;
        font-weight: 900;
        letter-spacing: -0.02em;
        line-height: 1;
        max-width: 900px;
      }
      .title em { font-style: normal; color: #67e8f9; }
      .tagline {
        font-size: 28px;
        font-weight: 500;
        line-height: 1.35;
        color: rgba(244, 241, 235, 0.85);
        max-width: 800px;
      }
      .meta {
        display: flex;
        gap: 16px;
        align-items: center;
        flex-wrap: wrap;
      }
      .chip {
        padding: 8px 16px;
        border-radius: 999px;
        border: 1px solid rgba(103, 232, 249, 0.4);
        background: rgba(103, 232, 249, 0.1);
        color: #67e8f9;
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 0.16em;
        text-transform: uppercase;
      }
      .chip--warm {
        border-color: rgba(250, 204, 21, 0.4);
        background: rgba(250, 204, 21, 0.1);
        color: #facc15;
      }
      .credits {
        font-size: 14px;
        font-weight: 500;
        color: rgba(244, 241, 235, 0.4);
        letter-spacing: 0.06em;
      }
    </style>
  </head>
  <body>
    <div class="grid"></div>
    <div class="container">
      <div class="eyebrow">Bangkok Rift · Episode 01</div>
      <div>
        <div class="title">Learn Thai by <em>living in it.</em></div>
        <div class="tagline" style="margin-top: 24px">
          Patrick falls through a magic rift into Bangkok. Su, an AI tutor princess, drills him on
          the polite phrases he needs to survive — three stages, about twenty minutes.
        </div>
      </div>
      <div class="meta">
        <span class="chip">Tech demo · 3 stages</span>
        <span class="chip chip--warm">Voice or read-and-tap</span>
        <span class="chip">React · Three.js · OpenAI Realtime</span>
        <span class="credits" style="margin-left: auto">bangkokrift.app</span>
      </div>
    </div>
  </body>
</html>`;

async function main() {
  console.log('Rendering OG card…');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.setContent(html, { waitUntil: 'networkidle' });

  await mkdir(dirname(outPath), { recursive: true });
  const buffer = await page.screenshot({ omitBackground: false, type: 'png' });
  await writeFile(outPath, buffer);
  await browser.close();

  console.log(`✓ Wrote ${outPath} (${buffer.length} bytes)`);
}

main().catch((err) => {
  console.error('OG card generation failed:', err);
  process.exit(1);
});
