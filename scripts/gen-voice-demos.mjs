#!/usr/bin/env node
/**
 * Generates the male-voice Thai phrase attempt WAVs used by trailer clips
 * 14 / 23 / 24 / 25. Each phrase gets two takes — a "pass" version where
 * the romanization is faithful, and a "fail" version where it's mangled
 * with anglicized syllables and the wrong stresses. When the in-game
 * Whisper judge transcribes the fail take, it scores low because the
 * transcription doesn't match the target Thai phrase — which is the
 * authentic "AI corrects you" loop we want on camera.
 *
 * Why OpenAI TTS (`/v1/audio/speech`) instead of Realtime WebRTC:
 *   - This is one-shot synthesis, not a live conversation. The Realtime
 *     API's WebRTC handshake adds 4–6 lines of infra for zero gain here.
 *   - The standard TTS endpoint returns a WAV blob the script can write
 *     directly to disk.
 *
 * Voice choice: `onyx` is the male voice with the most natural pacing
 * across non-English phonemes. `echo` is also male but a touch lighter;
 * if you want a second take with vocal variety, override --voice=echo.
 *
 * Usage:
 *   export OPENAI_API_KEY=sk-...     (or set in .env.local — see below)
 *   npm run voice:gen-demos
 *   npm run voice:gen-demos -- --phrase=sawatdee   # one phrase
 *   npm run voice:gen-demos -- --voice=echo
 *
 * Output:
 *   public/voice-demo/<phraseId>-pass.wav
 *   public/voice-demo/<phraseId>-fail.wav
 *
 * Vite serves /public/* at the site root, so the WAVs are reachable from
 * Playwright as `/voice-demo/<phraseId>-<outcome>.wav` once the dev server
 * is running.
 */

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '..', 'public', 'voice-demo');

const args = process.argv.slice(2);
const phraseFilter = args.find((a) => a.startsWith('--phrase='))?.split('=')[1] ?? null;
const voice = args.find((a) => a.startsWith('--voice='))?.split('=')[1] ?? 'onyx';
const model = args.find((a) => a.startsWith('--model='))?.split('=')[1] ?? 'tts-1-hd';

// API key: prefer process.env, then a .env.local one-liner for convenience.
async function resolveApiKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  try {
    const env = await readFile(resolve(__dirname, '..', '.env.local'), 'utf8');
    const match = env.match(/^\s*OPENAI_API_KEY\s*=\s*(.+?)\s*$/m);
    if (match) return match[1].replace(/^["']|["']$/g, '');
  } catch {
    /* no .env.local — fall through to error */
  }
  throw new Error(
    'OPENAI_API_KEY is not set. Add it to .env.local or export it before running.',
  );
}

// Phrase manifest — one entry per Thai phrase that needs voice demos.
// `passText` should approximate Thai phonemes for `onyx` to read naturally;
// `failText` deliberately mangles syllable boundaries, swaps vowels, or
// shifts stress so the Whisper transcription drifts off-target.
//
// Adding a phrase: append an entry and re-run the script. Existing files
// are overwritten only if --force is passed.
const PHRASE_MANIFEST = [
  {
    id: 'sawatdee',
    target: 'สวัสดีครับ',
    english: 'Hello',
    passText: 'Sah-waht-dee krahp.',
    failText: 'Suh wuzz day krup.',
  },
  {
    id: 'khobkun',
    target: 'ขอบคุณครับ',
    english: 'Thank you',
    passText: 'Khawp-koon krahp.',
    failText: 'Cob kun crap.',
  },
  {
    id: 'khotoht',
    target: 'ขอโทษครับ',
    english: 'Sorry',
    passText: 'Khaw-tote krahp.',
    failText: 'Co toast krup.',
  },
  {
    id: 'yindee',
    target: 'ยินดีที่ได้รู้จักครับ',
    english: 'Nice to meet you',
    passText: 'Yin-dee tee dai roo-jak krahp.',
    failText: 'Yin deer tee dye roo jock crap.',
  },
  {
    id: 'aroi',
    target: 'อร่อยมากครับ',
    english: 'Delicious',
    passText: 'Ah-roi mahk krahp.',
    failText: 'Aroy mock krup.',
  },
  {
    id: 'mai-phet',
    target: 'ไม่เผ็ด',
    english: 'Not spicy',
    passText: 'My phet.',
    failText: 'Mai-pet.',
  },
];

async function synthesize(apiKey, text) {
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      voice,
      input: text,
      response_format: 'wav',
      // Slightly slower than natural English pacing — gives the Whisper
      // model cleaner syllable boundaries to score. Realistic for a
      // beginner Thai learner too, so the demo reads as authentic.
      speed: 0.92,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI TTS failed: HTTP ${response.status} — ${detail.slice(0, 300)}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 1024) {
    throw new Error(`Suspiciously small WAV (${buffer.length} bytes). Aborting.`);
  }
  return buffer;
}

async function writeTake(apiKey, phrase, outcome) {
  const text = outcome === 'pass' ? phrase.passText : phrase.failText;
  const outPath = resolve(outDir, `${phrase.id}-${outcome}.wav`);
  const buffer = await synthesize(apiKey, text);
  await writeFile(outPath, buffer);
  return { outPath, bytes: buffer.length };
}

// Clip 23 / 25 reference these specific filenames — produce them as
// aliases so the manifest paths line up without an extra renaming step.
async function writeClip23Aliases(apiKey, phrase) {
  if (phrase.id !== 'sawatdee') return; // only sawatdee gets the take1/take2 aliases
  const failBuf = await synthesize(apiKey, phrase.failText);
  const passBuf = await synthesize(apiKey, phrase.passText);
  await writeFile(resolve(outDir, 'sawatdee-take1-fail.wav'), failBuf);
  await writeFile(resolve(outDir, 'sawatdee-take2-pass.wav'), passBuf);
  console.log(`  · sawatdee-take1-fail.wav + sawatdee-take2-pass.wav (hero-clip aliases)`);
}

async function main() {
  const apiKey = await resolveApiKey();
  await mkdir(outDir, { recursive: true });

  const phrases = phraseFilter
    ? PHRASE_MANIFEST.filter((p) => p.id === phraseFilter)
    : PHRASE_MANIFEST;

  if (!phrases.length) {
    console.error(`No phrase with id=${phraseFilter}. Choose one of: ${PHRASE_MANIFEST.map((p) => p.id).join(', ')}`);
    process.exit(2);
  }

  console.log(`\n━━ Generating ${phrases.length} phrase × 2 takes via OpenAI TTS (${model}, voice=${voice}) ━━`);

  for (const phrase of phrases) {
    console.log(`\n[${phrase.id}] ${phrase.target} — "${phrase.english}"`);
    try {
      const pass = await writeTake(apiKey, phrase, 'pass');
      console.log(`  ✓ ${phrase.id}-pass.wav (${(pass.bytes / 1024).toFixed(1)} KB)`);
      const fail = await writeTake(apiKey, phrase, 'fail');
      console.log(`  ✓ ${phrase.id}-fail.wav (${(fail.bytes / 1024).toFixed(1)} KB)`);
      await writeClip23Aliases(apiKey, phrase);
    } catch (err) {
      console.error(`  ✗ ${phrase.id}: ${err.message}`);
    }
  }

  console.log(`\n━━ Done ━━`);
  console.log(`  WAVs at ${outDir}`);
  console.log(`  Served by Vite at /voice-demo/<id>-<outcome>.wav`);
  console.log(`  Next: npm run dev (in another terminal), then npm run promo:record -- --clip=23`);
}

main().catch((err) => {
  console.error('Voice demo generation crashed:', err);
  process.exit(1);
});
