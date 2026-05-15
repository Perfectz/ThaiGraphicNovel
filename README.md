# ThaiGraphicNovel

ThaiGraphicNovel is a Vite/React browser game for learning Thai through a visual-novel RPG flow. The first chapter teaches starter survival phrases with Su as the coach, RPG battle feedback, generated scene art, and voice pronunciation judging.

## What is in the game

- Visual-novel chapter flow with ten lesson stages.
- Thai phrase practice with romanization, phonetic hints, translation, and battle progress.
- Local Whisper pronunciation judging by default, using Transformers.js.
- Optional OpenAI Realtime WebRTC coaching with `gpt-realtime-2`.
- Settings for voice mode, sound, and local API-key entry without committing secrets.
- Comic/storyboard reference material in `docs/`.

## Requirements

- Node.js 20 or newer.
- npm.
- A modern Chromium-based browser for microphone and WebRTC testing.
- An OpenAI API key only if you choose the Realtime voice mode.

## Setup

```powershell
npm install
Copy-Item .env.example .env.local
```

Edit `.env.local` only for local machine settings. Do not commit real API keys.

Start the local Whisper service:

```powershell
npm run whisper:service
```

Start the optional Realtime session service:

```powershell
npm run realtime:session
```

Start the game:

```powershell
npm run dev
```

Open the Vite app at `http://127.0.0.1:5188/` or the port printed by Vite.

## Voice Modes

Whisper is the default and runs locally:

- `GET http://127.0.0.1:5188/api/whisper/health`
- `POST http://127.0.0.1:8788/api/whisper/warmup`
- `POST http://127.0.0.1:8788/api/whisper/judge-audio`

Realtime is optional and needs a valid OpenAI API key in AI Settings or `.env.local`:

- `GET http://127.0.0.1:5188/api/realtime/health`
- `POST http://127.0.0.1:8787/api/realtime/session`

## Verification

Run the production build after source changes:

```powershell
npm run build
```

Run focused Whisper tests after pronunciation changes:

```powershell
npm run test:whisper
```

For local service checks, start the needed service first and then use the Vite proxy health URLs:

```powershell
npm run whisper:service
npm run realtime:session
```

Then check:

- `http://127.0.0.1:5188/api/whisper/health`
- `http://127.0.0.1:5188/api/realtime/health`

## Secrets

Never commit `.env.local` or a real OpenAI API key. The app can read a key from in-app AI Settings for local Realtime testing, and `.gitignore` excludes local env files.
