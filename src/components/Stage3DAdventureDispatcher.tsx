import { useMemo } from 'react';
import { getAdventureConfigByScenarioIndex } from '../data/adventures/registry';
import { useGameStore } from '../store/gameStore';
import { Stage3DAdventure } from './Stage3DAdventure';
import { Button } from './ui';

/**
 * Resolves the 3D adventure config from the store's active scenario index
 * and renders a fresh Stage3DAdventure with a key tied to the scenario so the
 * Three.js engine fully remounts when the player moves between stages.
 */
export function Stage3DAdventureDispatcher() {
  const activeScenarioIndex = useGameStore((state) => state.activeScenarioIndex);
  const finishStage = useGameStore((state) => state.finishStage3DAdventure);
  const returnToOverworld = useGameStore((state) => state.returnToOverworld);

  const config = useMemo(() => getAdventureConfigByScenarioIndex(activeScenarioIndex), [activeScenarioIndex]);

  if (!config) {
    return (
      <main
        role="alert"
        className="grid h-dvh w-screen place-items-center bg-ink px-6 text-center text-paper"
      >
        <div className="flex max-w-md flex-col items-center gap-4">
          <p className="font-display text-[0.65rem] font-bold uppercase tracking-[0.28em] text-accent">
            Stage missing
          </p>
          <h1 className="font-display text-xl font-black uppercase tracking-tight text-paper">
            No 3D adventure registered for scenario #{activeScenarioIndex + 1}.
          </h1>
          <Button variant="primary" onClick={returnToOverworld}>
            Return to map
          </Button>
        </div>
      </main>
    );
  }

  return (
    <Stage3DAdventure
      key={config.scenarioId}
      config={config}
      onComplete={finishStage}
      onReturnToOverworld={returnToOverworld}
    />
  );
}
