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

function whisperEndpoint(path: 'health' | 'judge-audio') {
  const baseUrl = import.meta.env.VITE_OPENAI_WHISPER_SERVICE_URL ?? '/api/whisper';
  return new URL(`${baseUrl.replace(/\/$/, '')}/${path}`, window.location.origin).toString();
}

function audioMimeType() {
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
  if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4';
  return '';
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
  const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
  const duration = decoded.duration;
  const targetSampleRate = 16000;
  const offlineContext = new OfflineAudioContext(1, Math.ceil(duration * targetSampleRate), targetSampleRate);
  const source = offlineContext.createBufferSource();
  source.buffer = decoded;
  source.connect(offlineContext.destination);
  source.start(0);
  const rendered = await offlineContext.startRendering();
  await audioContext.close();
  return rendered.getChannelData(0).slice();
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

    onStatus(`Sending ${Math.max(1, Math.round(durationMs / 1000))} seconds to Whisper service...`);
    const verdict = await judgeWithWhisperService(audioBlob, activePrompt);
    onVerdict(verdict);
  }

  return {
    updatePrompt: (nextPrompt) => {
      activePrompt = nextPrompt;
    },
    startRecording: () => {
      if (recorder?.state === 'recording') return;
      chunks = [];
      recordingStartedAt = performance.now();
      recorder = new MediaRecorder(stream, audioMimeType() ? { mimeType: audioMimeType() } : undefined);
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
