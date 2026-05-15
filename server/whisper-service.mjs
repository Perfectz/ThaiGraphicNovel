import { createServer } from 'node:http';
import { loadLocalEnv } from './env.mjs';
import { createCorsHeaders, readFormData, readJson, sendJson } from './http-utils.mjs';
import { DEFAULT_TRANSCRIBE_LANGUAGE, DEFAULT_WHISPER_MODEL, getLocalTranscriber, judgeTranscript, readWhisperMetadata, transcribeAudio } from './whisper-core.mjs';

loadLocalEnv();

const port = Number(process.env.WHISPER_SERVICE_PORT || 8788);
const allowedOrigin = process.env.WHISPER_ALLOWED_ORIGIN ?? process.env.REALTIME_ALLOWED_ORIGIN ?? '*';
const corsHeaders = createCorsHeaders(allowedOrigin);

function healthPayload() {
  return {
    ok: true,
    service: 'thai-quest-whisper',
    runtime: 'local-transformers',
    model: process.env.LOCAL_WHISPER_MODEL || DEFAULT_WHISPER_MODEL,
    language: process.env.LOCAL_WHISPER_LANGUAGE || DEFAULT_TRANSCRIBE_LANGUAGE,
    requiresApiKey: false,
    endpoints: {
      health: '/api/whisper/health',
      warmup: '/api/whisper/warmup',
      judgeText: '/api/whisper/judge-text',
      judgeAudio: '/api/whisper/judge-audio',
    },
  };
}

async function handleJudgeText(req, res) {
  const body = await readJson(req);
  const verdict = judgeTranscript({
    targetPhrase: String(body.targetPhrase ?? ''),
    romanization: String(body.romanization ?? ''),
    phoneticSpelling: String(body.phoneticSpelling ?? body.romanization ?? ''),
    translation: String(body.translation ?? ''),
    transcript: String(body.transcript ?? ''),
    tutoringLevel: String(body.tutoringLevel ?? ''),
  });
  sendJson(res, 200, verdict, corsHeaders);
}

async function handleJudgeAudio(req, res) {
  const incomingForm = await readFormData(req);
  const audio = incomingForm.get('audio');
  if (!(audio instanceof Blob)) {
    sendJson(res, 400, { error: 'Missing audio recording for Whisper judgement.' }, corsHeaders);
    return;
  }
  if (String(incomingForm.get('audioFormat') ?? '') !== 'f32le' || String(incomingForm.get('sampleRate') ?? '') !== '16000') {
    sendJson(res, 400, {
      error: 'Local Whisper expects browser-decoded 16 kHz mono Float32 PCM audio.',
    }, corsHeaders);
    return;
  }

  const metadata = readWhisperMetadata(incomingForm);
  if (!metadata.targetPhrase || !metadata.romanization || !metadata.translation) {
    sendJson(res, 400, { error: 'Missing targetPhrase, romanization, or translation metadata.' }, corsHeaders);
    return;
  }

  try {
    const transcript = await transcribeAudio({
      audio,
    });
    sendJson(res, 200, judgeTranscript({ ...metadata, transcript }), corsHeaders);
  } catch (error) {
    sendJson(res, error.status || 500, {
      error: error instanceof Error ? error.message : 'Local Whisper transcription failed.',
      detail: error.detail ?? String(error),
    }, corsHeaders);
  }
}

createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  if (req.url?.startsWith('/api/whisper/health') && req.method === 'GET') {
    sendJson(res, 200, healthPayload(), corsHeaders);
    return;
  }

  if (req.url?.startsWith('/api/whisper/warmup') && req.method === 'POST') {
    try {
      await getLocalTranscriber();
      sendJson(res, 200, { ok: true, ready: true, model: process.env.LOCAL_WHISPER_MODEL || DEFAULT_WHISPER_MODEL }, corsHeaders);
    } catch (error) {
      sendJson(res, 500, {
        error: 'Failed to warm up local Whisper model.',
        detail: error instanceof Error ? error.message : String(error),
      }, corsHeaders);
    }
    return;
  }

  if (req.url?.startsWith('/api/whisper/judge-text') && req.method === 'POST') {
    try {
      await handleJudgeText(req, res);
    } catch (error) {
      sendJson(res, 500, {
        error: 'Failed to judge Whisper transcript.',
        detail: error instanceof Error ? error.message : String(error),
      }, corsHeaders);
    }
    return;
  }

  if (req.url?.startsWith('/api/whisper/judge-audio') && req.method === 'POST') {
    await handleJudgeAudio(req, res);
    return;
  }

  sendJson(res, 404, { error: 'Not found' }, corsHeaders);
}).listen(port, () => {
  console.log(`Whisper service listening on http://localhost:${port}`);
});
