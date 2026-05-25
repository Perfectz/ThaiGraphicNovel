import { useShallow } from 'zustand/react/shallow';
import { lessonScenarios, type LessonScenario } from '../data/lessonScenarios';
import { stageThemes, type StageTheme } from '../data/stageThemes';
import { getScenarioByIndex } from '../domain/scenarioRules';
import { useGameStore, type ScenarioStatus } from './gameStore';

/**
 * Strongly-typed, encapsulated selector hooks. Components import these instead
 * of pulling raw fields from {@link useGameStore} directly. Benefits:
 *
 *   - Stable contracts: callers depend on the hook name, not the store shape.
 *     Refactoring the store doesn't require touching every component.
 *   - Re-render hygiene: shallow-compared composites + cached derivations
 *     avoid re-renders when unrelated state changes.
 *   - Discoverability: a single file lists every meaningful store read pattern.
 *
 * Convention: every hook here starts with `use`, returns either a primitive
 * (cheap) or a frozen/immutable composite (via {@link useShallow}). Never
 * return a fresh object/array literal from a non-shallow hook — it would
 * trigger a re-render every store update.
 */

/** The current top-level scene the App router should render. */
export const useCurrentScene = () => useGameStore((s) => s.currentScene);

/** Has the player ever started a game (across sessions, via save data)? */
export const useHasSavedGame = () => useGameStore((s) => s.hasSavedGame);

/** Has the player completed the tutorial battle? */
export const useCompletedTutorial = () => useGameStore((s) => s.completedTutorial);

/** The player's forward progression bookmark — the next scenario to play. */
export const useActiveScenarioIndex = () => useGameStore((s) => s.activeScenarioIndex);

/**
 * Snapshot of progression state used by the title screen and Level Select.
 * Shallow-compared so the hook only re-renders when one of the four fields
 * actually changes.
 */
export const useProgressionSnapshot = () =>
  useGameStore(
    useShallow((s) => ({
      activeScenarioIndex: s.activeScenarioIndex,
      replayScenarioIndex: s.replayScenarioIndex,
      completedScenarioIds: s.completedScenarioIds,
      hasSavedGame: s.hasSavedGame,
    })),
  );

/**
 * The scenario currently in play (replay-aware). Returns the resolved
 * {@link LessonScenario} so callers don't need to know about the replay flag.
 */
export const useActiveScenario = (): LessonScenario => {
  const activeIndex = useGameStore((s) => s.activeScenarioIndex);
  const replayIndex = useGameStore((s) => s.replayScenarioIndex);
  return getScenarioByIndex(replayIndex ?? activeIndex);
};

/**
 * Status of a specific scenario by index (completed / current / available).
 * Recomputed when either the bookmark or completion set changes.
 */
export const useScenarioStatus = (scenarioIndex: number): ScenarioStatus => {
  const getScenarioStatus = useGameStore((s) => s.getScenarioStatus);
  // Subscribe to the inputs so React re-runs the selector when they change.
  useGameStore((s) => s.activeScenarioIndex);
  useGameStore((s) => s.completedScenarioIds);
  return getScenarioStatus(scenarioIndex);
};

/** Stable lookup of a stage theme by scenario id (memoized at module scope). */
const stageThemeById = new Map<string, StageTheme>();
stageThemes.forEach((theme) => stageThemeById.set(theme.scenarioId, theme));
export function getStageThemeByScenarioId(scenarioId: string): StageTheme {
  return stageThemeById.get(scenarioId) ?? stageThemes[0];
}

/** The full ordered scenario list — exposed as a hook for parity even though it's static. */
export const useLessonScenarios = (): ReadonlyArray<LessonScenario> => lessonScenarios;

/**
 * Bundle of navigation actions. Stable identity across renders (Zustand
 * actions are static references), so this can be used in dependency arrays
 * without churn.
 */
export const useNavigationActions = () =>
  useGameStore(
    useShallow((s) => ({
      startAdventure: s.startAdventure,
      continueAdventure: s.continueAdventure,
      jumpToScenario: s.jumpToScenario,
      returnToOverworld: s.returnToOverworld,
    })),
  );

/** Battle state — large object, only subscribe when the component actually renders battle UI. */
export const useBattleState = () => useGameStore((s) => s.battle);
