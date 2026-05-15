import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { lessonScenarios } from '../data/lessonScenarios';
import { getPhrasePhoneticSpelling } from '../data/thaiPhrases';
import { getVoiceJudgeMode, VOICE_JUDGE_MODE_CHANGED_EVENT, type VoiceJudgeMode } from '../services/openAiSettings';
import { getPhraseAudioSrc } from '../services/phraseAudio';
import { createPronunciationSession, type PronunciationSession, type PronunciationVerdict } from '../services/realtimePronunciation';
import { getSoundSettings, SOUND_SETTINGS_CHANGED_EVENT, type SoundSettings } from '../services/soundSettings';
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
  const [isPhraseAudioPlaying, setIsPhraseAudioPlaying] = useState(false);
  const [phraseAudioError, setPhraseAudioError] = useState('');
  const [voiceMode, setVoiceMode] = useState<VoiceJudgeMode>(() => getVoiceJudgeMode());
  const [soundSettings, setSoundSettings] = useState<SoundSettings>(() => getSoundSettings());
  const [verdict, setVerdict] = useState<PronunciationVerdict | null>(null);
  const pronunciationSession = useRef<PronunciationSession | null>(null);
  const connectionPromise = useRef<Promise<PronunciationSession | null> | null>(null);
  const pressedSpeakPointers = useRef<Set<number>>(new Set());
  const phraseAudio = useRef<HTMLAudioElement | null>(null);
  const activeScenario = lessonScenarios[activeScenarioIndex] ?? lessonScenarios[0];
  const activePhrases = useMemo(() => activeScenario.chunks.flatMap((chunk) => chunk.phrases), [activeScenario]);
  const displayedPhraseIndex = battle.reviewPhraseIndex ?? battle.phraseIndex;
  const isReviewingPrevious = battle.reviewPhraseIndex !== null;
  const currentPhrase = activePhrases[displayedPhraseIndex] ?? activePhrases[0];
  const phraseAudioSrc = getPhraseAudioSrc(currentPhrase);
  const lessonProgress = `${Math.min(displayedPhraseIndex + 1, activePhrases.length)}/${activePhrases.length}`;
  const phoneticSpelling = getPhrasePhoneticSpelling(currentPhrase);
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

  useEffect(() => {
    return () => {
      pronunciationSession.current?.disconnect();
      pronunciationSession.current = null;
      phraseAudio.current?.pause();
      phraseAudio.current = null;
    };
  }, []);

  useEffect(() => {
    phraseAudio.current?.pause();
    phraseAudio.current = null;
    setIsPhraseAudioPlaying(false);
    setPhraseAudioError('');
  }, [phraseAudioSrc]);

  useEffect(() => {
    const currentAudio = phraseAudio.current;
    if (!currentAudio) return;

    currentAudio.volume = soundSettings.guideAudioVolume;
    if (!soundSettings.guideAudioEnabled) {
      currentAudio.pause();
      phraseAudio.current = null;
      setIsPhraseAudioPlaying(false);
    }
  }, [soundSettings.guideAudioEnabled, soundSettings.guideAudioVolume]);

  async function connectVoiceCoach(): Promise<PronunciationSession | null> {
    if (pronunciationSession.current) return pronunciationSession.current;
    if (connectionPromise.current) return connectionPromise.current;

    setIsConnecting(true);
    setVoiceError('');
    setVerdict(null);
    const selectedMode = getVoiceJudgeMode();
    setVoiceMode(selectedMode);

    connectionPromise.current = (async () => {
      const createSession = selectedMode === 'whisper' ? createWhisperPronunciationSession : createPronunciationSession;
      const session = await createSession({
        prompt: pronunciationPrompt,
        onStatus: setVoiceStatus,
        onError: (message) => {
          setVoiceError(message);
          setVoiceStatus('Voice coach needs another try.');
        },
        onVerdict: (nextVerdict) => {
          setVerdict(nextVerdict);
          setVoiceStatus(nextVerdict.pass ? 'Pronunciation accepted.' : 'Pronunciation needs another try.');
          submitPronunciationResult(nextVerdict);
        },
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
    setVoiceError('');
    setVerdict(null);
    session.updatePrompt(pronunciationPrompt);
    session.startRecording();
    setIsRecording(true);
  }

  function stopVoiceAttempt() {
    if (!pronunciationSession.current || !isRecording) return;
    pronunciationSession.current.stopRecording();
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
      setPhraseAudioError('No guide audio is available for this phrase yet.');
      return;
    }

    if (!soundSettings.guideAudioEnabled) {
      setPhraseAudioError('Guide audio is turned off in Game Settings.');
      return;
    }

    setPhraseAudioError('');
    phraseAudio.current?.pause();
    const nextAudio = new Audio(phraseAudioSrc);
    nextAudio.volume = soundSettings.guideAudioVolume;
    phraseAudio.current = nextAudio;
    setIsPhraseAudioPlaying(true);

    nextAudio.addEventListener('ended', () => setIsPhraseAudioPlaying(false), { once: true });
    nextAudio.addEventListener(
      'error',
      () => {
        setIsPhraseAudioPlaying(false);
        setPhraseAudioError('The phrase audio could not be played.');
      },
      { once: true },
    );

    try {
      await nextAudio.play();
    } catch (error) {
      setIsPhraseAudioPlaying(false);
      setPhraseAudioError(error instanceof Error ? error.message : 'The phrase audio could not be played.');
    }
  }

  function chooseBattleOptionWithAudio(option: BattleOption) {
    if (option === 'Hear Example') {
      void playCurrentPhrase();
    }

    chooseBattleOption(option);
  }

  return (
    <section className="pointer-events-none absolute inset-x-3 bottom-[var(--vn-panel-bottom)] z-50 h-[var(--vn-panel-height)] sm:inset-x-10 lg:inset-x-16">
      <div className="pointer-events-auto grid h-full gap-2 overflow-y-auto border-[3px] border-slate-950 bg-white/96 p-3 shadow-[8px_8px_0_#0f172a] backdrop-blur sm:grid-cols-[minmax(0,1.25fr)_minmax(13rem,0.58fr)_minmax(15rem,0.58fr)] sm:p-3 lg:p-4">
        <div className="min-w-0">
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <span className="bg-slate-950 px-3 py-1 font-display text-xs font-black uppercase tracking-[0.16em] text-white">
              Su
            </span>
            <span className="vn-outline-label text-[10px] font-black uppercase tracking-[0.14em]">
              {isReviewingPrevious ? 'Review' : `Phrase ${lessonProgress}`}
            </span>
          </div>

          <p className="vn-outline-text text-xl font-black leading-tight sm:text-2xl lg:text-3xl">{currentPhrase.targetPhrase}</p>
          <p className="vn-outline-subtext mt-1 text-base font-black leading-tight sm:text-lg lg:text-xl">{currentPhrase.romanization}</p>
          <p className="vn-outline-label mt-0.5 text-[11px] font-black uppercase tracking-[0.08em]">Phonetic: {phoneticSpelling}</p>
          <p className="vn-outline-subtext mt-2 text-sm font-bold leading-snug">
            {currentPhrase.translation}
            <span className="hidden sm:inline"> - {currentPhrase.context}</span>
          </p>

          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <div>
              <div className="vn-outline-label mb-1 flex justify-between text-[10px] font-black uppercase tracking-[0.12em]">
                <span>Courage</span>
                <span>
                  {battle.courage}/{battle.maxCourage}
                </span>
              </div>
              <div className="h-2.5 overflow-hidden border-2 border-slate-950 bg-rose-100">
                <div className="h-full bg-fuchsia-400" style={{ width: `${couragePercent}%` }} />
              </div>
            </div>
            <div>
              <div className="vn-outline-label mb-1 flex justify-between text-[10px] font-black uppercase tracking-[0.12em]">
                <span>Understanding</span>
                <span>{Math.round(understandingPercent)}%</span>
              </div>
              <div className="h-2.5 overflow-hidden border-2 border-slate-950 bg-cyan-100">
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
              className="border-[3px] border-slate-950 bg-emerald-300 px-3 py-2.5 text-left text-sm font-black uppercase tracking-[0.12em] text-slate-950 shadow-[5px_5px_0_#0f172a] active:translate-y-1"
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
                      void connectVoiceCoach();
                      return;
                    }

                    if (!isSpeak) chooseBattleOptionWithAudio(option);
                  }}
                  onPointerDown={isSpeak ? startVoiceAttemptWithPointerCapture : undefined}
                  onPointerUp={isSpeak ? stopVoiceAttemptWithPointerCapture : undefined}
                  onPointerCancel={isSpeak ? stopVoiceAttemptWithPointerCapture : undefined}
                  disabled={disabled || isConnecting}
                  className={`border-[3px] px-3 py-1.5 text-left text-xs font-black uppercase tracking-[0.1em] shadow-[4px_4px_0_#0f172a] active:translate-y-1 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none sm:py-2 ${
                    isSpeak
                      ? isRecording
                        ? 'border-red-950 bg-red-500 text-white'
                        : 'border-emerald-950 bg-emerald-300 text-emerald-950'
                      : 'border-slate-950 bg-white text-slate-950'
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
            voiceError={voiceError || phraseAudioError}
            voiceStatus={voiceStatus}
          />
        </div>
      </div>
    </section>
  );
}
