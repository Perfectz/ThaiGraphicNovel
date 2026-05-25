import { useEffect, useRef, useState } from 'react';

export type AudioPlayer = {
  error: string;
  isPlaying: boolean;
  play: (src: string, volume: number) => Promise<void>;
  playUntilEnded: (src: string, volume: number) => Promise<void>;
  setVolume: (volume: number) => void;
  stop: () => void;
};

export function useAudioPlayer(errorMessage = 'The audio could not be played.'): AudioPlayer {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const finishRef = useRef<(() => void) | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState('');

  function stop() {
    const audio = audioRef.current;
    finishRef.current?.();
    finishRef.current = null;
    audio?.pause();
    audioRef.current = null;
    setIsPlaying(false);
  }

  function setVolume(volume: number) {
    if (!audioRef.current) return;
    audioRef.current.volume = volume;
  }

  async function startAudio(src: string, volume: number, waitForEnd: boolean) {
    setError('');
    stop();

    const audio = new Audio(src);
    audio.volume = volume;
    audioRef.current = audio;
    setIsPlaying(true);

    return await new Promise<void>((resolve) => {
      let settled = false;
      let resolved = false;

      function resolveOnce() {
        if (resolved) return;
        resolved = true;
        resolve();
      }

      function finish() {
        if (settled) return;
        settled = true;
        finishRef.current = null;
        setIsPlaying(false);
        if (audioRef.current === audio) audioRef.current = null;
        if (waitForEnd) resolveOnce();
      }

      finishRef.current = finish;
      audio.addEventListener('ended', finish, { once: true });
      audio.addEventListener(
        'error',
        () => {
          setError(errorMessage);
          finish();
        },
        { once: true },
      );

      audio
        .play()
        .then(() => {
          if (!waitForEnd) resolveOnce();
        })
        .catch((playError) => {
          if (settled) {
            if (!waitForEnd) resolveOnce();
            return;
          }
          setError(playError instanceof Error ? playError.message : errorMessage);
          finish();
          if (!waitForEnd) resolveOnce();
        });
    });
  }

  async function play(src: string, volume: number) {
    await startAudio(src, volume, false);
  }

  async function playUntilEnded(src: string, volume: number) {
    await startAudio(src, volume, true);
  }

  useEffect(() => stop, []);

  return { error, isPlaying, play, playUntilEnded, setVolume, stop };
}
