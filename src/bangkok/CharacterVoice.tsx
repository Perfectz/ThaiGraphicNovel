import { useCallback, useEffect, useRef, useState } from 'react';
import { useSoundSettings } from '../hooks/useSoundSettings';
import { saveSoundSettings } from '../services/soundSettings';
import { reservePracticeAudio } from '../services/musicFocus';
import { recordedVoiceUrl, stopStoryVoice, storyVoiceStopEvent, voiceSpeaker } from './recordedVoice';
import './characterVoice.css';

/** Prerecorded lines never consume API calls or advance a conversation during play. */
export default function CharacterVoice({
  speaker,
  text,
  disabled = false,
}: {
  speaker: string;
  text: string;
  disabled?: boolean;
}) {
  const settings = useSoundSettings();
  const source = recordedVoiceUrl(speaker, text);
  const audio = useRef<HTMLAudioElement | null>(null);
  const release = useRef<(() => void) | null>(null);
  const [playing, setPlaying] = useState(false);
  const [message, setMessage] = useState('');
  const stop = useCallback(() => {
    if (audio.current) {
      audio.current.onended = null;
      audio.current.onerror = null;
      audio.current.pause();
      audio.current.removeAttribute('src');
      audio.current.load();
      audio.current = null;
    }
    release.current?.();
    release.current = null;
    setPlaying(false);
  }, []);
  const play = useCallback(async () => {
    if (!source || disabled || document.hidden) return;
    stopStoryVoice();
    const a = new Audio(`${import.meta.env.BASE_URL}${source.replace(/^\//, '')}`);
    audio.current = a;
    a.volume = settings.guideAudioVolume;
    release.current = reservePracticeAudio();
    setMessage('');
    setPlaying(true);
    a.onended = stop;
    a.onerror = () => {
      if (audio.current !== a) return;
      stop();
      setMessage('Voice could not load. You can keep reading and try again.');
    };
    try {
      await a.play();
    } catch {
      if (audio.current === a) {
        stop();
        setMessage('Tap Hear to play this line.');
      }
    }
  }, [source, disabled, settings.guideAudioVolume, stop]);
  const playRef = useRef(play);
  playRef.current = play;
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) stop();
    };
    window.addEventListener(storyVoiceStopEvent, stop);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener(storyVoiceStopEvent, stop);
      document.removeEventListener('visibilitychange', hidden);
      stop();
    };
  }, [stop]);
  useEffect(() => {
    stop();
    setMessage('');
    if (settings.guideAudioEnabled) void playRef.current();
    return stop;
    // Busy changes stop the line below but must never restart it after recording.
  }, [source, settings.guideAudioEnabled, stop]);
  useEffect(() => {
    if (disabled) stop();
  }, [disabled, stop]);
  if (!source) return null;
  return (
    <div className="character-voice" data-voice-speaker={voiceSpeaker(speaker)}>
      <button
        type="button"
        onClick={() => (playing ? stop() : void play())}
        disabled={disabled}
        aria-label={playing ? 'Stop character voice' : `Hear ${voiceSpeaker(speaker)}`}
      >
        {playing ? '■ Stop voice' : `♫ Hear ${voiceSpeaker(speaker)}`}
      </button>
      <button
        type="button"
        aria-pressed={settings.guideAudioEnabled}
        onClick={() => saveSoundSettings({ ...settings, guideAudioEnabled: !settings.guideAudioEnabled })}
      >
        Story voices {settings.guideAudioEnabled ? 'on' : 'off'}
      </button>
      <small>AI-generated voice</small>
      {message && <small role="status">{message}</small>}
    </div>
  );
}
