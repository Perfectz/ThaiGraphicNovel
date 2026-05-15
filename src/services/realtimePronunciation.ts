import { getStoredOpenAiApiKey } from './openAiSettings';

export type PronunciationPrompt = {
  targetPhrase: string;
  romanization: string;
  phoneticSpelling?: string;
  translation: string;
};

export type PronunciationVerdict = {
  score: number;
  pass: boolean;
  heard: string;
  feedback: string;
  tip: string;
};

export type PronunciationSession = {
  updatePrompt: (prompt: PronunciationPrompt) => void;
  startRecording: () => void;
  stopRecording: () => void;
  disconnect: () => void;
};

type SessionOptions = {
  prompt: PronunciationPrompt;
  onStatus: (status: string) => void;
  onVerdict: (verdict: PronunciationVerdict) => void;
  onError: (message: string) => void;
};

type RealtimeResponseKind = 'idle' | 'verdict' | 'su-audio';

type RealtimeServerEvent = {
  type?: string;
  delta?: string;
  text?: string;
  transcript?: string;
  error?: {
    code?: string;
    message?: string;
    type?: string;
  };
  response?: {
    status?: string;
    status_details?: {
      error?: {
        code?: string;
        message?: string;
        type?: string;
      };
      reason?: string;
      type?: string;
    };
    output?: Array<{
      content?: Array<{
        text?: string;
        transcript?: string;
      }>;
    }>;
  };
};

function sessionEndpoint(prompt: PronunciationPrompt) {
  const baseUrl = import.meta.env.VITE_OPENAI_REALTIME_SESSION_URL ?? '/api/realtime/session';
  const url = new URL(baseUrl, window.location.origin);
  url.searchParams.set('targetPhrase', prompt.targetPhrase);
  url.searchParams.set('romanization', prompt.romanization);
  if (prompt.phoneticSpelling) {
    url.searchParams.set('phoneticSpelling', prompt.phoneticSpelling);
  }
  url.searchParams.set('translation', prompt.translation);
  return url.toString();
}

function extractResponseText(event: RealtimeServerEvent, bufferedText: string) {
  if (bufferedText.trim()) return bufferedText.trim();

  const content = event.response?.output?.flatMap((output) => output.content ?? []) ?? [];
  return content
    .map((item) => item.text ?? item.transcript ?? '')
    .join('')
    .trim();
}

function parseVerdict(rawText: string): PronunciationVerdict {
  const jsonText = rawText.match(/\{[\s\S]*\}/)?.[0] ?? rawText;
  const parsed = JSON.parse(jsonText) as Partial<PronunciationVerdict>;
  const scoreValue = Number(parsed.score);
  const score = Number.isFinite(scoreValue) ? scoreValue : 0;
  const passed = typeof parsed.pass === 'boolean' ? parsed.pass : score >= 70;

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    pass: passed,
    heard: String(parsed.heard ?? ''),
    feedback: String(parsed.feedback ?? 'No feedback returned.'),
    tip: String(parsed.tip ?? 'Try again with a slower, clearer rhythm.'),
  };
}

function createResponseInstructions(prompt: PronunciationPrompt) {
  return [
    'Judge only the most recent microphone audio.',
    'You are Su, a strict but kind Thai pronunciation coach.',
    `Target Thai phrase: ${prompt.targetPhrase}`,
    `Romanization: ${prompt.romanization}`,
    prompt.phoneticSpelling ? `Phonetic spelling for learner: ${prompt.phoneticSpelling}` : '',
    `Meaning: ${prompt.translation}`,
    'The feedback must explain what the learner said wrong, or say exactly what was correct if they passed.',
    'The tip must include the correct pronunciation and a slow syllable-by-syllable repeat.',
    'Return only JSON: {"score":0,"pass":false,"heard":"","feedback":"","tip":""}',
    'feedback and tip must be one short sentence each.',
  ].filter(Boolean).join('\n');
}

function createSuAudioInstructions(prompt: PronunciationPrompt, verdict: PronunciationVerdict) {
  return [
    'You are Su, a Thai language tutor helping Patrick practice pronunciation in an RPG.',
    'Only give spoken coaching because the learner failed this pronunciation attempt.',
    'Keep the spoken response short: two or three brief sentences total.',
    'Speak in English when explaining what went wrong and what corrective action to take.',
    'When saying the target phrase, say the Thai phrase itself, not the romanization.',
    `Target Thai phrase: ${prompt.targetPhrase}`,
    `Romanization: ${prompt.romanization}`,
    prompt.phoneticSpelling ? `Learner phonetic spelling: ${prompt.phoneticSpelling}` : '',
    `Meaning: ${prompt.translation}`,
    `What you heard: ${verdict.heard || 'unclear audio'}`,
    `Score: ${verdict.score}/100. Passed: ${verdict.pass ? 'yes' : 'no'}.`,
    `Judgement: ${verdict.feedback}`,
    `Correction tip: ${verdict.tip}`,
    'Response structure: explain the exact pronunciation issue in English, give one corrective action in English, then say the target Thai phrase slowly with clear syllable spacing.',
    'Do not say whether it passed, because this response is only for failed attempts.',
    'Do not speak JSON, markdown, labels, scores, or long teaching notes.',
  ].filter(Boolean).join('\n');
}

export async function createPronunciationSession({
  prompt,
  onStatus,
  onVerdict,
  onError,
}: SessionOptions): Promise<PronunciationSession> {
  onStatus('Requesting microphone access...');
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  const audioTrack = stream.getAudioTracks()[0];
  audioTrack.enabled = false;

  onStatus('Creating OpenAI Realtime WebRTC session...');
  const peerConnection = new RTCPeerConnection();
  const remoteAudio = document.createElement('audio');
  remoteAudio.autoplay = true;
  remoteAudio.setAttribute('playsinline', 'true');
  remoteAudio.controls = false;
  remoteAudio.style.display = 'none';
  document.body.appendChild(remoteAudio);
  peerConnection.ontrack = (event) => {
    remoteAudio.srcObject = event.streams[0];
    void remoteAudio.play().catch(() => {
      onError('Browser blocked Su audio playback. Click Connect AI Mic again, then retry the phrase.');
    });
  };
  peerConnection.addTrack(audioTrack, stream);

  const dataChannel = peerConnection.createDataChannel('oai-events');
  let activePrompt = prompt;
  let responseText = '';
  let responseKind: RealtimeResponseKind = 'idle';
  let suAudioTimeout: number | undefined;
  let isRecording = false;

  dataChannel.addEventListener('open', () => {
    onStatus('Voice coach connected. Hold the Thai button and speak.');
  });

  dataChannel.addEventListener('message', (message) => {
    const event = JSON.parse(message.data) as RealtimeServerEvent;

    if (event.type === 'error') {
      if (suAudioTimeout !== undefined) {
        window.clearTimeout(suAudioTimeout);
        suAudioTimeout = undefined;
      }
      responseKind = 'idle';
      const errorMessage = event.error?.message ?? event.error?.code ?? 'Unknown Realtime data-channel error.';
      onError(`Realtime response failed: ${errorMessage}`);
      return;
    }

    if (event.type === 'response.output_text.delta' || event.type === 'response.text.delta') {
      responseText += event.delta ?? event.text ?? '';
      return;
    }

    if (event.type === 'response.output_audio_transcript.delta' || event.type === 'response.audio_transcript.delta') {
      return;
    }

    if (event.type === 'response.done') {
      const completedKind = responseKind;
      responseKind = 'idle';
      const text = extractResponseText(event, responseText);
      responseText = '';
      const responseStatus = event.response?.status;
      if (responseStatus === 'failed' || responseStatus === 'incomplete') {
        if (suAudioTimeout !== undefined) {
          window.clearTimeout(suAudioTimeout);
          suAudioTimeout = undefined;
        }
        const responseError = event.response?.status_details?.error;
        const reason = responseError?.message ?? responseError?.code ?? event.response?.status_details?.reason ?? responseStatus;
        onError(`Realtime ${completedKind === 'su-audio' ? 'audio response' : 'verdict'} failed: ${reason}`);
        return;
      }

      if (completedKind === 'su-audio') {
        if (suAudioTimeout !== undefined) {
          window.clearTimeout(suAudioTimeout);
          suAudioTimeout = undefined;
        }
        onStatus('Su finished coaching. Hold to try again.');
        return;
      }

      if (completedKind === 'verdict') {
        try {
          const verdict = parseVerdict(text);
          onVerdict(verdict);
          if (verdict.pass) {
            onStatus('Good pronunciation. Hold for the next phrase.');
            return;
          }
          speakSuCoaching(verdict);
        } catch {
          onError(`Could not parse pronunciation verdict: ${text || 'empty response'}`);
        }
      }
    }
  });

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  const headers: Record<string, string> = {
    'Content-Type': 'application/sdp',
  };
  const apiKey = getStoredOpenAiApiKey();
  if (apiKey) {
    headers['X-OpenAI-API-Key'] = apiKey;
  }

  const sdpResponse = await fetch(sessionEndpoint(prompt), {
    method: 'POST',
    body: offer.sdp,
    headers,
  });

  if (!sdpResponse.ok) {
    let detail = await sdpResponse.text();
    try {
      const payload = JSON.parse(detail);
      const baseError = String(payload.error ?? detail);
      const detailMessage = typeof payload.detail?.message === 'string' ? payload.detail.message : '';
      detail = detailMessage && !baseError.includes(detailMessage) ? `${baseError} ${detailMessage}` : baseError;
    } catch {
      // The server returns JSON for errors and SDP for success.
    }
    if (!detail.trim() && sdpResponse.status === 502) {
      detail = 'Local Realtime session server is not running. Start it with `npm run realtime:session`, then try Connect AI Mic again.';
    }
    if (!detail.trim()) {
      detail = `HTTP ${sdpResponse.status} from the local Realtime session endpoint.`;
    }
    throw new Error(`Realtime WebRTC connection failed: ${detail}`);
  }

  await peerConnection.setRemoteDescription({
    type: 'answer',
    sdp: await sdpResponse.text(),
  });

  await new Promise<void>((resolve, reject) => {
    if (dataChannel.readyState === 'open') {
      resolve();
      return;
    }

    const timeout = window.setTimeout(() => {
      reject(new Error('Realtime data channel did not open.'));
    }, 10000);

    dataChannel.addEventListener(
      'open',
      () => {
        window.clearTimeout(timeout);
        resolve();
      },
      { once: true },
    );
  });

  function sendEvent(event: unknown) {
    if (dataChannel.readyState !== 'open') return;
    dataChannel.send(JSON.stringify(event));
  }

  function cancelSuAudioTimeout() {
    if (suAudioTimeout === undefined) return;
    window.clearTimeout(suAudioTimeout);
    suAudioTimeout = undefined;
  }

  function speakSuCoaching(verdict: PronunciationVerdict) {
    cancelSuAudioTimeout();
    responseKind = 'su-audio';
    onStatus('Su is giving a short correction...');
    sendEvent({
      type: 'response.create',
      response: {
        output_modalities: ['audio'],
        audio: {
          output: {
            voice: 'marin',
          },
        },
        max_output_tokens: 500,
        instructions: createSuAudioInstructions(activePrompt, verdict),
      },
    });
    suAudioTimeout = window.setTimeout(() => {
      if (responseKind !== 'su-audio') return;
      sendEvent({ type: 'response.cancel' });
      responseKind = 'idle';
      onStatus('Su stopped to keep the coaching under 2 minutes.');
    }, 115000);
  }

  return {
    updatePrompt: (nextPrompt) => {
      activePrompt = nextPrompt;
    },
    startRecording: () => {
      if (isRecording) return;
      responseText = '';
      cancelSuAudioTimeout();
      responseKind = 'idle';
      sendEvent({ type: 'response.cancel' });
      sendEvent({ type: 'input_audio_buffer.clear' });
      audioTrack.enabled = true;
      isRecording = true;
      onStatus('Listening...');
    },
    stopRecording: () => {
      if (!isRecording) return;
      audioTrack.enabled = false;
      isRecording = false;
      onStatus('Judging pronunciation...');
      sendEvent({ type: 'input_audio_buffer.commit' });
      responseKind = 'verdict';
      sendEvent({
        type: 'response.create',
        response: {
          output_modalities: ['text'],
          instructions: createResponseInstructions(activePrompt),
        },
      });
    },
    disconnect: () => {
      cancelSuAudioTimeout();
      audioTrack.enabled = false;
      remoteAudio.pause();
      remoteAudio.srcObject = null;
      remoteAudio.remove();
      stream.getTracks().forEach((track) => track.stop());
      dataChannel.close();
      peerConnection.close();
    },
  };
}
