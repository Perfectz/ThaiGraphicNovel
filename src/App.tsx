import { useEffect, useMemo, useRef, useState } from 'react';
import stageOneThemeUrl from '../humandropbox/Stage 1 Thai adventure.mp3';
import titleThemeUrl from '../humandropbox/Title Screen Thai adventure.mp3';
import { GameCanvas } from './components/GameCanvas';
import { GameSettings } from './components/GameSettings';
import { LessonRoadmap } from './components/LessonRoadmap';
import { TitleScreen } from './components/TitleScreen';
import { getSoundSettings, SOUND_SETTINGS_CHANGED_EVENT, type SoundSettings } from './services/soundSettings';
import { useGameStore } from './store/gameStore';

export default function App() {
  const currentScene = useGameStore((state) => state.currentScene);
  const hydrateSave = useGameStore((state) => state.hydrateSave);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [roadmapOpen, setRoadmapOpen] = useState(false);
  const [soundSettings, setSoundSettings] = useState<SoundSettings>(() => getSoundSettings());
  const musicTrackUrl = useMemo(() => {
    if (currentScene === 'title') return titleThemeUrl;
    return stageOneThemeUrl;
  }, [currentScene]);

  useEffect(() => {
    hydrateSave();
  }, [hydrateSave]);

  useEffect(() => {
    function syncSoundSettings() {
      setSoundSettings(getSoundSettings());
    }

    window.addEventListener(SOUND_SETTINGS_CHANGED_EVENT, syncSoundSettings);
    window.addEventListener('focus', syncSoundSettings);
    return () => {
      window.removeEventListener(SOUND_SETTINGS_CHANGED_EVENT, syncSoundSettings);
      window.removeEventListener('focus', syncSoundSettings);
    };
  }, []);

  useGameMusic(musicTrackUrl, soundSettings);

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

function useGameMusic(trackUrl: string | null, soundSettings: SoundSettings) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasUserGestureRef = useRef(false);

  useEffect(() => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.loop = true;
      audio.preload = 'auto';
      audioRef.current = audio;
    }

    const audio = audioRef.current;

    async function playMusic() {
      if (!trackUrl || !soundSettings.musicEnabled || !hasUserGestureRef.current) {
        audio.pause();
        return;
      }

      if (!audio.src.endsWith(trackUrl)) {
        audio.src = trackUrl;
        audio.currentTime = 0;
      }

      audio.volume = soundSettings.musicVolume;

      try {
        await audio.play();
      } catch {
        audio.pause();
      }
    }

    void playMusic();
  }, [soundSettings.musicEnabled, soundSettings.musicVolume, trackUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = soundSettings.musicVolume;
  }, [soundSettings.musicVolume]);

  useEffect(() => {
    function unlockMusic() {
      hasUserGestureRef.current = true;
      const audio = audioRef.current;
      if (!audio || !trackUrl || !soundSettings.musicEnabled) return;

      if (!audio.src.endsWith(trackUrl)) {
        audio.src = trackUrl;
        audio.currentTime = 0;
      }

      audio.volume = soundSettings.musicVolume;
      void audio.play().catch(() => {
        audio.pause();
      });
    }

    window.addEventListener('pointerdown', unlockMusic, { once: true });
    window.addEventListener('keydown', unlockMusic, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlockMusic);
      window.removeEventListener('keydown', unlockMusic);
    };
  }, [soundSettings.musicEnabled, soundSettings.musicVolume, trackUrl]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);
}
