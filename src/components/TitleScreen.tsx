import { useGameStore } from '../store/gameStore';
import { TitleThreeScene } from './TitleThreeScene';

function getCharacterDebugUrl() {
  const baseUrl = import.meta.env.BASE_URL;
  return `${baseUrl}${baseUrl.endsWith('/') ? '' : '/'}character-debug`;
}

export function TitleScreen() {
  const hasSavedGame = useGameStore((state) => state.hasSavedGame);
  const completedTutorial = useGameStore((state) => state.completedTutorial);
  const continueAdventure = useGameStore((state) => state.continueAdventure);

  return (
    <main className="title-screen title-vn title-space relative h-dvh min-h-[620px] w-screen overflow-hidden bg-[#020312] text-slate-50">
      <TitleThreeScene />
      <div className="title-space-haze absolute inset-0" />
      <div className="title-space-scan absolute inset-0" />

      <section className="relative z-10 mx-auto grid h-full w-full max-w-7xl grid-rows-[auto_1fr_auto] px-4 py-4 sm:px-8 sm:py-6">
        <header className="flex items-center justify-between gap-3">
          <div className="rounded-full border border-cyan-200/50 bg-slate-950/48 px-4 py-2 shadow-[0_0_32px_rgba(34,211,238,0.24)] backdrop-blur-md">
            <p className="font-display text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100 sm:text-xs">
              Bangkok Rift Visual Novel
            </p>
          </div>
          <div className="hidden -rotate-2 border border-fuchsia-200/50 bg-fuchsia-400/16 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-fuchsia-50 shadow-[0_0_28px_rgba(217,70,239,0.28)] backdrop-blur-md sm:block">
            Episode 01
          </div>
        </header>

        <div className="grid min-h-0 grid-cols-1 items-end gap-3 pb-3 pt-4 sm:grid-cols-[minmax(0,0.95fr)_minmax(20rem,0.7fr)] sm:gap-5 sm:pt-4">
          <div className="relative z-10 min-w-0 self-center">
            <div className="mb-4 inline-flex rotate-[-2deg] items-center gap-2 border border-cyan-200/60 bg-cyan-300/18 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-50 shadow-[0_0_28px_rgba(34,211,238,0.3)] backdrop-blur-md sm:text-xs">
              <span className="h-2.5 w-2.5 rounded-full bg-fuchsia-300 shadow-[0_0_18px_rgba(240,171,252,0.9)]" />
              Su Route Unlocked
            </div>

            <h1 className="title-space-logo max-w-3xl font-display text-[clamp(3.1rem,10vw,6.4rem)] font-black uppercase leading-[0.82] text-white">
              <span className="block">Isekai</span>
              <span className="block text-cyan-200">Thai Quest</span>
            </h1>

            <div className="title-panel-glass mt-4 max-w-2xl p-4 sm:p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="bg-cyan-200 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-slate-950">Su</span>
                <span className="h-px flex-1 bg-cyan-100/30" />
              </div>
              <p className="text-base font-black leading-relaxed text-slate-50 sm:text-lg">
                Patrick wakes in the Chao Phraya Star Hotel. Su is across the room, and the first spell is learning how to say hello.
              </p>
            </div>
          </div>

          <div className="relative min-h-[20rem] sm:min-h-[29rem]" aria-hidden="true">
            <div className="absolute bottom-4 right-2 z-20 rotate-3 border border-cyan-100/50 bg-slate-950/72 px-4 py-2 text-sm font-black uppercase tracking-[0.14em] text-cyan-50 shadow-[0_0_26px_rgba(34,211,238,0.24)] backdrop-blur-md sm:bottom-2 sm:right-4">
              3D Su Online
            </div>
            <div className="absolute right-4 top-10 z-20 max-w-52 border border-fuchsia-100/40 bg-fuchsia-400/14 px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-fuchsia-50 shadow-[0_0_30px_rgba(217,70,239,0.24)] backdrop-blur-md sm:right-10">
              Rift training field active
            </div>
          </div>
        </div>

        <div className="relative z-20 flex justify-end pb-1">
          <div className="title-panel-glass grid gap-2 p-3 text-slate-50 sm:w-72">
            {hasSavedGame ? (
              <button
                type="button"
                onClick={continueAdventure}
                className="vn-action-button bg-cyan-300 px-5 py-3 text-left text-sm font-black uppercase tracking-[0.14em] text-slate-950 sm:text-base"
              >
                Continue
              </button>
            ) : null}
            <a
              href={getCharacterDebugUrl()}
              className="vn-action-button bg-fuchsia-400 px-5 py-3 text-left text-sm font-black uppercase tracking-[0.14em] text-white sm:text-base"
            >
              Start Level 1
            </a>
            {completedTutorial ? (
              <p className="border-2 border-emerald-950 bg-emerald-100 px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em] text-emerald-900">
                Save found: tutorial battle completed
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
