import { create } from 'zustand';
import { lessonScenarios, starterScenario, type LessonScenario } from '../data/lessonScenarios';
import { suThaiBasicsTrial } from '../data/enemies';
import { startPosition, suPosition, type GridPosition } from '../data/map';
import { buildScenarioDialogue } from '../data/dialogue';
import {
  resolveBattleTurn,
  resolvePronunciationTurn,
  type BattleOption,
  type PronunciationBattleResult,
} from '../systems/battleSystem';
import { isInsideMap, isSamePosition } from '../systems/movement';
import { loadSave, writeSave, type SaveData } from '../systems/saveSystem';

export type GameScene = 'title' | 'overworld' | 'dialogue' | 'battle';

export type BattleState = {
  enemyName: string;
  enemyConfidence: number;
  enemyMaxConfidence: number;
  courage: number;
  maxCourage: number;
  superCharge: number;
  maxSuperCharge: number;
  phraseIndex: number;
  reviewPhraseIndex: number | null;
  phrasesPassed: number;
  log: string[];
  hasWon: boolean;
};

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
  getActiveScenario: () => LessonScenario;
  getActivePhrases: () => LessonScenario['chunks'][number]['phrases'];
  advanceDialogue: () => void;
  chooseBattleOption: (option: BattleOption) => void;
  submitPronunciationResult: (result: PronunciationBattleResult) => void;
  skipBattle: () => void;
  returnToOverworld: () => void;
};

const initialBattleState = (): BattleState => ({
  enemyName: suThaiBasicsTrial.name,
  enemyConfidence: suThaiBasicsTrial.maxConfidence,
  enemyMaxConfidence: suThaiBasicsTrial.maxConfidence,
  courage: 22,
  maxCourage: 30,
  superCharge: 0,
  maxSuperCharge: 3,
  phraseIndex: 0,
  reviewPhraseIndex: null,
  phrasesPassed: 0,
  log: [
    suThaiBasicsTrial.openingLine,
    `${starterScenario.title}: say each phrase clearly with your voice to complete the lesson.`,
  ],
  hasWon: false,
});

function getScenarioIndex(index: number): number {
  return Math.max(0, Math.min(index, lessonScenarios.length - 1));
}

function getScenarioPhrases(index: number) {
  const scenario = lessonScenarios[getScenarioIndex(index)] ?? lessonScenarios[0];
  return scenario.chunks.flatMap((chunk) => chunk.phrases);
}

function saveProgress(
  hasStarted: boolean,
  completedTutorial: boolean,
  lastPlayerPosition: GridPosition,
  activeScenarioIndex: number,
  completedScenarioIds: string[],
): SaveData {
  const saveData = {
    hasStarted,
    completedTutorial,
    activeScenarioIndex: getScenarioIndex(activeScenarioIndex),
    completedScenarioIds,
    lastPlayerPosition,
  };
  writeSave(saveData);
  return saveData;
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
  battle: initialBattleState(),
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
      battle: initialBattleState(),
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
      battle: initialBattleState(),
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
    const activeScenario = lessonScenarios[activeScenarioIndex] ?? lessonScenarios[0];
    const shouldStartDialogue = isSamePosition(position, suPosition);
    const reachedTarget = targetPosition ? isSamePosition(position, targetPosition) : false;
    const saveData = saveProgress(hasStarted, completedTutorial, position, activeScenarioIndex, completedScenarioIds);

    set({
      playerPosition: position,
      saveData,
      hasSavedGame: true,
      currentScene: shouldStartDialogue ? 'dialogue' : get().currentScene,
      targetPosition: shouldStartDialogue || reachedTarget ? null : targetPosition,
      dialogueIndex: shouldStartDialogue ? 0 : get().dialogueIndex,
      battle: shouldStartDialogue ? initialBattleStateForScenario(activeScenario) : get().battle,
    });
  },

  startTutorialDialogue: () => {
    const { currentScene } = get();
    if (currentScene !== 'overworld') return;

    set({
      currentScene: 'dialogue',
      targetPosition: null,
      dialogueIndex: 0,
    });
  },

  getActiveScenario: () => {
    const { activeScenarioIndex } = get();
    return lessonScenarios[getScenarioIndex(activeScenarioIndex)] ?? lessonScenarios[0];
  },

  getActivePhrases: () => {
    const { activeScenarioIndex } = get();
    return getScenarioPhrases(activeScenarioIndex);
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
      battle: initialBattleStateForScenario(get().getActiveScenario()),
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

    if (reviewPhraseIndex !== null) {
      const nextCourage = Math.max(0, Math.min(battle.maxCourage, battle.courage + (pronunciation.pass ? 2 : -2)));
      set({
        battle: {
          ...battle,
          courage: nextCourage,
          reviewPhraseIndex: null,
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
        log,
        hasWon,
      },
    });
  },

  skipBattle: () => {
    const { battle, playerPosition } = get();
    if (battle.hasWon) return;

    const completion = completeActiveScenario(playerPosition, get());
    const nextScenario = lessonScenarios[completion.activeScenarioIndex] ?? lessonScenarios[0];

    set({
      currentScene: 'overworld',
      completedTutorial: completion.completedTutorial,
      activeScenarioIndex: completion.activeScenarioIndex,
      completedScenarioIds: completion.completedScenarioIds,
      saveData: completion.saveData,
      hasSavedGame: true,
      targetPosition: null,
      battle: {
        ...initialBattleStateForScenario(nextScenario),
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
      battle: initialBattleStateForScenario(get().getActiveScenario()),
    });
  },
}));

function initialBattleStateForScenario(scenario: LessonScenario): BattleState {
  const phraseCount = scenario.chunks.reduce((count, chunk) => count + chunk.phrases.length, 0);

  return {
    ...initialBattleState(),
    enemyConfidence: phraseCount * 10,
    enemyMaxConfidence: phraseCount * 10,
    log: [
      `${scenario.title}: ${scenario.storyGoal}`,
      `Clear ${phraseCount} phrases to reach ${scenario.equipmentReward.name}.`,
    ],
  };
}

type ScenarioCompletion = {
  saveData: SaveData;
  activeScenarioIndex: number;
  completedScenarioIds: string[];
  completedTutorial: boolean;
};

function completeActiveScenario(playerPosition: GridPosition, state: GameStore): ScenarioCompletion {
  const scenario = state.getActiveScenario();
  const completedScenarioIds = Array.from(new Set([...state.completedScenarioIds, scenario.id]));
  const nextScenarioIndex = getScenarioIndex(state.activeScenarioIndex + 1);
  const completedTutorial = completedScenarioIds.includes(lessonScenarios[0].id);
  const saveData = saveProgress(true, completedTutorial, playerPosition, nextScenarioIndex, completedScenarioIds);

  return {
    saveData,
    activeScenarioIndex: nextScenarioIndex,
    completedScenarioIds,
    completedTutorial,
  };
}
