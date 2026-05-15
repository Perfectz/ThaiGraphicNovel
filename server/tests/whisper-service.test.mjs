import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import test from 'node:test';
import { getTranscriptionChunkOptions, judgeTranscript, similarityScore } from '../whisper-core.mjs';

const TEST_PORT = 8798;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

async function startWhisperService() {
  const child = spawn(process.execPath, ['server/whisper-service.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      WHISPER_SERVICE_PORT: String(TEST_PORT),
      LOCAL_WHISPER_MODEL: 'Xenova/whisper-tiny',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const timeout = setTimeout(() => {
    child.kill();
  }, 10000);

  await Promise.race([
    once(child.stdout, 'data'),
    once(child, 'exit').then(([code]) => {
      throw new Error(`Whisper service exited early with code ${code}`);
    }),
  ]);

  clearTimeout(timeout);
  return child;
}

test('judgeTranscript passes an exact Thai phrase', () => {
  const verdict = judgeTranscript({
    targetPhrase: 'สวัสดีครับ',
    romanization: 'sawatdee khrap',
    translation: 'Hello',
    transcript: 'สวัสดีครับ',
  });

  assert.equal(verdict.pass, true);
  assert.equal(verdict.score, 100);
});

test('similarityScore rejects unrelated text', () => {
  assert.equal(similarityScore('สวัสดีครับ', 'bathroom please'), 0);
});

test('judgeTranscript accepts learner phonetic spelling and returns phonetic retry tip', () => {
  const verdict = judgeTranscript({
    targetPhrase: 'สวัสดีครับ',
    romanization: 'sawatdee khrap',
    phoneticSpelling: 'sah-waht-dee krahp',
    translation: 'Hello',
    transcript: 'sah waht dee krahp',
  });

  assert.equal(verdict.pass, true);
  assert.equal(verdict.score, 100);

  const retry = judgeTranscript({
    targetPhrase: 'สวัสดีครับ',
    romanization: 'sawatdee khrap',
    phoneticSpelling: 'sah-waht-dee krahp',
    translation: 'Hello',
    transcript: 'bathroom please',
  });
  assert.match(retry.tip, /sah-waht-dee krahp/);
});

test('long Whisper recordings use chunked transcription options', () => {
  assert.deepEqual(getTranscriptionChunkOptions(16000 * 7), {});
  assert.deepEqual(getTranscriptionChunkOptions(16000 * 12), {
    chunk_length_s: 15,
    stride_length_s: 3,
  });
});

test('standalone Whisper service exposes health, transcript judging, and audio validation', async () => {
  const child = await startWhisperService();

  try {
    const health = await fetch(`${BASE_URL}/api/whisper/health`);
    assert.equal(health.status, 200);
    const healthPayload = await health.json();
    assert.equal(healthPayload.ok, true);
    assert.equal(healthPayload.service, 'thai-quest-whisper');
    assert.equal(healthPayload.runtime, 'local-transformers');
    assert.equal(healthPayload.requiresApiKey, false);

    const textJudge = await fetch(`${BASE_URL}/api/whisper/judge-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetPhrase: 'ขอบคุณครับ',
        romanization: 'khop khun khrap',
        translation: 'Thank you',
        transcript: 'ขอบคุณครับ',
      }),
    });
    assert.equal(textJudge.status, 200);
    const verdict = await textJudge.json();
    assert.equal(verdict.pass, true);
    assert.equal(verdict.score, 100);

    const formData = new FormData();
    formData.set('targetPhrase', 'ขอบคุณครับ');
    formData.set('romanization', 'khop khun khrap');
    formData.set('translation', 'Thank you');
    const missingAudio = await fetch(`${BASE_URL}/api/whisper/judge-audio`, {
      method: 'POST',
      body: formData,
    });
    assert.equal(missingAudio.status, 400);
    const missingAudioPayload = await missingAudio.json();
    assert.match(missingAudioPayload.error, /Missing audio recording/);
  } finally {
    child.kill();
  }
});
