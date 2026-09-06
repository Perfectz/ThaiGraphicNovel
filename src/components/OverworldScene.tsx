import { useCallback } from 'react';
import { sukhumvitOverworld } from '../data/adventures/overworld-sukhumvit';
import { TECH_DEMO_PLAYABLE_STAGE_COUNT } from '../data/techDemoConfig';
import { useGameStore } from '../store/gameStore';
import { Stage3DAdventure } from './Stage3DAdventure';

/**
 * The walkable Sukhumvit overworld hub. Reuses the full Stage3DAdventure engine
 * (Patrick rig, movement, camera, collision) with the overworld config, and
 * wires the gate "portals" to the store: saying a gate's destination phrase
 * jumps into that stage. Locked gates carry no portal, so they're a no-op here.
 */
export function OverworldScene() {
  const jumpToScenario = useGameStore((state) => state.jumpToScenario);

  const handleEnterStage = useCallback(
    (scenarioIndex: number) => {
      if (scenarioIndex < 0 || scenarioIndex >= TECH_DEMO_PLAYABLE_STAGE_COUNT) return;
      jumpToScenario(scenarioIndex);
    },
    [jumpToScenario],
  );

  return <Stage3DAdventure key="sukhumvit-overworld" config={sukhumvitOverworld} onEnterStage={handleEnterStage} />;
}
