# Bangkok Rift — Architecture Tour

One-page tour of the codebase. Read this after `README.md`, before opening any individual file.

## The big picture

```
┌─────────────────────────────────────────────────────────────────┐
│  App.tsx — top-level router (title / overworld / battle-demo)   │
│       │                                                         │
│       ▼                                                         │
│  GameCanvas.tsx — scene dispatcher by gameStore.currentScene    │
│       │                                                         │
│       ▼ (every gameplay scene resolves here)                    │
│  Stage3DAdventureDispatcher — picks config by scenarioIndex     │
│       │                                                         │
│       ▼                                                         │
│  Stage3DAdventure — single engine that renders any stage 1–10   │
│       │                                                         │
│       ├──> .types.ts        SceneRefs, NpcAnimationController   │
│       ├──> .hotspots.ts     Sprite + ring + click collider      │
│       ├──> .npcRig.ts       Per-rig animation loaders           │
│       └──> .ui.ts           Verdict flash + color helpers       │
└─────────────────────────────────────────────────────────────────┘
```

Every stage from 1 through 10 runs on the same engine. The difference between stages is purely declarative — a single config file in `src/data/adventures/stage0N-*.ts` describes rooms, hotspots, commands, conversations, and ambiance. The engine reads it and builds a Three.js scene.

## State management

Zustand. The single source of truth is `src/store/gameStore.ts`. Selectors live in `src/store/selectors.ts`. Three concerns:

1. **Progression** — `activeScenarioIndex`, `completedScenarioIds`, `currentScene`, `hasSavedGame`.
2. **In-stage** — `battle` (pronunciation attempts, scoring, current chunk). The engine reads this for cue cards.
3. **Persistence** — `saveData`, `playerPosition`. Hydrated from localStorage on mount via `hydrateSave()`.

Scene transitions are driven by store actions (`startAdventure`, `finishStage3DAdventure`, `returnToOverworld`, `returnToTitle`). Components never set `currentScene` directly — they call the action.

## The Stage3DAdventure engine

This is the biggest single component (~1900 LOC after extractions). Its job: turn an `AdventureSceneConfig` into a playable 3D scene with mic input, conversation flow, and inventory.

Lifecycle:

1. **Bootstrap effect** runs once on mount. Builds the Three.js scene, camera, lights, OrbitControls. Loads Patrick rig. Sets up the animation loop.
2. **Room rebuild effect** runs when `roomId` changes. Disposes prior room geometry, calls `config.rooms[i].build(...)` to add new geometry, mounts hotspots.
3. **Conversation VO effect** runs when `activeConversation` changes. Looks up `stageOneConversationDeck[turn.id]` for recorded `suLine` + `coachingLine` audio and plays them sequentially.

State responsibilities:

- `activeCommand` — which verb the player picked on the selected hotspot
- `activeConversation` — multi-turn dialogue in progress
- `inventory` — collected items (string IDs)
- `verdict` — most recent pronunciation result
- `isIntroMovieDone`, `isIntroComplete` — gate input until cinematics finish
- `skipCount`, `playbackCaption`, `reviewTurnIndex` — accessibility/QoL

## The data-driven adventure model

Each `AdventureSceneConfig` has:

- `scenarioId`, `scenarioNumber`, `title`, `subtitle`, `badge`, `description`
- `rooms: AdventureRoom3D[]` — each room has its own `build()` function and `hotspots`
- `inventoryItems` + `requiredInventory` — gates the completion check
- `ambiance` — fog, key/rim/hemi lights, background color
- Optional: `introVideoUrl` (pre-roll cinematic), `completionMessage`

Hotspots have a `commands: Partial<Record<AdventureVerb, AdventureCommand>>` map. Each command can attach a `conversation: AdventureConversationTurn[]` for multi-turn dialogues. Commands can gate behind `requiresItems` or `requiresConversation`.

## Voice pipeline

See `docs/voice-pipeline.md` for the deep dive. Short version: three modes (Whisper / Realtime / No-mic) selectable in Settings. Whisper runs locally via Transformers.js. Realtime hits OpenAI via a Node relay (`server/realtime-session.mjs`). No-mic replaces the mic button with a Confirm Phrase tap.

## Quality gates

- **Typecheck**: `npm run typecheck` (`tsc --noEmit`)
- **Lint**: `npm run lint` (ESLint flat config — typescript-eslint + react-hooks + jsx-a11y)
- **Format**: `npm run format:check` (Prettier)
- **Build**: `npm run build` (production Vite build)
- **CI**: `.github/workflows/ci.yml` runs all four on every PR.

## Where things live

| Domain | Path |
|---|---|
| React UI | `src/components/` |
| Three.js primitives | `src/components/three/` |
| Lesson data (phrases) | `src/data/lessonScenarios.ts` |
| Adventure configs (one per stage) | `src/data/adventures/stage0N-*.ts` |
| Tech-demo lock config | `src/data/techDemoConfig.ts` |
| Voice services (client) | `src/services/{realtime,whisper}Pronunciation.ts` |
| Zustand store | `src/store/gameStore.ts` |
| Speech relay (server) | `server/realtime-session.mjs` |
| Local Whisper service | `server/whisper-service.mjs` |
| Codegen + smoke scripts | `scripts/` |

## Common surgical operations

- **Add an NPC rig**: extend `AdventureHotspot3D.model` union in `src/data/adventures/types.ts`, add a branch in `getRiggedNpcConfig` in `Stage3DAdventure.npcRig.ts`, and create a rig module under `src/components/three/`.
- **Add a phrase**: edit `src/data/lessonScenarios.ts`. To make Su voice it during the drill, also add an entry to `stageOneConversationDeck` and record matching `stage-NN-<phraseId>-su.wav` + `-coach.wav` files.
- **Tweak stage geometry**: edit the `build()` function inside `src/data/adventures/stage0N-*.ts`. Use `sceneHelpers` primitives (`addBox`, `addCylinder`, `addRoomShell`, etc.). Auto-detected collision via Y-extent.
- **Lock/unlock a stage**: bump `TECH_DEMO_PLAYABLE_STAGE_COUNT` in `src/data/techDemoConfig.ts`. LevelSelect, LessonRoadmap, and TitleScreen all read from this one constant.
