import { getChapterCharacters, type ChapterCharacterReaction, type ChapterCharacterSprite } from '../data/chapterCharacters';
import { lessonScenarios } from '../data/lessonScenarios';
import { getStageTheme } from '../data/stageThemes';
import { suReactions, type SuReaction } from '../data/suReactions';
import { getScenarioByIndex, type BattleState } from './scenarioRules';

type SceneName = 'title' | 'overworld' | 'pointClickAdventure' | 'dialogue' | 'battle';

const stageOnePhraseReactions: ChapterCharacterReaction[] = [
  'explaining',
  'smile',
  'playful',
  'explaining',
  'surprised',
  'determined',
  'playful',
  'explaining',
  'surprised',
  'determined',
];

export type FocusCharacter = ChapterCharacterSprite & {
  label: string;
};

export function getScenePresentation(currentScene: SceneName, activeScenarioIndex: number, battle: BattleState) {
  const displayScenarioIndex = getDisplayScenarioIndex(currentScene, activeScenarioIndex, battle);
  const activeScenario = getScenarioByIndex(displayScenarioIndex);
  const activeStage = getStageTheme(displayScenarioIndex);
  const isBattle = currentScene === 'battle';
  const chapterCharacterReaction: ChapterCharacterReaction =
    currentScene === 'battle'
      ? battle.hasWon
        ? 'playful'
        : 'determined'
      : currentScene === 'dialogue' || currentScene === 'pointClickAdventure'
        ? 'explaining'
        : 'smile';
  const chapterCharacters = getChapterCharacters(displayScenarioIndex, chapterCharacterReaction);
  const isSuFocused = displayScenarioIndex === 0;
  const focusCharacter = getFocusCharacter({
    activeScenario,
    battle,
    chapterCharacters,
    currentScene,
    isBattle,
    isSuFocused,
  });
  const focusLabel = focusCharacter?.label ?? activeScenario.title;

  return {
    activeScenario,
    activeStage,
    focusCharacter,
    focusLabel,
    focusLine: isSuFocused
      ? `Welcome back to ${activeScenario.location}. Start the lesson when you are ready.`
      : `${focusLabel} is waiting at ${activeScenario.location}. Start the lesson when you are ready.`,
    startLessonLabel: isSuFocused ? 'Train with Su' : 'Start Lesson',
  };
}

function getDisplayScenarioIndex(currentScene: SceneName, activeScenarioIndex: number, battle: BattleState) {
  if (currentScene !== 'battle' || !battle.hasWon) return activeScenarioIndex;
  const completedScenarioIndex = lessonScenarios.findIndex((scenario) => scenario.id === battle.scenarioId);
  if (completedScenarioIndex >= 0) return completedScenarioIndex;
  return Math.max(0, activeScenarioIndex - 1);
}

function getFocusCharacter({
  activeScenario,
  battle,
  chapterCharacters,
  currentScene,
  isBattle,
  isSuFocused,
}: {
  activeScenario: ReturnType<typeof getScenarioByIndex>;
  battle: BattleState;
  chapterCharacters: ChapterCharacterSprite[];
  currentScene: SceneName;
  isBattle: boolean;
  isSuFocused: boolean;
}): FocusCharacter | null {
  if (isSuFocused) {
    const suReaction = getStageOneSuReaction(currentScene, activeScenario, battle);

    return {
      id: 'su',
      scenarioId: 'hotel-lobby-basics',
      image: suReactions[suReaction],
      alt: 'Su',
      label: 'Su',
      className: `${isBattle ? 'vn-stage-one-su-battle' : 'vn-stage-one-su'} vn-su-reaction-${suReaction}`,
    };
  }

  const chapterFocusCharacter = chapterCharacters[0] ?? null;
  return chapterFocusCharacter
    ? {
        ...chapterFocusCharacter,
        label: chapterFocusCharacter.alt,
      }
    : null;
}

function getStageOneSuReaction(
  currentScene: SceneName,
  activeScenario: ReturnType<typeof getScenarioByIndex>,
  battle: BattleState,
): SuReaction {
  if (currentScene === 'battle') {
    if (battle.hasWon) return 'excellent';
    if (battle.reviewPhraseIndex !== null) return 'listening';

    const activePhrases = activeScenario.chunks.flatMap((chunk) => chunk.phrases);
    const currentPhrase = activePhrases[battle.phraseIndex] ?? activePhrases[0];
    const lastAttempt = battle.pronunciationAttempts[battle.pronunciationAttempts.length - 1] ?? null;

    if (lastAttempt?.phraseId === currentPhrase?.id) {
      if (lastAttempt.isSkipped) return 'failure';
      if (lastAttempt.pass && lastAttempt.score >= 95) return 'excellent';
      if (lastAttempt.pass) return 'great';
      if (lastAttempt.score < 35) return 'failure';
      return 'tryHarder';
    }

    return stageOnePhraseReactions[battle.phraseIndex % stageOnePhraseReactions.length] ?? 'determined';
  }

  if (currentScene === 'dialogue' || currentScene === 'pointClickAdventure') return 'explaining';
  return 'smile';
}
