# Isekai Thai Quest Development Direction

This document turns the game design direction into an execution plan. Use it
when deciding what to build next, where work should live, and what must be true
before a feature is considered ready.

Related docs:

- `docs/game-design-direction.md` for the product and design source of truth.
- `docs/battle-system-theory.md` for the 90s RPG battle conversion direction.
- `docs/3d-adventure-architecture.md` for the current Stage3DAdventure module
  boundaries.
- `docs/voice-pipeline.md` for Whisper, Realtime, no-mic, and audio generation.
- `TECH_DEMO_MVPs.md` for the current shareable-demo checklist.

## Current Product State

The project is a React, Vite, and Three.js browser game. The current production
track is the 3D adventure engine driven by `AdventureSceneConfig` data.

The immediate product is a 3-stage tech demo:

1. Hotel Lobby Basics.
2. Front Desk Check-in.
3. Street Food Order.

Stages 4-10 exist as authored data and should be treated as future-production
content until they receive matching scene polish, voice coverage, QA, and demo
flow integration.

## Development Priorities

Work should be prioritized in this order:

1. **Playable critical path.** A first-time player can start Stage 1, complete
   the demo path, and understand why it ends.
2. **Input resilience.** Voice, no-mic, permission-denied, and service-health
   paths are explicit and recoverable.
3. **Stage quality parity.** Stages 1-3 should feel like the same game in art
   density, objective clarity, and payoff.
4. **Content pipeline reliability.** Stage data, voice lines, image assets, and
   smoke scripts should make gaps obvious.
5. **Future-stage production.** Unlock later stages only when they meet the same
   playability and verification bar as the demo stages.
6. **XR and advanced features.** Treat VR as an additive mode with strict comfort
   requirements, not as a reason to destabilize the flat-screen game.

## Technical Direction

Keep the current stack:

- React owns app state, screens, settings, and DOM HUD.
- Three.js owns the 3D room, camera, animation playback, collisions, and visual
  effects.
- Zustand owns serializable game progress and scene transitions.
- Adventure data owns stage content, hotspots, commands, conversations, and
  stage-level ambiance.
- Services own speech recognition, Realtime session tokens, audio playback, and
  generated voice manifests.

Do not move gameplay rules into raw Three.js object callbacks if they can remain
in data, store actions, or Stage3DAdventure orchestration. Renderer objects
should not become the source of truth for saveable state.

## Ownership Boundaries

| Concern | Primary Home | Notes |
|---|---|---|
| Stage content | `src/data/adventures/stage0N-*.ts` | Rooms, hotspots, commands, conversations |
| Stage schema | `src/data/adventures/types.ts` | Extend carefully; data authors depend on it |
| Lesson phrase data | `src/data/lessonScenarios.ts` | Practical language source of truth |
| React stage orchestration | `src/components/Stage3DAdventure.tsx` | State, command flow, transitions, voice flow |
| Room lifecycle | `src/components/Stage3DAdventure.rooms.ts` | Rebuilds, loaders, room cleanup, collider refresh |
| Hotspots | `src/components/Stage3DAdventure.hotspots.ts` | Meshes, tags, command helpers, click priority |
| NPC rigs | `src/components/Stage3DAdventure.npcRig.ts` | Model attachment and animation adapters |
| Camera | `src/components/Stage3DAdventure.camera.ts` | Framing, mobile rules, auto-follow math |
| Runtime setup | `src/components/Stage3DAdventure.runtime.ts` | Renderer, render loop, dev probes, disposal |
| Three primitives | `src/components/three/sceneHelpers.ts` | Shared authored-room helpers and disposal rules |
| Voice services | `src/services/` and `server/` | Client modes and local service endpoints |
| Verification scripts | `scripts/` and `tests/` | Focused stage and service smoke coverage |

When adding code, choose the smallest owner that matches the concern. If a
change touches multiple owners, write down the boundary in the relevant doc.

## Near-Term Roadmap

### Phase 1: Demo Shareability

Goal: a stranger can open the game and complete the 3-stage demo.

- First-time title flow explains the 3-stage demo.
- Stages 4-10 are visibly locked or clearly marked as future content.
- No-mic path is obvious and persists after mic denial.
- Stage 3 clear leads to an end-of-demo splash, not a dead end.
- Browser-visible copy avoids engineering phrasing.
- Build, stage smoke, and health checks have a repeatable runbook.

### Phase 2: Demo Polish Parity

Goal: Stages 1-3 feel intentionally authored, not mixed-prototype content.

- Stage 2 and Stage 3 scene density match Stage 1's current quality bar.
- Each stage has a readable focal point, walk path, and application moment.
- Su and key NPC voice/captions are covered where the design expects VO.
- Stage-clear payoff communicates what the player learned and earned.
- Mobile layout is usable, even if desktop remains the recommended target.

### Phase 3: Content Pipeline Hardening

Goal: adding or polishing stages becomes predictable.

- Add a stage authoring checklist template.
- Keep audio coverage reporting accurate for Su, coach, and character lines.
- Add asset provenance notes for generated images, GLBs, HDRIs, and music.
- Standardize stage intro, loading tagline, completion message, and recap data.
- Keep the architecture docs updated when ownership moves.

### Phase 4: Stages 4-10 Production

Goal: unlock later stages only after they meet demo-stage quality.

- Upgrade one stage at a time.
- Add or polish its 3D room and hotspot layout.
- Verify the phrase set has a practical application moment.
- Fill required voice and caption gaps.
- Add smoke coverage or manual QA notes before raising the playable stage count.

### Phase 5: Optional XR Mode

Goal: VR is comfortable and additive.

- Flat-screen Stage3DAdventure remains the baseline.
- Comfort settings default to conservative motion.
- XR HUD mirrors existing handlers rather than forking gameplay rules.
- Headset-felt QA is required before claiming VR readiness.

## Stage Production Template

Use this outline when creating or upgrading a stage:

```md
# Stage N: <Title>

## Player Promise
What practical Thai situation does this stage make playable?

## Location Read
What should the player understand within five seconds of seeing the room?

## Core NPCs and Props
Who speaks, what objects matter, and which hotspots are critical path?
What contextual action label appears above each clicked NPC, item, or object?

## Phrase Chunks
Chunk 1:
Chunk 2:
Chunk 3:

## Drill Flow
How does Su teach or rehearse the phrases?

## Application Flow
How does the player use the phrases with someone or something else?

## Gates
Items, required conversations, blocked text, and failure recovery.

## Payoff
Stage-clear message, reward, unlocked next step, and recap phrases.

## Asset Needs
Room props, NPC rigs or sprites, sky, music, VO, captions, UI images.

## Verification
Build, focused smoke, voice/no-mic checks, and any manual QA notes.
```

## Feature Readiness Checklist

A feature is ready only when:

- It has one owner module or a documented cross-module boundary.
- It is reachable from the current product flow or intentionally gated.
- It does not break no-mic completion.
- It has clear copy for blocked, loading, error, and success states.
- It has a focused verification path.
- Relevant docs are updated.

## Verification Runbook

For source, UI, API, voice, asset, or gameplay changes, use the strongest
practical checks:

- `npm.cmd run build`
- `npm.cmd run lint`
- `npm.cmd run test:whisper` for Whisper or pronunciation changes
- Start the app and verify the affected flow at `http://127.0.0.1:5188/`
- Check service health through the Vite app when Realtime or Whisper is touched:
  - `http://127.0.0.1:5188/api/realtime/health`
  - `http://127.0.0.1:5188/api/whisper/health`
- Run focused stage smoke with `node scripts/test-3d-stage-one.mjs 0 --base
  http://127.0.0.1:5188` when Stage3DAdventure behavior changes.
- Run `npm.cmd run test:mobile -- --base http://127.0.0.1:5188` when layout,
  HUD, input, or mobile playability changes.

If port 5188 is unavailable, use a nearby port consistently and record the port
in the verification note.

## Contribution Rules For Future Agents

- Read `docs/game-design-direction.md` before adding new mechanics or content.
- Read `docs/3d-adventure-architecture.md` before touching Stage3DAdventure.
- Preserve user-owned changes in dirty worktrees.
- Prefer small helper-level changes over broad rewrites.
- Keep stage data declarative where practical.
- Update docs in the same change when ownership, stage flow, or verification
  expectations change.
- Never expose real API keys in docs, logs, commits, or screenshots.
