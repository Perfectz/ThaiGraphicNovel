# MVP — Persistent Learner Model + Spaced-Repetition Tutor

**Status:** proposed
**Owner:** TBD
**Estimated effort:** ~3–4 weeks (5 phases)
**Roadmap tie-in:** This is the "Q3 SRS pedagogy layer" already flagged as the highest-leverage future quarter.

---

## 1. The problem

The game already does the hard part — it judges real Thai pronunciation and captures a rich
per-attempt record. Every `PronunciationAttempt` records the phrase, the score (0–100),
pass/fail, what was heard, and coaching feedback (`src/domain/scenarioRules.ts:23`). But all of
that is **thrown away when the session ends.**

`SaveData` persists only five fields — which stages are done and the map position
(`src/systems/saveSystem.ts:3`):

```ts
export type SaveData = {
  hasStarted: boolean;
  completedTutorial: boolean;
  activeScenarioIndex?: number;
  completedScenarioIds?: string[];
  lastPlayerPosition: GridPosition;
};
```

Consequences:

- The game has **no memory of what the learner actually knows.** A phrase aced on the first try
  and a phrase failed eight times are treated identically once the stage is cleared.
- Phrases are drilled **once, top-to-bottom, then never seen again.** There is no review, so
  vocabulary decays exactly as fast as untested cramming — the worst case for retention.
- There is no learner model, no mastery, no adaptive sequencing, no difficulty tuning.

For a *language-learning* product, this is the single biggest gap. It turns a beautiful 20-minute
scripted tour into something that doesn't actually teach durably.

## 2. The outcome we want

A tutor that:

1. **Remembers every learner** across sessions (persisted, versioned, migratable).
2. **Knows which of the ~100 phrases** each learner has mastered vs. struggles with.
3. **Resurfaces weak/old phrases at the right time** using a spaced-repetition schedule — woven
   into the existing 3D fiction (a recurring "Rift Echo" review encounter), not bolted on as a
   flashcard list.
4. **Adapts** pass thresholds and review frequency to the learner's demonstrated ability.
5. **Shows progress** so the learner feels the system working (mastery counts, due-today badge,
   streak).

## 3. Non-goals (for this MVP)

- No server/account sync — localStorage only (a later quarter can add cloud sync on top of the
  same schema).
- No new stages or vocabulary content — this MVP makes the *existing* content teach better.
- No change to the pronunciation-judging pipeline (Realtime / Whisper / no-mic) itself.
- No leaderboards or social features.

---

## 4. Architecture

The codebase already separates **pure domain logic** (`src/domain/`, `src/systems/`) from
**Zustand state** (`src/store/`) from **React UI** (`src/components/`). The SRS layer follows the
same split, so the scheduling math is unit-testable in isolation (mirrors the existing
`node --test` setup used by the Whisper service).

```
src/
  domain/
    srs/
      learnerModel.ts        # types + pure reducers over the learner model
      scheduler.ts           # SM-2-derived "what's due / next interval" math (pure, tested)
      mastery.ts             # score history -> mastery state mapping (pure, tested)
  systems/
    learnerStore.ts          # localStorage read/write + schema versioning + migration
  store/
    gameStore.ts             # pipe submitPronunciationResult -> learnerModel update
  components/
    review/
      RiftEchoEncounter.tsx   # in-fiction review drill (reuses existing rigs + judge UI)
    MasteryBadge.tsx          # due-today / streak / mastered-count surface
```

### 4.1 The learner-model schema

One record per phrase id (phrase ids already exist and are stable, e.g. `'sawatdee-khrap'`).

```ts
// src/domain/srs/learnerModel.ts
export type PhraseMemory = {
  phraseId: string;
  scenarioId: string;        // which stage it was introduced in
  seenCount: number;         // total drills
  passCount: number;
  lastScore: number;         // 0–100, most recent
  bestScore: number;
  scoreHistory: number[];    // capped ring buffer (last ~10) for trend/EMA
  // SM-2-derived scheduling state:
  ease: number;              // ease factor, starts 2.5
  intervalDays: number;      // current review interval
  dueAt: number;             // epoch ms — when this phrase next becomes due
  lastReviewedAt: number;    // epoch ms
  mastery: 'new' | 'learning' | 'familiar' | 'mastered';
  lapses: number;            // times it dropped back after being familiar+
};

export type LearnerModel = {
  schemaVersion: number;     // for migration; starts at 1
  phrases: Record<string, PhraseMemory>;
  streak: { current: number; longest: number; lastActiveDay: string }; // YYYY-MM-DD
  totals: { drills: number; reviews: number };
};
```

### 4.2 Persistence (versioned)

`src/systems/learnerStore.ts` mirrors `saveSystem.ts` (same defensive parse + `try/catch`),
under a **separate** localStorage key so the existing save is never at risk:

- Key: `isekai-thai-quest-learner-v1`.
- `loadLearnerModel(): LearnerModel | null` — validate `schemaVersion`, run migrations, reject
  malformed data (return a fresh model rather than throwing).
- `writeLearnerModel(model)` — debounced write (the model updates on every attempt; we don't
  want a synchronous localStorage write inside the render path).
- `migrateLearnerModel(raw)` — switch on `schemaVersion`; v0→v1 is identity. Establishes the
  pattern so future schema changes don't wipe progress.

### 4.3 The scheduler (pure, tested)

An SM-2 variant adapted for *pronunciation* (continuous 0–100 score rather than a 0–5 self-grade):

- Map the judge score to an SM-2-style quality `q`: `q = clamp(round(score / 20), 0, 5)`
  (so 100 → 5, 60 → 3, the typical pass threshold).
- `q < 3` (a fail): reset `intervalDays` to 0 (due again same session), increment `lapses`,
  drop mastery one tier, nudge `ease` down (floor 1.3).
- `q >= 3` (a pass): advance interval (`1 → 3 → intervalDays * ease`), raise mastery when the
  phrase clears interval thresholds, nudge `ease` up.
- `dueAt = now + intervalDays * DAY`.
- `getDuePhrases(model, now, limit)` → ids sorted by overdueness, capped.

All of this is a pure function of `(PhraseMemory, score, now)` → `PhraseMemory`, plus a pure
selector over the model. Fully unit-testable with no DOM/Three/React. Target: a
`src/domain/srs/scheduler.test.mjs` covering pass/fail/lapse/interval-growth/mastery-transition.

---

## 5. Phases

### Phase 1 — Persistence & learner model *(foundation, ~1 week)*
- Add `learnerModel.ts` types + pure reducers (`recordAttempt`, `recordReview`, streak update).
- Add `learnerStore.ts` (load/write/migrate, debounced) under its own localStorage key.
- Pipe the already-captured attempt stream into the model: in `gameStore.ts`
  `submitPronunciationResult` (around `src/store/gameStore.ts:473`) call `recordAttempt`.
- **Value shipped on its own:** pronunciation progress finally survives a refresh.
- Tests: reducer + store round-trip + migration identity.

### Phase 2 — Scheduling engine *(~3–4 days)*
- Add `scheduler.ts` + `mastery.ts` (pure) with the SM-2 variant above.
- `getDuePhrases` selector.
- Tests: pass/fail/lapse/interval-growth/mastery transitions, due-sorting.
- No UI yet — purely the brain.

### Phase 3 — In-fiction review encounters *(~1 week)*
- `RiftEchoEncounter.tsx`: a "Rift Echo" drill that pulls due phrases from *past* stages and runs
  them through the **existing** pronunciation pipeline + rigs (no new judging code). Diegetic
  framing: a shimmer of the rift replays a moment, Su quizzes Patrick on what he learned.
- Entry points: a "Review (N due)" CTA on the title/roadmap, and an optional 1–2 due-phrase
  injection at the start of a new stage's drill so old vocab recirculates naturally.
- Reuse `SuPronunciationJudge` / `BattleHUD` so it feels native.

### Phase 4 — Mastery UI & motivation *(~3–4 days)*
- `MasteryBadge.tsx`: mastered-count, due-today badge, streak.
- Per-phrase mastery dots in `LessonRoadmap` (it already lists every phrase —
  `src/components/LessonRoadmap.tsx:283`).
- "Words you know: N" on the title screen status line.

### Phase 5 — Adaptive difficulty *(~3–4 days)*
- Flex the pass threshold (currently a fixed tutoring level) by per-phrase EMA: phrases the
  learner reliably nails raise the bar; struggling phrases relax it and review more often.
- Frequency of review-injection scales to overall accuracy.

---

## 6. Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| Corrupting the existing save | Separate localStorage key + defensive parse; never touch `saveSystem.ts`. |
| Schema churn wiping progress | `schemaVersion` + migration switch from day one. |
| localStorage write in render path | Debounced writes from `learnerStore`; model lives in memory. |
| Review feeling like a chore | Diegetic "Rift Echo" framing + injection into normal play, not a flashcard wall. |
| No-mic mode skews the model | Tag attempts with input mode; treat no-mic confirms as low-confidence signals (don't let them mark a phrase "mastered"). |

## 7. Definition of done

- A learner's per-phrase history survives a full browser restart.
- Failing a phrase makes it come back; acing it pushes it out — verified by the scheduler tests.
- A "Rift Echo" review session can be launched and drills genuinely due phrases.
- The roadmap and title surface real mastery numbers.
- `npm run typecheck`, `npm run lint`, and the new `node --test` suite all pass.
