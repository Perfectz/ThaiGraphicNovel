import { getScenePresentation } from '../domain/scenePresentation';
import { useGameStore } from '../store/gameStore';
import { BattleHUD } from './BattleHUD';
import { ChapterCharacterLayer } from './ChapterCharacterLayer';
import { DialogueBox } from './DialogueBox';
import { PointClickAdventureScene } from './PointClickAdventureScene';

export function GameCanvas() {
  const currentScene = useGameStore((state) => state.currentScene);
  const activeScenarioIndex = useGameStore((state) => state.activeScenarioIndex);
  const startTutorialDialogue = useGameStore((state) => state.startTutorialDialogue);
  const battle = useGameStore((state) => state.battle);
  const { activeScenario, activeStage, focusCharacter, focusLabel, focusLine, startLessonLabel } = getScenePresentation(
    currentScene,
    activeScenarioIndex,
    battle,
  );

  return (
    <main className="vn-game-shell relative h-dvh w-screen overflow-hidden bg-slate-950 text-slate-950">
      <img
        src={activeStage.backgroundImage}
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        decoding="async"
        draggable={false}
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,244,251,0.08),rgba(15,23,42,0.16)),radial-gradient(circle_at_78%_22%,rgba(34,211,238,0.12),transparent_24%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[58%] bg-gradient-to-t from-slate-950/62 via-slate-950/12 to-transparent" />

      <header className="pointer-events-none absolute left-3 right-16 top-3 z-30 flex items-start justify-between gap-3 sm:left-6 sm:right-6 sm:top-5">
        <div className="vn-glass-panel px-4 py-2">
          <p className="font-display text-[10px] font-black uppercase tracking-[0.18em] text-fuchsia-700">
            Stage {activeScenario.scenarioNumber}/10
          </p>
          <p className="mt-1 text-sm font-black leading-tight text-slate-950 sm:text-lg">{activeScenario.title}</p>
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-cyan-800">
            {activeStage.routeLabel} to {activeStage.nextRouteLabel}
          </p>
        </div>
      </header>

      <ChapterCharacterLayer characters={focusCharacter ? [focusCharacter] : []} />

      {currentScene === 'overworld' ? (
        <section className="vn-glass-panel pointer-events-auto absolute inset-x-3 bottom-[var(--vn-panel-bottom)] z-40 grid min-h-[9.5rem] gap-2 overflow-y-auto p-3 sm:inset-x-10 sm:grid-cols-[1fr_auto] sm:gap-4 sm:p-4 lg:inset-x-16">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2">
              <span className="vn-status-chip px-3 py-1 font-display text-xs font-black uppercase tracking-[0.16em]">
                {focusLabel}
              </span>
              <span className="h-px flex-1 bg-slate-950/25" />
            </div>
            <p className="text-base font-black leading-snug text-slate-950 sm:text-xl">
              {focusLine}
            </p>
          </div>
          <div className="grid gap-2 sm:w-64">
            <button
              type="button"
              onClick={startTutorialDialogue}
              className="vn-action-button bg-fuchsia-400 px-4 py-2.5 text-left text-sm font-black uppercase tracking-[0.14em] text-white sm:text-base"
            >
              {startLessonLabel}
            </button>
          </div>
        </section>
      ) : null}

      {currentScene === 'dialogue' ? <DialogueBox /> : null}
      {currentScene === 'pointClickAdventure' ? <PointClickAdventureScene /> : null}
      {currentScene === 'battle' ? <BattleHUD /> : null}
    </main>
  );
}
