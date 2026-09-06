> **Active open-world rebuild:** the adventure now begins inside a Sukhumvit hotel and connects six Bangkok-inspired neighbourhoods on foot. See [the full quality audit](docs/OPEN_WORLD_QUALITY.md) for current evidence and the remaining learning, content and visual standards.

# Bangkok Rift — Isekai Thai Quest

A Bangkok-inspired 3D RPG that teaches practical Thai. **The Last Ferry** is a playable opening chapter: explore with Su, help the townspeople, discover treasure, fight word spirits, and restore a passage across the river. Battles now feature separate party turns, AP, targeted Thai abilities, breaks, exposure combos, and reactive dodge/parry defense. **Rehearse combat** on the title opens repeatable sparring without spending story supplies. A separate thirty-day training route offers 82 phrases, reference audio, recording, and spaced recall.

> **Play:** open the default route. WASD/arrow keys move, E talks, clicking the ground walks, and the town map guides the party to landmarks. Phones have direction controls. See [The Last Ferry](docs/THE_LAST_FERRY.md) for the quest and combat systems. **Train at camp** opens the practice route, also available at `/training`; [training notes](docs/BANGKOK_REBUILD.md) cover its learning design. The earlier tech demo remains at `/legacy`.

After checking in with Mali, **Journeys** opens a Bangkok passport with 30 practice outings. Visit three people, rehearse useful Thai with its English meaning, then try it from memory. Due phrases return in later outings. Progress is saved between visits; first completions award a stamp and RPG supplies. These outings use six route families and do not represent thirty unique story chapters.

**Your Thai today**, in Journeys and the camp phrasebook, separates active phrase-practice time, submitted spoken replies and recall attempts. Walking, menus, hidden tabs and more than 45 seconds without interaction pause the clock. Older activity totals are retained under their original meaning. Campfire review also brings back due phrases encountered ahead of the camp curriculum during city exploration, in rounds of up to eight.

**Journal → Your adventures** lets you track the main story or an available local adventure. Each entry explains its next step, useful Thai and reward. Walking buttons follow the city paths to the destination; talk when you arrive. Your selected story survives reloads, updates as you progress and moves into Completed stories when finished. Active practice outings keep priority until paused in Journeys.

**An Evening of Our Own** is a companion story available after hotel check-in. Choose **Plan an evening with Su** near Mali, or follow the story in your journal. Tell Su you like Thai food to visit Lek in Yaowarat, or that you are thirsty to visit Pim in Lumphini. Then choose mild food or a little chilli, water or tea. English meanings and the consequences appear before speaking; a separate confirmation saves each decision. Finish for 60 XP, two rice parcels or two flasks of tea, and a journal memory reflecting your choices. The outing awards its completion reward once.

The soundtrack crossfades between hotel, street, market and journey themes as you explore. Thai practice pauses the music while you read, listen and speak; leaving practice resumes playback. The music control remembers your mute preference. The score currently reuses four existing tracks across the six districts and battles.

Six background residents walk local routes around Sukhumvit, Yaowarat, Lumphini and Old Town. They yield to the party and stop during conversations and menus; reduced motion keeps them stationary. These scenic residents use shared character models and do not add new conversations or rewards.

Old Town's hall and Lumphini's pavilion now use original **Blender-authored environment models** with curved tiled roofs, carved gables, framed windows and timber details. Editable `.blend` scenes, the construction script and export instructions are in [art/blender](art/blender/README.md). The game preserves their walking boundaries, removes obstructing structural parts for conversations, and falls back to simplified geometry if a model cannot load.

Explore side paths for six **city memories**: a journal, route board, supply basket, recipe board, carved boat and unfinished lantern. **Journal → Explorer’s journal** provides clues. Their locations appear on the map after discovery. Find all six to equip a **River Charm**, which restores 15 HP after story-battle victories.

Adventure XP now develops the party. Select **Patrick’s level** or **Bag → Develop the party** to allocate talents for opening AP, break, healing and the shared River Duet. Levels 2–6 grant one point each; talents can be changed freely between encounters. Battle loadouts are saved when the encounter starts. Party level measures game progress; Thai recall and speaking records remain separate.

Prepare for your next encounter in the city. After their first conversations, revisit **Mali** for free recovery, **Uncle Lek** for rice parcels (10 coins), and **Pim** for tea (8 coins). Each service shows an English intention and Thai speaking preview before a separate receipt confirmation. Your bag points back to these people on the map; it no longer sells provisions remotely. Their return dialogue changes with story progress.

Dao also points out the **crossroads waystone** on the road to Yaowarat. Find it through the city map after completing his introduction. Practise asking where the station is, then choose whether to challenge the optional **Waywarden**. Its armor halves word damage until exposed; counters and River Duet bypass it. Victory grants 75 XP, 25 coins and a **Wayfinder Seal**, which starts future battles with 20 resonance.

The southern canal walk connects the hotel, park and Old Town. After hotel check-in, the map also offers **A Light for Late Walkers**: visit the damaged canal lantern, collect paper from Pim and a frame from Arun in either order, then return to restore it. Choose **Talk about the canal lantern** near either host for this optional errand; ordinary conversations and services remain separate. The restored light persists, and the one-time reward is 80 XP, 25 coins, rice and tea.

After checking in with Mali, find **A Way Back Together → Find Nok** on the town map. Invite the lost traveller in Thai, then walk with him from the park to Dao at the station. Nok follows the city paths, waits during conversations and battles, and remembers his position between visits. Complete the arrival conversation for a one-time reward of 70 XP, 20 coins and tea. English meanings appear before each Thai reply; text practice remains available separately from spoken replies.

---

## Run it locally

```bash
git clone <this-repo>
cd "New project 6"
npm install
cp .env.example .env.local     # optional — only for Realtime voice mode
npm run dev                    # serves at http://127.0.0.1:5188
```

The new adventure offers local recording and playback directly in each lesson. The optional voice coach uses the configured service below. Phrase-choice practice is available without a microphone and never counts as speaking.

Voice services (configuration settings remain in `/legacy`):

- **Whisper (default)** — local Transformers.js model. No API key. First load downloads ~75 MB; cached after that. Start `npm run whisper:service` in another terminal.
- **Realtime** — OpenAI Realtime via WebRTC. Needs `OPENAI_API_KEY` in `.env.local` (preferred) or pasted into Settings. Start `npm run realtime:session` in another terminal.
- **No-mic** — choose “Practise with choices instead” in the speaking dojo. You can switch back to your microphone at any time.

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

- `http://127.0.0.1:5188/api/whisper/health`
- `http://127.0.0.1:5188/api/realtime/health`

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
Game direction docs: [`docs/game-design-direction.md`](docs/game-design-direction.md), [`docs/development-direction.md`](docs/development-direction.md), [`docs/battle-system-theory.md`](docs/battle-system-theory.md).

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
