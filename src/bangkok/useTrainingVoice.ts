import { useCallback, useEffect, useRef, useState } from 'react';
import type { ThaiPhrase } from '../data/thaiPhrases';
import type { PronunciationSession } from '../services/realtimePronunciation';
import { getVoiceJudgeMode } from '../services/openAiSettings';
import { reservePracticeAudio } from '../services/musicFocus';
import { recordedVoiceUrl, stopStoryVoice, storyVoiceStopEvent } from './recordedVoice';

export function useTrainingVoice(phrase: ThaiPhrase | undefined) {
  const practicing = !!phrase;
  useEffect(() => (practicing ? reservePracticeAudio() : undefined), [practicing]);
  const [recording, setRecording] = useState(false);
  const [clip, setClip] = useState('');
  const [message, setMessage] = useState('');
  const [coachBusy, setCoachBusy] = useState(false);
  const [coachPass, setCoachPass] = useState(false);
  const [playing, setPlaying] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const session = useRef<PronunciationSession | null>(null);
  const clipRef = useRef('');
  const generation = useRef(0);
  const recordMode = useRef<'local' | 'coach'>('local');
  const limitTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const invalidate = useCallback(() => {
    generation.current += 1;
  }, []);

  useEffect(() => {
    invalidate();
    setClip('');
    setMessage('');
    setCoachPass(false);
    setRecording(false);
    setCoachBusy(false);
    setPlaying(false);
    return () => {
      invalidate();
      clearTimeout(limitTimer.current);
      session.current?.disconnect();
      session.current = null;
      if (recorder.current?.state === 'recording') recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
      audio.current?.pause();
      if (clipRef.current) URL.revokeObjectURL(clipRef.current);
      clipRef.current = '';
    };
  }, [phrase?.id, invalidate]);

  async function play(slow = false, own = false) {
    if (!phrase || recording || coachBusy) return;
    stopStoryVoice();
    audio.current?.pause();
    const reference = recordedVoiceUrl('Su', phrase.targetPhrase) ?? `/bangkok/audio/${phrase.id}.mp3`;
    const a = new Audio(own ? clipRef.current : `${import.meta.env.BASE_URL}${reference.replace(/^\//, '')}`);
    a.playbackRate = slow ? 0.78 : 1;
    a.preservesPitch = true;
    a.volume = 0.9;
    audio.current = a;
    setPlaying(true);
    setMessage(
      own
        ? 'Your recording — compare it with the example.'
        : slow
          ? 'Listen slowly, then echo the phrase.'
          : 'Listen to the Thai, then say it aloud.',
    );
    const version = generation.current;
    a.onended = () => {
      if (version === generation.current) setPlaying(false);
    };
    a.onerror = () => {
      if (version === generation.current) {
        setPlaying(false);
        setMessage('The reference audio could not load. Try listening again.');
      }
    };
    try {
      await a.play();
    } catch {
      if (version === generation.current) {
        setPlaying(false);
        setMessage('Audio could not play. Tap Listen to try again.');
      }
    }
  }
  const stopPlayback = useCallback(() => {
    audio.current?.pause();
    setPlaying(false);
  }, []);
  useEffect(() => {
    window.addEventListener(storyVoiceStopEvent, stopPlayback);
    return () => window.removeEventListener(storyVoiceStopEvent, stopPlayback);
  }, [stopPlayback]);
  function stop() {
    clearTimeout(limitTimer.current);
    if (recordMode.current === 'coach') {
      session.current?.stopRecording();
      setCoachBusy(true);
      setMessage('Listening to your answer…');
      limitTimer.current = setTimeout(() => {
        invalidate();
        session.current?.disconnect();
        session.current = null;
        setCoachBusy(false);
        setMessage('The coach took too long. Retry or use local recording; no turn was lost.');
      }, 45000);
    } else if (recorder.current?.state === 'recording') recorder.current.stop();
    setRecording(false);
  }
  async function record(useCoach = false) {
    if (!phrase || coachBusy) return;
    stopStoryVoice();
    if (recording) {
      stop();
      return;
    }
    audio.current?.pause();
    setPlaying(false);
    setMessage('Opening your microphone…');
    setCoachPass(false);
    setCoachBusy(true);
    const version = generation.current;
    let openingTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (useCoach) {
        setCoachBusy(true);
        session.current?.disconnect();
        const opts = {
          prompt: phrase,
          onStatus: () => undefined,
          onError: () => {
            if (version === generation.current) {
              clearTimeout(limitTimer.current);
              setCoachBusy(false);
              setRecording(false);
              setMessage(
                'The coach could not hear that reliably. Retry, record locally, or use phrase choices. No progress is lost.',
              );
            }
          },
          onVerdict: (verdict: { pass: boolean; heard: string }) => {
            if (version !== generation.current) return;
            clearTimeout(limitTimer.current);
            setCoachBusy(false);
            setRecording(false);
            setCoachPass(verdict.pass);
            setMessage(
              verdict.pass
                ? `Phrase recognised: “${verdict.heard}”. This checks the wording, not your Thai tones.`
                : `Heard: “${verdict.heard || 'nothing clear'}”. Listen again and retry; this does not cost a turn.`,
            );
          },
        };
        const next =
          getVoiceJudgeMode() === 'realtime'
            ? await (
                await import('../services/realtimePronunciation')
              ).createPronunciationSession({ ...opts, enableFailureCoachingAudio: false })
            : await (
                await import('../services/whisperPronunciation')
              ).createWhisperPronunciationSession(opts);
        if (version !== generation.current) {
          next.disconnect();
          return;
        }
        session.current = next;
        recordMode.current = 'coach';
        setCoachBusy(false);
        next.startRecording();
      } else {
        // A browser permission prompt may remain unanswered indefinitely. Release the UI
        // without claiming a recording, and retire any stream granted after this attempt expires.
        openingTimer = setTimeout(() => {
          if (version !== generation.current) return;
          invalidate();
          setCoachBusy(false);
          setMessage(
            'Microphone access is still pending. Check your browser permission, retry, or use text this time.',
          );
        }, 12000);
        limitTimer.current = openingTimer;
        const nextStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        clearTimeout(openingTimer);
        if (version !== generation.current) {
          nextStream.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.current = nextStream;
        recordMode.current = 'local';
        const nextRecorder = new MediaRecorder(nextStream);
        recorder.current = nextRecorder;
        const chunks: BlobPart[] = [];
        nextRecorder.ondataavailable = (event) => {
          if (event.data.size) chunks.push(event.data);
        };
        nextRecorder.onstop = () => {
          nextStream.getTracks().forEach((t) => t.stop());
          if (version !== generation.current) return;
          if (clipRef.current) URL.revokeObjectURL(clipRef.current);
          clipRef.current = URL.createObjectURL(new Blob(chunks, { type: nextRecorder.mimeType }));
          setClip(clipRef.current);
          setRecording(false);
          setMessage('Recording ready. Play it back and compare with the example.');
        };
        nextRecorder.start();
      }
      setCoachBusy(false);
      setRecording(true);
      setMessage('Recording… Say the phrase, then press Stop.');
      limitTimer.current = setTimeout(stop, 20000);
    } catch {
      if (version !== generation.current) return;
      setCoachBusy(false);
      setRecording(false);
      setMessage(
        useCoach
          ? 'Voice coach unavailable. You can still record and compare, or use phrase choices.'
          : 'Microphone unavailable or permission denied. Phrase choices keep the session playable.',
      );
    } finally {
      clearTimeout(openingTimer);
    }
  }
  return { recording, clip, message, coachBusy, coachPass, playing, play, record, stop, stopPlayback };
}
