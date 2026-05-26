#!/usr/bin/env node
/**
 * Encodes the PNG frame sequences produced by `npm run promo:record -- --clip=<id>`
 * into per-clip MP4 masters for the LinkedIn / Facebook trailer.
 *
 * For each tmp/promo/clip-<id>/ that exists, this script:
 *   1. Reads the matching entry in scripts/clip-manifest.json to pick the fps
 *   2. Runs ffmpeg to produce tmp/promo/clips/clip-<id>.mp4 (H.264, yuv420p, crf 18)
 *   3. Skips clips with source: 'editor' / 'manual' / 'existing' — those are
 *      composed outside the engine and don't have a frame folder to encode.
 *
 * Usage:
 *   node scripts/encode-clips.mjs                # encode every captured clip
 *   node scripts/encode-clips.mjs --clip=02      # encode just one clip
 *   node scripts/encode-clips.mjs --force        # overwrite existing MP4s
 *
 * Requires `ffmpeg` on PATH. On Windows: `winget install Gyan.FFmpeg` or
 * download from https://www.gyan.dev/ffmpeg/builds/ and add `bin/` to PATH.
 */

import { readFile, mkdir, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const promoRoot = resolve(projectRoot, 'tmp', 'promo');
const outRoot = resolve(promoRoot, 'clips');
const manifestPath = resolve(__dirname, 'clip-manifest.json');

const args = process.argv.slice(2);
const clipFilter = args.find((a) => a.startsWith('--clip='))?.split('=')[1] ?? null;
const force = args.includes('--force');

function runFfmpeg(ffArgs) {
  // Pipe ffmpeg's stderr to ours line-by-line so progress is visible. ffmpeg
  // writes its progress chatter to stderr; stdout is reserved for piped frames.
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn('ffmpeg', ffArgs, { stdio: ['ignore', 'inherit', 'inherit'] });
    child.on('error', rejectPromise);
    child.on('exit', (code) => {
      if (code === 0) resolvePromise();
      else rejectPromise(new Error(`ffmpeg exited with code ${code}`));
    });
  });
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function encodeClip(clip) {
  if (clip.source !== 'engine' && clip.source !== 'engine-dual') {
    return { id: clip.id, skipped: true, reason: `source=${clip.source}` };
  }

  const frameDir = resolve(promoRoot, `clip-${clip.id}`);
  const webmPath = resolve(frameDir, `clip-${clip.id}.webm`);
  const metaPath = resolve(frameDir, `clip-${clip.id}.meta.json`);

  if (!(await exists(webmPath))) {
    return { id: clip.id, skipped: true, reason: 'no recorded webm yet' };
  }

  const outPath = resolve(outRoot, `clip-${clip.id}.mp4`);
  if (!force && (await exists(outPath))) {
    return { id: clip.id, skipped: true, reason: 'already encoded (use --force to overwrite)' };
  }

  // Read the sidecar that record-promo.mjs writes to know how many seconds
  // of setup overhead to slice off the head of the webm. If no sidecar is
  // present (older capture or manual webm drop), default to no trim.
  let headTrimSec = 0;
  let durationSec = clip.durationMs / 1000;
  if (await exists(metaPath)) {
    try {
      const meta = JSON.parse(await readFile(metaPath, 'utf8'));
      headTrimSec = Math.max(0, (meta.headTrimMs ?? 0) / 1000);
      durationSec = (meta.durationMs ?? clip.durationMs) / 1000;
    } catch {
      /* fall back to defaults */
    }
  }

  // -ss before -i is fast seek (key-frame accurate enough for our case).
  // -t caps the encoded duration to exactly the clip window.
  // -crf 18 is visually lossless at 1080p.
  // -pix_fmt yuv420p keeps Safari + Facebook + LinkedIn decoders happy.
  // -movflags +faststart moves the moov atom up so the file streams cleanly.
  const ffArgs = [
    '-y',
    '-ss',
    String(headTrimSec.toFixed(3)),
    '-i',
    webmPath,
    '-t',
    String(durationSec.toFixed(3)),
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '18',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    outPath,
  ];

  console.log(
    `  → ffmpeg encode clip-${clip.id} (trim ${headTrimSec.toFixed(2)}s head, take ${durationSec.toFixed(2)}s)`,
  );
  await runFfmpeg(ffArgs);
  return { id: clip.id, encoded: true, path: outPath };
}

async function main() {
  const manifestRaw = await readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestRaw);
  const clips = clipFilter
    ? manifest.clips.filter((c) => c.id === clipFilter)
    : manifest.clips;

  if (!clips.length) {
    console.error(`No clips match --clip=${clipFilter}.`);
    process.exit(2);
  }

  await mkdir(outRoot, { recursive: true });

  console.log(`\n━━ Encoding ${clips.length} clip${clips.length === 1 ? '' : 's'} ━━`);

  const results = [];
  for (const clip of clips) {
    try {
      const result = await encodeClip(clip);
      results.push(result);
      if (result.encoded) {
        console.log(`  ✓ clip-${result.id}.mp4`);
      } else if (result.skipped) {
        console.log(`  · clip-${clip.id}: skipped — ${result.reason}`);
      }
    } catch (err) {
      console.error(`  ✗ clip-${clip.id}: ${err.message}`);
      results.push({ id: clip.id, error: err.message });
    }
  }

  const encoded = results.filter((r) => r.encoded).length;
  const skipped = results.filter((r) => r.skipped).length;
  const errored = results.filter((r) => r.error).length;

  console.log(`\n━━ Done ━━`);
  console.log(`  ${encoded} encoded · ${skipped} skipped · ${errored} errored`);
  console.log(`  Output: ${outRoot}`);
  if (errored > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Encode crashed:', err);
  process.exit(1);
});
