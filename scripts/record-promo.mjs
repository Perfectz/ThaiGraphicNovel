#!/usr/bin/env node
/**
 * Autonomous gameplay recorder. Two modes:
 *
 *   STAGE MODE (legacy, for the 90s trailer-v2 captures):
 *     npm run promo:record                   # records all three stages
 *     npm run promo:record -- --stage=1
 *
 *   CLIP MODE (new, for the LinkedIn / Facebook short-clip library):
 *     npm run promo:record -- --clip=02      # one clip from clip-manifest.json
 *     npm run promo:record -- --all-clips    # every `source: engine` clip
 *
 * Output:
 *   tmp/promo/<stage-NN>/frame-XXXX.png       (stage mode)
 *   tmp/promo/clip-<id>/frame-XXXX.png        (clip mode)
 *
 * Encode the PNG sequences with `node scripts/encode-clips.mjs` (clip mode)
 * or `ffmpeg -framerate 10 -i tmp/promo/stage-01/frame-%04d.png ...`.
 *
 * Pre-reqs for voice-loop clips (23/24/25):
 *   - Whisper service running (`npm run whisper:service`)
 *   - Voice-demo WAVs generated (`npm run voice:gen-demos`) and present in
 *     public/voice-demo/ so Vite serves them at /voice-demo/<file>.wav
 */

import { chromium } from 'playwright-core';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const promoRoot = resolve(__dirname, '..', 'tmp', 'promo');
const manifestPath = resolve(__dirname, 'clip-manifest.json');

const args = process.argv.slice(2);
const baseArgIdx = args.indexOf('--base');
const baseUrl = baseArgIdx >= 0 ? args[baseArgIdx + 1] : 'http://127.0.0.1:5173';
const stageFilter = args.find((a) => a.startsWith('--stage='))?.split('=')[1];
const clipFilter = args.find((a) => a.startsWith('--clip='))?.split('=')[1];
const allClips = args.includes('--all-clips');
const headed = args.includes('--headed');

// =====================  STAGE MODE (legacy)  =====================

const STAGES = [
  { index: 0, label: 'Stage 01 — Hotel Lobby', durationMs: 30_000 },
  { index: 1, label: 'Stage 02 — Front Desk', durationMs: 35_000 },
  { index: 2, label: 'Stage 03 — Night Market', durationMs: 35_000 },
];

const STAGE_FRAME_INTERVAL_MS = 100;

async function recordStage(stage) {
  const outDir = resolve(promoRoot, `stage-${String(stage.index + 1).padStart(2, '0')}`);
  await mkdir(outDir, { recursive: true });

  console.log(`\n━━ ${stage.label} ━━`);
  const browser = await chromium.launch({ headless: !headed });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    permissions: ['microphone'],
  });
  const page = await context.newPage();

  await page.addInitScript(() => {
    window.localStorage.setItem('isekai-thai-quest-voice-judge-mode-v2', 'no-mic');
    window.localStorage.setItem(
      'isekai-thai-quest-sound-settings-v1',
      JSON.stringify({
        musicEnabled: true,
        musicVolume: 0.6,
        guideAudioEnabled: true,
        guideAudioVolume: 0.95,
        captionsEnabled: true,
      }),
    );
  });

  await page.addInitScript((index) => {
    window.sessionStorage.setItem('isekai-debug-stage-3d-index', String(index));
  }, stage.index);

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="stage-3d-adventure-canvas"]', { timeout: 20_000 });
  await page.waitForTimeout(2500);

  let frameIndex = 0;
  const startTime = Date.now();
  let stopped = false;

  const capture = async () => {
    while (!stopped && Date.now() - startTime < stage.durationMs) {
      const framePath = resolve(outDir, `frame-${String(frameIndex).padStart(4, '0')}.png`);
      try {
        await page.screenshot({ path: framePath, fullPage: false });
      } catch {
        /* navigation race */
      }
      frameIndex += 1;
      await page.waitForTimeout(STAGE_FRAME_INTERVAL_MS);
    }
  };

  const drive = async () => {
    while (!stopped && Date.now() - startTime < stage.durationMs) {
      const advance = page.locator('button:has-text("Confirm Phrase")').first();
      const introCue = page.locator('button:has-text("Tap to")').first();
      try {
        if (await advance.isVisible({ timeout: 200 })) {
          await advance.click({ trial: false });
        } else if (await introCue.isVisible({ timeout: 200 })) {
          await introCue.click({ trial: false });
        } else {
          const x = 480 + Math.floor(Math.random() * 960);
          const y = 540 + Math.floor(Math.random() * 240);
          await page.mouse.click(x, y);
        }
      } catch {
        /* buttons race */
      }
      await page.waitForTimeout(2200);
    }
  };

  await Promise.all([capture(), drive()]);
  stopped = true;

  await page.screenshot({ path: resolve(outDir, 'cover.png'), fullPage: false });
  console.log(`  ✓ Wrote ${frameIndex} frames + cover.png to ${outDir}`);

  await context.close();
  await browser.close();
}

// =====================  CLIP MODE (new)  =====================

function parseViewport(spec) {
  // "1920x1080" → { width, height }
  const [w, h] = spec.split('x').map((v) => parseInt(v, 10));
  if (!Number.isFinite(w) || !Number.isFinite(h)) {
    throw new Error(`Invalid viewport spec: ${spec}`);
  }
  return { width: w, height: h };
}

function buildClipUrl(clip) {
  const url = new URL(baseUrl);
  if (clip.hideHud) url.searchParams.set('no-hud', '1');
  if (clip.debugOrbit) {
    url.searchParams.set('debug-orbit', clip.debugOrbit.hotspotId);
    url.searchParams.set('orbit-radius', String(clip.debugOrbit.radius));
    url.searchParams.set('orbit-speed', String(clip.debugOrbit.speed));
  }
  // For rooms other than each stage's first (lobby/stalls), use the
  // enter-room debug query so the room-nav-pill click path isn't needed —
  // the pill is hidden in no-hud mode.
  if (clip.room && clip.room !== 'lobby' && clip.room !== 'stalls') {
    url.searchParams.set('enter-room', clip.room);
  }
  return url.toString();
}

async function recordClipEngine(clip) {
  const outDir = resolve(promoRoot, `clip-${clip.id}`);
  await mkdir(outDir, { recursive: true });

  const viewport = parseViewport(clip.viewport ?? '1920x1080');
  const fps = clip.fps ?? 30;
  const wantsVoice = Array.isArray(clip.voiceInjectSequence) || Boolean(clip.voiceInject);

  console.log(`\n━━ Clip ${clip.id} — ${clip.title} ━━`);
  console.log(
    `  viewport ${viewport.width}×${viewport.height} · ${fps}fps · ${(clip.durationMs / 1000).toFixed(1)}s` +
      `${clip.hideHud ? ' · no-hud' : ''}${clip.debugOrbit ? ' · orbit' : ''}${wantsVoice ? ' · voice-inject' : ''}`,
  );

  const browser = await chromium.launch({ headless: !headed });
  // Playwright's recordVideo captures the whole context lifetime as a webm
  // at native frame rate — much faster than per-frame PNG screenshots
  // (which top out near 4 fps at 1080p on Windows headless Chromium).
  // We let the recording span setup + the capture window, then trim the
  // setup head in encode-clips.mjs via `ffmpeg -ss`.
  const contextCreatedAt = Date.now();
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    permissions: ['microphone'],
    recordVideo: { dir: outDir, size: viewport },
  });
  const page = await context.newPage();

  await page.addInitScript(
    ({ wantsVoiceMode }) => {
      // Force Whisper if the clip needs voice injection (so the
      // __injectVoiceAttempt hook attaches); force no-mic otherwise so the
      // capture is fully autonomous and never blocks on mic permission.
      window.localStorage.setItem(
        'isekai-thai-quest-voice-judge-mode-v2',
        wantsVoiceMode ? 'whisper' : 'no-mic',
      );
      window.localStorage.setItem(
        'isekai-thai-quest-sound-settings-v1',
        JSON.stringify({
          musicEnabled: true,
          musicVolume: 0.55,
          guideAudioEnabled: true,
          guideAudioVolume: 0.92,
          captionsEnabled: true,
        }),
      );
      // Opt into the trailer-capture hooks (window.__injectVoiceAttempt,
      // any future capture-only debug flags). Mirrors the
      // `import.meta.env.DEV || window.__CLIP_CAPTURE` guard in the React app.
      window.__CLIP_CAPTURE = true;
    },
    { wantsVoiceMode: wantsVoice },
  );

  // Jump to the requested stage. The stage index comes from clip.stage (0/1/2).
  if (typeof clip.stage === 'number') {
    await page.addInitScript((index) => {
      window.sessionStorage.setItem('isekai-debug-stage-3d-index', String(index));
    }, clip.stage);
  }

  await page.goto(buildClipUrl(clip), { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="stage-3d-adventure-canvas"]', { timeout: 20_000 });

  // Intro video handling. By default, every clip skips the pre-roll
  // cinematic so the capture sees real gameplay — letting the intro play
  // murders frame rate (GPU video decode + 3D both contend) and gives the
  // first ~12 s to a movie nobody asked for. Opt-in via `keepIntroVideo:
  // true` in the manifest for clips that genuinely want the cinematic
  // (clip 02 — Rift Arrival).
  if (!clip.keepIntroVideo) {
    try {
      const skipBtn = page.locator('button:has-text("Skip Intro")').first();
      if (await skipBtn.isVisible({ timeout: 1500 })) {
        await skipBtn.click();
        // Stand-up animation + Patrick GLB resolve + lobby render: ~3s.
        await page.waitForTimeout(3200);
      } else {
        // No intro for this stage (or already dismissed) — short settle.
        await page.waitForTimeout(1200);
      }
    } catch {
      await page.waitForTimeout(1200);
    }
  } else {
    // Keep the intro and let it play during capture (clip 02). Still wait
    // a moment for the video element to mount and start.
    await page.waitForTimeout(800);
  }

  // Room jumps (frontDesk / cookline / bathroom) are handled via the
  // ?enter-room=<id> query param now — see buildClipUrl above. The React
  // effect fires enterRoom() ~1.2s after mount, so add a small extra wait
  // here for the room's cinematic to settle when one is requested.
  if (clip.room && clip.room !== 'lobby' && clip.room !== 'stalls') {
    await page.waitForTimeout(1800);
  }

  // If the clip targets a hotspot (su, hotelLobbyGirl, stage3Vendor), click
  // it once so the cinematic two-shot fires and the cue card surfaces. This
  // is best-effort — orbit-mode clips and pure B-roll skip hotspot clicks.
  if (clip.hotspot && !clip.debugOrbit) {
    try {
      // The hotspot click target is the rigged-character group. We synthesize
      // the click by dispatching a pointerup at the hotspot's screen-space
      // projection, which the existing onPointerUp handler reads via the
      // raycaster. The dev-only window.__sceneDebug exposes those projections
      // every frame.
      const ndc = await page.evaluate((hotspotId) => {
        const debug = (window).__sceneDebug;
        const npc = debug?.npcs?.[hotspotId];
        if (!npc?.ndc) return null;
        // NDC → viewport pixels
        return {
          x: (npc.ndc.x * 0.5 + 0.5) * window.innerWidth,
          y: (-npc.ndc.y * 0.5 + 0.5) * window.innerHeight,
        };
      }, clip.hotspot);
      if (ndc) {
        await page.mouse.click(ndc.x, ndc.y);
        await page.waitForTimeout(1200);
      }
    } catch {
      /* hotspot click optional */
    }
  }

  // If voice injection is configured, connect the Whisper mic and prepare
  // for timed inject calls. The schedule is a list of { atMs, wav } entries
  // measured from capture-start (after this setup completes).
  const voiceSequence = clip.voiceInjectSequence ?? (clip.voiceInject ? [{ atMs: 1000, wav: clip.voiceInject }] : null);
  if (voiceSequence) {
    try {
      const connectBtn = page.locator('button:has-text("Connect Whisper Mic")').first();
      if (await connectBtn.isVisible({ timeout: 2000 })) {
        await connectBtn.click();
        // Wait for the hook to attach. The useEffect runs after
        // setHasVoiceCoach(true) settles, so a short wait is enough.
        await page.waitForFunction(
          () => typeof (window).__injectVoiceAttempt === 'function',
          { timeout: 15_000 },
        );
        console.log(`  · voice hook ready, ${voiceSequence.length} injection(s) scheduled`);
      } else {
        console.warn('  ! Connect Whisper Mic button not visible — voice injection will be skipped.');
      }
    } catch (err) {
      console.warn(`  ! Voice setup failed: ${err.message}. Continuing without injection.`);
    }
  }

  // Anchor t=0 for voice-inject scheduling AFTER setup finishes. Stash it
  // alongside the recording so encode-clips.mjs knows how many seconds to
  // trim from the head when slicing the webm to the final clip length.
  const captureStart = Date.now();

  const runVoice = async () => {
    if (!voiceSequence) return;
    for (const step of voiceSequence) {
      const targetTime = captureStart + step.atMs;
      const wait = targetTime - Date.now();
      if (wait > 0) await page.waitForTimeout(wait);
      const wavServeUrl = `/voice-demo/${step.wav.replace(/^voice-demo\//, '')}`;
      try {
        await page.evaluate((url) => (window).__injectVoiceAttempt?.(url), wavServeUrl);
        console.log(`  · t+${step.atMs}ms injected ${step.wav}`);
      } catch (err) {
        console.warn(`  ! Inject failed @ t+${step.atMs}ms: ${err.message}`);
      }
    }
  };

  // Let the recording run for the requested clip duration. Voice injections
  // fire in parallel on their scheduled offsets.
  await Promise.all([page.waitForTimeout(clip.durationMs), runVoice()]);

  // Closing the context finalizes the webm. The file lands in `outDir`
  // with a random name (Playwright assigns it from the page's UUID); we
  // rename it to clip-<id>.webm so the encoder can find it deterministically.
  const video = page.video();
  await context.close();
  await browser.close();

  if (video) {
    const recordedPath = await video.path();
    const finalPath = resolve(outDir, `clip-${clip.id}.webm`);
    if (recordedPath !== finalPath) {
      await rename(recordedPath, finalPath);
    }
    // Write a sidecar that encode-clips.mjs uses to trim the setup portion.
    // `headTrimMs` = time between newContext (when recording starts) and the
    // moment we declared setup complete. The encoder slices everything
    // before that off the front of the webm.
    const headTrimMs = captureStart - contextCreatedAt;
    await writeFile(
      resolve(outDir, `clip-${clip.id}.meta.json`),
      JSON.stringify({ id: clip.id, durationMs: clip.durationMs, fps, headTrimMs }, null, 2),
    );
    console.log(`  ✓ Recorded clip-${clip.id}.webm (head-trim ${headTrimMs}ms in sidecar)`);
  } else {
    console.warn(`  ! No video produced for clip ${clip.id}.`);
  }
}

async function recordClipEditor(clip) {
  console.log(`\n━━ Clip ${clip.id} — ${clip.title} ━━`);
  console.log(`  · source=${clip.source} — skipped (compose in editor).`);
  if (clip.notes) console.log(`    ${clip.notes}`);
}

async function recordClip(clip) {
  if (clip.source === 'engine' || clip.source === 'engine-dual') {
    if (clip.source === 'engine-dual') {
      console.warn(
        `  ! Clip ${clip.id} is engine-dual (phone+desktop). This script captures the FIRST viewport only; ` +
          `re-run with a second --viewport override or extend the script for true lockstep. ` +
          `Falling back to ${clip.viewports?.[1] ?? '1440x900'} for now.`,
      );
      await recordClipEngine({ ...clip, viewport: clip.viewports?.[1] ?? '1440x900' });
      await recordClipEngine({ ...clip, id: `${clip.id}-phone`, viewport: clip.viewports?.[0] ?? '390x844' });
    } else {
      await recordClipEngine(clip);
    }
  } else {
    await recordClipEditor(clip);
  }
}

// =====================  Entry  =====================

async function main() {
  await mkdir(promoRoot, { recursive: true });

  // Clip mode wins if either --clip or --all-clips is provided.
  if (clipFilter || allClips) {
    const manifestRaw = await readFile(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestRaw);
    const clips = clipFilter
      ? manifest.clips.filter((c) => c.id === clipFilter)
      : manifest.clips.filter((c) => c.source === 'engine' || c.source === 'engine-dual');

    if (!clips.length) {
      console.error(
        clipFilter
          ? `No clip with id=${clipFilter} in scripts/clip-manifest.json.`
          : 'No engine clips found in scripts/clip-manifest.json.',
      );
      process.exit(2);
    }

    for (const clip of clips) {
      await recordClip(clip);
    }

    console.log('\n━━ Done (clip mode) ━━');
    console.log(`  Frames live at ${promoRoot}`);
    console.log('  Encode with: node scripts/encode-clips.mjs');
    return;
  }

  // Default: stage mode (legacy)
  const targets = stageFilter
    ? STAGES.filter((s) => String(s.index + 1) === stageFilter || String(s.index) === stageFilter)
    : STAGES;
  if (!targets.length) {
    console.error(`No stages match --stage=${stageFilter}. Choose 1, 2, or 3.`);
    process.exit(2);
  }

  for (const stage of targets) {
    await recordStage(stage);
  }

  console.log('\n━━ Done (stage mode) ━━');
  console.log(`  Frames live at ${promoRoot}`);
  console.log('  Compose a trailer with:');
  console.log(
    '    ffmpeg -framerate 10 -i tmp/promo/stage-01/frame-%04d.png \\\n' +
      '      -c:v libx264 -pix_fmt yuv420p tmp/promo/stage-01.mp4',
  );
}

main().catch((err) => {
  console.error('Promo recording crashed:', err);
  process.exit(1);
});
