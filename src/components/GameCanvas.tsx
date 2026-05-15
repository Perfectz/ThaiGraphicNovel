import { getChapterCharacters, type ChapterCharacterReaction } from '../data/chapterCharacters';
import { lessonScenarios } from '../data/lessonScenarios';
import { getStageTheme } from '../data/stageThemes';
import { suReactions } from '../data/suReactions';
import { useGameStore } from '../store/gameStore';
import { BattleHUD } from './BattleHUD';
import { ChapterCharacterLayer } from './ChapterCharacterLayer';
import { DialogueBox } from './DialogueBox';

export function GameCanvas() {
  const currentScene = useGameStore((state) => state.currentScene);
  const activeScenarioIndex = useGameStore((state) => state.activeScenarioIndex);
  const startTutorialDialogue = useGameStore((state) => state.startTutorialDialogue);
  const battle = useGameStore((state) => state.battle);
  const activeScenario = lessonScenarios[activeScenarioIndex] ?? lessonScenarios[0];
  const activeStage = getStageTheme(activeScenarioIndex);
  const isBattle = currentScene === 'battle';
  const chapterCharacterReaction: ChapterCharacterReaction =
    currentScene === 'battle' ? (battle.hasWon ? 'playful' : 'determined') : currentScene === 'dialogue' ? 'explaining' : 'smile';
  const chapterCharacters = getChapterCharacters(activeScenarioIndex, chapterCharacterReaction);
  const chapterFocusCharacter = chapterCharacters[0] ?? null;
  const isSuFocused = activeScenarioIndex === 0;
  const focusCharacter = isSuFocused
    ? {
        id: 'su',
        image:
          currentScene === 'battle'
            ? battle.hasWon
              ? suReactions.smile
              : suReactions.determined
            : currentScene === 'dialogue'
              ? suReactions.explaining
              : suReactions.smile,
        alt: 'Su',
        label: 'Su',
        className: `${
          isBattle
            ? 'right-[-3.75rem] h-[min(60dvh,36rem)] sm:right-[7vw] sm:h-[min(68dvh,44rem)]'
            : 'right-[-4.5rem] h-[min(64dvh,39rem)] sm:right-[5vw] sm:h-[min(72dvh,48rem)]'
        }`,
      }
    : chapterFocusCharacter
      ? {
          ...chapterFocusCharacter,
          label: chapterFocusCharacter.alt,
        }
      : null;
  const focusLabel = focusCharacter?.label ?? activeScenario.title;
  const focusLine = isSuFocused
    ? `Welcome back to ${activeScenario.location}. Start the lesson when you are ready.`
    : `${focusLabel} is waiting at ${activeScenario.location}. Start the lesson when you are ready.`;
  const startLessonLabel = isSuFocused ? 'Train with Su' : 'Start Lesson';

  return (
    <main className="vn-game-shell relative h-dvh w-screen overflow-hidden bg-slate-950 text-slate-950">
      <img
        src={activeStage.backgroundImage}
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        draggable={false}
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,244,251,0.16),rgba(15,23,42,0.2)),radial-gradient(circle_at_78%_22%,rgba(34,211,238,0.16),transparent_26%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-slate-950/58 via-slate-950/16 to-transparent" />

      <header className="pointer-events-none absolute left-3 right-16 top-3 z-30 flex items-start justify-between gap-3 sm:left-6 sm:right-6 sm:top-5">
        <div className="border-[3px] border-slate-950 bg-white/94 px-4 py-2 shadow-[5px_5px_0_#0f172a] backdrop-blur">
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
        <section className="pointer-events-auto absolute inset-x-3 bottom-[var(--vn-panel-bottom)] z-40 grid h-[var(--vn-panel-height)] gap-2 overflow-y-auto border-[3px] border-slate-950 bg-white/95 p-3 shadow-[8px_8px_0_#0f172a] backdrop-blur sm:inset-x-10 sm:grid-cols-[1fr_auto] sm:gap-4 sm:p-4 lg:inset-x-16">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2">
              <span className="bg-slate-950 px-3 py-1 font-display text-xs font-black uppercase tracking-[0.16em] text-white">
                {focusLabel}
              </span>
              <span className="h-px flex-1 bg-slate-950/25" />
            </div>
            <p className="vn-outline-text text-base font-black leading-snug sm:text-xl">
              {focusLine}
            </p>
          </div>
          <div className="grid gap-2 sm:w-64">
            <button
              type="button"
              onClick={startTutorialDialogue}
              className="border-[3px] border-slate-950 bg-fuchsia-400 px-4 py-2.5 text-left text-sm font-black uppercase tracking-[0.14em] text-white shadow-[5px_5px_0_#0f172a] active:translate-y-1 sm:text-base"
            >
              {startLessonLabel}
            </button>
          </div>
        </section>
      ) : null}

      {currentScene === 'dialogue' ? <DialogueBox /> : null}
      {currentScene === 'battle' ? <BattleHUD /> : null}
    </main>
  );
}
