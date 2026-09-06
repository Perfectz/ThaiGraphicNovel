import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useActiveScenarioIndex, useHasSavedGame, useNavigationActions } from '../store/selectors';
import { getScenarioByIndex } from '../domain/scenarioRules';
import { getBrowserAdvisory } from '../services/browserCapabilities';
import { saveVoiceJudgeMode } from '../services/openAiSettings';
import logoUrl from '../assets/branding/isekai-thai-quest-logo.svg';
import {
  GearIcon,
  GridIcon,
  InfoIcon,
  MoreIcon,
  PlayIcon,
  SwordsIcon,
  TargetIcon,
} from './ui/TitleMenuIcons';

// Three.js is the largest dependency in the app (~400kb). Lazy-loading it lets the
// title screen's text/CTA paint in the first frame; the 3D scene streams in after.
const TitleThreeScene = lazy(() =>
  import('./TitleThreeScene').then((module) => ({ default: module.TitleThreeScene })),
);

// LevelSelect (carousel) and OverworldMap (Sukhumvit transit map) are only
// mounted when the user opens them — no reason to ship either in the initial
// title bundle. The map is the primary "where to next" entry; the carousel is
// kept reachable from the More menu.
const LevelSelect = lazy(() => import('./LevelSelect').then((module) => ({ default: module.LevelSelect })));
const OverworldMap = lazy(() =>
  import('./OverworldMap').then((module) => ({ default: module.OverworldMap })),
);

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
  const [mapOpen, setMapOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement | null>(null);

  const openLevelSelect = useCallback(() => setLevelSelectOpen(true), []);
  const closeLevelSelect = useCallback(() => setLevelSelectOpen(false), []);
  const openMap = useCallback(() => setMapOpen(true), []);
  const closeMap = useCallback(() => setMapOpen(false), []);
  const openAbout = useCallback(() => setAboutOpen(true), []);
  const closeAbout = useCallback(() => setAboutOpen(false), []);
  const startNoMicAdventure = useCallback(() => {
    saveVoiceJudgeMode('no-mic');
    startAdventure();
  }, [startAdventure]);
  const continueNoMicAdventure = useCallback(() => {
    saveVoiceJudgeMode('no-mic');
    continueAdventure();
  }, [continueAdventure]);

  // Secondary actions (About, Battle Demo, Microgames) live behind a single
  // "More" disclosure so the title's primary flow stays to three buttons.
  // Close it on outside-click or Escape so it never lingers over the scene.
  useEffect(() => {
    if (!moreOpen) return;
    function handlePointer(event: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) {
        setMoreOpen(false);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setMoreOpen(false);
    }
    window.addEventListener('mousedown', handlePointer);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handlePointer);
      window.removeEventListener('keydown', handleKey);
    };
  }, [moreOpen]);

  const goToRoute = useCallback((route: string) => {
    const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
    window.location.href = `${basePath}${route}`;
  }, []);

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
        <div className="relative z-10 flex min-w-0 flex-col gap-5">
          {/* Eyebrow — one short orienting line. Scope ("3-stage demo") now
              lives in the tagline, so the redundant tech-demo chip is gone. */}
          <p className="font-display text-[10px] font-bold uppercase tracking-[0.32em] text-[#67E8F9]">
            Bangkok Rift · Episode 01
          </p>

          {/* Hero cluster — logo + tagline */}
          <div className="flex min-w-0 flex-col gap-4">
            <img
              src={logoUrl}
              alt="Isekai Thai Quest"
              className="title-modern-logo block h-auto w-full max-w-[30rem] select-none"
              draggable={false}
            />
            <p className="max-w-lg text-sm font-medium leading-relaxed text-[#F4F1EB]/85 sm:text-base">
              Learn survival Thai in Bangkok with Su, your AI tutor.{' '}
              <span className="text-[#67E8F9]">3-stage demo, ~20 min.</span> Mic optional.
            </p>
          </div>

          {/* Action zone — primary CTA + nav row + status line */}
          <nav aria-label="Title menu" className="relative z-20 flex flex-col gap-3">
            {/* Hero resume card — a returning player's primary action is to
                continue, so surface the next stage by name instead of a bare
                button. New players see the plain Start CTA in the row below. */}
            {hasSavedGame && resumeScenario ? (
              <button
                type="button"
                onClick={continueAdventure}
                className="group flex w-full max-w-sm items-center gap-3 rounded-lg border border-[#67E8F9]/40 bg-gradient-to-r from-[#67E8F9]/15 to-[#67E8F9]/5 p-3 text-left transition-colors duration-150 hover:border-[#67E8F9] hover:from-[#67E8F9]/25"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#67E8F9] text-[#0A0A0B] transition-transform duration-150 group-hover:scale-105">
                  <PlayIcon className="text-xl" />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="font-display text-[9px] font-bold uppercase tracking-[0.3em] text-[#67E8F9]">
                    Resume · Stage {activeScenarioIndex + 1}
                  </span>
                  <span className="truncate font-display text-base font-black uppercase tracking-tight text-[#F4F1EB]">
                    {resumeScenario.title}
                  </span>
                </span>
              </button>
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
              {hasSavedGame ? null : (
                <button
                  type="button"
                  onClick={startAdventure}
                  className="title-modern-button title-modern-button--primary group"
                >
                  <span className="title-modern-button__chevron">
                    <PlayIcon />
                  </span>
                  <span>Start</span>
                </button>
              )}
              <button
                type="button"
                onClick={hasSavedGame ? continueNoMicAdventure : startNoMicAdventure}
                aria-label={hasSavedGame ? 'Resume without microphone' : 'Start without microphone'}
                className="title-modern-button title-modern-button--ghost"
              >
                <PlayIcon />
                <span>{hasSavedGame ? 'Resume No-Mic' : 'Start No-Mic'}</span>
              </button>
              <button
                type="button"
                onClick={openMap}
                className="title-modern-button title-modern-button--ghost"
              >
                <GridIcon />
                <span>Overworld Map</span>
              </button>
              <button
                type="button"
                onClick={onOpenSettings}
                className="title-modern-button title-modern-button--ghost"
              >
                <GearIcon />
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

              {/* Secondary actions — About + the two bonus modes — tucked
                  behind a single disclosure so the primary row stays short. */}
              <div ref={moreRef} className="relative">
                <button
                  type="button"
                  onClick={() => setMoreOpen((open) => !open)}
                  aria-haspopup="menu"
                  aria-expanded={moreOpen}
                  className="title-modern-button title-modern-button--ghost"
                >
                  <MoreIcon />
                  <span>More</span>
                </button>
                {moreOpen ? (
                  <div
                    role="menu"
                    className="absolute left-0 top-full z-30 mt-2 flex min-w-[12rem] flex-col gap-1 rounded-lg border border-[#3A3D44] bg-[#15171B]/95 p-1.5 shadow-2xl backdrop-blur-sm"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMoreOpen(false);
                        openAbout();
                      }}
                      className="flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-medium text-[#F4F1EB]/85 transition hover:bg-[#67E8F9]/10 hover:text-[#67E8F9]"
                    >
                      <InfoIcon />
                      <span>About</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMoreOpen(false);
                        openLevelSelect();
                      }}
                      className="flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-medium text-[#F4F1EB]/85 transition hover:bg-[#67E8F9]/10 hover:text-[#67E8F9]"
                    >
                      <GridIcon />
                      <span>Level Select (cards)</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => goToRoute('/battle-demo')}
                      className="flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-medium text-[#F4F1EB]/85 transition hover:bg-[#67E8F9]/10 hover:text-[#67E8F9]"
                    >
                      <SwordsIcon />
                      <span>Battle Demo</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => goToRoute('/microgames')}
                      className="flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-medium text-[#F4F1EB]/85 transition hover:bg-[#67E8F9]/10 hover:text-[#67E8F9]"
                    >
                      <TargetIcon />
                      <span>Microgames</span>
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Info chips — orient a cold first-time player in one glance:
                what kind of game, how the mic works, how best to play. */}
            <div className="flex flex-wrap items-center gap-2" aria-label="Build info">
              {['Turn-based phrase duels', 'Voice or No-Mic mode', 'Headphones recommended'].map(
                (chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-[#F4F1EB]/15 bg-[#15171B]/60 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#F4F1EB]/65 backdrop-blur-sm"
                  >
                    {chip}
                  </span>
                ),
              )}
            </div>
          </nav>
        </div>

        {/* Right column reserved for 3D Su silhouette breathing room. No overlay chrome. */}
        <div className="hidden sm:block" aria-hidden="true" />
      </section>

      {mapOpen ? (
        <Suspense fallback={null}>
          <OverworldMap isOpen={mapOpen} onClose={closeMap} />
        </Suspense>
      ) : null}

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
