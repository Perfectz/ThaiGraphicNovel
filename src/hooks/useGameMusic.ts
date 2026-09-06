import { useEffect, useRef } from 'react';
import type { SoundSettings } from '../services/soundSettings';
import { MusicPlayer } from '../services/MusicPlayer';
import { musicHasFocus, subscribeMusicFocus } from '../services/musicFocus';

// Permission to play belongs to this document, including camp/adventure remounts.
let hasMusicGesture = false;

export function useGameMusic(trackUrl: string | null, soundSettings: SoundSettings) {
  const state = useRef({ trackUrl, soundSettings });
  state.current = { trackUrl, soundSettings };
  const player = useRef<MusicPlayer | null>(null);
  useEffect(() => {
    const instance = new MusicPlayer(() => {
      const audio = new Audio();
      audio.preload = 'auto';
      audio.dataset.gameMusic = 'true';
      return audio;
    });
    player.current = instance;
    const configure = () => {
      const { trackUrl, soundSettings: sound } = state.current;
      instance.configure(
        trackUrl,
        sound.musicEnabled,
        sound.musicVolume,
        document.hidden || !musicHasFocus(),
      );
    };
    const unlock = () => {
      hasMusicGesture = true;
      configure();
      instance.unlock();
    };
    const unsubscribe = subscribeMusicFocus(configure);
    window.addEventListener('pointerdown', unlock, { capture: true, passive: true });
    window.addEventListener('keydown', unlock, { capture: true });
    document.addEventListener('visibilitychange', configure);
    let previous = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      instance.tick((now - previous) / 1000);
      previous = now;
    }, 50);
    configure();
    if (hasMusicGesture) instance.unlock();
    return () => {
      window.clearInterval(timer);
      unsubscribe();
      window.removeEventListener('pointerdown', unlock, { capture: true });
      window.removeEventListener('keydown', unlock, { capture: true });
      document.removeEventListener('visibilitychange', configure);
      instance.dispose();
      player.current = null;
    };
  }, []);
  useEffect(() => {
    player.current?.configure(
      trackUrl,
      soundSettings.musicEnabled,
      soundSettings.musicVolume,
      document.hidden || !musicHasFocus(),
    );
  }, [trackUrl, soundSettings.musicEnabled, soundSettings.musicVolume]);
}
