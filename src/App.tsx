import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import stageOneThemeUrl from '../humandropbox/Stage 1 Thai adventure.mp3';
import titleThemeUrl from '../humandropbox/Title Screen Thai adventure.mp3';
import { GameCanvas } from './components/GameCanvas';
import { GameSettings } from './components/GameSettings';
import { LessonRoadmap } from './components/LessonRoadmap';
import { TitleScreen } from './components/TitleScreen';
import { useGameMusic } from './hooks/useGameMusic';
import { useSoundSettings } from './hooks/useSoundSettings';
import { useGameStore } from './store/gameStore';

const CharacterDebugPage = lazy(() =>
  import('./components/CharacterDebugPage').then((module) => ({ default: module.CharacterDebugPage })),
);

function getRoutePath() {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
  if (basePath && window.location.pathname.startsWith(basePath)) {
    return window.location.pathname.slice(basePath.length) || '/';
  }
  return window.location.pathname;
}

export default function App() {
  const routePath = getRoutePath();
  const isCharacterDebugRoute =
    routePath === '/character-debug' || (import.meta.env.VITE_DEFAULT_DEBUG === 'true' && routePath === '/');
  const currentScene = useGameStore((state) => state.currentScene);
  const hydrateSave = useGameStore((state) => state.hydrateSave);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [roadmapOpen, setRoadmapOpen] = useState(false);
  const soundSettings = useSoundSettings();
  const musicTrackUrl = useMemo(() => {
    if (isCharacterDebugRoute) return null;
    if (currentScene === 'title') return titleThemeUrl;
    return stageOneThemeUrl;
  }, [currentScene, isCharacterDebugRoute]);

  useEffect(() => {
    hydrateSave();
  }, [hydrateSave]);

  useGameMusic(musicTrackUrl, soundSettings);

  if (isCharacterDebugRoute) {
    return (
      <Suspense
        fallback={
          <main className="grid h-dvh w-screen place-items-center bg-slate-950 text-sm font-black uppercase tracking-[0.16em] text-cyan-100">
            Loading character debug...
          </main>
        }
      >
        <CharacterDebugPage />
      </Suspense>
    );
  }

  return (
    <>
      {currentScene === 'title' ? <TitleScreen /> : <GameCanvas />}
      <button
        type="button"
        onClick={() => setSettingsOpen(true)}
        className="fixed right-3 top-3 z-[60] rounded-2xl border-4 border-cyan-950 bg-cyan-300 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-cyan-950 shadow-rpg active:translate-y-1 sm:right-5 sm:top-5 sm:px-4"
      >
        <span className="hidden sm:inline">Game Settings</span>
        <span className="sm:hidden">Settings</span>
      </button>
      <GameSettings
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onOpenRoadmap={() => setRoadmapOpen(true)}
      />
      <LessonRoadmap isOpen={roadmapOpen} onClose={() => setRoadmapOpen(false)} />
    </>
  );
}
