import { useEffect, useRef } from 'react';
import type { SoundSettings } from '../services/soundSettings';

export function useGameMusic(trackUrl: string | null, soundSettings: SoundSettings) {
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
