import { createServer } from 'node:http';
import { DEFAULT_REALTIME_MODEL, getRequestApiKey, hasUsableApiKey, loadLocalEnv } from './env.mjs';
import { createCorsHeaders, readFormData, readText, sendJson } from './http-utils.mjs';

loadLocalEnv();

const port = Number(process.env.REALTIME_SESSION_PORT || process.env.REALTIME_TOKEN_PORT || 8787);
const model = process.env.OPENAI_REALTIME_MODEL ?? DEFAULT_REALTIME_MODEL;
const allowedOrigin = process.env.REALTIME_ALLOWED_ORIGIN ?? '*';
const corsHeaders = createCorsHeaders(allowedOrigin);

function extractOpenAIError(status, rawText) {
  try {
    const payload = JSON.parse(rawText);
    const error = payload.error ?? payload;
    const message = typeof error.message === 'string' ? error.message : rawText;
    const code = typeof error.code === 'string' ? error.code : undefined;
    const type = typeof error.type === 'string' ? error.type : undefined;

    return {
      message,
      status,
      ...(code ? { code } : {}),
      ...(type ? { type } : {}),
    };
  } catch {
    return {
      message: rawText || `OpenAI request failed with HTTP ${status}.`,
      status,
    };
  }
}

function healthPayload(req) {
  return {
    ok: true,
    service: 'thai-quest-realtime',
    model,
    requiresApiKey: !hasUsableApiKey(req),
    endpoints: {
      health: '/api/realtime/health',
      session: '/api/realtime/session',
    },
  };
}

function pronunciationInstructions(targetPhrase, romanization, phoneticSpelling, translation) {
  return [
    'You are a strict but encouraging Thai pronunciation judge inside an RPG language-learning game.',
    'The coach character is Su.',
    'Listen to the user audio and judge whether they said the target Thai phrase.',
    `Target phrase: ${targetPhrase}`,
    `Romanization hint: ${romanization}`,
    `Phonetic spelling for learner: ${phoneticSpelling}`,
    `Meaning: ${translation}`,
    'Prioritize pronunciation, tones, rhythm, and whether the words match the target.',
    'feedback must explain exactly what sounded wrong, or what was correct if the learner passed.',
    'tip must include the correct pronunciation and a slow syllable-by-syllable repeat.',
    'Return only compact JSON with this exact shape:',
    '{"score":0,"pass":false,"heard":"","feedback":"","tip":""}',
    'score is 0-100. pass is true only when score is 70 or higher. feedback and tip must be one short sentence each.',
  ].join('\n');
}

function createSessionConfig(req) {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const targetPhrase = url.searchParams.get('targetPhrase') ?? 'สวัสดีครับ';
  const romanization = url.searchParams.get('romanization') ?? 'sawatdee khrap';
  const phoneticSpelling = url.searchParams.get('phoneticSpelling') ?? romanization;
  const translation = url.searchParams.get('translation') ?? 'hello';

  return {
    type: 'realtime',
    model,
    instructions: pronunciationInstructions(targetPhrase, romanization, phoneticSpelling, translation),
    audio: {
      input: {
        turn_detection: null,
      },
      output: {
        voice: 'marin',
        speed: 0.9,
      },
    },
  };
}

async function createRealtimeCall(req, res) {
  const apiKey = getRequestApiKey(req);

  if (!hasUsableApiKey(req)) {
    sendJson(res, 500, {
      error: 'OpenAI API key is not configured. Add it in AI Settings or set OPENAI_API_KEY in .env.local.',
    }, corsHeaders);
    return;
  }

  const sdp = await readText(req);
  if (!sdp.trim()) {
    sendJson(res, 400, { error: 'Missing WebRTC SDP offer body.' }, corsHeaders);
    return;
  }

  const formData = new FormData();
  formData.set('sdp', sdp);
  formData.set('session', JSON.stringify(createSessionConfig(req)));

  const response = await fetch('https://api.openai.com/v1/realtime/calls', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  const answerSdp = await response.text();
  if (!response.ok) {
    const openAiError = extractOpenAIError(response.status, answerSdp);
    sendJson(res, response.status, {
      error: `OpenAI Realtime call request failed: ${openAiError.message}`,
      detail: openAiError,
    }, corsHeaders);
    return;
  }

  res.writeHead(200, {
    ...corsHeaders,
    'Content-Type': 'application/sdp',
  });
  res.end(answerSdp);
}

function normalizeText(value) {
  return String(value ?? '')
    .toLocaleLowerCase('th-TH')
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, '')
    .trim();
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array.from({ length: b.length + 1 }, () => 0);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + cost,
      );
    }
    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j];
  }

  return previous[b.length];
}

function similarityScore(expected, actual) {
  const normalizedExpected = normalizeText(expected);
  const normalizedActual = normalizeText(actual);
  if (!normalizedExpected || !normalizedActual) return 0;
  if (normalizedActual.includes(normalizedExpected)) return 100;

  const distance = levenshtein(normalizedExpected, normalizedActual);
  const length = Math.max(normalizedExpected.length, normalizedActual.length);
  return Math.max(0, Math.round((1 - distance / length) * 100));
}

function judgeWhisperTranscript({ targetPhrase, romanization, phoneticSpelling, translation, transcript }) {
  const thaiScore = similarityScore(targetPhrase, transcript);
  const romanizationScore = similarityScore(romanization, transcript);
  const phoneticScore = similarityScore(phoneticSpelling, transcript);
  const score = Math.max(thaiScore, romanizationScore, phoneticScore);
  const pass = score >= 70;

  return {
    score,
    pass,
    heard: transcript,
    feedback: pass
      ? `Whisper heard the ${translation} phrase clearly enough.`
      : `Whisper heard "${transcript || 'nothing clear'}" instead of the target phrase.`,
    tip: pass
      ? 'Good. Keep the rhythm steady.'
      : `Try again slowly: ${phoneticSpelling}.`,
  };
}

async function createWhisperJudgement(req, res) {
  const apiKey = getRequestApiKey(req);
  if (!hasUsableApiKey(req)) {
    sendJson(res, 500, {
      error: 'OpenAI API key is not configured. Add it in AI Settings or set OPENAI_API_KEY in .env.local.',
    }, corsHeaders);
    return;
  }

  const incomingForm = await readFormData(req);
  const audio = incomingForm.get('audio');
  if (!(audio instanceof Blob)) {
    sendJson(res, 400, { error: 'Missing audio recording for Whisper judgement.' }, corsHeaders);
    return;
  }

  const targetPhrase = String(incomingForm.get('targetPhrase') ?? 'สวัสดีครับ');
  const romanization = String(incomingForm.get('romanization') ?? 'sawatdee khrap');
  const phoneticSpelling = String(incomingForm.get('phoneticSpelling') ?? romanization);
  const translation = String(incomingForm.get('translation') ?? 'hello');

  const transcriptionForm = new FormData();
  transcriptionForm.set('file', audio, 'thai-attempt.webm');
  transcriptionForm.set('model', process.env.OPENAI_WHISPER_MODEL || 'whisper-1');
  transcriptionForm.set('language', 'th');
  transcriptionForm.set('response_format', 'json');
  transcriptionForm.set('temperature', '0');
  transcriptionForm.set('prompt', `${targetPhrase}\n${romanization}\n${phoneticSpelling}\n${translation}`);

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: transcriptionForm,
  });

  const payload = await response.json().catch(async () => ({ text: await response.text() }));
  if (!response.ok) {
    sendJson(res, response.status, {
      error: 'OpenAI Whisper transcription request failed.',
      detail: payload,
    }, corsHeaders);
    return;
  }

  const transcript = String(payload.text ?? '');
  sendJson(res, 200, judgeWhisperTranscript({ targetPhrase, romanization, phoneticSpelling, translation, transcript }), corsHeaders);
}

createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  if (req.url?.startsWith('/api/realtime/health') && req.method === 'GET') {
    sendJson(res, 200, healthPayload(req), corsHeaders);
    return;
  }

  if (req.url?.startsWith('/api/realtime/session') && req.method === 'POST') {
    try {
      await createRealtimeCall(req, res);
    } catch (error) {
      sendJson(res, 500, {
        error: 'Failed to create OpenAI Realtime WebRTC session.',
        detail: error instanceof Error ? error.message : String(error),
      }, corsHeaders);
    }
    return;
  }

  if (req.url?.startsWith('/api/whisper/judge') && req.method === 'POST') {
    try {
      await createWhisperJudgement(req, res);
    } catch (error) {
      sendJson(res, 500, {
        error: 'Failed to create Whisper pronunciation judgement.',
        detail: error instanceof Error ? error.message : String(error),
      }, corsHeaders);
    }
    return;
  }

  sendJson(res, 404, { error: 'Not found' }, corsHeaders);
}).listen(port, () => {
  console.log(`Realtime session server listening on http://localhost:${port}`);
});
