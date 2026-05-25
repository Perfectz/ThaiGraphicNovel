import { lessonScenarios } from '../lessonScenarios';
import { stageOneAdventure } from './stage01-hotel-lobby';
import { stageTwoAdventure } from './stage02-front-desk';
import { stageThreeAdventure } from './stage03-night-market';
import { stageFourAdventure } from './stage04-taxi-stand';
import { stageFiveAdventure } from './stage05-floating-market';
import { stageSixAdventure } from './stage06-clinic';
import { stageSevenAdventure } from './stage07-cafe';
import { stageEightAdventure } from './stage08-alley';
import { stageNineAdventure } from './stage09-embassy';
import { stageTenAdventure } from './stage10-rift-gate';
import type { AdventureSceneConfig } from './types';

/**
 * Registry of 3D adventure configurations keyed by scenario id.
 *
 * Stages 1–10 are all data-driven adventure-config 3D scenes rendered by
 * `Stage3DAdventureDispatcher`. The legacy bespoke renderers
 * (CharacterDebugPage for Stage 1, LevelTwoDebugPage for Stage 2) were
 * retired in Q1 of the 2-year roadmap once the data-driven entries below
 * reached parity. GameCanvas routes the `'dialogue'` and
 * `'pointClickAdventure'` scene markers through the dispatcher when the
 * active scenario has a config registered here.
 */
export const adventureConfigsByScenarioId: Record<string, AdventureSceneConfig> = {
  [stageOneAdventure.scenarioId]: stageOneAdventure,
  [stageTwoAdventure.scenarioId]: stageTwoAdventure,
  [stageThreeAdventure.scenarioId]: stageThreeAdventure,
  [stageFourAdventure.scenarioId]: stageFourAdventure,
  [stageFiveAdventure.scenarioId]: stageFiveAdventure,
  [stageSixAdventure.scenarioId]: stageSixAdventure,
  [stageSevenAdventure.scenarioId]: stageSevenAdventure,
  [stageEightAdventure.scenarioId]: stageEightAdventure,
  [stageNineAdventure.scenarioId]: stageNineAdventure,
  [stageTenAdventure.scenarioId]: stageTenAdventure,
};

export function getAdventureConfigByScenarioId(scenarioId: string): AdventureSceneConfig | null {
  return adventureConfigsByScenarioId[scenarioId] ?? null;
}

export function getAdventureConfigByScenarioIndex(scenarioIndex: number): AdventureSceneConfig | null {
  const scenario = lessonScenarios[scenarioIndex];
  if (!scenario) return null;
  return adventureConfigsByScenarioId[scenario.id] ?? null;
}

export function hasAdventureConfigForScenarioIndex(scenarioIndex: number): boolean {
  return getAdventureConfigByScenarioIndex(scenarioIndex) !== null;
}
