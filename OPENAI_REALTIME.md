# Voice pronunciation judging

This game supports two voice judging modes:

- Whisper: standalone local service that records in the browser, sends one audio clip to `server/whisper-service.mjs`, transcribes for free with local `Xenova/whisper-tiny` through Transformers.js, and returns a pronunciation verdict. This is the default mode.
- Realtime: low-latency OpenAI Realtime judging with `gpt-realtime-2`; requires the Realtime session server.

## Local setup

Start the Whisper service:

```powershell
npm run whisper:service
```

Start the Realtime service only if you choose Realtime mode:

```powershell
npm run realtime:session
```

Start the game:

```powershell
npm run dev
```

In the game, open AI Settings:

- Choose `Whisper` for free local clip-by-clip transcription and pronunciation scoring.
- Choose `Realtime` for the WebRTC voice coach.
- Paste a rotated OpenAI key or set it in `.env.local` only if you use Realtime.

Optional `.env.local`:

```powershell
LOCAL_WHISPER_MODEL=Xenova/whisper-tiny
LOCAL_WHISPER_LANGUAGE=thai
WHISPER_SERVICE_PORT=8788
OPENAI_API_KEY=YOUR_ROTATED_OPENAI_API_KEY
OPENAI_REALTIME_MODEL=gpt-realtime-2
REALTIME_SESSION_PORT=8787
```

## Whisper service checks

Run the standalone tests:

```powershell
npm run test:whisper
```

Run a live smoke test against generated silence after starting `npm run whisper:service`. This proves the local model, service endpoint, and scoring path run without an API key:

```powershell
npm run test:whisper:silence
```

Run against a browser-decoded raw Float32 PCM file when you have one:

```powershell
npm run test:whisper:live -- --audio .\recordings\hello.f32 --target "สวัสดีครับ" --romanization "sawatdee khrap" --translation "Hello"
```

Useful service endpoints:

- `GET http://localhost:8788/api/whisper/health`
- `POST http://localhost:8788/api/whisper/warmup`
- `POST http://localhost:8788/api/whisper/judge-text`
- `POST http://localhost:8788/api/whisper/judge-audio`

## How it works

- `src/services/whisperPronunciation.ts` records one phrase with `MediaRecorder`, decodes it in the browser to 16 kHz mono Float32 PCM, checks the Whisper service, then posts the samples and current target phrase to `/api/whisper/judge-audio`.
- `server/whisper-service.mjs` is standalone, separate from Realtime, and exposes health, warmup, text-judge, and audio-judge endpoints.
- `server/whisper-core.mjs` runs local Transformers.js Whisper on browser-decoded samples and holds transcript scoring so it can be tested without the game UI.
- `src/services/realtimePronunciation.ts` opens a WebRTC peer connection, streams mic audio only while the battle button is held, and requests a text JSON pronunciation verdict.
- `src/components/BattleHUD.tsx` applies score-based battle progress when the selected voice judge passes the pronunciation attempt.
