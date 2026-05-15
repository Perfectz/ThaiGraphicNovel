import { buildScenarioDialogue } from '../data/dialogue';
import { lessonScenarios } from '../data/lessonScenarios';
import { useGameStore } from '../store/gameStore';

export function DialogueBox() {
  const dialogueIndex = useGameStore((state) => state.dialogueIndex);
  const activeScenarioIndex = useGameStore((state) => state.activeScenarioIndex);
  const advanceDialogue = useGameStore((state) => state.advanceDialogue);
  const activeScenario = lessonScenarios[activeScenarioIndex] ?? lessonScenarios[0];
  const scenarioDialogue = buildScenarioDialogue(activeScenario);
  const line = scenarioDialogue[dialogueIndex] ?? scenarioDialogue[0];
  const isLastLine = dialogueIndex === scenarioDialogue.length - 1;

  return (
    <section className="pointer-events-auto absolute inset-x-3 bottom-[var(--vn-panel-bottom)] z-50 h-[var(--vn-panel-height)] sm:inset-x-10 lg:inset-x-16">
      <button
        type="button"
        onClick={advanceDialogue}
        className="h-full w-full overflow-y-auto border-[3px] border-slate-950 bg-white/96 p-3 text-left shadow-[8px_8px_0_#0f172a] backdrop-blur active:translate-y-1 sm:px-5 sm:py-4"
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="bg-slate-950 px-3 py-1 font-display text-xs font-black uppercase tracking-[0.18em] text-white sm:text-sm">
            {line.speaker}
          </span>
          <span className="vn-outline-label text-[11px] font-black uppercase tracking-[0.16em] sm:text-xs">
            {isLastLine ? 'Start lesson' : 'Next'}
          </span>
        </div>
        <p className="vn-outline-text max-w-5xl text-base font-black leading-snug sm:text-xl">{line.text}</p>
        {line.thai ? (
          <div className="mt-2 grid gap-1 border-2 border-emerald-950 bg-emerald-100 px-3 py-2 sm:grid-cols-[auto_1fr] sm:items-end sm:gap-3">
            <p className="vn-outline-text text-xl font-black leading-none sm:text-2xl">{line.thai}</p>
            <p className="vn-outline-subtext text-xs font-bold uppercase tracking-[0.14em] sm:text-sm">{line.translation}</p>
          </div>
        ) : null}
      </button>
    </section>
  );
}
