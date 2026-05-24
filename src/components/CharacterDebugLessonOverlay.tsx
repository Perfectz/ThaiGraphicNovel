import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import stageOneClearCardUrl from '../assets/stage-01/stage-01-clear-card.png';
import stageOneHitVfxUrl from '../assets/stage-01/stage-01-pronunciation-hit-vfx.png';
import stageOnePropsUrl from '../assets/stage-01/stage-01-lobby-practice-props.png';
import stageOneRiftVfxUrl from '../assets/stage-01/stage-01-rift-glyph-vfx.png';
import stageOneSuCutinsUrl from '../assets/stage-01/stage-01-su-cutins.png';
import { lessonScenarios } from '../data/lessonScenarios';
import { stageOneConversationDeck } from '../data/stageOneSuVoiceLines';
import { getPhrasePhoneticSpelling, type ThaiPhrase } from '../data/thaiPhrases';
import type { PronunciationAttempt } from '../domain/scenarioRules';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { useSoundSettings } from '../hooks/useSoundSettings';
import { getVoiceJudgeMode, VOICE_JUDGE_MODE_CHANGED_EVENT, type VoiceJudgeMode } from '../services/openAiSettings';
import { getPhraseAudioSrc } from '../services/phraseAudio';
import {
  createPronunciationSession,
  type PronunciationPrompt,
  type PronunciationSession,
  type PronunciationVerdict,
} from '../services/realtimePronunciation';
import { getStageOneSuAudioSrc } from '../services/suLineAudio';
import { createWhisperPronunciationSession } from '../services/whisperPronunciation';
import { resolvePronunciationTurn } from '../systems/battleSystem';
import { SuPronunciationJudge } from './SuPronunciationJudge';

type PronunciationFlashTone = 'excellent' | 'great' | 'passed' | 'try-harder' | 'failure';

type PronunciationScoreFlash = {
  id: number;
  tone: PronunciationFlashTone;
  label: string;
  detail: string;
};

type CharacterDebugLessonOverlayProps = {
  onClose: () => void;
  onComplete?: () => void;
  onContinueToLevelTwo?: () => void;
};

const stageOneScenario = lessonScenarios[0];
const activePhrases = stageOneScenario.chunks.flatMap((chunk) => chunk.phrases);
const maxCourage = 30;

function splitRomanization(romanization: string) {
  return romanization.split(' ').filter(Boolean);
}

function getPronunciationScoreFlash(verdict: PronunciationVerdict): Omit<PronunciationScoreFlash, 'id'> {
  if (verdict.score >= 95) {
    return { tone: 'excellent', label: 'Excellent', detail: `${verdict.score}/100 - Su heard it clearly.` };
  }

  if (verdict.score >= 85) {
    return { tone: 'great', label: 'Great', detail: `${verdict.score}/100 - rhythm landed.` };
  }

  if (verdict.pass) {
    return { tone: 'passed', label: 'Passed', detail: `${verdict.score}/100 - keep sharpening it.` };
  }

  if (verdict.score >= 45) {
    return { tone: 'try-harder', label: 'Try Harder', detail: `${verdict.score}/100 - slow it down.` };
  }

  return { tone: 'failure', label: 'Failure', detail: `${verdict.score}/100 - listen and retry.` };
}

function createPronunciationAttempt(
  phrase: ThaiPhrase,
  pronunciation: PronunciationVerdict,
  isReview: boolean,
): PronunciationAttempt {
  return {
    phraseId: phrase.id,
    phrase: phrase.targetPhrase,
    romanization: phrase.romanization,
    translation: phrase.translation,
    score: pronunciation.score,
    pass: pronunciation.pass,
    heard: pronunciation.heard,
    feedback: pronunciation.feedback,
    tip: pronunciation.tip,
    isReview,
    isSkipped: false,
  };
}

function createSkippedAttempt(phrase: ThaiPhrase): PronunciationAttempt {
  return {
    phraseId: phrase.id,
    phrase: phrase.targetPhrase,
    romanization: phrase.romanization,
    translation: phrase.translation,
    score: 0,
    pass: false,
    heard: 'Skipped',
    feedback: `Skipped "${phrase.translation}".`,
    tip: `Practice ${phrase.romanization} slowly before moving on.`,
    isReview: false,
    isSkipped: true,
  };
}

function createStagePracticeReport(attempts: PronunciationAttempt[], phrases: ThaiPhrase[]): string[] {
  const lessonAttempts = attempts.filter((attempt) => !attempt.isReview);
  if (lessonAttempts.length === 0) {
    return ['No pronunciation attempts were recorded for this stage. Replay the lesson and say each phrase out loud.'];
  }

  const scoredAttempts = lessonAttempts.filter((attempt) => !attempt.isSkipped);
  const averageScore = scoredAttempts.length
    ? Math.round(scoredAttempts.reduce((total, attempt) => total + attempt.score, 0) / scoredAttempts.length)
    : 0;
  const missedAttempts = lessonAttempts
    .filter((attempt) => !attempt.pass)
    .sort((a, b) => a.score - b.score);
  const hardestAttempts = (missedAttempts.length ? missedAttempts : lessonAttempts)
    .slice()
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);
  const passedCount = lessonAttempts.filter((attempt) => attempt.pass).length;
  const skippedCount = lessonAttempts.filter((attempt) => attempt.isSkipped).length;
  const phrasesTouched = new Set(lessonAttempts.map((attempt) => attempt.phraseId)).size;

  const report = [
    `Stage score: ${passedCount}/${phrases.length} phrases passed, average ${averageScore}/100 across ${scoredAttempts.length} spoken attempt${scoredAttempts.length === 1 ? '' : 's'}.`,
    `Coverage: ${phrasesTouched}/${phrases.length} phrases practiced${skippedCount ? `, ${skippedCount} skipped` : ''}.`,
  ];

  hardestAttempts.forEach((attempt, index) => {
    const focus = attempt.isSkipped
      ? `Say "${attempt.romanization}" from scratch and connect it to "${attempt.translation}".`
      : attempt.tip || attempt.feedback || `Repeat "${attempt.romanization}" slowly, then at normal speed.`;
    report.push(`Focus ${index + 1}: ${attempt.translation} (${attempt.romanization}) - ${focus}`);
  });

  if (missedAttempts.length === 0 && skippedCount === 0) {
    report.push('Next practice: keep the same rhythm, then speed up without losing the final polite sound.');
  }

  return report;
}

function PronunciationScoreFlashOverlay({ flash }: { flash: PronunciationScoreFlash | null }) {
  if (!flash) return null;

  return (
    <div
      key={flash.id}
      className={`pronunciation-score-flash pronunciation-score-flash--${flash.tone}`}
      aria-live="polite"
    >
      <span className="pronunciation-score-flash__label">{flash.label}</span>
      <span className="pronunciation-score-flash__detail">{flash.detail}</span>
    </div>
  );
}

export function CharacterDebugLessonOverlay({ onClose, onComplete, onContinueToLevelTwo }: CharacterDebugLessonOverlayProps) {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [reviewPhraseIndex, setReviewPhraseIndex] = useState<number | null>(null);
  const [phrasesPassed, setPhrasesPassed] = useState(0);
  const [courage, setCourage] = useState(22);
  const [attempts, setAttempts] = useState<PronunciationAttempt[]>([]);
  const [stageComplete, setStageComplete] = useState(false);
  const [stageReport, setStageReport] = useState<string[]>([]);
  const [voiceStatus, setVoiceStatus] = useState('Connect the AI mic when you are ready.');
  const [voiceError, setVoiceError] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isAwaitingPronunciationResult, setIsAwaitingPronunciationResult] = useState(false);
  const [voiceMode, setVoiceMode] = useState<VoiceJudgeMode>(() => getVoiceJudgeMode());
  const [verdict, setVerdict] = useState<PronunciationVerdict | null>(null);
  const [pronunciationFlash, setPronunciationFlash] = useState<PronunciationScoreFlash | null>(null);
  const [listenHighlight, setListenHighlight] = useState(false);
  const soundSettings = useSoundSettings();
  const phraseAudioPlayer = useAudioPlayer('The phrase audio could not be played.');
  const suAudioPlayer = useAudioPlayer('Su voice audio could not be played.');
  const pronunciationSession = useRef<PronunciationSession | null>(null);
  const connectionPromise = useRef<Promise<PronunciationSession | null> | null>(null);
  const pressedSpeakPointers = useRef<Set<number>>(new Set());
  const suPlaybackRun = useRef(0);
  const completionNotified = useRef(false);
  const attemptsRef = useRef<PronunciationAttempt[]>([]);
  const runtimeRef = useRef({
    phraseIndex: 0,
    reviewPhraseIndex: null as number | null,
    phrasesPassed: 0,
    courage: 22,
    stageComplete: false,
  });
  const verdictHandlerRef = useRef<(nextVerdict: PronunciationVerdict) => void>(() => {});

  const displayedPhraseIndex = reviewPhraseIndex ?? phraseIndex;
  const isReviewingPrevious = reviewPhraseIndex !== null;
  const currentPhrase = activePhrases[displayedPhraseIndex] ?? activePhrases[0];
  const phoneticSpelling = getPhrasePhoneticSpelling(currentPhrase);
  const phraseAudioSrc = getPhraseAudioSrc(currentPhrase);
  const phraseAudioError = phraseAudioPlayer.error;
  const isPhraseAudioPlaying = phraseAudioPlayer.isPlaying;
  const romanizationParts = splitRomanization(currentPhrase.romanization);
  const lessonProgress = `${Math.min(displayedPhraseIndex + 1, activePhrases.length)}/${activePhrases.length}`;
  const lastAttempt = attempts[attempts.length - 1] ?? null;
  const hasFailedCurrentPhrase =
    lastAttempt?.phraseId === currentPhrase.id &&
    !lastAttempt.pass &&
    !lastAttempt.isSkipped;
  const conversationLine = stageOneConversationDeck[currentPhrase.id] ?? {
    suLine: currentPhrase.example,
    coachingLine: `Say it slowly: ${currentPhrase.romanization}. Repeat: ${currentPhrase.romanization}.`,
    playerIntent: `Respond with: ${currentPhrase.translation}.`,
    suAudioId: undefined,
    coachingAudioId: undefined,
  };
  const suLineAudioSrc = getStageOneSuAudioSrc(conversationLine.suAudioId);
  const suCoachingAudioSrc = getStageOneSuAudioSrc(conversationLine.coachingAudioId);
  const hasVoiceCoach = pronunciationSession.current !== null;
  const understandingPercent = activePhrases.length ? (phrasesPassed / activePhrases.length) * 100 : 0;
  const couragePercent = (courage / maxCourage) * 100;
  const pronunciationPrompt = useMemo<PronunciationPrompt>(
    () => ({
      targetPhrase: currentPhrase.targetPhrase,
      romanization: currentPhrase.romanization,
      phoneticSpelling,
      translation: currentPhrase.translation,
    }),
    [currentPhrase.romanization, currentPhrase.targetPhrase, currentPhrase.translation, phoneticSpelling],
  );
  const stageOneAssetStyle = {
    '--stage-one-props-sheet': `url(${stageOnePropsUrl})`,
    '--stage-one-hit-vfx-sheet': `url(${stageOneHitVfxUrl})`,
    '--stage-one-rift-vfx-sheet': `url(${stageOneRiftVfxUrl})`,
    '--stage-one-su-cutins-sheet': `url(${stageOneSuCutinsUrl})`,
    '--stage-one-clear-card': `url(${stageOneClearCardUrl})`,
  } as CSSProperties;
  const stageOneVfxClass = isRecording
    ? 'stage-one-vfx--mic'
    : verdict?.pass && currentPhrase.isHeal
      ? 'stage-one-vfx--heal'
      : verdict?.pass
        ? 'stage-one-vfx--pass'
        : verdict && !verdict.pass
          ? 'stage-one-vfx--retry'
          : listenHighlight
            ? 'stage-one-vfx--listen'
            : 'stage-one-vfx--idle';
  const stageOneEffectClass = isRecording
    ? 'stage-one-practice--recording'
    : verdict?.pass && currentPhrase.isHeal
      ? 'stage-one-practice--heal'
      : verdict?.pass
        ? 'stage-one-practice--pass'
        : verdict && !verdict.pass
          ? 'stage-one-practice--retry'
          : listenHighlight
            ? 'stage-one-practice--listen'
            : '';

  runtimeRef.current = { phraseIndex, reviewPhraseIndex, phrasesPassed, courage, stageComplete };
  attemptsRef.current = attempts;

  useEffect(() => {
    pronunciationSession.current?.updatePrompt(pronunciationPrompt);
    if (pronunciationSession.current && !stageComplete) {
      setVoiceStatus(isReviewingPrevious ? 'Review phrase ready. Hold to speak.' : 'Next phrase ready. Hold to speak.');
    }
  }, [isReviewingPrevious, pronunciationPrompt, stageComplete]);

  useEffect(() => {
    const syncVoiceMode = () => setVoiceMode(getVoiceJudgeMode());
    window.addEventListener(VOICE_JUDGE_MODE_CHANGED_EVENT, syncVoiceMode);
    window.addEventListener('focus', syncVoiceMode);
    return () => {
      window.removeEventListener(VOICE_JUDGE_MODE_CHANGED_EVENT, syncVoiceMode);
      window.removeEventListener('focus', syncVoiceMode);
    };
  }, []);

  useEffect(() => {
    return () => {
      pronunciationSession.current?.disconnect();
      pronunciationSession.current = null;
      phraseAudioPlayer.stop();
      stopSuPlayback();
    };
  }, []);

  useEffect(() => {
    phraseAudioPlayer.stop();
  }, [phraseAudioSrc]);

  useEffect(() => {
    stopSuPlayback();

    if (stageComplete || isRecording || isAwaitingPronunciationResult || hasFailedCurrentPhrase || !soundSettings.guideAudioEnabled) {
      return;
    }

    const sequence = [suLineAudioSrc, suCoachingAudioSrc].filter((src): src is string => Boolean(src));
    if (!sequence.length) return;

    const runId = suPlaybackRun.current;
    setVoiceError('');
    void (async () => {
      for (const src of sequence) {
        if (suPlaybackRun.current !== runId) return;
        await suAudioPlayer.playUntilEnded(src, soundSettings.guideAudioVolume);
      }
    })();

    return () => {
      if (suPlaybackRun.current === runId) stopSuPlayback();
    };
  }, [
    currentPhrase.id,
    hasFailedCurrentPhrase,
    isAwaitingPronunciationResult,
    isRecording,
    soundSettings.guideAudioEnabled,
    soundSettings.guideAudioVolume,
    stageComplete,
    suCoachingAudioSrc,
    suLineAudioSrc,
  ]);

  useEffect(() => {
    if (!listenHighlight) return;
    const timeoutId = window.setTimeout(() => setListenHighlight(false), 1600);
    return () => window.clearTimeout(timeoutId);
  }, [listenHighlight]);

  useEffect(() => {
    if (!pronunciationFlash) return;
    const timeoutId = window.setTimeout(() => setPronunciationFlash(null), 1450);
    return () => window.clearTimeout(timeoutId);
  }, [pronunciationFlash]);

  useEffect(() => {
    if (!soundSettings.guideAudioEnabled) {
      phraseAudioPlayer.stop();
      stopSuPlayback();
      return;
    }
    phraseAudioPlayer.setVolume(soundSettings.guideAudioVolume);
    suAudioPlayer.setVolume(soundSettings.guideAudioVolume);
  }, [soundSettings.guideAudioEnabled, soundSettings.guideAudioVolume]);

  function stopSuPlayback() {
    suPlaybackRun.current += 1;
    suAudioPlayer.stop();
  }

  function recordAttempt(attempt: PronunciationAttempt) {
    const nextAttempts = [...attemptsRef.current, attempt];
    attemptsRef.current = nextAttempts;
    setAttempts(nextAttempts);
    return nextAttempts;
  }

  function completeLesson(nextAttempts: PronunciationAttempt[]) {
    setStageComplete(true);
    setStageReport(createStagePracticeReport(nextAttempts, activePhrases));
    setVoiceStatus('Stage clear. Su wrote the local debug report.');
    if (!completionNotified.current) {
      completionNotified.current = true;
      onComplete?.();
    }
  }

  function handlePronunciationVerdict(nextVerdict: PronunciationVerdict) {
    const runtime = runtimeRef.current;
    const activePhraseIndex = runtime.reviewPhraseIndex ?? runtime.phraseIndex;
    const phrase = activePhrases[activePhraseIndex] ?? activePhrases[0];
    const isReview = runtime.reviewPhraseIndex !== null;
    const nextAttempts = recordAttempt(createPronunciationAttempt(phrase, nextVerdict, isReview));
    const result = resolvePronunciationTurn(nextVerdict, phrase);

    setIsAwaitingPronunciationResult(false);
    setVerdict(nextVerdict);
    setPronunciationFlash({ id: Date.now(), ...getPronunciationScoreFlash(nextVerdict) });

    if (isReview) {
      setReviewPhraseIndex(null);
      setCourage(Math.max(0, Math.min(maxCourage, runtime.courage + (nextVerdict.pass ? 2 : -2))));
      setVoiceStatus(nextVerdict.pass ? 'Review complete. Returning to the current phrase.' : 'Review noted. Returning to the current phrase.');
      return;
    }

    setCourage(Math.max(0, Math.min(maxCourage, runtime.courage + result.courageDelta)));
    if (!result.shouldAdvancePhrase) {
      setVoiceStatus('Pronunciation needs another try.');
      return;
    }

    const nextPhrasesPassed = Math.min(runtime.phrasesPassed + 1, activePhrases.length);
    setPhrasesPassed(nextPhrasesPassed);
    setVoiceStatus(nextPhrasesPassed >= activePhrases.length ? 'Stage clear.' : 'Good job. Su accepted the phrase.');

    if (nextPhrasesPassed >= activePhrases.length) {
      completeLesson(nextAttempts);
      return;
    }

    setPhraseIndex(Math.min(runtime.phraseIndex + 1, activePhrases.length - 1));
  }

  verdictHandlerRef.current = handlePronunciationVerdict;

  async function connectVoiceCoach(): Promise<PronunciationSession | null> {
    if (pronunciationSession.current) return pronunciationSession.current;
    if (connectionPromise.current) return connectionPromise.current;

    setIsConnecting(true);
    setVoiceError('');
    setVerdict(null);
    const selectedMode = getVoiceJudgeMode();
    setVoiceMode(selectedMode);

    connectionPromise.current = (async () => {
      const sessionOptions = {
        prompt: pronunciationPrompt,
        onStatus: setVoiceStatus,
        onError: (message: string) => {
          setVoiceError(message);
          setVoiceStatus('Voice coach needs another try.');
          setIsAwaitingPronunciationResult(false);
          setIsRecording(false);
        },
        onVerdict: (nextVerdict: PronunciationVerdict) => {
          verdictHandlerRef.current(nextVerdict);
        },
      };
      const session =
        selectedMode === 'whisper'
          ? await createWhisperPronunciationSession(sessionOptions)
          : await createPronunciationSession({
              ...sessionOptions,
              enableFailureCoachingAudio: true,
            });
      pronunciationSession.current = session;
      return session;
    })();

    try {
      return await connectionPromise.current;
    } catch (error) {
      setVoiceError(error instanceof Error ? error.message : String(error));
      setVoiceStatus(`${selectedMode === 'whisper' ? 'Local Whisper' : 'Realtime'} voice coach could not connect.`);
      return null;
    } finally {
      setIsConnecting(false);
      connectionPromise.current = null;
    }
  }

  function startVoiceAttempt(session = pronunciationSession.current) {
    if (!session || stageComplete || isRecording) return;
    phraseAudioPlayer.stop();
    stopSuPlayback();
    setListenHighlight(false);
    setVoiceError('');
    setVerdict(null);
    setPronunciationFlash(null);
    setIsAwaitingPronunciationResult(false);
    session.updatePrompt(pronunciationPrompt);
    session.startRecording();
    setIsRecording(true);
  }

  function stopVoiceAttempt() {
    if (!pronunciationSession.current || !isRecording) return;
    pronunciationSession.current.stopRecording();
    setIsAwaitingPronunciationResult(true);
    setIsRecording(false);
    setVoiceStatus('Judging pronunciation...');
  }

  function startVoiceAttemptWithPointerCapture(event: PointerEvent<HTMLButtonElement>) {
    if (stageComplete || !pronunciationSession.current) return;
    const pointerId = event.pointerId;
    event.currentTarget.setPointerCapture(pointerId);
    pressedSpeakPointers.current.add(pointerId);
    startVoiceAttempt(pronunciationSession.current);
  }

  function stopVoiceAttemptWithPointerCapture(event: PointerEvent<HTMLButtonElement>) {
    pressedSpeakPointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    stopVoiceAttempt();
  }

  async function playCurrentPhrase() {
    if (!phraseAudioSrc) {
      setVoiceError('No guide audio is available for this phrase yet.');
      return;
    }

    if (!soundSettings.guideAudioEnabled) {
      setVoiceError('Guide audio is turned off in Game Settings.');
      return;
    }

    setVoiceError('');
    stopSuPlayback();
    setListenHighlight(true);
    await phraseAudioPlayer.play(phraseAudioSrc, soundSettings.guideAudioVolume);
  }

  async function playSuVoice(src: string | undefined) {
    if (!src) return;

    if (!soundSettings.guideAudioEnabled) {
      setVoiceError('Guide audio is turned off in Game Settings.');
      return;
    }

    stopSuPlayback();
    setVoiceError('');
    phraseAudioPlayer.stop();
    setListenHighlight(false);
    await suAudioPlayer.play(src, soundSettings.guideAudioVolume);
  }

  function reviewPreviousPhrase() {
    if (stageComplete || phraseIndex <= 0) {
      setVoiceStatus('No previous phrase is available yet.');
      return;
    }

    phraseAudioPlayer.stop();
    stopSuPlayback();
    setVerdict(null);
    setReviewPhraseIndex(Math.max(0, phraseIndex - 1));
    setVoiceStatus('Review phrase loaded. It will not advance the lesson.');
  }

  function skipCurrentPhrase() {
    if (stageComplete) return;
    const runtime = runtimeRef.current;
    const phrase = activePhrases[runtime.phraseIndex] ?? activePhrases[0];
    const nextAttempts = recordAttempt(createSkippedAttempt(phrase));
    const nextPhrasesPassed = Math.min(runtime.phrasesPassed + 1, activePhrases.length);

    setReviewPhraseIndex(null);
    setVerdict(null);
    setCourage(Math.max(0, Math.min(maxCourage, runtime.courage - 2)));
    setPhrasesPassed(nextPhrasesPassed);

    if (nextPhrasesPassed >= activePhrases.length) {
      completeLesson(nextAttempts);
      return;
    }

    setPhraseIndex(Math.min(runtime.phraseIndex + 1, activePhrases.length - 1));
    setVoiceStatus('Phrase skipped locally. Su moved to the next card.');
  }

  function resetLesson() {
    phraseAudioPlayer.stop();
    stopSuPlayback();
    pronunciationSession.current?.disconnect();
    pronunciationSession.current = null;
    connectionPromise.current = null;
    attemptsRef.current = [];
    setPhraseIndex(0);
    setReviewPhraseIndex(null);
    setPhrasesPassed(0);
    setCourage(22);
    setAttempts([]);
    setStageComplete(false);
    setStageReport([]);
    setVoiceStatus('Connect the AI mic when you are ready.');
    setVoiceError('');
    setIsConnecting(false);
    setIsRecording(false);
    setIsAwaitingPronunciationResult(false);
    setVerdict(null);
    setPronunciationFlash(null);
    setListenHighlight(false);
    completionNotified.current = false;
  }

  const actionControls = stageComplete ? (
    <>
      {onContinueToLevelTwo ? (
        <button
          type="button"
          onClick={onContinueToLevelTwo}
          className="vn-action-button bg-fuchsia-300 px-3 py-2.5 text-left text-sm font-black uppercase tracking-[0.12em] text-slate-950"
        >
          Continue To Level 2
        </button>
      ) : null}
      <button
        type="button"
        onClick={resetLesson}
        className="vn-action-button bg-emerald-300 px-3 py-2.5 text-left text-sm font-black uppercase tracking-[0.12em] text-slate-950"
      >
        Reset Lesson
      </button>
      <button
        type="button"
        onClick={onClose}
        className="vn-action-button bg-white px-3 py-2.5 text-left text-sm font-black uppercase tracking-[0.12em] text-slate-950"
      >
        Close Lesson
      </button>
    </>
  ) : (
    <>
      <button
        type="button"
        onClick={() => {
          if (!pronunciationSession.current) {
            phraseAudioPlayer.stop();
            stopSuPlayback();
            setListenHighlight(false);
            void connectVoiceCoach();
          }
        }}
        onPointerDown={startVoiceAttemptWithPointerCapture}
        onPointerUp={stopVoiceAttemptWithPointerCapture}
        onPointerCancel={stopVoiceAttemptWithPointerCapture}
        disabled={isConnecting || isAwaitingPronunciationResult}
        className={`vn-action-button px-3 py-1.5 text-left text-xs font-black uppercase tracking-[0.1em] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none sm:py-2 ${
          isRecording ? 'bg-red-500 text-white' : 'bg-emerald-300 text-emerald-950'
        }`}
      >
        Speak
        <span className="mt-0.5 block text-[10px] normal-case tracking-normal opacity-80">
          {!hasVoiceCoach ? `Connect ${voiceMode === 'whisper' ? 'Whisper' : 'Realtime'} mic` : isRecording ? 'Release to judge' : 'Hold to talk'}
        </span>
      </button>
      <button
        type="button"
        onClick={() => void playCurrentPhrase()}
        disabled={!phraseAudioSrc || isPhraseAudioPlaying}
        className="vn-action-button bg-white px-3 py-1.5 text-left text-xs font-black uppercase tracking-[0.1em] text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none sm:py-2"
      >
        Hear
      </button>
      <button
        type="button"
        onClick={reviewPreviousPhrase}
        disabled={phraseIndex <= 0 || isRecording || isAwaitingPronunciationResult}
        className="vn-action-button bg-white px-3 py-1.5 text-left text-xs font-black uppercase tracking-[0.1em] text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none sm:py-2"
      >
        Review
      </button>
      <button
        type="button"
        onClick={skipCurrentPhrase}
        disabled={isRecording || isAwaitingPronunciationResult}
        className="vn-action-button bg-white px-3 py-1.5 text-left text-xs font-black uppercase tracking-[0.1em] text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none sm:py-2"
      >
        Skip
      </button>
      <button
        type="button"
        onClick={onClose}
        className="vn-action-button bg-slate-950 px-3 py-1.5 text-left text-xs font-black uppercase tracking-[0.1em] text-white sm:py-2"
      >
        Close Lesson
      </button>
    </>
  );

  return (
    <section
      className={`stage-one-practice pointer-events-none absolute inset-x-3 bottom-[var(--vn-panel-bottom)] z-50 h-[var(--stage-one-panel-height)] sm:inset-x-6 lg:inset-x-12 ${stageOneEffectClass}`}
      style={stageOneAssetStyle}
      aria-label="3D debug Stage 1 Su lesson"
    >
      <PronunciationScoreFlashOverlay flash={pronunciationFlash} />
      <div className="stage-one-practice__rift" aria-hidden="true">
        <span className="stage-one-rift-sprite stage-one-rift-sprite--glyphs" />
        <span className="stage-one-rift-sprite stage-one-rift-sprite--ring" />
        <span className="stage-one-rift-sprite stage-one-rift-sprite--sparks" />
      </div>

      <div className="vn-glass-panel pointer-events-auto grid h-full min-h-0 gap-2 overflow-hidden p-2 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,0.38fr)] sm:p-3 lg:grid-cols-[minmax(0,1fr)_minmax(14rem,0.34fr)]">
        <div className="stage-one-phrase min-w-0">
          {stageComplete ? (
            <div className="stage-one-recap">
              <div className="stage-one-clear-card-art" aria-hidden="true" />
              <span className="vn-status-chip px-3 py-1 font-display text-[10px] font-black uppercase tracking-[0.16em]">
                Stage Clear
              </span>
              <h2 className="mt-3 text-2xl font-black leading-tight text-slate-950">Su locks in your lobby basics.</h2>
              <div className="mt-3 grid gap-2">
                {stageReport.map((line) => (
                  <p key={line} className="rounded-lg border border-cyan-900/15 bg-white/70 px-3 py-2 text-xs font-bold leading-snug text-slate-700">
                    {line}
                  </p>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="mb-2 flex items-center gap-2">
                <span className="vn-status-chip px-3 py-1 font-display text-xs font-black uppercase tracking-[0.16em]">
                  {currentPhrase.lesson}
                </span>
                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">
                  {isReviewingPrevious ? 'Review' : `Phrase ${lessonProgress}`}
                </span>
                <span className="h-px flex-1 bg-slate-950/20" />
              </div>

              <div className="stage-one-thai-card">
                <span className={`stage-one-vfx ${stageOneVfxClass}`} aria-hidden="true" />
                <div className="stage-one-conversation">
                  <div className="stage-one-bubble stage-one-bubble--su">
                    <span className="stage-one-su-cutin stage-one-su-cutin--coach" aria-hidden="true" />
                    <div className="min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-900">Su says</p>
                        {suLineAudioSrc ? (
                          <button
                            type="button"
                            onClick={() => void playSuVoice(suLineAudioSrc)}
                            className="stage-one-voice-button"
                          >
                            Play Su
                          </button>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm font-black leading-snug text-slate-950">{conversationLine.suLine}</p>
                    </div>
                  </div>
                  <div className="stage-one-bubble stage-one-bubble--coach">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-900">Su coaches</p>
                      {suCoachingAudioSrc ? (
                        <button
                          type="button"
                          onClick={() => void playSuVoice(suCoachingAudioSrc)}
                          className="stage-one-voice-button"
                        >
                          Coach
                        </button>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs font-bold leading-snug text-slate-700">{conversationLine.coachingLine}</p>
                  </div>
                  <div className="stage-one-bubble stage-one-bubble--player">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-fuchsia-900">Your reply</p>
                    <p className="mt-1 text-xs font-bold leading-snug text-slate-600">{conversationLine.playerIntent}</p>
                    <p className="stage-one-thai-glyph mt-1 text-3xl font-black leading-tight text-slate-950 sm:text-4xl">{currentPhrase.targetPhrase}</p>
                    <div className={`mt-2 flex flex-wrap gap-1.5 ${listenHighlight ? 'stage-one-syllables--listen' : ''}`}>
                      {romanizationParts.map((part, index) => (
                        <span key={`${part}-${index}`} className="stage-one-syllable">
                          {part}
                        </span>
                      ))}
                    </div>
                    <p className="mt-2 text-[11px] font-black uppercase tracking-[0.08em] text-slate-600">Phonetic: {phoneticSpelling}</p>
                  </div>
                </div>
              </div>

              <div className="mt-2 grid gap-2 sm:grid-cols-[0.8fr_1fr]">
                <div className="rounded-lg border border-cyan-900/15 bg-cyan-50/80 px-3 py-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-900">Meaning</p>
                  <p className="mt-1 text-sm font-black leading-snug text-slate-950">{currentPhrase.translation}</p>
                </div>
                <div className="rounded-lg border border-fuchsia-900/15 bg-fuchsia-50/70 px-3 py-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-fuchsia-900">Use this when</p>
                  <p className="mt-1 text-sm font-bold leading-snug text-slate-700">{currentPhrase.context}</p>
                </div>
              </div>

              <div className="stage-one-result mt-2">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">Last result</p>
                <p className="mt-1 text-xs font-bold leading-snug text-slate-700">
                  {lastAttempt
                    ? lastAttempt.isSkipped
                      ? `Skipped: practice ${lastAttempt.romanization} before replaying the stage.`
                      : `${lastAttempt.pass ? 'Passed' : 'Retry'} ${lastAttempt.translation}. Heard: ${lastAttempt.heard || 'voice attempt recorded'}.`
                    : listenHighlight
                      ? 'Su is marking the sound shape. Listen once, then hold Speak.'
                      : 'Listen once, then say the phrase out loud.'}
                </p>
                {lastAttempt?.tip ? <p className="mt-1 text-xs font-bold leading-snug text-cyan-900">Su tip: {lastAttempt.tip}</p> : null}
              </div>

              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <div>
                  <div className="mb-1 flex justify-between text-[10px] font-black uppercase tracking-[0.12em] text-slate-600">
                    <span>Courage</span>
                    <span>
                      {courage}/{maxCourage}
                    </span>
                  </div>
                  <div className="vn-meter h-2.5">
                    <div className="h-full bg-fuchsia-400" style={{ width: `${couragePercent}%` }} />
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-[10px] font-black uppercase tracking-[0.12em] text-slate-600">
                    <span>Understanding</span>
                    <span>{Math.round(understandingPercent)}%</span>
                  </div>
                  <div className="vn-meter h-2.5">
                    <div className="h-full bg-cyan-400" style={{ width: `${understandingPercent}%` }} />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <aside className="stage-one-controls grid min-w-0 content-start gap-2">
          <div className="rounded-lg border border-cyan-900/15 bg-white/70 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-700">
            Voice Judge: {voiceMode === 'whisper' ? 'Local Whisper' : 'Realtime'}
          </div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-1">{actionControls}</div>
          <SuPronunciationJudge
            hasVoiceCoach={hasVoiceCoach}
            isConnecting={isConnecting}
            isRecording={isRecording}
            verdict={verdict}
            voiceError={voiceError || phraseAudioError || suAudioPlayer.error}
            voiceStatus={voiceStatus}
            stageComplete={stageComplete}
            stageReport={stageReport}
          />
        </aside>
      </div>
    </section>
  );
}
