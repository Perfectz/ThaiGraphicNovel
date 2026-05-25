import { lazy, Suspense, useCallback, useState } from 'react';
import { useActiveScenarioIndex, useHasSavedGame, useNavigationActions } from '../store/selectors';
import { getScenarioByIndex } from '../domain/scenarioRules';
import logoUrl from '../assets/branding/isekai-thai-quest-logo.svg';

// Three.js is the largest dependency in the app (~400kb). Lazy-loading it lets the
// title screen's text/CTA paint in the first frame; the 3D scene streams in after.
const TitleThreeScene = lazy(() =>
  import('./TitleThreeScene').then((module) => ({ default: module.TitleThreeScene })),
);

// LevelSelect is only mounted when the user opens it. No reason to ship it in the
// initial title bundle.
const LevelSelect = lazy(() => import('./LevelSelect').then((module) => ({ default: module.LevelSelect })));

export type TitleScreenProps = {
  /**
   * Opens the shared GameSettings modal owned by App.tsx so the title menu
   * has an explicit Settings entry (instead of relying on players spotting
   * the floating gear icon).
   */
  onOpenSettings: () => void;
};

export function TitleScreen({ onOpenSettings }: TitleScreenProps) {
  const hasSavedGame = useHasSavedGame();
  const activeScenarioIndex = useActiveScenarioIndex();
  const { startAdventure, continueAdventure } = useNavigationActions();
  const [levelSelectOpen, setLevelSelectOpen] = useState(false);

  const openLevelSelect = useCallback(() => setLevelSelectOpen(true), []);
  const closeLevelSelect = useCallback(() => setLevelSelectOpen(false), []);

  const resumeScenario = hasSavedGame ? getScenarioByIndex(activeScenarioIndex) : null;

  return (
    <main className="title-screen title-modern relative h-dvh min-h-dvh w-screen overflow-hidden bg-[#0A0A0B] text-[#F4F1EB] lg:min-h-[620px]">
      <Suspense fallback={null}>
        <TitleThreeScene />
      </Suspense>
      <div className="title-modern-haze pointer-events-none absolute inset-0" />

      {/* Single 2-column grid for the entire title screen. Left column owns
          ALL chrome (eyebrow, logo, tagline, CTAs, status) stacked into one
          vertically-centered cluster — no more orphan eyebrow at top + a
          bottom-heavy logo. Right column is empty reserved space so the 3D Su
          portrait behind has breathing room; on mobile the chrome stretches
          full width. */}
      <section className="relative z-10 mx-auto grid min-h-full w-full max-w-7xl grid-cols-1 items-center px-6 py-6 sm:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] sm:px-12 sm:py-8">
        <div className="relative z-10 flex min-w-0 flex-col gap-7">
          {/* Eyebrow above the logo as a single typographic cluster */}
          <p className="font-display text-[10px] font-bold uppercase tracking-[0.32em] text-[#67E8F9]">
            Bangkok Rift · Episode 01
          </p>

          {/* Hero cluster — logo + tagline */}
          <div className="flex min-w-0 flex-col gap-5">
            <img
              src={logoUrl}
              alt="Isekai Thai Quest"
              className="title-modern-logo block h-auto w-full max-w-[36rem] select-none"
              draggable={false}
            />
            <p className="max-w-lg text-base font-medium leading-relaxed text-[#F4F1EB]/85 sm:text-lg">
              Wake up in Bangkok with one spell:{' '}
              <span className="text-[#67E8F9]">learn Thai by living in it</span>. Su has 10 episodes ready.
            </p>
          </div>

          {/* Action zone — primary CTA + nav row + status line */}
          <nav aria-label="Title menu" className="relative z-20 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {hasSavedGame ? (
                <button
                  type="button"
                  onClick={continueAdventure}
                  className="title-modern-button title-modern-button--primary group"
                >
                  <span className="title-modern-button__chevron">▶</span>
                  <span>Continue</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startAdventure}
                  className="title-modern-button title-modern-button--primary group"
                >
                  <span className="title-modern-button__chevron">▶</span>
                  <span>Start</span>
                </button>
              )}
              <button
                type="button"
                onClick={openLevelSelect}
                className="title-modern-button title-modern-button--ghost"
              >
                <span aria-hidden="true">☷</span>
                <span>Level Select</span>
              </button>
              <button
                type="button"
                onClick={onOpenSettings}
                className="title-modern-button title-modern-button--ghost"
              >
                <span aria-hidden="true">⚙</span>
                <span>Settings</span>
              </button>
              {hasSavedGame ? (
                <button
                  type="button"
                  onClick={startAdventure}
                  className="title-modern-button title-modern-button--quiet"
                >
                  New Game
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
                  window.location.href = `${basePath}/battle-demo`;
                }}
                className="title-modern-button title-modern-button--ghost"
              >
                <span aria-hidden="true">⚔</span>
                <span>Battle Demo</span>
              </button>
              {/* Microgames — WarioWare-style bonus mode for stages 1-3. Hard
                  nav so the App's route detector mounts the hub on first paint. */}
              <button
                type="button"
                onClick={() => {
                  const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
                  window.location.href = `${basePath}/microgames`;
                }}
                className="title-modern-button title-modern-button--ghost"
              >
                <span aria-hidden="true">🎯</span>
                <span>Microgames</span>
              </button>
            </div>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#F4F1EB]/55">
              {resumeScenario
                ? `Stage ${activeScenarioIndex + 1} · ${resumeScenario.title}`
                : 'Chapter 1 · Chao Phraya Star Hotel'}
            </p>
          </nav>
        </div>

        {/* Right column reserved for 3D Su silhouette breathing room. No overlay chrome. */}
        <div className="hidden sm:block" aria-hidden="true" />
      </section>

      {levelSelectOpen ? (
        <Suspense fallback={null}>
          <LevelSelect isOpen={levelSelectOpen} onClose={closeLevelSelect} />
        </Suspense>
      ) : null}
    </main>
  );
}
