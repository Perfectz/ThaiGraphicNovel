// whisper-base is ~2x the download of tiny (~150 MB vs ~75 MB) but
// significantly better at Thai — tiny mistranscribes most prompted
// phrases. Override with LOCAL_WHISPER_MODEL=Xenova/whisper-small for
// even better accuracy at ~5x the compute cost.
export const DEFAULT_WHISPER_MODEL = 'Xenova/whisper-base';
export const DEFAULT_TRANSCRIBE_LANGUAGE = 'thai';
const TRANSCRIBE_SAMPLE_RATE = 16000;
const CHUNKED_TRANSCRIPTION_THRESHOLD_SECONDS = 8;
const CHUNK_LENGTH_SECONDS = 15;
const STRIDE_LENGTH_SECONDS = 3;
// Reject recordings shorter than ~300 ms outright — anything below this is
// almost always a fumbled button press and Whisper will hallucinate a
// generic Thai phrase rather than admit silence.
const MIN_TRANSCRIBE_DURATION_SECONDS = 0.3;
const SILENCE_RMS_THRESHOLD = 0.0025;
const SILENCE_PEAK_THRESHOLD = 0.015;
// Whisper's most common Thai hallucinations on near-silence or stray noise.
// These show up so often on tiny/base that we treat any transcript that
// reduces to one of them (and only one of them) as a non-attempt.
const COMMON_WHISPER_HALLUCINATIONS = new Set([
  'ขอบคุณครับ',
  'ขอบคุณค่ะ',
  'ขอบคุณมากครับ',
  'ขอบคุณมากค่ะ',
  'สวัสดีครับ',
  'สวัสดีค่ะ',
  'ครับ',
  'ค่ะ',
  'thankyouforwatching',
  'thanksforwatching',
  'subtitlesbytheamaraorgcommunity',
]);
const THAI_CHAR_PATTERN = /\p{Script=Thai}/u;
export const TUTORING_LEVELS = {
  easy: {
    passScore: 50,
    description: 'friendly tutor that passes phrases a native speaker would understand',
  },
  medium: {
    passScore: 60,
    description: 'balanced beginner tutor',
  },
  hard: {
    passScore: 70,
    description: 'strict pronunciation tutor',
  },
};

let localTranscriberPromise = null;

export function normalizeText(value) {
  return String(value ?? '')
    .toLocaleLowerCase('th-TH')
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, '')
    .trim();
}

export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array.from({ length: b.length + 1 }, () => 0);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j];
  }

  return previous[b.length];
}

export function similarityScore(expected, actual) {
  const normalizedExpected = normalizeText(expected);
  const normalizedActual = normalizeText(actual);
  if (!normalizedExpected || !normalizedActual) return 0;
  if (normalizedActual.includes(normalizedExpected)) return 100;

  const distance = levenshtein(normalizedExpected, normalizedActual);
  const length = Math.max(normalizedExpected.length, normalizedActual.length);
  return Math.max(0, Math.round((1 - distance / length) * 100));
}

export function judgeTranscript({ targetPhrase, romanization, phoneticSpelling = romanization, translation, transcript, tutoringLevel = 'medium' }) {
  const resolvedTutoringLevel = getTutoringLevel(tutoringLevel);
  const passScore = TUTORING_LEVELS[resolvedTutoringLevel].passScore;
  const thaiScore = similarityScore(targetPhrase, transcript);
  const romanizationScore = similarityScore(romanization, transcript);
  const phoneticScore = similarityScore(phoneticSpelling, transcript);
  const score = Math.max(thaiScore, romanizationScore, phoneticScore);
  const pass = score >= passScore;

  return {
    score,
    pass,
    heard: String(transcript ?? ''),
    feedback: pass
      ? `Su heard the ${translation} phrase clearly enough.`
      : `Su heard "${transcript || 'nothing clear'}" instead of the target phrase.`,
    tip: pass ? 'Su says to keep the rhythm steady.' : `Su says to try again slowly: ${phoneticSpelling}.`,
  };
}

export function readWhisperMetadata(source) {
  return {
    targetPhrase: String(source.get?.('targetPhrase') ?? source.targetPhrase ?? ''),
    romanization: String(source.get?.('romanization') ?? source.romanization ?? ''),
    phoneticSpelling: String(source.get?.('phoneticSpelling') ?? source.phoneticSpelling ?? source.get?.('romanization') ?? source.romanization ?? ''),
    translation: String(source.get?.('translation') ?? source.translation ?? ''),
    tutoringLevel: getTutoringLevel(source.get?.('tutoringLevel') ?? source.tutoringLevel),
  };
}

export function getTutoringLevel(value) {
  return value === 'easy' || value === 'hard' ? value : 'medium';
}

export async function getLocalTranscriber({ onProgress } = {}) {
  if (!localTranscriberPromise) {
    localTranscriberPromise = (async () => {
      const { env, pipeline } = await import('@huggingface/transformers');
      env.allowRemoteModels = true;
      env.allowLocalModels = true;

      return pipeline('automatic-speech-recognition', process.env.LOCAL_WHISPER_MODEL || DEFAULT_WHISPER_MODEL, {
        dtype: process.env.LOCAL_WHISPER_DTYPE || 'q8',
        progress_callback: (progress) => {
          if (onProgress && progress?.status === 'progress' && typeof progress.progress === 'number') {
            onProgress(progress);
          }
        },
      });
    })();
  }

  return localTranscriberPromise;
}

export async function readFloat32Audio(audio) {
  const bytes = Buffer.from(await audio.arrayBuffer());
  if (bytes.byteLength % Float32Array.BYTES_PER_ELEMENT !== 0) {
    throw new Error('Local Whisper expected 16 kHz mono Float32 PCM audio from the browser.');
  }

  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return new Float32Array(arrayBuffer);
}

export function analyzeFloat32Audio(samples, sampleRate = TRANSCRIBE_SAMPLE_RATE) {
  if (!samples.length) {
    return {
      durationSeconds: 0,
      rms: 0,
      peak: 0,
      isSilent: true,
    };
  }

  let sumSquares = 0;
  let peak = 0;
  for (const sample of samples) {
    const value = Number.isFinite(sample) ? sample : 0;
    sumSquares += value * value;
    peak = Math.max(peak, Math.abs(value));
  }

  const rms = Math.sqrt(sumSquares / samples.length);
  const durationSeconds = samples.length / sampleRate;
  return {
    durationSeconds,
    rms,
    peak,
    isSilent:
      durationSeconds < MIN_TRANSCRIBE_DURATION_SECONDS ||
      (rms < SILENCE_RMS_THRESHOLD && peak < SILENCE_PEAK_THRESHOLD),
  };
}

export function isLikelyWhisperHallucination(transcript, { targetPhrase = '' } = {}) {
  const text = String(transcript ?? '').trim();
  if (!text) return false;

  // Catch the stock phrases Whisper falls back to when it hears noise — but
  // only when the target wasn't that exact phrase, so we don't punish a
  // legitimate "ขอบคุณครับ" prompt.
  const compactTranscript = normalizeText(text);
  const compactTarget = normalizeText(targetPhrase);
  if (
    COMMON_WHISPER_HALLUCINATIONS.has(compactTranscript) &&
    compactTranscript !== compactTarget
  ) {
    return true;
  }

  const words = text.split(/\s+/u).filter(Boolean);
  if (words.length >= 8) {
    const counts = new Map();
    for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
    const topCount = Math.max(...counts.values());
    if (counts.size <= 3 && topCount / words.length >= 0.7) return true;
  }

  if (compactTranscript.length < 24) return false;

  for (let unitLength = 1; unitLength <= 4; unitLength += 1) {
    const unit = compactTranscript.slice(0, unitLength);
    if (!unit.trim()) continue;
    const repeated = unit.repeat(Math.ceil(compactTranscript.length / unitLength)).slice(0, compactTranscript.length);
    if (repeated === compactTranscript && compactTranscript.length / unitLength >= 8) return true;
  }

  return false;
}

export function getTranscriptionChunkOptions(sampleCount, sampleRate = TRANSCRIBE_SAMPLE_RATE) {
  const durationSeconds = sampleCount / sampleRate;
  return durationSeconds > CHUNKED_TRANSCRIPTION_THRESHOLD_SECONDS
    ? {
        chunk_length_s: CHUNK_LENGTH_SECONDS,
        stride_length_s: STRIDE_LENGTH_SECONDS,
      }
    : {};
}

export async function transcribeAudio({ audio, language, targetPhrase = '' }) {
  const transcriber = await getLocalTranscriber();
  const samples = await readFloat32Audio(audio);
  const audioStats = analyzeFloat32Audio(samples);
  if (audioStats.isSilent) {
    const error = new Error('No clear microphone audio was captured. Hold the button while speaking, then release after the phrase.');
    error.status = 422;
    error.detail = audioStats;
    throw error;
  }

  const output = await transcriber(samples, {
    language: language || process.env.LOCAL_WHISPER_LANGUAGE || DEFAULT_TRANSCRIBE_LANGUAGE,
    task: 'transcribe',
    // Deterministic greedy decoding — sampling at higher temperature is
    // what causes Whisper to invent words from rough audio.
    do_sample: false,
    temperature: 0,
    num_beams: 1,
    // Suppress Whisper's tendency to repeat the same syllable as a phrase
    // when input is noisy.
    no_repeat_ngram_size: 3,
    // Timestamps add no value for one-shot pronunciation judging and only
    // make the decoder more failure-prone.
    return_timestamps: false,
    ...getTranscriptionChunkOptions(samples.length),
  });

  const transcript = String(output.text ?? '').trim();

  // If the target is Thai script but Whisper returned no Thai at all, it
  // almost always means the model latched onto background noise and
  // hallucinated English/Latin tokens. Treat as a non-attempt rather than
  // judging it as a complete miss (which scores 0 and frustrates users).
  if (targetPhrase && THAI_CHAR_PATTERN.test(targetPhrase) && !THAI_CHAR_PATTERN.test(transcript)) {
    const error = new Error('Whisper could not hear a clear Thai phrase. Try again, closer to the mic, in a quieter spot.');
    error.status = 422;
    error.detail = { transcript, audioStats };
    throw error;
  }

  if (isLikelyWhisperHallucination(transcript, { targetPhrase })) {
    const error = new Error('Whisper heard background noise rather than your phrase. Try again closer to the mic.');
    error.status = 422;
    error.detail = { transcript, audioStats };
    throw error;
  }

  return transcript;
}
