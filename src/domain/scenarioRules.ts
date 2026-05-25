import { suThaiBasicsTrial } from '../data/enemies';
import { lessonScenarios, starterScenario, type LessonScenario } from '../data/lessonScenarios';
import type { GridPosition } from '../data/map';

export type BattleState = {
  scenarioId: string;
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
  pronunciationAttempts: PronunciationAttempt[];
  stagePracticeReport: string[];
  log: string[];
  hasWon: boolean;
};

export type PronunciationAttempt = {
  phraseId: string;
  phrase: string;
  romanization: string;
  translation: string;
  score: number;
  pass: boolean;
  heard: string;
  feedback: string;
  tip: string;
  isReview: boolean;
  isSkipped: boolean;
};

export type ScenarioCompletion = {
  activeScenarioIndex: number;
  completedScenarioIds: string[];
  completedTutorial: boolean;
};

export function getScenarioIndex(index: number): number {
  return Math.max(0, Math.min(index, lessonScenarios.length - 1));
}

export function getScenarioByIndex(index: number): LessonScenario {
  return lessonScenarios[getScenarioIndex(index)] ?? starterScenario;
}

export function getScenarioPhrases(index: number): LessonScenario['chunks'][number]['phrases'] {
  return getScenarioByIndex(index).chunks.flatMap((chunk) => chunk.phrases);
}

export function createInitialBattleState(): BattleState {
  return {
    scenarioId: starterScenario.id,
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
    pronunciationAttempts: [],
    stagePracticeReport: [],
    log: [
      suThaiBasicsTrial.openingLine,
      `${starterScenario.title}: say each phrase clearly with your voice to complete the lesson.`,
    ],
    hasWon: false,
  };
}

export function createBattleStateForScenario(scenario: LessonScenario): BattleState {
  const phraseCount = scenario.chunks.reduce((count, chunk) => count + chunk.phrases.length, 0);

  return {
    ...createInitialBattleState(),
    scenarioId: scenario.id,
    enemyConfidence: phraseCount * 10,
    enemyMaxConfidence: phraseCount * 10,
    log: [
      `${scenario.title}: ${scenario.storyGoal}`,
      `Clear ${phraseCount} phrases to reach ${scenario.equipmentReward.name}.`,
    ],
  };
}

export function completeScenario(
  activeScenarioIndex: number,
  completedScenarioIds: string[],
): ScenarioCompletion {
  const scenario = getScenarioByIndex(activeScenarioIndex);
  const nextCompletedScenarioIds = Array.from(new Set([...completedScenarioIds, scenario.id]));
  const nextScenarioIndex = getScenarioIndex(activeScenarioIndex + 1);

  return {
    activeScenarioIndex: nextScenarioIndex,
    completedScenarioIds: nextCompletedScenarioIds,
    completedTutorial: nextCompletedScenarioIds.includes(lessonScenarios[0].id),
  };
}

export function createSaveSnapshot(
  hasStarted: boolean,
  completedTutorial: boolean,
  lastPlayerPosition: GridPosition,
  activeScenarioIndex: number,
  completedScenarioIds: string[],
) {
  return {
    hasStarted,
    completedTutorial,
    activeScenarioIndex: getScenarioIndex(activeScenarioIndex),
    completedScenarioIds,
    lastPlayerPosition,
  };
}
