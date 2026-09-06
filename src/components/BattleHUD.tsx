import { useEffect, useMemo, useRef, useState } from 'react';
import { lessonScenarios } from '../data/lessonScenarios';
import { stageOneConversationDeck } from '../data/stageOneSuVoiceLines';
import { getPhrasePhoneticSpelling } from '../data/thaiPhrases';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { useSoundSettings } from '../hooks/useSoundSettings';
import {
  getVoiceJudgeMode,
  VOICE_JUDGE_MODE_CHANGED_EVENT,
  type VoiceJudgeMode,
} from '../services/openAiSettings';
import { getPhraseAudioSrc } from '../services/phraseAudio';
import {
  createPronunciationSession,
  type PronunciationSession,
  type PronunciationVerdict,
} from '../services/realtimePronunciation';
import { getStageOneSuAudioSrc } from '../services/suLineAudio';
import { createWhisperPronunciationSession } from '../services/whisperPronunciation';
import { type BattleOption } from '../systems/battleSystem';
import { useGameStore } from '../store/gameStore';
import { Button, Chip, MicButton, StatBar, VerdictBadge, type VerdictTone } from './ui';
import { SuPronunciationJudge } from './SuPronunciationJudge';

const battleOptions: BattleOption[] = [
  'Speak Phrase',
  'Hear Example',
  'Try Previous Phrase Again',
  'Skip Phrase',
];
const battleOptionLabels: Record<BattleOption, string> = {
  'Speak Phrase': 'Speak',
  'Hear Example': 'Hear',
  'Try Previous Phrase Again': 'Review',
  'Skip Phrase': 'Skip',
};

type PronunciationScoreFlash = {
  id: number;
  tone: VerdictTone;
  label: string;
  detail: string;
};

/**
 * Reduces the five legacy gradient flash tones (excellent/great/passed/
 * try-harder/failure) to three semantic VerdictBadge tones. The verdict
 * signal is an outline + dot — no neon glow, no display-1000 type. See
 * plan §2.7.
 */
function getPronunciationScoreFlash(verdict: PronunciationVerdict): Omit<PronunciationScoreFlash, 'id'> {
  if (verdict.score >= 85) {
    return {
      tone: 'jade',
      label: verdict.score >= 95 ? 'Excellent' : 'Strong',
      detail: `${verdict.score}/100 — Su heard it clearly.`,
    };
  }
  if (verdict.pass) {
    return {
      tone: 'paper',
      label: 'Passed',
      detail: `${verdict.score}/100 — keep sharpening it.`,
    };
  }
  if (verdict.score >= 45) {
    return {
      tone: 'coach',
      label: 'Almost',
      detail: `${verdict.score}/100 — slow it down.`,
    };
  }
  return {
    tone: 'ember',
    label: 'Try again',
    detail: `${verdict.score}/100 — listen and retry.`,
  };
}

function getNoMicVerdict(romanization: string): PronunciationVerdict {
  return {
    score: 72,
    pass: true,
    heard: romanization,
    feedback: 'Confirmed in No-Mic mode.',
    tip: 'Read the Thai aloud if you can, then keep moving.',
  };
}

function PronunciationScoreFlashOverlay({ flash }: { flash: PronunciationScoreFlash | null }) {
  if (!flash) return null;
  return (
    <div
      key={flash.id}
      className="pointer-events-none absolute -top-14 left-1/2 z-10 -translate-x-1/2 animate-[fadeInDown_320ms_ease-out]"
    >
      <VerdictBadge tone={flash.tone} label={flash.label} detail={flash.detail} emphasis />
    </div>
  );
}

export function BattleHUD() {
  const battle = useGameStore((state) => state.battle);
  const activeScenarioIndex = useGameStore((state) => state.activeScenarioIndex);
  const chooseBattleOption = useGameStore((state) => state.chooseBattleOption);
  const submitPronunciationResult = useGameStore((state) => state.submitPronunciationResult);
  const returnToOverworld = useGameStore((state) => state.returnToOverworld);
  const [voiceStatus, setVoiceStatus] = useState('Connect the AI mic when you are ready.');
  const [voiceError, setVoiceError] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isAwaitingPronunciationResult, setIsAwaitingPronunciationResult] = useState(false);
  const [voiceMode, setVoiceMode] = useState<VoiceJudgeMode>(() => getVoiceJudgeMode());
  const soundSettings = useSoundSettings();
  const phraseAudioPlayer = useAudioPlayer('The phrase audio could not be played.');
  const suAudioPlayer = useAudioPlayer('Su voice audio could not be played.');
  const [verdict, setVerdict] = useState<PronunciationVerdict | null>(null);
  const [pronunciationFlash, setPronunciationFlash] = useState<PronunciationScoreFlash | null>(null);
  const [listenHighlight, setListenHighlight] = useState(false);
  const pronunciationSession = useRef<PronunciationSession | null>(null);
  const connectionPromise = useRef<Promise<PronunciationSession | null> | null>(null);
  const suPlaybackRun = useRef(0);

  const activeScenario = useMemo(() => {
    if (!battle.hasWon) return lessonScenarios[activeScenarioIndex] ?? lessonScenarios[0];
    return (
      lessonScenarios.find((scenario) => scenario.id === battle.scenarioId) ??
      lessonScenarios[Math.max(0, activeScenarioIndex - 1)] ??
      lessonScenarios[activeScenarioIndex] ??
      lessonScenarios[0]
    );
  }, [activeScenarioIndex, battle.hasWon, battle.scenarioId]);
  const activePhrases = useMemo(
    () => activeScenario.chunks.flatMap((chunk) => chunk.phrases),
    [activeScenario],
  );
  const displayedPhraseIndex = battle.reviewPhraseIndex ?? battle.phraseIndex;
  const isReviewingPrevious = battle.reviewPhraseIndex !== null;
  const currentPhrase = activePhrases[displayedPhraseIndex] ?? activePhrases[0];
  const phraseAudioSrc = getPhraseAudioSrc(currentPhrase);
  const isPhraseAudioPlaying = phraseAudioPlayer.isPlaying;
  const phraseAudioError = phraseAudioPlayer.error;
  const lessonProgress = `${Math.min(displayedPhraseIndex + 1, activePhrases.length)}/${activePhrases.length}`;
  const phoneticSpelling = getPhrasePhoneticSpelling(currentPhrase);
  const lastAttempt = battle.pronunciationAttempts[battle.pronunciationAttempts.length - 1] ?? null;
  const hasFailedCurrentPhrase =
    lastAttempt?.phraseId === currentPhrase.id && !lastAttempt.pass && !lastAttempt.isSkipped;
  const conversationLine = stageOneConversationDeck[currentPhrase.id] ?? {
    suLine: currentPhrase.example,
    coachingLine: `Say it slowly: ${currentPhrase.romanization}. Repeat: ${currentPhrase.romanization}.`,
    playerIntent: `Respond with: ${currentPhrase.translation}.`,
    suAudioId: undefined,
    coachingAudioId: undefined,
  };
  const suLineAudioSrc = getStageOneSuAudioSrc(conversationLine.suAudioId);
  const suCoachingAudioSrc = getStageOneSuAudioSrc(conversationLine.coachingAudioId);

  const pronunciationPrompt = useMemo(
    () => ({
      targetPhrase: currentPhrase.targetPhrase,
      romanization: currentPhrase.romanization,
      phoneticSpelling,
      translation: currentPhrase.translation,
    }),
    [currentPhrase.romanization, currentPhrase.targetPhrase, currentPhrase.translation, phoneticSpelling],
  );
  const hasVoiceCoach = pronunciationSession.current !== null;

  useEffect(() => {
    pronunciationSession.current?.updatePrompt(pronunciationPrompt);
    if (pronunciationSession.current && !battle.hasWon) {
      setVoiceStatus(
        isReviewingPrevious ? 'Review phrase ready. Hold to speak.' : 'Next phrase ready. Hold to speak.',
      );
    }
  }, [battle.hasWon, isReviewingPrevious, pronunciationPrompt]);

  useEffect(() => {
    setListenHighlight(false);
    setVerdict(null);
    setIsAwaitingPronunciationResult(false);
  }, [currentPhrase.id]);

  useEffect(() => {
    function syncVoiceMode() {
      setVoiceMode(getVoiceJudgeMode());
    }
    window.addEventListener(VOICE_JUDGE_MODE_CHANGED_EVENT, syncVoiceMode);
    window.addEventListener('focus', syncVoiceMode);
    return () => {
      window.removeEventListener(VOICE_JUDGE_MODE_CHANGED_EVENT, syncVoiceMode);
      window.removeEventListener('focus', syncVoiceMode);
    };
  }, []);

  useEffect(() => {
    if (voiceMode !== 'no-mic' || battle.hasWon) return;
    pronunciationSession.current?.disconnect();
    pronunciationSession.current = null;
    connectionPromise.current = null;
    setIsConnecting(false);
    setIsRecording(false);
    setIsAwaitingPronunciationResult(false);
    setVoiceError('');
    setVoiceStatus('No mic this run. Read the Thai, then tap Confirm Phrase.');
  }, [battle.hasWon, currentPhrase.id, voiceMode]);

  useEffect(() => {
    return () => {
      pronunciationSession.current?.disconnect();
      pronunciationSession.current = null;
      phraseAudioPlayer.stop();
      stopSuPlayback();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    phraseAudioPlayer.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phraseAudioSrc]);

  // Su voice playback for Stage 1 onboarding lines. Kept for Stage 1 only since
  // later stages don't ship the same Su VO deck.
  useEffect(() => {
    stopSuPlayback();
    if (
      activeScenario.scenarioNumber !== 1 ||
      battle.hasWon ||
      isRecording ||
      isAwaitingPronunciationResult ||
      !soundSettings.guideAudioEnabled
    ) {
      return;
    }
    const sequence = (hasFailedCurrentPhrase ? [] : [suLineAudioSrc, suCoachingAudioSrc]).filter(
      (src): src is string => Boolean(src),
    );
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeScenario.scenarioNumber,
    battle.hasWon,
    currentPhrase.id,
    hasFailedCurrentPhrase,
    isAwaitingPronunciationResult,
    isRecording,
    soundSettings.guideAudioEnabled,
    soundSettings.guideAudioVolume,
    suLineAudioSrc,
    suCoachingAudioSrc,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soundSettings.guideAudioEnabled, soundSettings.guideAudioVolume]);

  function stopSuPlayback() {
    suPlaybackRun.current += 1;
    suAudioPlayer.stop();
  }

  async function connectVoiceCoach(): Promise<PronunciationSession | null> {
    if (pronunciationSession.current) return pronunciationSession.current;
    if (connectionPromise.current) return connectionPromise.current;

    setIsConnecting(true);
    setVoiceError('');
    setVerdict(null);
    const selectedMode = getVoiceJudgeMode();
    setVoiceMode(selectedMode);

    if (selectedMode === 'no-mic') {
      setIsConnecting(false);
      setVoiceError('');
      setVoiceStatus('No mic this run. Read the Thai, then tap Confirm Phrase.');
      return null;
    }

    connectionPromise.current = (async () => {
      const sessionOptions = {
        prompt: pronunciationPrompt,
        onStatus: setVoiceStatus,
        onError: (message: string) => {
          setVoiceError(message);
          setVoiceStatus('Voice coach needs another try.');
          setIsAwaitingPronunciationResult(false);
        },
        onVerdict: (nextVerdict: PronunciationVerdict) => {
          setIsAwaitingPronunciationResult(false);
          setVerdict(nextVerdict);
          setPronunciationFlash({ id: Date.now(), ...getPronunciationScoreFlash(nextVerdict) });
          setVoiceStatus(
            nextVerdict.pass ? 'Good job. Su accepted the phrase.' : 'Pronunciation needs another try.',
          );
          submitPronunciationResult(nextVerdict);
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
      setVoiceStatus(
        `${selectedMode === 'whisper' ? 'Local Whisper' : 'Realtime'} voice coach could not connect.`,
      );
      return null;
    } finally {
      setIsConnecting(false);
      connectionPromise.current = null;
    }
  }

  function startVoiceAttempt(session = pronunciationSession.current) {
    if (!session || battle.hasWon || isRecording) return;
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

  function chooseBattleOptionWithAudio(option: BattleOption) {
    if (option === 'Hear Example') {
      void playCurrentPhrase();
    }
    chooseBattleOption(option);
  }

  // Mic start/stop handlers wired into the MicButton primitive. The primitive
  // owns pointer capture + Space/Enter press-and-hold; we just hand it
  // start/stop callbacks.
  function handleMicStart() {
    if (battle.hasWon) return;
    if (!pronunciationSession.current) {
      phraseAudioPlayer.stop();
      stopSuPlayback();
      setListenHighlight(false);
      void connectVoiceCoach();
      return;
    }
    startVoiceAttempt(pronunciationSession.current);
  }

  function handleMicStop() {
    stopVoiceAttempt();
  }

  function confirmNoMicPhrase() {
    if (battle.hasWon) return;
    phraseAudioPlayer.stop();
    stopSuPlayback();
    setListenHighlight(false);
    setVoiceError('');
    setVerdict(null);
    setPronunciationFlash(null);
    const nextVerdict = getNoMicVerdict(currentPhrase.romanization);
    setVerdict(nextVerdict);
    setPronunciationFlash({ id: Date.now(), ...getPronunciationScoreFlash(nextVerdict) });
    setVoiceStatus('Confirmed without mic. The action succeeds.');
    submitPronunciationResult(nextVerdict);
  }

  const micHint = !hasVoiceCoach
    ? `Connect ${voiceMode === 'whisper' ? 'Whisper' : 'Realtime'} mic`
    : isRecording
      ? 'Release to judge'
      : 'Hold to talk';

  // Secondary action buttons (Hear / Review / Skip). Speak gets the MicButton.
  const secondaryOptions = battleOptions.filter((option) => option !== 'Speak Phrase');

  // ──────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────

  if (battle.hasWon) {
    return (
      <section
        className="battle-hud pointer-events-none absolute inset-x-3 bottom-[var(--vn-panel-bottom)] z-50 h-[min(28rem,48dvh)] sm:inset-x-10 sm:h-[var(--vn-panel-height)] lg:inset-x-16"
        aria-label={`${activeScenario.title} — stage complete`}
      >
        <div className="pointer-events-auto grid h-full grid-cols-1 gap-4 overflow-y-auto rounded-[12px] border border-hairline bg-ink-raised p-5 text-paper shadow-card sm:grid-cols-[minmax(0,1fr)_minmax(15rem,0.5fr)] sm:p-6">
          <div className="min-w-0">
            <Chip tone="jade">Stage Clear</Chip>
            <h2 className="mt-3 font-display text-2xl font-black uppercase tracking-tight text-paper">
              {activeScenario.title}
            </h2>
            <p className="mt-2 text-sm font-medium text-paper-muted">{activeScenario.lessonGoal}</p>
            {battle.stagePracticeReport.length ? (
              <ul className="mt-4 grid gap-2">
                {battle.stagePracticeReport.map((line) => (
                  <li
                    key={line}
                    className="rounded-md border border-hairline bg-ink-elevated px-3 py-2 text-xs font-medium text-paper-muted"
                  >
                    {line}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-5">
              <Button onClick={returnToOverworld} variant="primary" size="md">
                Continue journey
              </Button>
            </div>
          </div>
          <div className="min-w-0">
            <SuPronunciationJudge
              hasVoiceCoach={hasVoiceCoach}
              isConnecting={isConnecting}
              isRecording={isRecording}
              verdict={verdict}
              voiceError={voiceError || phraseAudioError || suAudioPlayer.error}
              voiceStatus={voiceStatus}
              voiceMode={voiceMode}
              stageComplete
              stageReport={battle.stagePracticeReport}
            />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className="battle-hud pointer-events-none absolute inset-x-3 bottom-[var(--vn-panel-bottom)] z-50 h-[min(30rem,52dvh)] sm:inset-x-10 sm:h-[var(--vn-panel-height)] lg:inset-x-16"
      aria-label={`${activeScenario.title} — pronunciation practice`}
    >
      <PronunciationScoreFlashOverlay flash={pronunciationFlash} />
      <div className="pointer-events-auto grid h-full grid-cols-1 gap-4 overflow-y-auto rounded-[12px] border border-hairline bg-ink-raised p-4 text-paper shadow-card sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] sm:gap-5 sm:p-5">
        {/* Left column — phrase + coaching + stat bars */}
        <div className="flex min-w-0 flex-col gap-3">
          <header className="flex items-center justify-between gap-3">
            <Chip>{currentPhrase.lesson || 'Su'}</Chip>
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-paper-muted">
              {isReviewingPrevious ? 'Review' : `Phrase ${lessonProgress}`}
            </span>
          </header>

          <div>
            <p className="font-display text-3xl font-bold leading-tight text-paper sm:text-4xl">
              {currentPhrase.targetPhrase}
            </p>
            <p className="mt-1 text-xl font-bold leading-tight text-accent sm:text-2xl">
              {currentPhrase.romanization}
            </p>
            <p className="mt-1 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-paper-quiet">
              Phonetic · {phoneticSpelling}
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold text-paper">{currentPhrase.translation}</p>
            <p className="mt-1 text-xs font-medium leading-relaxed text-paper-muted">
              {currentPhrase.context}
            </p>
          </div>

          {/* Su's coaching line — replaces the three-bubble Su/Coach/Player layout */}
          {conversationLine.coachingLine ? (
            <div className="border-t border-hairline pt-3">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-paper-muted">
                Su coaches
              </p>
              <p className="mt-1 text-sm font-medium leading-relaxed text-paper">
                {conversationLine.coachingLine}
              </p>
              {listenHighlight ? (
                <p className="mt-1 text-[0.7rem] font-medium uppercase tracking-[0.18em] text-accent">
                  Listening cue — repeat after Su.
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Stat bars — both accent, both fraction, both labeled in player-meaningful terms */}
          <div className="mt-auto grid grid-cols-2 gap-3 border-t border-hairline pt-3">
            <StatBar
              label="Courage"
              value={battle.courage}
              max={battle.maxCourage}
              format="fraction"
              tone="accent"
            />
            <StatBar
              label="Phrases passed"
              value={battle.phrasesPassed}
              max={activePhrases.length}
              format="fraction"
              tone="accent"
            />
          </div>
        </div>

        {/* Right column — action stack + judge */}
        <div className="flex min-w-0 flex-col gap-3">
          {voiceMode === 'no-mic' ? (
            <Button
              variant="primary"
              size="md"
              onClick={confirmNoMicPhrase}
              disabled={isConnecting || isAwaitingPronunciationResult}
              className="w-full"
            >
              Confirm Phrase
            </Button>
          ) : (
            <MicButton
              isRecording={isRecording}
              onStart={handleMicStart}
              onStop={handleMicStop}
              hint={micHint}
              disabled={isConnecting}
              className="w-full"
            />
          )}
          <div className="grid grid-cols-3 gap-2">
            {secondaryOptions.map((option) => {
              const disabled =
                (option === 'Hear Example' && (!phraseAudioSrc || isPhraseAudioPlaying)) || isConnecting;
              return (
                <Button
                  key={option}
                  variant="ghost"
                  size="sm"
                  disabled={disabled}
                  onClick={() => chooseBattleOptionWithAudio(option)}
                >
                  {battleOptionLabels[option]}
                </Button>
              );
            })}
          </div>
          <SuPronunciationJudge
            hasVoiceCoach={hasVoiceCoach}
            isConnecting={isConnecting}
            isRecording={isRecording}
            verdict={verdict}
            voiceError={voiceError || phraseAudioError || suAudioPlayer.error}
            voiceStatus={voiceStatus}
            voiceMode={voiceMode}
            stageComplete={battle.hasWon}
            stageReport={battle.stagePracticeReport}
          />
        </div>
      </div>
    </section>
  );
}
