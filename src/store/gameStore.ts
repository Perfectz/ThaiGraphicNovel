import { create } from 'zustand';
import { lessonScenarios, type LessonScenario } from '../data/lessonScenarios';
import { startPosition, suPosition, type GridPosition } from '../data/map';
import { type ThaiPhrase } from '../data/thaiPhrases';
import { buildScenarioDialogue } from '../data/dialogue';
import { hasAdventureConfigForScenarioIndex } from '../data/adventures/registry';
import {
  completeScenario,
  createBattleStateForScenario,
  createInitialBattleState,
  createSaveSnapshot,
  getScenarioByIndex,
  getScenarioIndex,
  getScenarioPhrases as getScenarioPhrasesByIndex,
  type BattleState,
  type PronunciationAttempt,
} from '../domain/scenarioRules';
import {
  resolveBattleTurn,
  resolvePronunciationTurn,
  type BattleOption,
  type PronunciationBattleResult,
} from '../systems/battleSystem';
import { isInsideMap, isSamePosition } from '../systems/movement';
import { clearSave, loadSave, writeSave, type SaveData } from '../systems/saveSystem';

export type GameScene =
  | 'title'
  | 'overworld'
  | 'pointClickAdventure'
  | 'stage3dAdventure'
  | 'dialogue'
  | 'battle';

export type ScenarioStatus = 'completed' | 'current' | 'available';

type GameStore = {
  currentScene: GameScene;
  hasStarted: boolean;
  completedTutorial: boolean;
  activeScenarioIndex: number;
  /**
   * When set, the player is replaying a stage at this index (typically below
   * activeScenarioIndex). Forward progression (activeScenarioIndex) does NOT
   * move while this is set, so replays don't roll the player's bookmark back.
   * Session-only — not persisted to save.
   */
  replayScenarioIndex: number | null;
  completedScenarioIds: string[];
  playerPosition: GridPosition;
  targetPosition: GridPosition | null;
  dialogueIndex: number;
  battle: BattleState;
  saveData: SaveData | null;
  hasSavedGame: boolean;
  hydrateSave: () => void;
  startAdventure: () => void;
  continueAdventure: () => void;
  jumpToScenario: (scenarioIndex: number) => void;
  getScenarioStatus: (scenarioIndex: number) => ScenarioStatus;
  setTargetPosition: (position: GridPosition) => void;
  setPlayerPosition: (position: GridPosition) => void;
  startTutorialDialogue: () => void;
  finishPointClickAdventure: () => void;
  finishStage3DAdventure: () => void;
  getActiveScenario: () => LessonScenario;
  getActivePhrases: () => LessonScenario['chunks'][number]['phrases'];
  advanceDialogue: () => void;
  chooseBattleOption: (option: BattleOption) => void;
  submitPronunciationResult: (result: PronunciationBattleResult) => void;
  skipBattle: () => void;
  returnToOverworld: () => void;
  /**
   * Sends the player back to the title screen without touching save data.
   * Used by the Settings → Danger Zone "Return to title" affordance so the
   * player can bail out of a stage without reloading the page.
   */
  returnToTitle: () => void;
  /**
   * Wipes the local save and resets every game-progress field back to its
   * initial value. The player ends up on the title screen as if it were a
   * brand-new install. Settings (sound, voice, tutor level, API key) are NOT
   * touched — those live in their own storage namespace.
   */
  clearAllProgress: () => void;
};

function saveProgress(
  hasStarted: boolean,
  completedTutorial: boolean,
  lastPlayerPosition: GridPosition,
  activeScenarioIndex: number,
  completedScenarioIds: string[],
): SaveData {
  const saveData = createSaveSnapshot(
    hasStarted,
    completedTutorial,
    lastPlayerPosition,
    activeScenarioIndex,
    completedScenarioIds,
  );
  writeSave(saveData);
  return saveData;
}

function createPronunciationAttempt(
  phrase: ThaiPhrase,
  pronunciation: PronunciationBattleResult,
  isReview: boolean,
): PronunciationAttempt {
  return {
    phraseId: phrase.id,
    phrase: phrase.targetPhrase,
    romanization: phrase.romanization,
    translation: phrase.translation,
    score: pronunciation.score,
    pass: pronunciation.pass,
    heard: pronunciation.heard,
    feedback: pronunciation.feedback,
    tip: pronunciation.tip,
    isReview,
    isSkipped: false,
  };
}

function createSkippedAttempt(phrase: ThaiPhrase): PronunciationAttempt {
  return {
    phraseId: phrase.id,
    phrase: phrase.targetPhrase,
    romanization: phrase.romanization,
    translation: phrase.translation,
    score: 0,
    pass: false,
    heard: 'Skipped',
    feedback: `Skipped "${phrase.translation}".`,
    tip: `Practice ${phrase.romanization} slowly before moving on.`,
    isReview: false,
    isSkipped: true,
  };
}

function getScenarioStartScene(scenario: LessonScenario, scenarioIndex: number): GameScene {
  // All stages (1–10) now resolve to the data-driven Stage3DAdventureDispatcher
  // via GameCanvas. The 'dialogue' (Stage 1) and 'pointClickAdventure' (Stage 2)
  // scene markers are preserved here so existing save files still load to the
  // right stage without a state migration — GameCanvas routes both through the
  // dispatcher.
  if (scenario.id === 'front-desk-check-in') return 'pointClickAdventure';
  if (hasAdventureConfigForScenarioIndex(scenarioIndex)) return 'stage3dAdventure';
  return 'dialogue';
}

function getSceneAfterStageCompletion(nextScenarioIndex: number, completedScenarioIds: string[]): GameScene {
  if (completedScenarioIds.length >= lessonScenarios.length) return 'title';
  return getScenarioStartScene(getScenarioByIndex(nextScenarioIndex), nextScenarioIndex);
}

function createStagePracticeReport(attempts: PronunciationAttempt[], phrases: ThaiPhrase[]): string[] {
  const lessonAttempts = attempts.filter((attempt) => !attempt.isReview);
  if (lessonAttempts.length === 0) {
    return [
      'No pronunciation attempts were recorded for this stage. Replay the lesson and say each phrase out loud.',
    ];
  }

  const scoredAttempts = lessonAttempts.filter((attempt) => !attempt.isSkipped);
  const averageScore = scoredAttempts.length
    ? Math.round(scoredAttempts.reduce((total, attempt) => total + attempt.score, 0) / scoredAttempts.length)
    : 0;
  const missedAttempts = lessonAttempts.filter((attempt) => !attempt.pass).sort((a, b) => a.score - b.score);
  const hardestAttempts = (missedAttempts.length ? missedAttempts : lessonAttempts)
    .slice()
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);
  const passedCount = lessonAttempts.filter((attempt) => attempt.pass).length;
  const skippedCount = lessonAttempts.filter((attempt) => attempt.isSkipped).length;
  const phrasesTouched = new Set(lessonAttempts.map((attempt) => attempt.phraseId)).size;

  const report = [
    `Stage score: ${passedCount}/${phrases.length} phrases passed, average ${averageScore}/100 across ${scoredAttempts.length} spoken attempt${scoredAttempts.length === 1 ? '' : 's'}.`,
    `Coverage: ${phrasesTouched}/${phrases.length} phrases practiced${skippedCount ? `, ${skippedCount} skipped` : ''}.`,
  ];

  hardestAttempts.forEach((attempt, index) => {
    const focus = attempt.isSkipped
      ? `Say "${attempt.romanization}" from scratch and connect it to "${attempt.translation}".`
      : attempt.tip || attempt.feedback || `Repeat "${attempt.romanization}" slowly, then at normal speed.`;
    report.push(`Focus ${index + 1}: ${attempt.translation} (${attempt.romanization}) - ${focus}`);
  });

  if (missedAttempts.length === 0 && skippedCount === 0) {
    report.push('Next practice: keep the same rhythm, then speed up without losing the final polite sound.');
  }

  return report;
}

export const useGameStore = create<GameStore>((set, get) => ({
  currentScene: 'title',
  hasStarted: false,
  completedTutorial: false,
  activeScenarioIndex: 0,
  replayScenarioIndex: null,
  completedScenarioIds: [],
  playerPosition: startPosition,
  targetPosition: null,
  dialogueIndex: 0,
  battle: createInitialBattleState(),
  saveData: null,
  hasSavedGame: false,

  hydrateSave: () => {
    const saveData = loadSave();
    if (!saveData) return;

    set({
      hasStarted: saveData.hasStarted,
      completedTutorial: saveData.completedTutorial,
      activeScenarioIndex: getScenarioIndex(saveData.activeScenarioIndex ?? 0),
      completedScenarioIds: saveData.completedScenarioIds ?? [],
      playerPosition: saveData.lastPlayerPosition,
      saveData,
      hasSavedGame: true,
    });
  },

  startAdventure: () => {
    const scenario = getScenarioByIndex(0);
    const saveData = saveProgress(true, false, startPosition, 0, []);
    set({
      currentScene: getScenarioStartScene(scenario, 0),
      hasStarted: true,
      completedTutorial: false,
      activeScenarioIndex: 0,
      replayScenarioIndex: null,
      completedScenarioIds: [],
      playerPosition: startPosition,
      targetPosition: null,
      dialogueIndex: 0,
      battle: createBattleStateForScenario(scenario),
      saveData,
      hasSavedGame: true,
    });
  },

  continueAdventure: () => {
    const saveData = get().saveData ?? loadSave();
    if (!saveData) {
      get().startAdventure();
      return;
    }

    const activeScenarioIndex = getScenarioIndex(saveData.activeScenarioIndex ?? 0);
    const scenario = getScenarioByIndex(activeScenarioIndex);

    set({
      currentScene: getScenarioStartScene(scenario, activeScenarioIndex),
      hasStarted: saveData.hasStarted,
      completedTutorial: saveData.completedTutorial,
      activeScenarioIndex,
      replayScenarioIndex: null,
      completedScenarioIds: saveData.completedScenarioIds ?? [],
      playerPosition: saveData.lastPlayerPosition,
      targetPosition: null,
      dialogueIndex: 0,
      battle: createBattleStateForScenario(scenario),
      saveData,
      hasSavedGame: true,
    });
  },

  jumpToScenario: (scenarioIndex) => {
    const clampedIndex = getScenarioIndex(scenarioIndex);
    const { activeScenarioIndex, completedScenarioIds, completedTutorial, playerPosition } = get();
    const scenario = getScenarioByIndex(clampedIndex);
    const startScene = getScenarioStartScene(scenario, clampedIndex);
    const isReplay = clampedIndex < activeScenarioIndex;

    if (isReplay) {
      // Replay an older stage without rolling the forward bookmark back.
      set({
        currentScene: startScene,
        replayScenarioIndex: clampedIndex,
        targetPosition: null,
        dialogueIndex: 0,
        battle: createBattleStateForScenario(scenario),
      });
      return;
    }

    // Forward jump (or current stage). Move the bookmark and persist.
    const saveData = saveProgress(
      true,
      completedTutorial,
      playerPosition,
      clampedIndex,
      completedScenarioIds,
    );
    set({
      currentScene: startScene,
      hasStarted: true,
      activeScenarioIndex: clampedIndex,
      replayScenarioIndex: null,
      saveData,
      hasSavedGame: true,
      targetPosition: null,
      dialogueIndex: 0,
      battle: createBattleStateForScenario(scenario),
    });
  },

  getScenarioStatus: (scenarioIndex) => {
    const clampedIndex = getScenarioIndex(scenarioIndex);
    const { activeScenarioIndex, completedScenarioIds } = get();
    const scenario = lessonScenarios[clampedIndex];
    if (scenario && completedScenarioIds.includes(scenario.id)) return 'completed';
    if (clampedIndex === activeScenarioIndex) return 'current';
    return 'available';
  },

  setTargetPosition: (position) => {
    if (!isInsideMap(position) || get().currentScene !== 'overworld') return;
    set({ targetPosition: position });
  },

  setPlayerPosition: (position) => {
    if (!isInsideMap(position)) return;

    const { activeScenarioIndex, completedScenarioIds, completedTutorial, hasStarted, targetPosition } =
      get();
    const activeScenario = getScenarioByIndex(activeScenarioIndex);
    const shouldStartDialogue = isSamePosition(position, suPosition);
    const startScene = getScenarioStartScene(activeScenario, activeScenarioIndex);
    const reachedTarget = targetPosition ? isSamePosition(position, targetPosition) : false;
    const saveData = saveProgress(
      hasStarted,
      completedTutorial,
      position,
      activeScenarioIndex,
      completedScenarioIds,
    );

    set({
      playerPosition: position,
      saveData,
      hasSavedGame: true,
      currentScene: shouldStartDialogue ? startScene : get().currentScene,
      targetPosition: shouldStartDialogue || reachedTarget ? null : targetPosition,
      dialogueIndex: shouldStartDialogue ? 0 : get().dialogueIndex,
      battle: shouldStartDialogue ? createBattleStateForScenario(activeScenario) : get().battle,
    });
  },

  startTutorialDialogue: () => {
    const { currentScene, activeScenarioIndex } = get();
    if (currentScene !== 'overworld') return;

    const activeScenario = get().getActiveScenario();
    set({
      currentScene: getScenarioStartScene(activeScenario, activeScenarioIndex),
      targetPosition: null,
      dialogueIndex: 0,
      battle: createBattleStateForScenario(activeScenario),
    });
  },

  finishPointClickAdventure: () => {
    const activeScenario = get().getActiveScenario();
    if (activeScenario.id !== 'front-desk-check-in') return;

    set({
      currentScene: 'dialogue',
      targetPosition: null,
      dialogueIndex: 0,
      battle: createBattleStateForScenario(activeScenario),
    });
  },

  finishStage3DAdventure: () => {
    const {
      activeScenarioIndex,
      replayScenarioIndex,
      completedScenarioIds,
      completedTutorial,
      playerPosition,
    } = get();
    const isReplay = replayScenarioIndex !== null;
    const effectiveIndex = replayScenarioIndex ?? activeScenarioIndex;
    const completion = completeScenario(effectiveIndex, completedScenarioIds);
    const nextActiveIndex = isReplay ? activeScenarioIndex : completion.activeScenarioIndex;
    const nextCompletedTutorial = isReplay ? completedTutorial : completion.completedTutorial;
    const saveData = saveProgress(
      true,
      nextCompletedTutorial,
      playerPosition,
      nextActiveIndex,
      completion.completedScenarioIds,
    );
    set({
      currentScene: getSceneAfterStageCompletion(nextActiveIndex, completion.completedScenarioIds),
      activeScenarioIndex: nextActiveIndex,
      replayScenarioIndex: null,
      completedScenarioIds: completion.completedScenarioIds,
      completedTutorial: nextCompletedTutorial,
      saveData,
      hasSavedGame: true,
      targetPosition: null,
      battle: createBattleStateForScenario(getScenarioByIndex(nextActiveIndex)),
    });
  },

  getActiveScenario: () => {
    const { activeScenarioIndex, replayScenarioIndex } = get();
    return getScenarioByIndex(replayScenarioIndex ?? activeScenarioIndex);
  },

  getActivePhrases: () => {
    const { activeScenarioIndex, replayScenarioIndex } = get();
    return getScenarioPhrasesByIndex(replayScenarioIndex ?? activeScenarioIndex);
  },

  advanceDialogue: () => {
    const { dialogueIndex } = get();
    const dialogue = buildScenarioDialogue(get().getActiveScenario());
    if (dialogueIndex < dialogue.length - 1) {
      set({ dialogueIndex: dialogueIndex + 1 });
      return;
    }

    set({
      currentScene: 'battle',
      dialogueIndex: 0,
      battle: createBattleStateForScenario(get().getActiveScenario()),
    });
  },

  chooseBattleOption: (option) => {
    const { battle, completedTutorial, playerPosition } = get();
    if (battle.hasWon) return;

    const activePhrases = get().getActivePhrases();
    const displayedPhraseIndex = battle.reviewPhraseIndex ?? battle.phraseIndex;
    const phrase = activePhrases[displayedPhraseIndex] ?? activePhrases[0];
    const result = resolveBattleTurn(option, phrase);

    if (option === 'Try Previous Phrase Again') {
      const previousPhraseIndex = Math.max(0, battle.phraseIndex - 1);
      const previousPhrase = activePhrases[previousPhraseIndex] ?? phrase;

      set({
        battle: {
          ...battle,
          reviewPhraseIndex: previousPhraseIndex,
          log: [
            result.playerText,
            previousPhraseIndex === battle.phraseIndex
              ? 'Su says there is no previous phrase yet, so this one stays on the board.'
              : `Review phrase: ${previousPhrase.translation}.`,
            `Say it: ${previousPhrase.romanization}.`,
            'A review attempt does not advance the stage, but it can rebuild Courage.',
          ],
        },
      });
      return;
    }

    if (option === 'Skip Phrase') {
      const nextPhrasesPassed = Math.min(battle.phrasesPassed + 1, activePhrases.length);
      const nextPhraseIndex = Math.min(battle.phraseIndex + 1, activePhrases.length - 1);
      const nextCourage = Math.max(0, Math.min(battle.maxCourage, battle.courage + result.courageDelta));
      const hasWon = nextPhrasesPassed >= activePhrases.length;
      const nextPhrase = activePhrases[nextPhraseIndex] ?? phrase;
      const nextAttempts = [...battle.pronunciationAttempts, createSkippedAttempt(phrase)];
      const stagePracticeReport = hasWon
        ? createStagePracticeReport(nextAttempts, activePhrases)
        : battle.stagePracticeReport;
      const completion = hasWon ? completeActiveScenario(playerPosition, get()) : null;
      const saveData = completion?.saveData ?? get().saveData;

      set({
        completedTutorial: completion?.completedTutorial ?? completedTutorial,
        activeScenarioIndex: completion?.activeScenarioIndex ?? get().activeScenarioIndex,
        completedScenarioIds: completion?.completedScenarioIds ?? get().completedScenarioIds,
        saveData,
        hasSavedGame: true,
        battle: {
          ...battle,
          courage: nextCourage,
          phraseIndex: nextPhraseIndex,
          reviewPhraseIndex: null,
          phrasesPassed: nextPhrasesPassed,
          pronunciationAttempts: nextAttempts,
          stagePracticeReport,
          log: [
            result.playerText,
            'No Understanding gained. No Super charge gained.',
            result.courageDelta !== 0 ? `Courage ${result.courageDelta}.` : 'Courage holds steady.',
            result.enemyText,
            ...(hasWon
              ? [`You completed ${get().getActiveScenario().title}!`]
              : [`Next phrase: ${nextPhrase.translation}.`]),
          ],
          hasWon,
        },
      });
      return;
    }

    const nextConfidence = Math.max(0, battle.enemyConfidence - result.confidenceDamage);
    const nextCourage = Math.max(0, Math.min(battle.maxCourage, battle.courage + result.courageDelta));
    const hasWon = battle.phrasesPassed >= activePhrases.length;
    const log = [
      result.playerText,
      result.confidenceDamage > 0
        ? `Understanding +${result.confidenceDamage}.`
        : 'Use the mic to pass this phrase and build Understanding.',
      result.courageDelta !== 0
        ? `Courage ${result.courageDelta > 0 ? '+' : ''}${result.courageDelta}.`
        : 'Courage holds steady.',
      result.enemyText,
      ...(hasWon
        ? [`You completed ${get().getActiveScenario().title}!`]
        : [`Current phrase: ${phrase.translation}.`]),
    ];

    const completion = hasWon ? completeActiveScenario(playerPosition, get()) : null;
    const saveData = completion?.saveData ?? get().saveData;

    set({
      completedTutorial: completion?.completedTutorial ?? completedTutorial,
      activeScenarioIndex: completion?.activeScenarioIndex ?? get().activeScenarioIndex,
      completedScenarioIds: completion?.completedScenarioIds ?? get().completedScenarioIds,
      saveData,
      hasSavedGame: true,
      battle: {
        ...battle,
        enemyConfidence: nextConfidence,
        courage: nextCourage,
        reviewPhraseIndex: null,
        log,
        hasWon,
      },
    });
  },

  submitPronunciationResult: (pronunciation) => {
    const { battle, completedTutorial, playerPosition } = get();
    if (battle.hasWon) return;

    const activePhrases = get().getActivePhrases();
    const reviewPhraseIndex = battle.reviewPhraseIndex;
    const activePhraseIndex = reviewPhraseIndex ?? battle.phraseIndex;
    const phrase = activePhrases[activePhraseIndex] ?? activePhrases[0];
    const result = resolvePronunciationTurn(pronunciation, phrase);
    const nextAttempts = [
      ...battle.pronunciationAttempts,
      createPronunciationAttempt(phrase, pronunciation, reviewPhraseIndex !== null),
    ];

    if (reviewPhraseIndex !== null) {
      const nextCourage = Math.max(
        0,
        Math.min(battle.maxCourage, battle.courage + (pronunciation.pass ? 2 : -2)),
      );
      set({
        battle: {
          ...battle,
          courage: nextCourage,
          reviewPhraseIndex: null,
          pronunciationAttempts: nextAttempts,
          log: [
            result.playerText,
            pronunciation.heard ? `AI heard: ${pronunciation.heard}` : 'AI listened to your review attempt.',
            pronunciation.feedback,
            pronunciation.pass
              ? 'Review complete. Returning to the current phrase.'
              : 'Review needs another try later. Returning to the current phrase.',
            pronunciation.pass ? 'Courage +2.' : 'Courage -2.',
          ],
        },
      });
      return;
    }

    const nextPhraseIndex = result.shouldAdvancePhrase
      ? Math.min(battle.phraseIndex + 1, activePhrases.length - 1)
      : battle.phraseIndex;
    const nextPhrasesPassed = result.shouldAdvancePhrase
      ? Math.min(battle.phrasesPassed + 1, activePhrases.length)
      : battle.phrasesPassed;
    const nextConfidence = Math.max(0, battle.enemyConfidence - result.confidenceDamage);
    const nextCourage = Math.max(0, Math.min(battle.maxCourage, battle.courage + result.courageDelta));
    const nextSuperCharge = result.shouldAdvancePhrase
      ? Math.min(battle.maxSuperCharge, battle.superCharge + 1)
      : battle.superCharge;
    const hasWon = nextPhrasesPassed >= activePhrases.length;
    const nextPhrase = activePhrases[nextPhraseIndex] ?? phrase;
    const stagePracticeReport = hasWon
      ? createStagePracticeReport(nextAttempts, activePhrases)
      : battle.stagePracticeReport;
    const log = [
      result.playerText,
      pronunciation.heard ? `AI heard: ${pronunciation.heard}` : 'AI listened to your pronunciation.',
      pronunciation.feedback,
      ...(result.confidenceDamage > 0
        ? [`Understanding +${result.confidenceDamage}.`]
        : ['No Understanding gained. Try the phrase again.']),
      result.courageDelta !== 0
        ? `Courage ${result.courageDelta > 0 ? '+' : ''}${result.courageDelta}.`
        : 'Courage holds steady.',
      result.enemyText,
      ...(hasWon
        ? [`You completed ${get().getActiveScenario().title}!`]
        : [`Next phrase: ${nextPhrase.translation}.`]),
    ];

    const completion = hasWon ? completeActiveScenario(playerPosition, get()) : null;
    const saveData = completion?.saveData ?? get().saveData;

    set({
      completedTutorial: completion?.completedTutorial ?? completedTutorial,
      activeScenarioIndex: completion?.activeScenarioIndex ?? get().activeScenarioIndex,
      completedScenarioIds: completion?.completedScenarioIds ?? get().completedScenarioIds,
      saveData,
      hasSavedGame: true,
      battle: {
        ...battle,
        enemyConfidence: nextConfidence,
        courage: nextCourage,
        superCharge: nextSuperCharge,
        phraseIndex: nextPhraseIndex,
        reviewPhraseIndex: null,
        phrasesPassed: nextPhrasesPassed,
        pronunciationAttempts: nextAttempts,
        stagePracticeReport,
        log,
        hasWon,
      },
    });
  },

  skipBattle: () => {
    const { battle, playerPosition } = get();
    if (battle.hasWon) return;

    const completion = completeActiveScenario(playerPosition, get());
    const nextScenario = getScenarioByIndex(completion.activeScenarioIndex);

    set({
      currentScene: getSceneAfterStageCompletion(
        completion.activeScenarioIndex,
        completion.completedScenarioIds,
      ),
      replayScenarioIndex: null,
      completedTutorial: completion.completedTutorial,
      activeScenarioIndex: completion.activeScenarioIndex,
      completedScenarioIds: completion.completedScenarioIds,
      saveData: completion.saveData,
      hasSavedGame: true,
      targetPosition: null,
      battle: {
        ...createBattleStateForScenario(nextScenario),
        log: [
          `Skipped ahead to ${nextScenario.title}.`,
          `${nextScenario.location}: ${nextScenario.lessonGoal}`,
        ],
      },
    });
  },

  returnToOverworld: () => {
    // Returning to overworld always exits a replay session and snaps the
    // active battle back to whatever the forward bookmark points at.
    set((state) => {
      const forwardScenario = getScenarioByIndex(state.activeScenarioIndex);
      return {
        currentScene: 'overworld',
        replayScenarioIndex: null,
        targetPosition: null,
        battle: createBattleStateForScenario(forwardScenario),
      };
    });
  },

  returnToTitle: () => {
    set({
      currentScene: 'title',
      replayScenarioIndex: null,
      targetPosition: null,
      dialogueIndex: 0,
    });
  },

  clearAllProgress: () => {
    clearSave();
    set({
      currentScene: 'title',
      hasStarted: false,
      completedTutorial: false,
      activeScenarioIndex: 0,
      replayScenarioIndex: null,
      completedScenarioIds: [],
      playerPosition: startPosition,
      targetPosition: null,
      dialogueIndex: 0,
      battle: createInitialBattleState(),
      saveData: null,
      hasSavedGame: false,
    });
  },
}));

type PersistedScenarioCompletion = {
  saveData: SaveData;
  activeScenarioIndex: number;
  completedScenarioIds: string[];
  completedTutorial: boolean;
};

function completeActiveScenario(playerPosition: GridPosition, state: GameStore): PersistedScenarioCompletion {
  const isReplay = state.replayScenarioIndex !== null;
  const effectiveIndex = state.replayScenarioIndex ?? state.activeScenarioIndex;
  const completion = completeScenario(effectiveIndex, state.completedScenarioIds);
  // Replays must not roll the player's forward bookmark.
  const nextActiveIndex = isReplay ? state.activeScenarioIndex : completion.activeScenarioIndex;
  const nextCompletedTutorial = isReplay ? state.completedTutorial : completion.completedTutorial;
  const saveData = saveProgress(
    true,
    nextCompletedTutorial,
    playerPosition,
    nextActiveIndex,
    completion.completedScenarioIds,
  );

  return {
    saveData,
    activeScenarioIndex: nextActiveIndex,
    completedScenarioIds: completion.completedScenarioIds,
    completedTutorial: nextCompletedTutorial,
  };
}
