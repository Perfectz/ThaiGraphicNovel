import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import stageOneThemeUrl from './assets/audio/music/stage-01-hotel-lobby.mp3';
import stageTwoThemeUrl from './assets/audio/music/stage-02-front-desk.mp3';
import stageThreeThemeUrl from './assets/audio/music/stage-03-night-market.mp3';
import titleThemeUrl from './assets/audio/music/title-theme.mp3';
import { GameErrorBoundary } from './components/ErrorBoundary';
import { GameSettings } from './components/GameSettings';
import { LessonRoadmap } from './components/LessonRoadmap';
import { MusicToggle } from './components/MusicToggle';
import { TitleScreen } from './components/TitleScreen';
import { IconButton } from './components/ui';
import { lessonScenarios } from './data/lessonScenarios';
import { suPosition } from './data/map';
import { createBattleStateForScenario } from './domain/scenarioRules';
import { useGameMusic } from './hooks/useGameMusic';
import { useSoundSettings } from './hooks/useSoundSettings';
import { fetchServerEnvKeyStatus } from './services/openAiSettings';
import { useGameStore } from './store/gameStore';
import { writeSave } from './systems/saveSystem';

// All route-level views are lazy. TitleScreen ships in the initial bundle (it's the
// landing page); everything else streams in on demand so first paint stays small.
const GameCanvas = lazy(() =>
  import('./components/GameCanvas').then((module) => ({ default: module.GameCanvas })),
);
const PhantasyBattleDemo = lazy(() =>
  import('./components/PhantasyBattleDemo').then((module) => ({ default: module.PhantasyBattleDemo })),
);
// WarioWare-style microgame mode (Stages 1-3). Self-contained route. Mounted
// only when the player navigates to /microgames — has no effect on the main
// campaign flow.
const MicrogameHub = lazy(() =>
  import('./components/microgames/MicrogameHub').then((module) => ({ default: module.MicrogameHub })),
);

function RouteLoading({ label }: { label: string }) {
  return (
    <main
      role="status"
      aria-live="polite"
      className="grid h-dvh w-screen place-items-center bg-[#0A0A0B] text-sm font-bold uppercase tracking-[0.22em] text-[#67E8F9]"
    >
      {label}
    </main>
  );
}

function getRoutePath() {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
  if (basePath && window.location.pathname.startsWith(basePath)) {
    return window.location.pathname.slice(basePath.length) || '/';
  }
  return window.location.pathname;
}

export default function App() {
  const routePath = getRoutePath();
  const isBattleDemoRoute = routePath === '/battle-demo';
  const isMicrogamesRoute = routePath === '/microgames';
  const currentScene = useGameStore((state) => state.currentScene);
  const hydrateSave = useGameStore((state) => state.hydrateSave);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [roadmapOpen, setRoadmapOpen] = useState(false);
  const soundSettings = useSoundSettings();
  const activeScenarioIndex = useGameStore((state) => state.activeScenarioIndex);
  const replayScenarioIndex = useGameStore((state) => state.replayScenarioIndex);
  const musicTrackUrl = useMemo(() => {
    // Debug routes are intentionally silent — they're for development checks,
    // not gameplay, and music would obscure console / TTS playback.
    if (isBattleDemoRoute || isMicrogamesRoute) return null;
    if (currentScene === 'title') return titleThemeUrl;
    // Per-stage music: route dedicated stage tracks first, then fall back to
    // the stage-01 hotel-lobby track so the player is never in silence.
    const musicScenarioIndex = replayScenarioIndex ?? activeScenarioIndex;
    if (musicScenarioIndex === 1) return stageTwoThemeUrl;
    if (musicScenarioIndex === 2) return stageThreeThemeUrl;
    return stageOneThemeUrl;
  }, [activeScenarioIndex, currentScene, isBattleDemoRoute, isMicrogamesRoute, replayScenarioIndex]);

  useEffect(() => {
    hydrateSave();
  }, [hydrateSave]);

  // Boot-time probe of /api/realtime/health so the local-.env-key signal is
  // populated before any UI consults hasUsableOpenAiKey() or the Settings
  // modal opens. Cheap (one GET, server cached) and silent on failure — if
  // the server is offline we just stay on "no local key" until next probe.
  useEffect(() => {
    void fetchServerEnvKeyStatus();
  }, []);

  useEffect(() => {
    if (window.sessionStorage.getItem('isekai-debug-start-level-2') !== '1') return;
    window.sessionStorage.removeItem('isekai-debug-start-level-2');
    const levelTwoScenario = lessonScenarios[1];
    const saveData = {
      hasStarted: true,
      completedTutorial: true,
      activeScenarioIndex: 1,
      completedScenarioIds: [lessonScenarios[0].id],
      lastPlayerPosition: suPosition,
    };
    writeSave(saveData);
    useGameStore.setState({
      // Stage 2 now flows through the data-driven dispatcher just like 3–10;
      // 'pointClickAdventure' is preserved as a scene marker so older save
      // files still resolve to the right stage. GameCanvas routes both
      // 'pointClickAdventure' (index 1) and 'stage3dAdventure' through the
      // dispatcher.
      currentScene: 'pointClickAdventure',
      hasStarted: true,
      completedTutorial: true,
      activeScenarioIndex: 1,
      completedScenarioIds: [lessonScenarios[0].id],
      playerPosition: suPosition,
      targetPosition: null,
      dialogueIndex: 0,
      battle: createBattleStateForScenario(levelTwoScenario),
      saveData,
      hasSavedGame: true,
    });
  }, []);

  // Debug bootstrap for the walkable Sukhumvit overworld. Set sessionStorage
  // 'isekai-debug-overworld' to '1' and reload — App drops straight onto the
  // street hub (as if the player had just cleared the hotel).
  useEffect(() => {
    if (window.sessionStorage.getItem('isekai-debug-overworld') !== '1') return;
    window.sessionStorage.removeItem('isekai-debug-overworld');
    const completedScenarioIds = lessonScenarios.slice(0, 2).map((s) => s.id);
    const saveData = {
      hasStarted: true,
      completedTutorial: true,
      activeScenarioIndex: 2,
      completedScenarioIds,
      lastPlayerPosition: suPosition,
    };
    writeSave(saveData);
    useGameStore.setState({
      currentScene: 'overworld',
      hasStarted: true,
      completedTutorial: true,
      activeScenarioIndex: 2,
      completedScenarioIds,
      playerPosition: suPosition,
      targetPosition: null,
      dialogueIndex: 0,
      saveData,
      hasSavedGame: true,
    });
  }, []);

  // Debug bootstrap for any 3D stage (1-10). Set sessionStorage
  // 'isekai-debug-stage-3d-index' to a scenario index (0..9) and reload —
  // App jumps straight into that 3D stage on mount via the dispatcher.
  useEffect(() => {
    const raw = window.sessionStorage.getItem('isekai-debug-stage-3d-index');
    if (!raw) return;
    window.sessionStorage.removeItem('isekai-debug-stage-3d-index');
    const index = Number.parseInt(raw, 10);
    if (Number.isNaN(index) || index < 0 || index >= lessonScenarios.length) return;
    const targetScenario = lessonScenarios[index];
    const completedScenarioIds = lessonScenarios.slice(0, index).map((s) => s.id);
    const saveData = {
      hasStarted: true,
      completedTutorial: true,
      activeScenarioIndex: index,
      completedScenarioIds,
      lastPlayerPosition: suPosition,
    };
    writeSave(saveData);
    useGameStore.setState({
      currentScene: 'stage3dAdventure',
      hasStarted: true,
      completedTutorial: true,
      activeScenarioIndex: index,
      completedScenarioIds,
      playerPosition: suPosition,
      targetPosition: null,
      dialogueIndex: 0,
      battle: createBattleStateForScenario(targetScenario),
      saveData,
      hasSavedGame: true,
    });
  }, []);

  useGameMusic(musicTrackUrl, soundSettings);

  if (isBattleDemoRoute) {
    const exitToTitle = () => {
      const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
      window.location.href = basePath ? `${basePath}/` : '/';
    };
    return (
      <GameErrorBoundary>
        <Suspense fallback={<RouteLoading label="Loading battle demo…" />}>
          <PhantasyBattleDemo onExit={exitToTitle} />
        </Suspense>
      </GameErrorBoundary>
    );
  }

  if (isMicrogamesRoute) {
    const exitToTitle = () => {
      const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
      window.location.href = basePath ? `${basePath}/` : '/';
    };
    return (
      <GameErrorBoundary>
        <Suspense fallback={<RouteLoading label="Loading microgames…" />}>
          <MicrogameHub onExit={exitToTitle} />
        </Suspense>
      </GameErrorBoundary>
    );
  }

  // Settings opens the same modal from every scene. Position is fixed top-right
  // — immersive scenes (3D, point-click) have a room nav also pinned top-right
  // and used to receive a completely different bottom-left chrome treatment;
  // we now use a single IconButton in both places and let the room nav stack
  // below it. See plan §2.6.

  return (
    <>
      <GameErrorBoundary>
        {currentScene === 'title' ? (
          <TitleScreen onOpenSettings={() => setSettingsOpen(true)} />
        ) : (
          <Suspense fallback={<RouteLoading label="Loading scene…" />}>
            <GameCanvas />
          </Suspense>
        )}
      </GameErrorBoundary>
      {/* Music toggle sits LEFT of the settings cog so a player can mute with
          a single tap from any screen. Same z-index so both stack above HUD. */}
      <MusicToggle className="!fixed right-16 top-3 z-[60] sm:right-[4.5rem] sm:top-5" />
      <IconButton
        onClick={() => setSettingsOpen(true)}
        aria-label="Open game settings"
        className="!fixed right-3 top-3 z-[60] sm:right-5 sm:top-5"
      >
        ⚙
      </IconButton>
      <GameSettings
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onOpenRoadmap={() => setRoadmapOpen(true)}
      />
      <LessonRoadmap isOpen={roadmapOpen} onClose={() => setRoadmapOpen(false)} />
    </>
  );
}
