# Voice Pipeline

Three modes, one shared judge contract. Picks up between sessions via `localStorage`.

## The three modes

### Whisper (local, default)

Runs locally in the browser via `@huggingface/transformers` (Transformers.js). No network round-trip after the model is cached. No API key needed.

- **Client**: `src/services/whisperPronunciation.ts` records mic audio, sends it as 16kHz mono f32le PCM to `server/whisper-service.mjs`.
- **Server**: Node service on port 8788 runs the model server-side (CPU). Returns `{ score, pass, heard, feedback, tip }`.
- **First load**: model weights download (~150 MB for `whisper-base`, the default) from HuggingFace CDN. Cached after that. Override with `LOCAL_WHISPER_MODEL=Xenova/whisper-tiny` (~75 MB, faster but noticeably worse at Thai) or `Xenova/whisper-small` (~470 MB, much better).
- **Latency**: ~1–3 seconds per attempt on a modern laptop, longer on phones.

### Realtime (cloud)

OpenAI Realtime API over WebRTC. Cheaper to develop with (no local model load), pricier per request, lower latency.

- **Client**: `src/services/realtimePronunciation.ts` opens a WebRTC PeerConnection via `server/realtime-session.mjs` as the SDP relay.
- **Server**: Node service on port 8787 forwards SDP + Bearer token to `https://api.openai.com/v1/realtime/calls`. Picks API key from request header OR server env (header wins — user-supplied key overrides env default).
- **Key resolution**: see `server/env.mjs`. Order of preference:
  1. `x-openai-api-key` header from the client (Settings → API key)
  2. `OPENAI_API_KEY` from `.env.local` / `.env` / process env
- **Latency**: ~500ms–2s per attempt.

### No-mic

No microphone at all. The Hold To Speak button is replaced by a Confirm Phrase button. The player reads the cue card and taps Confirm to advance. Saves to localStorage so it persists across sessions.

- **Client**: just a `voiceJudgeMode === 'no-mic'` conditional in `Stage3DAdventure.tsx`. No services involved.
- **Auto-fallback**: if Whisper or Realtime mode fails to acquire a mic (`NotAllowedError`, `NotFoundError`, denied permission, insecure origin), `connectVoiceCoach` automatically flips `voiceJudgeMode` to `no-mic` and persists it so the player doesn't hit the same wall on the next stage.

## The shared judge contract

Regardless of mode, the engine receives the same `PronunciationVerdict`:

```ts
type PronunciationVerdict = {
  score: number;          // 0..100
  pass: boolean;          // true if score ≥ tutoring level threshold
  heard: string;          // what the model thought the player said
  feedback: string;       // one-sentence English coaching from Su
  tip: string;            // one-sentence correction with romanization
};
```

`score` thresholds depend on the player's tutoring level (Settings → Tutor level):

- **Easy** — pass at 50/100 (native speaker would understand)
- **Medium** — pass at 60/100 (beginner-friendly)
- **Hard** — pass at 70/100 (tone and rhythm count)

## Audio file naming

Su voice lines live in `src/assets/audio/su/`:

- `stage-01/` — Stage 1 dialogue + per-phrase suLine/coachingLine pairs
- `stage-02/` — Stage 2 briefing lines
- `all/` — shared dialogue and stages 3+ intros

Per-phrase recordings use this convention:

```
stage-<NN>-<phraseId>-su.wav      Su's prompt before the player attempts
stage-<NN>-<phraseId>-coach.wav   Su's coaching breakdown after the prompt
```

`stage-NN-intro-<lineId>` is reserved for stage intro VN lines on stages 3–10 (Stages 1 and 2 use explicit `audioId` overrides for their `dialogue-hotel-lobby-basics-*` and `stage-02-briefing-*` legacy names).

Run `npm run audio:coverage` to see which files exist vs which are referenced by lesson data.

## Conversation playback timing

When the player selects Talk on Su and a multi-turn conversation starts:

1. The active turn becomes `activeConversation[turnIndex]`.
2. A `useEffect` in `Stage3DAdventure.tsx` looks up `stageOneConversationDeck[turn.id]`.
3. It plays `suAudioId` (the prompt) then `coachingAudioId` (the coaching line) sequentially via `suAudioPlayer.playUntilEnded`.
4. During each segment, the captions strip at the bottom shows the matching text (if `soundSettings.captionsEnabled`).
5. Playback is interrupted on: turn advance, Skip Phrase, Confirm Phrase (no-mic), Hold To Speak press, or unmount.

## Common gotchas

- **iOS Safari autoplay**: muted videos autoplay fine; unmuted needs user interaction. The intro1.mp4 cinematic handles this with a graceful catch + Skip button so denial doesn't soft-lock.
- **Whisper cold start**: first attempt on a fresh page takes 5–10s while the model loads. Subsequent attempts are fast.
- **Realtime in dev**: the Vite dev server proxies `/api/realtime/*` to `localhost:8787`. Make sure `npm run realtime:session` is running in another terminal.
- **HTTPS required for mic**: production must be HTTPS for `getUserMedia` to work. Localhost is exempt.
