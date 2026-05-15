import suBattleSpriteUrl from '../assets/battle/su-battle-sprite.png';
import { useGameStore } from '../store/gameStore';
import { TitleSpaceBackdrop } from './TitleSpaceBackdrop';

export function TitleScreen() {
  const hasSavedGame = useGameStore((state) => state.hasSavedGame);
  const completedTutorial = useGameStore((state) => state.completedTutorial);
  const startAdventure = useGameStore((state) => state.startAdventure);
  const continueAdventure = useGameStore((state) => state.continueAdventure);

  return (
    <main className="title-screen title-vn title-space relative h-dvh min-h-[640px] w-screen overflow-hidden bg-[#020312] text-slate-50">
      <TitleSpaceBackdrop />
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

            <div className="mt-4 max-w-2xl border border-cyan-100/35 bg-slate-950/58 p-4 shadow-[0_20px_60px_rgba(2,6,23,0.5)] backdrop-blur-md sm:p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="bg-cyan-200 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-slate-950">Su</span>
                <span className="h-px flex-1 bg-cyan-100/30" />
              </div>
              <p className="text-base font-black leading-relaxed text-slate-50 sm:text-lg">
                You fell through the rift again, Patrick. This time, every Thai phrase is a choice that changes the scene.
              </p>
            </div>
          </div>

          <div className="relative min-h-[22rem] sm:min-h-[29rem]">
            <div className="absolute inset-x-6 bottom-6 top-6 rotate-2 border border-cyan-100/30 bg-gradient-to-br from-white/10 via-cyan-200/10 to-fuchsia-300/12 shadow-[0_0_70px_rgba(34,211,238,0.22)] backdrop-blur-[2px]" />
            <div className="absolute right-0 top-8 z-0 h-28 w-28 border border-yellow-100/40 bg-yellow-200/16 shadow-[0_0_35px_rgba(250,204,21,0.28)] sm:right-6 sm:h-36 sm:w-36" />
            <div className="absolute left-2 top-16 z-0 h-20 w-20 -rotate-12 border border-fuchsia-100/40 bg-fuchsia-300/18 shadow-[0_0_35px_rgba(217,70,239,0.26)] sm:left-0 sm:h-28 sm:w-28" />
            <img
              src={suBattleSpriteUrl}
              alt="Su"
              className="absolute bottom-0 left-1/2 z-10 h-[min(66vh,34rem)] max-h-full -translate-x-1/2 object-contain drop-shadow-[0_0_36px_rgba(34,211,238,0.28)] sm:h-[min(64vh,35rem)]"
              draggable={false}
            />
            <div className="absolute bottom-4 right-2 z-20 rotate-3 border border-cyan-100/50 bg-slate-950/72 px-4 py-2 text-sm font-black uppercase tracking-[0.14em] text-cyan-50 shadow-[0_0_26px_rgba(34,211,238,0.24)] backdrop-blur-md sm:bottom-2 sm:right-4">
              Language Coach
            </div>
          </div>
        </div>

        <div className="relative z-20 grid gap-3 border border-cyan-100/35 bg-slate-950/66 p-3 text-slate-50 shadow-[0_22px_80px_rgba(2,6,23,0.58)] backdrop-blur-md sm:grid-cols-[1fr_auto] sm:p-3">
          <div className="grid grid-cols-3 gap-2 text-center text-[9px] font-black uppercase tracking-[0.08em] text-slate-200 sm:max-w-md sm:text-[10px]">
            <div className="border border-fuchsia-100/35 bg-fuchsia-300/12 px-2 py-3">
              <span className="block text-lg text-fuchsia-200">10</span>
              Scenes
            </div>
            <div className="border border-cyan-100/35 bg-cyan-300/12 px-2 py-3">
              <span className="block text-lg text-cyan-200">Gear</span>
              Rewards
            </div>
            <div className="border border-yellow-100/35 bg-yellow-200/12 px-2 py-3">
              <span className="block text-lg text-yellow-100">Voice</span>
              Choices
            </div>
          </div>

          <div className="grid gap-2 sm:w-72">
            {hasSavedGame ? (
              <button
                type="button"
                onClick={continueAdventure}
                className="border border-cyan-100/70 bg-cyan-300 px-5 py-3 text-left text-sm font-black uppercase tracking-[0.14em] text-slate-950 shadow-[0_0_30px_rgba(34,211,238,0.28)] transition-transform hover:-translate-y-0.5 active:translate-y-1 sm:text-base"
              >
                Continue
              </button>
            ) : null}
            <button
              type="button"
              onClick={startAdventure}
              className="border border-fuchsia-100/70 bg-fuchsia-400 px-5 py-3 text-left text-sm font-black uppercase tracking-[0.14em] text-white shadow-[0_0_30px_rgba(217,70,239,0.32)] transition-transform hover:-translate-y-0.5 active:translate-y-1 sm:text-base"
            >
              Start Adventure
            </button>
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
