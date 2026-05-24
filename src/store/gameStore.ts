import { create } from 'zustand';
import { type LessonScenario } from '../data/lessonScenarios';
import { startPosition, suPosition, type GridPosition } from '../data/map';
import { type ThaiPhrase } from '../data/thaiPhrases';
import { buildScenarioDialogue } from '../data/dialogue';
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
import { loadSave, writeSave, type SaveData } from '../systems/saveSystem';

export type GameScene = 'title' | 'overworld' | 'pointClickAdventure' | 'dialogue' | 'battle';

type GameStore = {
  currentScene: GameScene;
  hasStarted: boolean;
  completedTutorial: boolean;
  activeScenarioIndex: number;
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
  setTargetPosition: (position: GridPosition) => void;
  setPlayerPosition: (position: GridPosition) => void;
  startTutorialDialogue: () => void;
  finishPointClickAdventure: () => void;
  getActiveScenario: () => LessonScenario;
  getActivePhrases: () => LessonScenario['chunks'][number]['phrases'];
  advanceDialogue: () => void;
  chooseBattleOption: (option: BattleOption) => void;
  submitPronunciationResult: (result: PronunciationBattleResult) => void;
  skipBattle: () => void;
  returnToOverworld: () => void;
};

function saveProgress(
  hasStarted: boolean,
  completedTutorial: boolean,
  lastPlayerPosition: GridPosition,
  activeScenarioIndex: number,
  completedScenarioIds: string[],
): SaveData {
  const saveData = createSaveSnapshot(hasStarted, completedTutorial, lastPlayerPosition, activeScenarioIndex, completedScenarioIds);
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

function getScenarioStartScene(scenario: LessonScenario): GameScene {
  return scenario.id === 'front-desk-check-in' ? 'pointClickAdventure' : 'dialogue';
}

function createStagePracticeReport(attempts: PronunciationAttempt[], phrases: ThaiPhrase[]): string[] {
  const lessonAttempts = attempts.filter((attempt) => !attempt.isReview);
  if (lessonAttempts.length === 0) {
    return ['No pronunciation attempts were recorded for this stage. Replay the lesson and say each phrase out loud.'];
  }

  const scoredAttempts = lessonAttempts.filter((attempt) => !attempt.isSkipped);
  const averageScore = scoredAttempts.length
    ? Math.round(scoredAttempts.reduce((total, attempt) => total + attempt.score, 0) / scoredAttempts.length)
    : 0;
  const missedAttempts = lessonAttempts
    .filter((attempt) => !attempt.pass)
    .sort((a, b) => a.score - b.score);
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
    const saveData = saveProgress(true, false, startPosition, 0, []);
    set({
      currentScene: 'overworld',
      hasStarted: true,
      completedTutorial: false,
      activeScenarioIndex: 0,
      completedScenarioIds: [],
      playerPosition: startPosition,
      targetPosition: null,
      dialogueIndex: 0,
      battle: createInitialBattleState(),
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

    set({
      currentScene: 'overworld',
      hasStarted: saveData.hasStarted,
      completedTutorial: saveData.completedTutorial,
      activeScenarioIndex: getScenarioIndex(saveData.activeScenarioIndex ?? 0),
      completedScenarioIds: saveData.completedScenarioIds ?? [],
      playerPosition: saveData.lastPlayerPosition,
      targetPosition: null,
      dialogueIndex: 0,
      battle: createInitialBattleState(),
      saveData,
      hasSavedGame: true,
    });
  },

  setTargetPosition: (position) => {
    if (!isInsideMap(position) || get().currentScene !== 'overworld') return;
    set({ targetPosition: position });
  },

  setPlayerPosition: (position) => {
    if (!isInsideMap(position)) return;

    const { activeScenarioIndex, completedScenarioIds, completedTutorial, hasStarted, targetPosition } = get();
    const activeScenario = getScenarioByIndex(activeScenarioIndex);
    const shouldStartDialogue = isSamePosition(position, suPosition);
    const startScene = getScenarioStartScene(activeScenario);
    const reachedTarget = targetPosition ? isSamePosition(position, targetPosition) : false;
    const saveData = saveProgress(hasStarted, completedTutorial, position, activeScenarioIndex, completedScenarioIds);

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
    const { currentScene } = get();
    if (currentScene !== 'overworld') return;

    const activeScenario = get().getActiveScenario();
    set({
      currentScene: getScenarioStartScene(activeScenario),
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

  getActiveScenario: () => {
    const { activeScenarioIndex } = get();
    return getScenarioByIndex(activeScenarioIndex);
  },

  getActivePhrases: () => {
    const { activeScenarioIndex } = get();
    return getScenarioPhrasesByIndex(activeScenarioIndex);
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
      const stagePracticeReport = hasWon ? createStagePracticeReport(nextAttempts, activePhrases) : battle.stagePracticeReport;
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
            ...(hasWon ? [`You completed ${get().getActiveScenario().title}!`] : [`Next phrase: ${nextPhrase.translation}.`]),
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
      result.confidenceDamage > 0 ? `Understanding +${result.confidenceDamage}.` : 'Use the mic to pass this phrase and build Understanding.',
      result.courageDelta !== 0 ? `Courage ${result.courageDelta > 0 ? '+' : ''}${result.courageDelta}.` : 'Courage holds steady.',
      result.enemyText,
      ...(hasWon ? [`You completed ${get().getActiveScenario().title}!`] : [`Current phrase: ${phrase.translation}.`]),
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
      const nextCourage = Math.max(0, Math.min(battle.maxCourage, battle.courage + (pronunciation.pass ? 2 : -2)));
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
            pronunciation.pass ? 'Review complete. Returning to the current phrase.' : 'Review needs another try later. Returning to the current phrase.',
            pronunciation.pass ? 'Courage +2.' : 'Courage -2.',
          ],
        },
      });
      return;
    }

    const nextPhraseIndex = result.shouldAdvancePhrase ? Math.min(battle.phraseIndex + 1, activePhrases.length - 1) : battle.phraseIndex;
    const nextPhrasesPassed = result.shouldAdvancePhrase ? Math.min(battle.phrasesPassed + 1, activePhrases.length) : battle.phrasesPassed;
    const nextConfidence = Math.max(0, battle.enemyConfidence - result.confidenceDamage);
    const nextCourage = Math.max(0, Math.min(battle.maxCourage, battle.courage + result.courageDelta));
    const nextSuperCharge = result.shouldAdvancePhrase ? Math.min(battle.maxSuperCharge, battle.superCharge + 1) : battle.superCharge;
    const hasWon = nextPhrasesPassed >= activePhrases.length;
    const nextPhrase = activePhrases[nextPhraseIndex] ?? phrase;
    const stagePracticeReport = hasWon ? createStagePracticeReport(nextAttempts, activePhrases) : battle.stagePracticeReport;
    const log = [
      result.playerText,
      pronunciation.heard ? `AI heard: ${pronunciation.heard}` : 'AI listened to your pronunciation.',
      pronunciation.feedback,
      ...(result.confidenceDamage > 0 ? [`Understanding +${result.confidenceDamage}.`] : ['No Understanding gained. Try the phrase again.']),
      result.courageDelta !== 0 ? `Courage ${result.courageDelta > 0 ? '+' : ''}${result.courageDelta}.` : 'Courage holds steady.',
      result.enemyText,
      ...(hasWon ? [`You completed ${get().getActiveScenario().title}!`] : [`Next phrase: ${nextPhrase.translation}.`]),
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
      currentScene: 'overworld',
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
    set({
      currentScene: 'overworld',
      targetPosition: null,
      battle: createBattleStateForScenario(get().getActiveScenario()),
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
  const completion = completeScenario(state.activeScenarioIndex, state.completedScenarioIds);
  const saveData = saveProgress(
    true,
    completion.completedTutorial,
    playerPosition,
    completion.activeScenarioIndex,
    completion.completedScenarioIds,
  );

  return {
    ...completion,
    saveData,
  };
}
