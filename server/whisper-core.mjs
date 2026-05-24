export const DEFAULT_WHISPER_MODEL = 'Xenova/whisper-tiny';
export const DEFAULT_TRANSCRIBE_LANGUAGE = 'thai';
const TRANSCRIBE_SAMPLE_RATE = 16000;
const CHUNKED_TRANSCRIPTION_THRESHOLD_SECONDS = 8;
const CHUNK_LENGTH_SECONDS = 15;
const STRIDE_LENGTH_SECONDS = 3;
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

export function getTranscriptionChunkOptions(sampleCount, sampleRate = TRANSCRIBE_SAMPLE_RATE) {
  const durationSeconds = sampleCount / sampleRate;
  return durationSeconds > CHUNKED_TRANSCRIPTION_THRESHOLD_SECONDS
    ? {
        chunk_length_s: CHUNK_LENGTH_SECONDS,
        stride_length_s: STRIDE_LENGTH_SECONDS,
      }
    : {};
}

export async function transcribeAudio({ audio, language }) {
  const transcriber = await getLocalTranscriber();
  const samples = await readFloat32Audio(audio);
  const output = await transcriber(samples, {
    language: language || process.env.LOCAL_WHISPER_LANGUAGE || DEFAULT_TRANSCRIBE_LANGUAGE,
    task: 'transcribe',
    ...getTranscriptionChunkOptions(samples.length),
  });

  return String(output.text ?? '');
}
