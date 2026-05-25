import { useState } from 'react';
import { getMicrogamesForStage, type Stage, stageTitles } from '../../data/microgames';
import { MicrogameRunner } from './MicrogameRunner';

/**
 * Entry point for the microgame system. Lets the player pick stage 1, 2, or 3
 * and hands control to the runner. Mounted at the `/microgames` route AND
 * launched directly from the title screen via the "Microgames" button.
 *
 * Kept intentionally simple — three big buttons, one tap → playing. The hub
 * itself is the "main menu" of the microgame mode.
 */
export function MicrogameHub({ onExit }: { onExit?: () => void }) {
  const [activeStage, setActiveStage] = useState<Stage | null>(null);

  if (activeStage !== null) {
    return (
      <MicrogameRunner
        stage={activeStage}
        games={getMicrogamesForStage(activeStage)}
        onExit={() => setActiveStage(null)}
      />
    );
  }

  return (
    <main className="microgame-hub fixed inset-0 z-[90] flex flex-col bg-ink text-paper">
      <header className="microgame-hub__header flex items-center justify-between gap-3 border-b border-hairline px-5 py-4 sm:px-8">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-accent">Bonus Mode</p>
          <h1 className="font-display text-2xl font-black uppercase tracking-tight text-paper sm:text-3xl">
            Thai Microgames
          </h1>
        </div>
        {onExit ? (
          <button
            type="button"
            onClick={onExit}
            aria-label="Back to title"
            className="grid h-10 w-10 place-items-center rounded-full border border-hairline text-base text-paper transition hover:border-accent hover:text-accent"
          >
            ✕
          </button>
        ) : null}
      </header>

      <section className="flex-1 overflow-y-auto px-5 py-6 sm:px-8 sm:py-8">
        <p className="mx-auto mb-6 max-w-2xl text-center text-sm text-paper-muted sm:text-base">
          WarioWare-style bursts. One command, a few seconds, instant feedback. Five microgames per stage. No
          microphone needed — every game is mouse / touch friendly.
        </p>

        <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
          {([1, 2, 3] as const).map((stage) => {
            const games = getMicrogamesForStage(stage);
            return (
              <button
                key={stage}
                type="button"
                onClick={() => setActiveStage(stage)}
                className="group flex flex-col gap-3 rounded-xl border border-hairline bg-ink-elevated px-5 py-6 text-left transition hover:-translate-y-0.5 hover:border-accent hover:shadow-card"
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-display text-4xl font-black text-paper">
                    {String(stage).padStart(2, '0')}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-paper-muted">
                    {games.length} games
                  </span>
                </div>
                <p className="font-display text-base font-black uppercase tracking-tight text-paper">
                  {stageTitles[stage]}
                </p>
                <ul className="mt-2 flex flex-col gap-1 text-xs text-paper-muted">
                  {games.slice(0, 4).map((g) => (
                    <li key={g.id} className="truncate">
                      · {g.title}
                    </li>
                  ))}
                  {games.length > 4 ? <li className="truncate">… +{games.length - 4} more</li> : null}
                </ul>
                <span className="mt-3 inline-flex items-center gap-1.5 self-start rounded-md bg-accent px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-ink transition group-hover:bg-[#93EFFB]">
                  ▶ Play
                </span>
              </button>
            );
          })}
        </div>

        <p className="mx-auto mt-8 max-w-2xl text-center text-[10px] uppercase tracking-[0.22em] text-paper-quiet">
          Tip: stages 4-10 will get microgames in a later pass.
        </p>
      </section>
    </main>
  );
}
