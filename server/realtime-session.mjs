import { createServer } from 'node:http';
import {
  DEFAULT_REALTIME_MODEL,
  getRequestApiKey,
  hasServerEnvApiKey,
  hasUsableApiKey,
  loadLocalEnv,
} from './env.mjs';
import { createCorsHeaders, readFormData, readText, sendJson } from './http-utils.mjs';
import battleVoiceHandler from './battle-voice.mjs';

loadLocalEnv();

const port = Number(process.env.REALTIME_SESSION_PORT || process.env.REALTIME_TOKEN_PORT || 8787);
const model = process.env.OPENAI_REALTIME_MODEL ?? DEFAULT_REALTIME_MODEL;
const allowedOrigin = process.env.REALTIME_ALLOWED_ORIGIN ?? '*';
const corsHeaders = createCorsHeaders(allowedOrigin);
const tutoringLevelSettings = {
  easy: {
    passScore: 50,
    judgeTone: 'You are a friendly Thai pronunciation judge inside an RPG language-learning game for beginner learners.',
    passRule: 'Mark pass true if a native Thai speaker would understand the intended phrase, even with accent, tone, or rhythm mistakes.',
    feedbackRule: 'feedback must name what was understandable if the learner passed, or the one biggest clarity issue if they failed.',
  },
  medium: {
    passScore: 60,
    judgeTone: 'You are a patient Thai pronunciation judge inside an RPG language-learning game for beginner learners.',
    passRule: 'Mark pass true when the learner is understandable enough for a beginner, even if pronunciation is not perfect.',
    feedbackRule: 'feedback must explain what was understandable if the learner passed, or the one main issue if they failed.',
  },
  hard: {
    passScore: 70,
    judgeTone: 'You are a strict but encouraging Thai pronunciation judge inside an RPG language-learning game.',
    passRule: 'Mark pass true only when the words match the target and pronunciation, tone, and rhythm are solid.',
    feedbackRule: 'feedback must explain exactly what sounded wrong, or what was correct if the learner passed.',
  },
};

function getTutoringLevel(value) {
  return value === 'easy' || value === 'hard' ? value : 'medium';
}

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
    // requiresApiKey is true only when neither the server's env nor the
    // request supplied a usable key — i.e. when the user must enter one in
    // Settings before Realtime mode will work.
    requiresApiKey: !hasUsableApiKey(req),
    // serverEnvKeyAvailable lets the browser distinguish "you need to type a
    // key" from "a local .env key is already in use as the default". The UI
    // surfaces this so devs running with .env.local don't get nagged to
    // paste a key they have already provided to the server.
    serverEnvKeyAvailable: hasServerEnvApiKey(),
    endpoints: {
      health: '/api/realtime/health',
      session: '/api/realtime/session',
    },
  };
}

function pronunciationInstructions(targetPhrase, romanization, phoneticSpelling, translation, tutoringLevel) {
  const settings = tutoringLevelSettings[tutoringLevel];
  return [
    settings.judgeTone,
    'The coach character is Su.',
    'Listen to the user audio and judge whether they said the target Thai phrase.',
    `Target phrase: ${targetPhrase}`,
    `Romanization hint: ${romanization}`,
    `Phonetic spelling for learner: ${phoneticSpelling}`,
    `Meaning: ${translation}`,
    settings.passRule,
    settings.feedbackRule,
    'tip must include the correct pronunciation and a slow syllable-by-syllable repeat.',
    'Return only compact JSON with this exact shape:',
    '{"score":0,"pass":false,"heard":"","feedback":"","tip":""}',
    `score is 0-100. pass is true when score is ${settings.passScore} or higher. feedback and tip must be one short sentence each.`,
  ].join('\n');
}

function createSessionConfig(req) {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const targetPhrase = url.searchParams.get('targetPhrase') ?? 'สวัสดีครับ';
  const romanization = url.searchParams.get('romanization') ?? 'sawatdee khrap';
  const phoneticSpelling = url.searchParams.get('phoneticSpelling') ?? romanization;
  const translation = url.searchParams.get('translation') ?? 'hello';
  const tutoringLevel = getTutoringLevel(url.searchParams.get('tutoringLevel'));

  return {
    type: 'realtime',
    model,
    instructions: pronunciationInstructions(targetPhrase, romanization, phoneticSpelling, translation, tutoringLevel),
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

function judgeWhisperTranscript({ targetPhrase, romanization, phoneticSpelling, translation, transcript, tutoringLevel = 'medium' }) {
  const settings = tutoringLevelSettings[getTutoringLevel(tutoringLevel)];
  const thaiScore = similarityScore(targetPhrase, transcript);
  const romanizationScore = similarityScore(romanization, transcript);
  const phoneticScore = similarityScore(phoneticSpelling, transcript);
  const score = Math.max(thaiScore, romanizationScore, phoneticScore);
  const pass = score >= settings.passScore;

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
  const tutoringLevel = getTutoringLevel(incomingForm.get('tutoringLevel'));

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
  sendJson(res, 200, judgeWhisperTranscript({ targetPhrase, romanization, phoneticSpelling, translation, transcript, tutoringLevel }), corsHeaders);
}

createServer(async (req, res) => {
  if (req.url?.split('?')[0] === '/api/realtime/battle') return battleVoiceHandler(req, res);
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
