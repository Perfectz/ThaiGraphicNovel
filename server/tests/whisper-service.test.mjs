import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import test from 'node:test';
import {
  analyzeFloat32Audio,
  getTranscriptionChunkOptions,
  isLikelyWhisperHallucination,
  judgeTranscript,
  similarityScore,
} from '../whisper-core.mjs';

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

test('judgeTranscript passes beginner near-misses at the softer threshold', () => {
  const verdict = judgeTranscript({
    targetPhrase: 'สวัสดีครับ',
    romanization: 'sawatdee khrap',
    translation: 'Hello',
    transcript: 'sawatdee',
  });

  assert.equal(verdict.pass, true);
  assert.equal(verdict.score, 62);
});

test('judgeTranscript applies easy, medium, and hard tutoring levels', () => {
  const baseAttempt = {
    targetPhrase: 'สวัสดีครับ',
    romanization: 'sawatdee khrap',
    translation: 'Hello',
    transcript: 'sawatdee',
  };

  assert.equal(judgeTranscript({ ...baseAttempt, tutoringLevel: 'easy' }).pass, true);
  assert.equal(judgeTranscript({ ...baseAttempt, tutoringLevel: 'medium' }).pass, true);
  assert.equal(judgeTranscript({ ...baseAttempt, tutoringLevel: 'hard' }).pass, false);
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
  assert.match(verdict.feedback, /^Su heard/);
  assert.match(verdict.tip, /^Su says/);

  const retry = judgeTranscript({
    targetPhrase: 'สวัสดีครับ',
    romanization: 'sawatdee khrap',
    phoneticSpelling: 'sah-waht-dee krahp',
    translation: 'Hello',
    transcript: 'bathroom please',
  });
  assert.match(retry.feedback, /^Su heard/);
  assert.match(retry.tip, /^Su says/);
  assert.match(retry.tip, /sah-waht-dee krahp/);
});

test('long Whisper recordings use chunked transcription options', () => {
  assert.deepEqual(getTranscriptionChunkOptions(16000 * 7), {});
  assert.deepEqual(getTranscriptionChunkOptions(16000 * 12), {
    chunk_length_s: 15,
    stride_length_s: 3,
  });
});

test('audio analysis rejects silence before Whisper can hallucinate a transcript', () => {
  const silence = new Float32Array(16000);
  const quietNoise = Float32Array.from({ length: 16000 }, (_, index) => (index % 2 === 0 ? 0.0004 : -0.0004));
  const speechLikeSignal = Float32Array.from({ length: 16000 }, (_, index) => Math.sin(index / 8) * 0.04);

  assert.equal(analyzeFloat32Audio(silence).isSilent, true);
  assert.equal(analyzeFloat32Audio(quietNoise).isSilent, true);
  assert.equal(analyzeFloat32Audio(speechLikeSignal).isSilent, false);
});

test('repeated-noise transcripts are treated as Whisper hallucinations', () => {
  assert.equal(isLikelyWhisperHallucination('อีก อีก อีก อีก อีก อีก อีก อีก อีก อีก อีก อีก'), true);
  assert.equal(isLikelyWhisperHallucination('เจอเจอเจอเจอเจอเจอเจอเจอเจอเจอเจอเจอ'), true);
  assert.equal(isLikelyWhisperHallucination('เอาอันนี้ครับ'), false);
  assert.equal(isLikelyWhisperHallucination('sawatdee khrap'), false);
});

test('stock Whisper filler transcripts are rejected unless the target asked for them', () => {
  // Whisper falls back to these on silence/noise. Reject when we asked for
  // a different phrase, but accept when the prompt really was "ขอบคุณครับ".
  assert.equal(
    isLikelyWhisperHallucination('ขอบคุณครับ', { targetPhrase: 'สวัสดีตอนเช้าครับ' }),
    true,
  );
  assert.equal(
    isLikelyWhisperHallucination('ขอบคุณครับ', { targetPhrase: 'ขอบคุณครับ' }),
    false,
  );
  assert.equal(
    isLikelyWhisperHallucination('Thank you for watching.', { targetPhrase: 'สวัสดีครับ' }),
    true,
  );
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

    const silenceBytes = Buffer.alloc(16000 * Float32Array.BYTES_PER_ELEMENT);
    const silenceFormData = new FormData();
    silenceFormData.set('audio', new Blob([silenceBytes]), 'silence.f32');
    silenceFormData.set('audioFormat', 'f32le');
    silenceFormData.set('sampleRate', '16000');
    silenceFormData.set('targetPhrase', 'à¸‚à¸­à¸šà¸„à¸¸à¸“à¸„à¸£à¸±à¸š');
    silenceFormData.set('romanization', 'khop khun khrap');
    silenceFormData.set('translation', 'Thank you');
    const silenceAudio = await fetch(`${BASE_URL}/api/whisper/judge-audio`, {
      method: 'POST',
      body: silenceFormData,
    });
    assert.equal(silenceAudio.status, 422);
    const silenceAudioPayload = await silenceAudio.json();
    assert.match(silenceAudioPayload.error, /No clear microphone audio/);
  } finally {
    child.kill();
  }
});
