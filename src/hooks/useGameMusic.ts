import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import type { SoundSettings } from '../services/soundSettings';

const MUSIC_UNLOCK_EVENTS = ['pointerdown', 'click', 'keydown', 'touchstart'] as const;

function ensureAudioElement(audioRef: MutableRefObject<HTMLAudioElement | null>) {
  if (!audioRef.current) {
    const audio = new Audio();
    audio.loop = true;
    audio.preload = 'auto';
    audioRef.current = audio;
  }

  return audioRef.current;
}

function resolveTrackSrc(trackUrl: string) {
  return new URL(trackUrl, window.location.href).href;
}

export function useGameMusic(trackUrl: string | null, soundSettings: SoundSettings) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasUserGestureRef = useRef(false);
  const playbackStateRef = useRef({ trackUrl, soundSettings });
  playbackStateRef.current = { trackUrl, soundSettings };

  const playCurrentMusic = useCallback(async () => {
    if (typeof window === 'undefined') return false;

    const audio = ensureAudioElement(audioRef);
    const { trackUrl: currentTrackUrl, soundSettings: currentSoundSettings } = playbackStateRef.current;

    if (!currentTrackUrl || !currentSoundSettings.musicEnabled || !hasUserGestureRef.current) {
      audio.pause();
      return false;
    }

    const nextSrc = resolveTrackSrc(currentTrackUrl);
    if (audio.src !== nextSrc) {
      audio.src = nextSrc;
      audio.currentTime = 0;
    }

    audio.volume = currentSoundSettings.musicVolume;

    try {
      await audio.play();
      return true;
    } catch {
      audio.pause();
      return false;
    }
  }, []);

  useEffect(() => {
    ensureAudioElement(audioRef);
    void playCurrentMusic();
  }, [playCurrentMusic, soundSettings.musicEnabled, soundSettings.musicVolume, trackUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = soundSettings.musicVolume;
  }, [soundSettings.musicVolume]);

  useEffect(() => {
    let isMounted = true;
    let unlockListenersActive = true;

    function removeUnlockListeners() {
      if (!unlockListenersActive) return;
      unlockListenersActive = false;
      MUSIC_UNLOCK_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, unlockMusic, { capture: true });
      });
    }

    function unlockMusic() {
      hasUserGestureRef.current = true;
      void playCurrentMusic().then((played) => {
        if (played && isMounted) removeUnlockListeners();
      });
    }

    function resumeMusic() {
      if (!hasUserGestureRef.current) return;
      if (document.visibilityState === 'hidden') return;
      void playCurrentMusic();
    }

    MUSIC_UNLOCK_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, unlockMusic, { capture: true, passive: true });
    });
    window.addEventListener('focus', resumeMusic);
    document.addEventListener('visibilitychange', resumeMusic);

    return () => {
      isMounted = false;
      removeUnlockListeners();
      window.removeEventListener('focus', resumeMusic);
      document.removeEventListener('visibilitychange', resumeMusic);
    };
  }, [playCurrentMusic]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);
}
