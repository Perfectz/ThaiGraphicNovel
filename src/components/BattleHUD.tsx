import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import stageOneClearCardUrl from '../assets/stage-01/stage-01-clear-card.png';
import stageOneHitVfxUrl from '../assets/stage-01/stage-01-pronunciation-hit-vfx.png';
import stageOnePropBellUrl from '../assets/stage-01/stage-01-prop-bell.png';
import stageOnePropMapUrl from '../assets/stage-01/stage-01-prop-map.png';
import stageOnePropMicUrl from '../assets/stage-01/stage-01-prop-mic.png';
import stageOnePropNotebookUrl from '../assets/stage-01/stage-01-prop-notebook.png';
import stageOnePropRiftUrl from '../assets/stage-01/stage-01-prop-rift.png';
import stageOnePropSignUrl from '../assets/stage-01/stage-01-prop-sign.png';
import stageOnePropSuitcaseUrl from '../assets/stage-01/stage-01-prop-suitcase.png';
import stageOnePropWalletUrl from '../assets/stage-01/stage-01-prop-wallet.png';
import stageOnePropWaterUrl from '../assets/stage-01/stage-01-prop-water.png';
import stageOnePropsUrl from '../assets/stage-01/stage-01-lobby-practice-props.png';
import stageOneRiftVfxUrl from '../assets/stage-01/stage-01-rift-glyph-vfx.png';
import stageOneSuCutinsUrl from '../assets/stage-01/stage-01-su-cutins.png';
import { lessonScenarios } from '../data/lessonScenarios';
import { stageOneConversationDeck } from '../data/stageOneSuVoiceLines';
import { getPhrasePhoneticSpelling } from '../data/thaiPhrases';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { useSoundSettings } from '../hooks/useSoundSettings';
import { getVoiceJudgeMode, VOICE_JUDGE_MODE_CHANGED_EVENT, type VoiceJudgeMode } from '../services/openAiSettings';
import { getPhraseAudioSrc } from '../services/phraseAudio';
import { createPronunciationSession, type PronunciationSession, type PronunciationVerdict } from '../services/realtimePronunciation';
import { getStageOneSuAudioSrc } from '../services/suLineAudio';
import { createWhisperPronunciationSession } from '../services/whisperPronunciation';
import { type BattleOption } from '../systems/battleSystem';
import { useGameStore } from '../store/gameStore';
import { SuPronunciationJudge } from './SuPronunciationJudge';

const battleOptions: BattleOption[] = ['Speak Phrase', 'Hear Example', 'Try Previous Phrase Again', 'Skip Phrase'];
const battleOptionLabels: Record<BattleOption, string> = {
  'Speak Phrase': 'Speak',
  'Hear Example': 'Hear',
  'Try Previous Phrase Again': 'Review',
  'Skip Phrase': 'Skip',
};

const stageOnePropSprites: Record<string, string> = {
  bell: stageOnePropBellUrl,
  map: stageOnePropMapUrl,
  mic: stageOnePropMicUrl,
  notebook: stageOnePropNotebookUrl,
  rift: stageOnePropRiftUrl,
  sign: stageOnePropSignUrl,
  suitcase: stageOnePropSuitcaseUrl,
  wallet: stageOnePropWalletUrl,
  water: stageOnePropWaterUrl,
};

type StageOneCue = {
  id: string;
  label: string;
  prompt: string;
  sprite: string;
};

type PronunciationFlashTone = 'excellent' | 'great' | 'passed' | 'try-harder' | 'failure';

type PronunciationScoreFlash = {
  id: number;
  tone: PronunciationFlashTone;
  label: string;
  detail: string;
};


const stageOneCueDeck: Record<string, { mission: string; sceneBeat: string; cues: StageOneCue[] }> = {
  'first-contact': {
    mission: 'Open the lobby conversation politely before the rift gets louder.',
    sceneBeat: 'Su is waiting by the glowing lobby rift. Start simple, clear, and polite.',
    cues: [
      { id: 'rift', label: 'Rift shimmer', prompt: 'The rift reacts when Patrick greets Su clearly.', sprite: 'rift' },
      { id: 'su', label: 'Su coaching mark', prompt: 'Su points to the polite ending: khrap.', sprite: 'mic' },
      { id: 'guest', label: 'Lobby guest', prompt: 'A guest pauses nearby, so Patrick needs a calm introduction.', sprite: 'notebook' },
    ],
  },
  'polite-repair': {
    mission: 'Repair small social mistakes with respect before the lobby staff notices.',
    sceneBeat: 'A suitcase bumps the bell stand. Su wants Patrick to recover politely.',
    cues: [
      { id: 'bell', label: 'Front-desk bell', prompt: 'Use gratitude or an apology before touching the bell again.', sprite: 'bell' },
      { id: 'suitcase', label: 'Suitcase cue', prompt: 'The suitcase blocks the path. Yes or no needs to be crisp.', sprite: 'suitcase' },
      { id: 'staff', label: 'Staff glance', prompt: 'A staff member looks over. Keep the phrase short and respectful.', sprite: 'map' },
    ],
  },
  'first-needs': {
    mission: 'Ask for essentials and use Thai to recover Courage.',
    sceneBeat: 'The lobby opens into real survival needs: price, bathroom, and water.',
    cues: [
      { id: 'water', label: 'Water glass', prompt: 'Say you are thirsty clearly to turn the glass into a Courage heal.', sprite: 'water' },
      { id: 'sign', label: 'Bathroom sign', prompt: 'Follow the sign by asking where the bathroom is.', sprite: 'sign' },
      { id: 'wallet', label: 'Wallet check', prompt: 'Before buying water or a charm, ask the price.', sprite: 'wallet' },
    ],
  },
};


function getPhraseChunkId(phraseId: string, chunks: typeof lessonScenarios[number]['chunks']) {
  return chunks.find((chunk) => chunk.phrases.some((phrase) => phrase.id === phraseId))?.id ?? chunks[0]?.id ?? 'first-contact';
}

function splitRomanization(romanization: string) {
  return romanization.split(' ').filter(Boolean);
}

function getPronunciationScoreFlash(verdict: PronunciationVerdict): Omit<PronunciationScoreFlash, 'id'> {
  if (verdict.score >= 95) {
    return {
      tone: 'excellent',
      label: 'Excellent',
      detail: `${verdict.score}/100 - Su heard it clearly.`,
    };
  }

  if (verdict.score >= 85) {
    return {
      tone: 'great',
      label: 'Great',
      detail: `${verdict.score}/100 - rhythm landed.`,
    };
  }

  if (verdict.pass) {
    return {
      tone: 'passed',
      label: 'Passed',
      detail: `${verdict.score}/100 - keep sharpening it.`,
    };
  }

  if (verdict.score >= 45) {
    return {
      tone: 'try-harder',
      label: 'Try Harder',
      detail: `${verdict.score}/100 - slow it down.`,
    };
  }

  return {
    tone: 'failure',
    label: 'Failure',
    detail: `${verdict.score}/100 - listen and retry.`,
  };
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
  const [selectedCueId, setSelectedCueId] = useState<string | null>(null);
  const pronunciationSession = useRef<PronunciationSession | null>(null);
  const connectionPromise = useRef<Promise<PronunciationSession | null> | null>(null);
  const pressedSpeakPointers = useRef<Set<number>>(new Set());
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
  const activePhrases = useMemo(() => activeScenario.chunks.flatMap((chunk) => chunk.phrases), [activeScenario]);
  const displayedPhraseIndex = battle.reviewPhraseIndex ?? battle.phraseIndex;
  const isReviewingPrevious = battle.reviewPhraseIndex !== null;
  const currentPhrase = activePhrases[displayedPhraseIndex] ?? activePhrases[0];
  const phraseAudioSrc = getPhraseAudioSrc(currentPhrase);
  const isPhraseAudioPlaying = phraseAudioPlayer.isPlaying;
  const phraseAudioError = phraseAudioPlayer.error;
  const lessonProgress = `${Math.min(displayedPhraseIndex + 1, activePhrases.length)}/${activePhrases.length}`;
  const phoneticSpelling = getPhrasePhoneticSpelling(currentPhrase);
  const activeChunkId = getPhraseChunkId(currentPhrase.id, activeScenario.chunks);
  const stageOneChallenge = stageOneCueDeck[activeChunkId] ?? stageOneCueDeck['first-contact'];
  const selectedCue = stageOneChallenge.cues.find((cue) => cue.id === selectedCueId) ?? stageOneChallenge.cues[0];
  const romanizationParts = splitRomanization(currentPhrase.romanization);
  const lastAttempt = battle.pronunciationAttempts[battle.pronunciationAttempts.length - 1] ?? null;
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
  const couragePercent = (battle.courage / battle.maxCourage) * 100;
  const understandingPercent = 100 - (battle.enemyConfidence / battle.enemyMaxConfidence) * 100;
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
      setVoiceStatus(isReviewingPrevious ? 'Review phrase ready. Hold to speak.' : 'Next phrase ready. Hold to speak.');
    }
  }, [battle.hasWon, isReviewingPrevious, pronunciationPrompt]);

  useEffect(() => {
    setSelectedCueId(stageOneChallenge.cues[0]?.id ?? null);
    setListenHighlight(false);
    setVerdict(null);
    setIsAwaitingPronunciationResult(false);
  }, [currentPhrase.id, stageOneChallenge.cues]);

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
          setVoiceStatus(nextVerdict.pass ? 'Good job. Su accepted the phrase.' : 'Pronunciation needs another try.');
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
      setVoiceStatus(`${selectedMode === 'whisper' ? 'Local Whisper' : 'Realtime'} voice coach could not connect.`);
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

  function startVoiceAttemptWithPointerCapture(event: PointerEvent<HTMLButtonElement>) {
    if (battle.hasWon || !pronunciationSession.current) return;
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

  function chooseBattleOptionWithAudio(option: BattleOption) {
    if (option === 'Hear Example') {
      void playCurrentPhrase();
    }

    chooseBattleOption(option);
  }

  const battleActionControls = battle.hasWon ? (
    <button
      type="button"
      onClick={returnToOverworld}
      className="vn-action-button bg-emerald-300 px-3 py-2.5 text-left text-sm font-black uppercase tracking-[0.12em] text-slate-950"
    >
      Continue Journey
    </button>
  ) : (
    battleOptions.map((option) => {
      const isSpeak = option === 'Speak Phrase';
      const disabled = option === 'Hear Example' && (!phraseAudioSrc || isPhraseAudioPlaying);

      return (
        <button
          key={option}
          type="button"
          onClick={() => {
            if (isSpeak && !pronunciationSession.current) {
              phraseAudioPlayer.stop();
              stopSuPlayback();
              setListenHighlight(false);
              void connectVoiceCoach();
              return;
            }

            if (!isSpeak) chooseBattleOptionWithAudio(option);
          }}
          onPointerDown={isSpeak ? startVoiceAttemptWithPointerCapture : undefined}
          onPointerUp={isSpeak ? stopVoiceAttemptWithPointerCapture : undefined}
          onPointerCancel={isSpeak ? stopVoiceAttemptWithPointerCapture : undefined}
          disabled={disabled || isConnecting}
          className={`vn-action-button px-3 py-1.5 text-left text-xs font-black uppercase tracking-[0.1em] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none sm:py-2 ${
            isSpeak
              ? isRecording
                ? 'bg-red-500 text-white'
                : 'bg-emerald-300 text-emerald-950'
              : 'bg-white text-slate-950'
          }`}
        >
          {battleOptionLabels[option]}
          {isSpeak ? (
            <span className="mt-0.5 block text-[10px] normal-case tracking-normal opacity-80">
              {!hasVoiceCoach ? `Connect ${voiceMode === 'whisper' ? 'Whisper' : 'Realtime'} mic` : isRecording ? 'Release to judge' : 'Hold to talk'}
            </span>
          ) : null}
        </button>
      );
    })
  );

  if (activeScenario.scenarioNumber === 1) {
    return (
      <section
        className={`stage-one-practice pointer-events-none absolute inset-x-3 bottom-[var(--vn-panel-bottom)] z-50 h-[var(--stage-one-panel-height)] sm:inset-x-6 lg:inset-x-12 ${stageOneEffectClass}`}
        style={stageOneAssetStyle}
      >
        <PronunciationScoreFlashOverlay flash={pronunciationFlash} />
        <div className="stage-one-practice__rift" aria-hidden="true">
          <span className="stage-one-rift-sprite stage-one-rift-sprite--glyphs" />
          <span className="stage-one-rift-sprite stage-one-rift-sprite--ring" />
          <span className="stage-one-rift-sprite stage-one-rift-sprite--sparks" />
        </div>

        <div className="vn-glass-panel pointer-events-auto grid h-full min-h-0 gap-2 overflow-hidden p-2 sm:grid-cols-[minmax(12rem,0.46fr)_minmax(0,1fr)_minmax(12rem,0.46fr)] sm:p-3 lg:grid-cols-[minmax(14rem,0.5fr)_minmax(0,1fr)_minmax(14rem,0.5fr)]">
          <aside className="stage-one-mission min-w-0">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="vn-status-chip px-3 py-1 font-display text-[10px] font-black uppercase tracking-[0.16em]">
                Su's Mission
              </span>
              <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">
                {isReviewingPrevious ? 'Review' : `Phrase ${lessonProgress}`}
              </span>
            </div>
            <p className="text-sm font-black leading-snug text-slate-950">{stageOneChallenge.mission}</p>
            <p className="mt-2 text-xs font-bold leading-snug text-slate-600">{stageOneChallenge.sceneBeat}</p>

            <div className="mt-3 grid gap-1.5">
              {stageOneChallenge.cues.map((cue) => (
                <button
                  key={cue.id}
                  type="button"
                  onClick={() => setSelectedCueId(cue.id)}
                  className={`stage-one-cue text-left ${selectedCue.id === cue.id ? 'stage-one-cue--active' : ''}`}
                >
                  <img
                    src={stageOnePropSprites[cue.sprite]}
                    alt=""
                    className="stage-one-prop-sprite"
                    decoding="async"
                    draggable={false}
                  />
                  <span>{cue.label}</span>
                </button>
              ))}
            </div>

            <div className="stage-one-cue-card mt-2">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-900">Scene prompt</p>
              <p className="mt-1 text-xs font-bold leading-snug text-slate-700">{selectedCue.prompt}</p>
            </div>
          </aside>

          <div className="stage-one-phrase min-w-0">
            {battle.hasWon ? (
              <div className="stage-one-recap">
                <div className="stage-one-clear-card-art" aria-hidden="true" />
                <span className="vn-status-chip px-3 py-1 font-display text-[10px] font-black uppercase tracking-[0.16em]">
                  Stage Clear
                </span>
                <h2 className="mt-3 text-2xl font-black leading-tight text-slate-950">Su locks in your lobby basics.</h2>
                <div className="mt-3 grid gap-2">
                  {battle.stagePracticeReport.map((line) => (
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
                        : 'Pick a lobby cue, listen once, then say the phrase out loud.'}
                  </p>
                  {lastAttempt?.tip ? <p className="mt-1 text-xs font-bold leading-snug text-cyan-900">Su tip: {lastAttempt.tip}</p> : null}
                </div>

                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  <div>
                    <div className="mb-1 flex justify-between text-[10px] font-black uppercase tracking-[0.12em] text-slate-600">
                      <span>Courage</span>
                      <span>
                        {battle.courage}/{battle.maxCourage}
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
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-1">{battleActionControls}</div>
            <SuPronunciationJudge
              hasVoiceCoach={hasVoiceCoach}
              isConnecting={isConnecting}
              isRecording={isRecording}
              verdict={verdict}
              voiceError={voiceError || phraseAudioError || suAudioPlayer.error}
              voiceStatus={voiceStatus}
              stageComplete={battle.hasWon}
              stageReport={battle.stagePracticeReport}
            />
          </aside>
        </div>
      </section>
    );
  }

  return (
    <section className="pointer-events-none absolute inset-x-3 bottom-[var(--vn-panel-bottom)] z-50 h-[min(28rem,48dvh)] sm:inset-x-10 sm:h-[var(--vn-panel-height)] lg:inset-x-16">
      <PronunciationScoreFlashOverlay flash={pronunciationFlash} />
      <div className="vn-glass-panel pointer-events-auto grid h-full gap-2 overflow-y-auto p-3 sm:grid-cols-[minmax(0,1.18fr)_minmax(12rem,0.5fr)_minmax(15rem,0.62fr)] sm:p-3 lg:p-4">
        <div className="min-w-0">
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <span className="vn-status-chip px-3 py-1 font-display text-xs font-black uppercase tracking-[0.16em]">
              Su
            </span>
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">
              {isReviewingPrevious ? 'Review' : `Phrase ${lessonProgress}`}
            </span>
          </div>

          <p className="text-xl font-black leading-tight text-slate-950 sm:text-2xl lg:text-3xl">{currentPhrase.targetPhrase}</p>
          <p className="mt-1 text-base font-black leading-tight text-cyan-900 sm:text-lg lg:text-xl">{currentPhrase.romanization}</p>
          <p className="mt-0.5 text-[11px] font-black uppercase tracking-[0.08em] text-slate-600">Phonetic: {phoneticSpelling}</p>
          <p className="mt-2 text-sm font-bold leading-snug text-slate-700">
            {currentPhrase.translation}
            <span className="hidden sm:inline"> - {currentPhrase.context}</span>
          </p>

          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <div>
              <div className="mb-1 flex justify-between text-[10px] font-black uppercase tracking-[0.12em] text-slate-600">
                <span>Courage</span>
                <span>
                  {battle.courage}/{battle.maxCourage}
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
        </div>

        <div className="grid grid-cols-2 content-start gap-1.5 sm:grid-cols-1">
          {battle.hasWon ? (
            <button
              type="button"
              onClick={returnToOverworld}
              className="vn-action-button bg-emerald-300 px-3 py-2.5 text-left text-sm font-black uppercase tracking-[0.12em] text-slate-950"
            >
              Continue Journey
            </button>
          ) : (
            battleOptions.map((option) => {
              const isSpeak = option === 'Speak Phrase';
              const disabled = option === 'Hear Example' && (!phraseAudioSrc || isPhraseAudioPlaying);

              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    if (isSpeak && !pronunciationSession.current) {
                      phraseAudioPlayer.stop();
                      stopSuPlayback();
                      setListenHighlight(false);
                      void connectVoiceCoach();
                      return;
                    }

                    if (!isSpeak) chooseBattleOptionWithAudio(option);
                  }}
                  onPointerDown={isSpeak ? startVoiceAttemptWithPointerCapture : undefined}
                  onPointerUp={isSpeak ? stopVoiceAttemptWithPointerCapture : undefined}
                  onPointerCancel={isSpeak ? stopVoiceAttemptWithPointerCapture : undefined}
                  disabled={disabled || isConnecting}
                  className={`vn-action-button px-3 py-1.5 text-left text-xs font-black uppercase tracking-[0.1em] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none sm:py-2 ${
                    isSpeak
                      ? isRecording
                        ? 'bg-red-500 text-white'
                        : 'bg-emerald-300 text-emerald-950'
                      : 'bg-white text-slate-950'
                  }`}
                >
                  {battleOptionLabels[option]}
                  {isSpeak ? (
                    <span className="mt-0.5 block text-[10px] normal-case tracking-normal opacity-80">
                      {!hasVoiceCoach ? `Connect ${voiceMode === 'whisper' ? 'Whisper' : 'Realtime'} mic` : isRecording ? 'Release to judge' : 'Hold to talk'}
                    </span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>

        <div className="min-w-0">
          <SuPronunciationJudge
            hasVoiceCoach={hasVoiceCoach}
            isConnecting={isConnecting}
            isRecording={isRecording}
            verdict={verdict}
            voiceError={voiceError || phraseAudioError || suAudioPlayer.error}
            voiceStatus={voiceStatus}
            stageComplete={battle.hasWon}
            stageReport={battle.stagePracticeReport}
          />
        </div>
      </div>
    </section>
  );
}
