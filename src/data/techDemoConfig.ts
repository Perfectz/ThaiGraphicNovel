/**
 * Tech-demo configuration shared across UIs that need to know which stages
 * are playable. Stages 4-10 still exist as data + adventure configs so the
 * engine never sees a gap, but the player can't enter them from any UI.
 * Bump TECH_DEMO_PLAYABLE_STAGE_COUNT as more stages reach production
 * polish (when the demo expands beyond a 3-stage cut).
 *
 * Consumed by: LevelSelect (lock cards), LessonRoadmap (dim locked rows),
 * TitleScreen (header chip).
 */
export const TECH_DEMO_PLAYABLE_STAGE_COUNT = 3;

export function isStageLocked(scenarioIndex: number): boolean {
  return scenarioIndex >= TECH_DEMO_PLAYABLE_STAGE_COUNT;
}
