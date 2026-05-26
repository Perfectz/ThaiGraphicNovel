# Bangkok Rift — Isekai Thai Quest

A Thai-language tech demo: Patrick falls through a magic rift into Bangkok and learns survival Thai with Su, an AI tutor princess. Player pronounces (or taps) phrases to advance through a hotel lobby, a front desk check-in, and a night-market food order. ~20 minutes per playthrough.

> **This is a 3-stage tech demo.** Stages 4–10 exist as data but are locked. The full game is on a multi-year roadmap; see [`TECH_DEMO_MVPs.md`](TECH_DEMO_MVPs.md) for the demo-ship checklist.

---

## Run it locally

```bash
git clone <this-repo>
cd "New project 6"
npm install
cp .env.example .env.local     # optional — only for Realtime voice mode
npm run dev                    # serves at http://localhost:5173
```

Voice modes:

- **Whisper (default)** — local Transformers.js model. No API key. First load downloads ~75 MB; cached after that. Start `npm run whisper:service` in another terminal.
- **Realtime** — OpenAI Realtime via WebRTC. Needs `OPENAI_API_KEY` in `.env.local` (preferred) or pasted into Settings. Start `npm run realtime:session` in another terminal.
- **No-mic** — read & tap. Zero audio in. Settings → Voice Coach → No mic. Auto-selected if mic permission is denied.

## Common scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Production build (typecheck + Vite build) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint flat-config |
| `npm run format` / `format:check` | Prettier write / verify |
| `npm run realtime:session` | OpenAI Realtime relay (port 8787) |
| `npm run whisper:service` | Local Whisper HTTP service (port 8788) |
| `npm run audio:coverage` | Report which Su voice lines are recorded vs missing |
| `npm run test:mobile` | Playwright mobile smoke run |

Health endpoints (when services are running):

- `http://localhost:5173/api/whisper/health`
- `http://localhost:5173/api/realtime/health`

## Project layout

```
src/
  components/
    Stage3DAdventure.tsx        Engine for every stage (1–10)
    Stage3DAdventure.*.ts       Sibling helpers (npcRig, hotspots, types, ui)
    GameSettings.tsx            Settings modal
    DemoEndSplash.tsx           Stage-3-clear splash
    StageErrorBoundary.tsx      Per-stage crash recovery
  data/
    adventures/                 One file per stage (stage01-..., stage02-..., etc.)
    lessonScenarios.ts          Phrase data — the single source of truth
    techDemoConfig.ts           Playable-stage count + lock helpers
  services/                     Speech pipelines (whisper, realtime, audio playback)
  store/                        Zustand game state
server/                          Node services (realtime relay, whisper service)
scripts/                         Codegen + audio coverage + smoke tests
```

Deeper tours: [`docs/architecture.md`](docs/architecture.md), [`docs/voice-pipeline.md`](docs/voice-pipeline.md).

## How to add a new stage (post-demo)

1. Bump `TECH_DEMO_PLAYABLE_STAGE_COUNT` in `src/data/techDemoConfig.ts`.
2. Edit `src/data/adventures/stage0N-*.ts` — already authored, just polish geometry and add `introVideoUrl` / intro lines if desired.
3. Record voice lines per the naming convention (`stage-NN-<phraseId>-su.wav` and `-coach.wav`) — see [`docs/voice-pipeline.md`](docs/voice-pipeline.md).
4. Run `npm run audio:coverage` to verify your stage hits 100%.

## Sharing the demo

The demo is browser-only. Build with `npm run build` and host `dist/` on any static host (Vercel / Netlify / Cloudflare Pages / GitHub Pages). For Realtime voice to work for visitors without their own keys, also deploy `server/realtime-session.mjs` somewhere (Fly / Render / Railway) with `OPENAI_API_KEY` set; otherwise visitors fall back to Whisper or No-mic without configuration.

## Browser support

Tested on:

- ✅ Chrome / Edge desktop (primary dev target)
- ✅ Firefox desktop
- ✅ Safari desktop (intro audio needs first interaction)
- ⚠️ Mobile Safari / Chrome Android (works; reduced visual polish)

The title screen About modal carries a "Best on desktop Chrome or Safari" advisory.

## Secrets

Never commit `.env.local`. The app can read a key from in-game Settings for local Realtime testing — `.gitignore` excludes local env files. The server prefers `OPENAI_API_KEY` from env, but a user-supplied header key overrides it so multiple visitors can use their own keys against a shared deployment.

## Acknowledgements

Built with React, Three.js, OpenAI Realtime, local Whisper (via `@huggingface/transformers`), and Vite. Character rigs from Meshy AI.
