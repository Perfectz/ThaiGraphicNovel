import {
  type PronunciationPrompt,
  type PronunciationSession,
  type PronunciationVerdict,
} from './realtimePronunciation';
import { getTutoringLevel } from './openAiSettings';

type SessionOptions = {
  prompt: PronunciationPrompt;
  onStatus: (status: string) => void;
  onVerdict: (verdict: PronunciationVerdict) => void;
  onError: (message: string) => void;
};

const RECORDING_TIMESLICE_MS = 1000;
// Reject recordings shorter than this on the client so we never hand
// Whisper a fumbled tap — the server also enforces a 300 ms floor.
const MIN_CLIENT_RECORDING_MS = 350;
// Target peak amplitude after normalization. 0.95 leaves a touch of
// headroom so any post-resample ringing doesn't clip.
const TARGET_PEAK_AMPLITUDE = 0.95;
// Anything below this RMS in a 50 ms window is treated as trailing silence
// and trimmed before we ship audio to Whisper.
const TRIM_SILENCE_THRESHOLD = 0.008;

function whisperEndpoint(path: 'health' | 'judge-audio') {
  const baseUrl = import.meta.env.VITE_OPENAI_WHISPER_SERVICE_URL ?? '/api/whisper';
  return new URL(`${baseUrl.replace(/\/$/, '')}/${path}`, window.location.origin).toString();
}

let cachedMimeType: string | null = null;
function audioMimeType() {
  if (cachedMimeType !== null) return cachedMimeType;
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus'))
    return (cachedMimeType = 'audio/webm;codecs=opus');
  if (MediaRecorder.isTypeSupported('audio/webm')) return (cachedMimeType = 'audio/webm');
  if (MediaRecorder.isTypeSupported('audio/mp4')) return (cachedMimeType = 'audio/mp4');
  return (cachedMimeType = '');
}

// Post-process the resampled mono Float32 buffer before sending to
// Whisper: peak-normalize quiet attempts up to a reasonable level and
// trim trailing silence so Whisper doesn't fill it with hallucinated
// "thanks for watching"-style filler. Leading silence is left alone —
// it's short and harmless, and trimming it can clip the first consonant.
function postProcessSamples(samples: Float32Array, sampleRate: number) {
  if (samples.length === 0) return samples;

  let peak = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const value = Math.abs(samples[i]);
    if (value > peak) peak = value;
  }

  // Only boost when there's a real signal but the mic was quiet. Avoid
  // amplifying obvious near-silence (would just raise noise) and avoid
  // touching loud takes (Whisper handles 0.5–1.0 amplitudes fine).
  if (peak > 0.02 && peak < TARGET_PEAK_AMPLITUDE) {
    const gain = TARGET_PEAK_AMPLITUDE / peak;
    for (let i = 0; i < samples.length; i += 1) {
      samples[i] *= gain;
    }
  }

  // Walk backwards in 50 ms windows looking for the last window whose
  // RMS clears the silence threshold; trim everything after, plus a
  // 80 ms tail so we don't clip a final unvoiced consonant.
  const windowSize = Math.max(1, Math.floor(sampleRate * 0.05));
  const tailPadding = Math.floor(sampleRate * 0.08);
  let trimEnd = samples.length;

  for (let start = samples.length - windowSize; start >= 0; start -= windowSize) {
    let sumSquares = 0;
    for (let i = start; i < start + windowSize; i += 1) {
      sumSquares += samples[i] * samples[i];
    }
    const rms = Math.sqrt(sumSquares / windowSize);
    if (rms >= TRIM_SILENCE_THRESHOLD) {
      trimEnd = Math.min(samples.length, start + windowSize + tailPadding);
      break;
    }
  }

  // Refuse to trim more than 60% of the clip — defensive against a
  // mostly-quiet signal where the threshold misclassifies real audio.
  if (trimEnd < samples.length * 0.4) {
    return samples;
  }

  return trimEnd === samples.length ? samples : samples.subarray(0, trimEnd);
}

async function assertWhisperServiceReady() {
  const healthUrl = whisperEndpoint('health');
  let response: Response;

  try {
    response = await fetch(healthUrl);
  } catch {
    throw new Error(
      `Local Whisper service is not reachable at ${healthUrl}. Start it with \`npm run whisper:service\`, or switch Voice Judge Mode to Realtime in Game Settings.`,
    );
  }

  if (!response.ok) {
    throw new Error(
      `Local Whisper service health check failed with HTTP ${response.status} at ${healthUrl}. Start \`npm run whisper:service\`, or switch Voice Judge Mode to Realtime in Game Settings.`,
    );
  }

  const health = (await response.json()) as { ok?: boolean; requiresApiKey?: boolean };
  if (!health.ok) {
    throw new Error('Whisper service is running but did not report ready.');
  }
  if (health.requiresApiKey) {
    throw new Error('Whisper service is not in local-free mode.');
  }
}

async function decodeTo16kMono(audioBlob: Blob) {
  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioContext = new AudioContext();
  try {
    const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    const duration = decoded.duration;
    const targetSampleRate = 16000;
    const offlineContext = new OfflineAudioContext(
      1,
      Math.max(1, Math.ceil(duration * targetSampleRate)),
      targetSampleRate,
    );
    const source = offlineContext.createBufferSource();
    source.buffer = decoded;

    // 80 Hz high-pass clears DC offset, AC hum, mic-stand thump, and
    // most room rumble. Whisper interprets low-frequency noise as
    // voiced energy, which is a major source of mistranscription.
    const highpass = offlineContext.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 80;
    highpass.Q.value = 0.707;

    source.connect(highpass);
    highpass.connect(offlineContext.destination);
    source.start(0);

    const rendered = await offlineContext.startRendering();
    return postProcessSamples(rendered.getChannelData(0).slice(), targetSampleRate);
  } finally {
    // Close swallowed — some browsers throw on a context that already
    // closed itself after rendering, and we don't want decode failures
    // masked by an unhandled close error.
    audioContext.close().catch(() => undefined);
  }
}

function float32AudioBlob(audio: Float32Array) {
  const copy = new Uint8Array(audio.byteLength);
  copy.set(new Uint8Array(audio.buffer, audio.byteOffset, audio.byteLength));
  return new Blob([copy.buffer], { type: 'application/octet-stream' });
}

async function judgeWithWhisperService(
  audioBlob: Blob,
  prompt: PronunciationPrompt,
): Promise<PronunciationVerdict> {
  const audio = await decodeTo16kMono(audioBlob);
  const formData = new FormData();
  formData.set('audio', float32AudioBlob(audio), 'thai-attempt.f32');
  formData.set('audioFormat', 'f32le');
  formData.set('sampleRate', '16000');
  formData.set('targetPhrase', prompt.targetPhrase);
  formData.set('romanization', prompt.romanization);
  formData.set('tutoringLevel', getTutoringLevel());
  if (prompt.phoneticSpelling) {
    formData.set('phoneticSpelling', prompt.phoneticSpelling);
  }
  formData.set('translation', prompt.translation);

  const response = await fetch(whisperEndpoint('judge-audio'), {
    method: 'POST',
    body: formData,
  });

  const payload = await response.json().catch(async () => ({ error: await response.text() }));
  if (!response.ok) {
    const message =
      typeof payload.error === 'string' ? payload.error : `HTTP ${response.status} from Whisper service.`;
    const detail = payload.detail ? ` ${JSON.stringify(payload.detail)}` : '';
    throw new Error(`${message}${detail}`);
  }

  return payload as PronunciationVerdict;
}

export async function createWhisperPronunciationSession({
  prompt,
  onStatus,
  onVerdict,
  onError,
}: SessionOptions): Promise<PronunciationSession> {
  if (!('MediaRecorder' in window)) {
    throw new Error('Whisper mode needs MediaRecorder support in this browser.');
  }

  onStatus('Checking Whisper service...');
  await assertWhisperServiceReady();

  onStatus('Requesting microphone access...');
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  let activePrompt = prompt;
  let recorder: MediaRecorder | null = null;
  let chunks: BlobPart[] = [];
  let recordingStartedAt = 0;
  onStatus('Whisper service ready. Hold the Thai button and speak.');

  async function judgeAudio(audioBlob: Blob, durationMs: number) {
    if (audioBlob.size === 0) {
      throw new Error('No microphone audio was captured. Hold the button until you finish the phrase.');
    }
    if (durationMs > 0 && durationMs < MIN_CLIENT_RECORDING_MS) {
      throw new Error('That recording was too short. Hold the button while you say the full phrase.');
    }

    onStatus(`Sending ${Math.max(1, Math.round(durationMs / 1000))} seconds to Whisper service...`);
    const verdict = await judgeWithWhisperService(audioBlob, activePrompt);
    onVerdict(verdict);
  }

  // Trailer-capture injection: fetch a pre-recorded WAV and feed it through
  // the same judgeAudio path mic input uses. Returns the verdict as a side
  // effect via onVerdict — same contract as a real attempt. Used by
  // scripts/record-promo.mjs for the voice-loop hero clips (23/24/25).
  async function injectAudioFile(wavUrl: string) {
    onStatus(`Injecting attempt from ${wavUrl}...`);
    const response = await fetch(wavUrl);
    if (!response.ok) {
      throw new Error(`Could not fetch injected WAV at ${wavUrl}: HTTP ${response.status}`);
    }
    const blob = await response.blob();
    if (blob.size === 0) {
      throw new Error(`Injected WAV at ${wavUrl} is empty.`);
    }
    // judgeAudio expects a duration for the status line; estimate from
    // bytes-per-second of 16-bit PCM at 16 kHz (32_000 B/s). Off by 2× for
    // stereo or 8-bit WAVs but only affects the "X seconds" status string,
    // not the judge itself.
    const estimatedDurationMs = Math.round((blob.size / 32_000) * 1000);
    await judgeAudio(blob, estimatedDurationMs);
  }

  return {
    updatePrompt: (nextPrompt) => {
      activePrompt = nextPrompt;
    },
    injectAudioFile,
    startRecording: () => {
      if (recorder?.state === 'recording') return;
      chunks = [];
      recordingStartedAt = performance.now();
      const preferredMimeType = audioMimeType();
      recorder = new MediaRecorder(stream, preferredMimeType ? { mimeType: preferredMimeType } : undefined);
      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      });
      recorder.addEventListener(
        'stop',
        () => {
          const durationMs = recordingStartedAt ? performance.now() - recordingStartedAt : 0;
          const audioBlob = new Blob(chunks, { type: recorder?.mimeType || 'audio/webm' });
          judgeAudio(audioBlob, durationMs).catch((error) => {
            onError(error instanceof Error ? error.message : String(error));
          });
        },
        { once: true },
      );
      recorder.start(RECORDING_TIMESLICE_MS);
      onStatus('Listening...');
    },
    stopRecording: () => {
      if (!recorder || recorder.state !== 'recording') return;
      onStatus('Preparing Whisper transcription...');
      recorder.stop();
    },
    disconnect: () => {
      if (recorder?.state === 'recording') recorder.stop();
      stream.getTracks().forEach((track) => track.stop());
    },
  };
}
