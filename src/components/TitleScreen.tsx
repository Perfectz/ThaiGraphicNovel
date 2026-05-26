import { lazy, Suspense, useCallback, useState } from 'react';
import { useActiveScenarioIndex, useHasSavedGame, useNavigationActions } from '../store/selectors';
import { getScenarioByIndex } from '../domain/scenarioRules';
import { TECH_DEMO_PLAYABLE_STAGE_COUNT } from '../data/techDemoConfig';
import { getBrowserAdvisory } from '../services/browserCapabilities';
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
  const [aboutOpen, setAboutOpen] = useState(false);

  const openLevelSelect = useCallback(() => setLevelSelectOpen(true), []);
  const closeLevelSelect = useCallback(() => setLevelSelectOpen(false), []);
  const openAbout = useCallback(() => setAboutOpen(true), []);
  const closeAbout = useCallback(() => setAboutOpen(false), []);

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
          {/* Eyebrow above the logo as a single typographic cluster.
              The tech-demo chip sits beside the episode label so first-time
              players see the scope ("3 stages, not 10") before they click
              Start — sets the right expectation. */}
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-display text-[10px] font-bold uppercase tracking-[0.32em] text-[#67E8F9]">
              Bangkok Rift · Episode 01
            </p>
            <span
              className="rounded-full border border-[#67E8F9]/40 bg-[#67E8F9]/10 px-2.5 py-0.5 font-display text-[9px] font-bold uppercase tracking-[0.24em] text-[#67E8F9]"
              title="This build ships the first 3 of 10 planned stages."
            >
              Tech demo · {TECH_DEMO_PLAYABLE_STAGE_COUNT} stages
            </span>
          </div>

          {/* Hero cluster — logo + tagline */}
          <div className="flex min-w-0 flex-col gap-5">
            <img
              src={logoUrl}
              alt="Isekai Thai Quest"
              className="title-modern-logo block h-auto w-full max-w-[36rem] select-none"
              draggable={false}
            />
            <p className="max-w-lg text-base font-medium leading-relaxed text-[#F4F1EB]/85 sm:text-lg">
              Patrick falls through a magic rift into Bangkok and learns survival Thai with Su, an AI tutor
              princess. <span className="text-[#67E8F9]">3-stage demo, about 20 minutes.</span> Mic optional —
              read &amp; tap mode included.
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
                onClick={openAbout}
                className="title-modern-button title-modern-button--ghost"
              >
                <span aria-hidden="true">ⓘ</span>
                <span>About</span>
              </button>
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

      {/* About modal — first-time players who land cold need to know
          what this is, who made it, and what's NOT in this build. Kept
          lightweight (a single div overlay, no Modal import) so the
          title screen's initial bundle doesn't pull in the modal chrome
          just for an info popup. */}
      {aboutOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="title-about-heading"
          className="fixed inset-0 z-[80] grid place-items-center bg-black/80 backdrop-blur-sm px-4"
          onClick={closeAbout}
        >
          <div
            className="relative max-w-xl rounded-md border border-[#67E8F9]/30 bg-[#15171B] p-6 text-[#F4F1EB] shadow-2xl sm:p-8"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="font-display text-[10px] font-bold uppercase tracking-[0.32em] text-[#67E8F9]">
              About this build
            </p>
            <h2
              id="title-about-heading"
              className="mt-2 font-display text-2xl font-black uppercase tracking-tight"
            >
              Bangkok Rift — tech demo
            </h2>
            <div className="mt-4 grid gap-3 text-sm leading-relaxed text-[#F4F1EB]/80">
              <p>
                A Thai-language adventure where Patrick — recently fallen through a magic rift — learns
                survival Thai by living in Bangkok. Su, an AI tutor princess, drills him on phrases the player
                must pronounce (or tap, in No-mic mode) to advance.
              </p>
              <p>
                This build ships <span className="text-[#67E8F9]">3 of 10 planned stages</span>: hotel lobby
                (greetings &amp; needs), front desk (check-in &amp; room queries), night market (food ordering
                &amp; payment). Plays in ~20 minutes.
              </p>
              <p className="text-[#F4F1EB]/60">
                Built with React, Three.js, OpenAI Realtime, and local Whisper. Voice judging by{' '}
                <span className="text-[#67E8F9]">OpenAI</span> or local{' '}
                <span className="text-[#67E8F9]">Whisper</span> — or skip the mic entirely with No-mic mode in
                Settings.
              </p>
              <p className="text-[#F4F1EB]/60">
                Best on desktop Chrome or Safari. Mobile works but with reduced visual polish.
              </p>
              {getBrowserAdvisory() ? (
                <p className="rounded-md border border-[#67E8F9]/30 bg-[#67E8F9]/10 p-2 text-[#67E8F9]">
                  {getBrowserAdvisory()}
                </p>
              ) : null}
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={closeAbout}
                className="title-modern-button title-modern-button--primary"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
