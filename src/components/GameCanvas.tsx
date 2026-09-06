import { getScenePresentation } from '../domain/scenePresentation';
import { useGameStore } from '../store/gameStore';
import { BattleHUD } from './BattleHUD';
import { ChapterCharacterLayer } from './ChapterCharacterLayer';
import { DialogueBox } from './DialogueBox';
import { OverworldScene } from './OverworldScene';
import { Stage3DAdventureDispatcher } from './Stage3DAdventureDispatcher';
import { StageErrorBoundary } from './StageErrorBoundary';

export function GameCanvas() {
  const currentScene = useGameStore((state) => state.currentScene);
  const activeScenarioIndex = useGameStore((state) => state.activeScenarioIndex);
  const battle = useGameStore((state) => state.battle);

  // Every gameplay stage (1–10) now renders through the data-driven
  // Stage3DAdventureDispatcher. Stage 1 ('dialogue' scene, index 0) and
  // Stage 2 ('pointClickAdventure' scene, index 1) previously routed through
  // bespoke `CharacterDebugPage` and `LevelTwoDebugPage` components — those
  // were retired in Q1 of the 2-year roadmap once their adventure-config
  // equivalents reached parity. The legacy scene names are preserved here so
  // existing save data and store transitions keep working without a state
  // migration; they just resolve to the dispatcher now.
  // The walkable Sukhumvit overworld hub — a full 3D scene (not the old static
  // VN panel). Routed before the stage check so it owns the 'overworld' scene.
  if (currentScene === 'overworld') {
    return (
      <StageErrorBoundary>
        <OverworldScene />
      </StageErrorBoundary>
    );
  }

  if (
    currentScene === 'stage3dAdventure' ||
    (currentScene === 'dialogue' && activeScenarioIndex === 0) ||
    (currentScene === 'pointClickAdventure' && activeScenarioIndex === 1)
  ) {
    // StageErrorBoundary catches any Three.js / GLTFLoader / scene-init
    // failure and offers Reload / Return-to-map / Report-bug recovery so
    // a single bad asset can't take down the whole demo.
    return (
      <StageErrorBoundary>
        <Stage3DAdventureDispatcher />
      </StageErrorBoundary>
    );
  }

  const { activeScenario, activeStage, focusCharacter } = getScenePresentation(
    currentScene,
    activeScenarioIndex,
    battle,
  );

  return (
    <main className="vn-game-shell relative h-dvh w-screen overflow-hidden bg-ink text-paper">
      <img
        src={activeStage.backgroundImage}
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        decoding="async"
        draggable={false}
      />
      {/* Subtle bottom vignette so the modern UI chrome reads against any background image. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[58%] bg-gradient-to-t from-ink/85 via-ink/30 to-transparent" />

      <header className="pointer-events-none absolute left-3 right-16 top-3 z-30 flex items-start justify-between gap-3 sm:left-6 sm:right-6 sm:top-5">
        <div className="rounded-md border border-hairline bg-ink-raised/90 px-3 py-2 shadow-card backdrop-blur-sm">
          <p className="font-display text-[0.6rem] font-bold uppercase tracking-[0.28em] text-accent">
            Stage {activeScenario.scenarioNumber}/10
          </p>
          <p className="mt-0.5 text-sm font-semibold leading-tight text-paper sm:text-base">
            {activeScenario.title}
          </p>
          <p className="text-[0.6rem] font-medium uppercase tracking-[0.22em] text-paper-muted">
            {activeStage.routeLabel} → {activeStage.nextRouteLabel}
          </p>
        </div>
      </header>

      <ChapterCharacterLayer characters={focusCharacter ? [focusCharacter] : []} />

      {currentScene === 'dialogue' ? <DialogueBox /> : null}
      {currentScene === 'battle' ? <BattleHUD /> : null}
    </main>
  );
}
