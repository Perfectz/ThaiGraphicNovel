import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import '../styles/battle-demo.css';
import {
  conversationTurns,
  demoAlly,
  demoEnemy,
  demoHero,
  type BattleElement,
  type ConversationTurn,
  type DemoTechnique,
} from '../data/phantasyBattleDemo';
import {
  getVoiceJudgeMode,
  VOICE_JUDGE_MODE_CHANGED_EVENT,
  type VoiceJudgeMode,
} from '../services/openAiSettings';
import {
  createPronunciationSession,
  type PronunciationPrompt,
  type PronunciationSession,
  type PronunciationVerdict,
} from '../services/realtimePronunciation';
import { createWhisperPronunciationSession } from '../services/whisperPronunciation';
import { Button, Chip, MicButton, StatBar, VerdictBadge } from './ui';
import { BattleStage3D } from './BattleStage3D';

// ─────────────────────────────────────────────────────────────────────────
// Type definitions
// ─────────────────────────────────────────────────────────────────────────

type BattlePhase =
  | 'intro' // Banner flash on entry
  | 'commandSelect' // Hero picks a conversational move
  | 'heroAttack' // VFX animates on the enemy
  | 'enemyChallenge' // Enemy forces a required response
  | 'victory'
  | 'defeat';

type LogEntry = {
  id: number;
  speaker: 'system' | 'hero' | 'enemy' | 'narrator';
  text: string;
};

type DamageNumber = {
  id: number;
  target: 'hero' | 'enemy';
  amount: number;
  variant: 'phys' | 'fire' | 'ice' | 'bolt' | 'holy' | 'wind' | 'shadow' | 'heal' | 'miss';
};

type ActiveVfx = {
  id: number;
  element: BattleElement;
  target: 'hero' | 'enemy';
  techniqueId?: string;
};

type BattleState = {
  hero: {
    hp: number;
    maxHp: number;
    mp: number;
    maxMp: number;
    nextAttackMultiplier: number;
    guard: number;
    isCasting: boolean;
    isHurt: boolean;
  };
  enemy: {
    hp: number;
    maxHp: number;
    stunnedTurns: number;
    isHurt: boolean;
    isCasting: boolean;
    isDefeated: boolean;
  };
  phase: BattlePhase;
  turnCount: number;
  log: LogEntry[];
  damageNumbers: DamageNumber[];
  vfx: ActiveVfx[];
  turnIndex: number;
  lastScore: number | null;
  hasShake: boolean;
};

// ─────────────────────────────────────────────────────────────────────────
// State machine
// ─────────────────────────────────────────────────────────────────────────

type Action =
  | { kind: 'init' }
  | { kind: 'enterCommandSelect' }
  | { kind: 'startHeroMove'; technique: DemoTechnique }
  | { kind: 'startCounterResponse' }
  | { kind: 'resolveHeroMove'; technique: DemoTechnique; verdict: PronunciationVerdict }
  | { kind: 'resolveEnemyChallenge'; technique: DemoTechnique; verdict: PronunciationVerdict }
  | { kind: 'clearShake' }
  | { kind: 'clearVfx'; id: number }
  | { kind: 'clearDamage'; id: number }
  | { kind: 'clearHurt'; target: 'hero' | 'enemy' }
  | { kind: 'clearCast'; target: 'hero' | 'enemy' }
  | { kind: 'declareVictory' }
  | { kind: 'declareDefeat' }
  | { kind: 'reset' };

let idCounter = 0;
function nextId() {
  idCounter += 1;
  return idCounter;
}

const initialState: BattleState = {
  hero: {
    hp: demoHero.hp,
    maxHp: demoHero.maxHp,
    mp: demoHero.mp,
    maxMp: demoHero.maxMp,
    nextAttackMultiplier: 1,
    guard: 0,
    isCasting: false,
    isHurt: false,
  },
  enemy: {
    hp: demoEnemy.hp,
    maxHp: demoEnemy.maxHp,
    stunnedTurns: 0,
    isHurt: false,
    isCasting: false,
    isDefeated: false,
  },
  phase: 'intro',
  turnCount: 1,
  log: [
    { id: nextId(), speaker: 'narrator', text: `A ${demoEnemy.name} blocks the Bangkok Rift.` },
    {
      id: nextId(),
      speaker: 'enemy',
      text: conversationTurns[0]?.enemyLine ?? '"Introduce yourselves."',
    },
  ],
  damageNumbers: [],
  vfx: [],
  turnIndex: 0,
  lastScore: null,
  hasShake: false,
};

function elementToDamageVariant(element: BattleElement): DamageNumber['variant'] {
  switch (element) {
    case 'lightning':
      return 'bolt';
    case 'slash':
      return 'phys';
    default:
      return element;
  }
}

function appendLog(state: BattleState, entry: Omit<LogEntry, 'id'>): BattleState {
  return {
    ...state,
    log: [...state.log.slice(-20), { id: nextId(), ...entry }],
  };
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreRatio(verdict: PronunciationVerdict) {
  return clampScore(verdict.score) / 100;
}

function scoredDamage(technique: DemoTechnique, verdict: PronunciationVerdict) {
  const ratio = scoreRatio(verdict);
  const floor = technique.kind === 'super' ? 12 : 5;
  return Math.max(0, Math.round(floor + technique.power * ratio));
}

function scoredHeal(technique: DemoTechnique, verdict: PronunciationVerdict) {
  return Math.max(8, Math.round(10 + technique.power * scoreRatio(verdict)));
}

function scoredGuard(verdict: PronunciationVerdict) {
  return Math.round(10 + clampScore(verdict.score) * 0.45);
}

function incomingDamage(basePower: number, guard: number, verdict: PronunciationVerdict) {
  const score = clampScore(verdict.score);
  if (score >= 65 || verdict.pass) return 0;
  return Math.max(4, Math.round(basePower + (65 - score) * 0.45 - guard));
}

function currentTurnFor(state: BattleState) {
  return conversationTurns[Math.min(state.turnIndex, conversationTurns.length - 1)] ?? conversationTurns[0];
}

function reduce(state: BattleState, action: Action): BattleState {
  switch (action.kind) {
    case 'init':
      return { ...initialState, phase: 'intro' };

    case 'enterCommandSelect':
      return { ...state, phase: 'commandSelect' };

    case 'startHeroMove': {
      const t = action.technique;
      if (state.hero.mp < t.mpCost) return appendLog(state, { speaker: 'system', text: 'Not enough MP.' });
      return {
        ...state,
        hero: {
          ...state.hero,
          mp: Math.max(0, state.hero.mp - t.mpCost),
          isCasting: true,
        },
        phase: 'heroAttack',
      };
    }

    case 'startCounterResponse':
      return {
        ...state,
        hero: { ...state.hero, isCasting: true },
        enemy: { ...state.enemy, isCasting: false },
        phase: 'heroAttack',
      };

    case 'resolveHeroMove': {
      const { technique, verdict } = action;
      const score = clampScore(verdict.score);
      let next: BattleState = {
        ...state,
        lastScore: score,
        hero: { ...state.hero, isCasting: false },
      };

      if (technique.kind === 'heal') {
        const amount = scoredHeal(technique, verdict);
        const newHp = Math.min(next.hero.maxHp, next.hero.hp + amount);
        const restored = newHp - next.hero.hp;
        next = {
          ...next,
          hero: { ...next.hero, hp: newHp },
          damageNumbers: [
            ...next.damageNumbers,
            { id: nextId(), target: 'hero', amount: restored, variant: 'heal' },
          ],
          vfx: [...next.vfx, { id: nextId(), element: 'holy', target: 'hero', techniqueId: technique.id }],
        };
        next = appendLog(next, {
          speaker: 'narrator',
          text: `Su coaches the phrase. Score ${score}/100 restores ${restored} HP.`,
        });
      } else if (technique.kind === 'defend') {
        const guard = scoredGuard(verdict);
        next = {
          ...next,
          hero: { ...next.hero, guard: Math.max(next.hero.guard, guard) },
          vfx: [...next.vfx, { id: nextId(), element: 'wind', target: 'hero', techniqueId: technique.id }],
        };
        next = appendLog(next, {
          speaker: 'narrator',
          text: `Su explains Patrick is still learning. Score ${score}/100 raises Guard by ${guard}.`,
        });
      } else {
        const damage = scoredDamage(technique, verdict);
        const newHp = Math.max(0, next.enemy.hp - damage);
        next = {
          ...next,
          enemy: { ...next.enemy, hp: newHp, isHurt: true, isDefeated: newHp <= 0 },
          damageNumbers: [
            ...next.damageNumbers,
            {
              id: nextId(),
              target: 'enemy',
              amount: damage,
              variant: elementToDamageVariant(technique.element),
            },
          ],
          vfx: [
            ...next.vfx,
            { id: nextId(), element: technique.element, target: 'enemy', techniqueId: technique.id },
          ],
          hasShake: damage > 0,
        };
        next = appendLog(next, {
          speaker: 'narrator',
          text: `Patrick's phrasing scored ${score}/100. ${demoEnemy.name} takes ${damage} resolve damage.`,
        });
      }

      next = appendLog(next, { speaker: 'hero', text: `${technique.thai} — ${technique.translation}` });
      if (next.enemy.hp <= 0 || next.enemy.isDefeated) return { ...next, phase: 'victory' };
      return { ...next, phase: 'enemyChallenge', enemy: { ...next.enemy, isCasting: true } };
    }

    case 'resolveEnemyChallenge': {
      const { technique, verdict } = action;
      const score = clampScore(verdict.score);
      const damage = incomingDamage(demoEnemy.attackPower, state.hero.guard, verdict);
      const newHp = Math.max(0, state.hero.hp - damage);
      const nextTurnIndex = state.turnIndex + 1;
      const completedScript = nextTurnIndex >= conversationTurns.length;
      let next: BattleState = {
        ...state,
        turnIndex: Math.min(nextTurnIndex, conversationTurns.length - 1),
        turnCount: Math.min(nextTurnIndex + 1, conversationTurns.length),
        lastScore: score,
        enemy: { ...state.enemy, isCasting: false },
        hero: { ...state.hero, hp: newHp, guard: 0, isCasting: false, isHurt: damage > 0 },
        phase: damage > 0 && newHp <= 0 ? 'defeat' : completedScript ? 'victory' : 'commandSelect',
      };

      if (damage > 0) {
        next = {
          ...next,
          damageNumbers: [
            ...next.damageNumbers,
            { id: nextId(), target: 'hero', amount: damage, variant: 'shadow' },
          ],
          vfx: [...next.vfx, { id: nextId(), element: demoEnemy.attackElement, target: 'hero' }],
          hasShake: true,
        };
        next = appendLog(next, {
          speaker: 'enemy',
          text: `${demoEnemy.attackName}: score ${score}/100. Patrick takes ${damage} damage.`,
        });
      } else {
        const counterDamage = Math.round(8 + technique.power * scoreRatio(verdict));
        const enemyHp = Math.max(0, next.enemy.hp - counterDamage);
        next = {
          ...next,
          enemy: { ...next.enemy, hp: enemyHp, isHurt: true, isDefeated: enemyHp <= 0 },
          damageNumbers: [
            ...next.damageNumbers,
            { id: nextId(), target: 'enemy', amount: counterDamage, variant: 'holy' },
          ],
          vfx: [...next.vfx, { id: nextId(), element: 'holy', target: 'enemy', techniqueId: technique.id }],
        };
        next = appendLog(next, {
          speaker: 'narrator',
          text: `The forced response holds. Score ${score}/100 prevents damage and counters for ${counterDamage}.`,
        });
      }

      if (next.enemy.hp <= 0 || next.enemy.isDefeated) return { ...next, phase: 'victory' };
      if (next.phase === 'commandSelect') {
        const upcoming = conversationTurns[next.turnIndex];
        if (upcoming) next = appendLog(next, { speaker: 'enemy', text: upcoming.enemyLine });
      }
      return next;
    }

    case 'clearShake':
      return { ...state, hasShake: false };

    case 'clearVfx':
      return { ...state, vfx: state.vfx.filter((v) => v.id !== action.id) };

    case 'clearDamage':
      return { ...state, damageNumbers: state.damageNumbers.filter((d) => d.id !== action.id) };

    case 'clearHurt':
      if (action.target === 'hero') {
        return { ...state, hero: { ...state.hero, isHurt: false } };
      }
      return { ...state, enemy: { ...state.enemy, isHurt: false } };

    case 'clearCast':
      if (action.target === 'hero') {
        return { ...state, hero: { ...state.hero, isCasting: false } };
      }
      return { ...state, enemy: { ...state.enemy, isCasting: false } };

    case 'declareVictory':
      return { ...state, phase: 'victory' };

    case 'declareDefeat':
      return { ...state, phase: 'defeat' };

    case 'reset':
      idCounter = 0;
      return {
        ...initialState,
        hero: { ...initialState.hero },
        enemy: { ...initialState.enemy },
        log: [
          { id: nextId(), speaker: 'narrator', text: `The ${demoEnemy.name} bars the Bangkok Rift.` },
          {
            id: nextId(),
            speaker: 'enemy',
            text: conversationTurns[0]?.enemyLine ?? '"Introduce yourselves."',
          },
        ],
      };

    default:
      return state;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────

export type PhantasyBattleDemoProps = {
  onExit?: () => void;
};

function techniqueToPronunciationPrompt(technique: DemoTechnique): PronunciationPrompt {
  return {
    targetPhrase: technique.thai,
    romanization: technique.romanization,
    translation: technique.translation,
  };
}

export function PhantasyBattleDemo({ onExit }: PhantasyBattleDemoProps) {
  const [state, dispatch] = useReducer(reduce, initialState);
  const [bannerVisible, setBannerVisible] = useState(true);
  const [pendingVoiceTechnique, setPendingVoiceTechnique] = useState<DemoTechnique | null>(null);
  const [voiceMode, setVoiceMode] = useState<VoiceJudgeMode>(() => getVoiceJudgeMode());
  const [voiceStatus, setVoiceStatus] = useState('Pick a response, then say the Thai phrase.');
  const [voiceError, setVoiceError] = useState('');
  const [verdict, setVerdict] = useState<PronunciationVerdict | null>(null);
  const [isConnectingVoice, setIsConnectingVoice] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [isAwaitingVoiceResult, setIsAwaitingVoiceResult] = useState(false);
  const timers = useRef<Set<number>>(new Set());
  const pronunciationSession = useRef<PronunciationSession | null>(null);
  const connectionPromise = useRef<Promise<PronunciationSession | null> | null>(null);
  const pendingVoiceTechniqueRef = useRef<DemoTechnique | null>(null);
  const heroMpRef = useRef(state.hero.mp);

  const pronunciationPrompt = useMemo(
    () => (pendingVoiceTechnique ? techniqueToPronunciationPrompt(pendingVoiceTechnique) : null),
    [pendingVoiceTechnique],
  );

  useEffect(() => {
    pendingVoiceTechniqueRef.current = pendingVoiceTechnique;
    if (pendingVoiceTechnique && pronunciationPrompt) {
      pronunciationSession.current?.updatePrompt(pronunciationPrompt);
    }
  }, [pendingVoiceTechnique, pronunciationPrompt]);

  useEffect(() => {
    heroMpRef.current = state.hero.mp;
  }, [state.hero.mp]);

  // Helper to schedule a timeout and auto-cleanup on unmount.
  const schedule = useCallback((fn: () => void, delay: number) => {
    const id = window.setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, delay);
    timers.current.add(id);
    return id;
  }, []);

  useEffect(() => {
    const captured = timers.current;
    return () => {
      captured.forEach((id) => window.clearTimeout(id));
      captured.clear();
      pronunciationSession.current?.disconnect();
      pronunciationSession.current = null;
    };
  }, []);

  useEffect(() => {
    const handleVoiceModeChange = () => {
      setVoiceMode(getVoiceJudgeMode());
    };
    window.addEventListener(VOICE_JUDGE_MODE_CHANGED_EVENT, handleVoiceModeChange);
    window.addEventListener('storage', handleVoiceModeChange);
    return () => {
      window.removeEventListener(VOICE_JUDGE_MODE_CHANGED_EVENT, handleVoiceModeChange);
      window.removeEventListener('storage', handleVoiceModeChange);
    };
  }, []);

  // ── Intro banner sequencing ──
  useEffect(() => {
    if (state.phase !== 'intro') return;
    const bannerOff = window.setTimeout(() => setBannerVisible(false), 1300);
    const enter = window.setTimeout(() => dispatch({ kind: 'enterCommandSelect' }), 1400);
    return () => {
      window.clearTimeout(bannerOff);
      window.clearTimeout(enter);
    };
  }, [state.phase]);

  // ── Clear screen shake after animation ──
  useEffect(() => {
    if (!state.hasShake) return;
    const id = schedule(() => dispatch({ kind: 'clearShake' }), 300);
    return () => window.clearTimeout(id);
  }, [state.hasShake, schedule]);

  const prepareVoiceTechnique = useCallback((technique: DemoTechnique) => {
    if (heroMpRef.current < technique.mpCost) {
      setVoiceError('Not enough MP for that response.');
      return;
    }
    setPendingVoiceTechnique(technique);
    setVoiceError('');
    setVerdict(null);
    setIsAwaitingVoiceResult(false);
    setVoiceStatus(`Say ${technique.thai} clearly to use ${technique.name}.`);
  }, []);

  const connectVoiceCoach = useCallback(async (): Promise<PronunciationSession | null> => {
    const selectedMode = getVoiceJudgeMode();
    setVoiceMode(selectedMode);

    if (selectedMode === 'no-mic') {
      setVoiceError('Speaking requires Whisper or Realtime mode. Switch Voice Judge Mode in Game Settings.');
      setVoiceStatus('Responses are locked until a mic judge is enabled.');
      return null;
    }

    if (!pronunciationPrompt) {
      setVoiceError('Pick a response before connecting the voice judge.');
      return null;
    }

    if (pronunciationSession.current) return pronunciationSession.current;
    if (connectionPromise.current) return connectionPromise.current;

    setIsConnectingVoice(true);
    setVoiceError('');
    connectionPromise.current = (async () => {
      const sessionOptions = {
        prompt: pronunciationPrompt,
        onStatus: setVoiceStatus,
        onError: (message: string) => {
          setVoiceError(message);
          setVoiceStatus('Voice judge needs another try.');
          setIsAwaitingVoiceResult(false);
          setIsRecordingVoice(false);
        },
        onVerdict: (nextVerdict: PronunciationVerdict) => {
          setIsAwaitingVoiceResult(false);
          setIsRecordingVoice(false);
          setVerdict(nextVerdict);
          const technique = pendingVoiceTechniqueRef.current;
          if (technique) {
            setVoiceStatus(
              `${technique.kind === 'counter' ? 'Response' : 'Phrase'} scored ${nextVerdict.score}/100.`,
            );
            if (technique.kind === 'counter') {
              dispatch({ kind: 'startCounterResponse' });
            } else {
              dispatch({ kind: 'startHeroMove', technique });
            }
            schedule(() => {
              dispatch(
                technique.kind === 'counter'
                  ? { kind: 'resolveEnemyChallenge', technique, verdict: nextVerdict }
                  : { kind: 'resolveHeroMove', technique, verdict: nextVerdict },
              );
            }, 420);
            setPendingVoiceTechnique(null);
          } else {
            setVoiceStatus('Pick a response before speaking.');
          }
        },
      };
      const session =
        selectedMode === 'whisper'
          ? await createWhisperPronunciationSession(sessionOptions)
          : await createPronunciationSession({
              ...sessionOptions,
              enableFailureCoachingAudio: false,
            });
      pronunciationSession.current = session;
      return session;
    })();

    try {
      return await connectionPromise.current;
    } catch (error) {
      setVoiceError(error instanceof Error ? error.message : String(error));
      setVoiceStatus(
        `${selectedMode === 'whisper' ? 'Local Whisper' : 'Realtime'} voice judge could not connect.`,
      );
      return null;
    } finally {
      setIsConnectingVoice(false);
      connectionPromise.current = null;
    }
  }, [pronunciationPrompt, schedule]);

  const startVoiceAttempt = useCallback(
    (session: PronunciationSession) => {
      if (!pronunciationPrompt || isRecordingVoice || isAwaitingVoiceResult) return;
      setVoiceError('');
      setVerdict(null);
      setIsAwaitingVoiceResult(false);
      session.updatePrompt(pronunciationPrompt);
      session.startRecording();
      setIsRecordingVoice(true);
    },
    [isAwaitingVoiceResult, isRecordingVoice, pronunciationPrompt],
  );

  const handleVoiceStart = useCallback(() => {
    if (!pendingVoiceTechnique) {
      setVoiceError('Pick a response before speaking.');
      return;
    }
    if (pronunciationSession.current) {
      startVoiceAttempt(pronunciationSession.current);
      return;
    }
    void connectVoiceCoach().then((session) => {
      if (session) startVoiceAttempt(session);
    });
  }, [connectVoiceCoach, pendingVoiceTechnique, startVoiceAttempt]);

  const handleVoiceStop = useCallback(() => {
    if (!pronunciationSession.current || !isRecordingVoice) return;
    pronunciationSession.current.stopRecording();
    setIsAwaitingVoiceResult(true);
    setIsRecordingVoice(false);
  }, [isRecordingVoice]);

  // After a scored hero move lands, clear the enemy reaction flash.
  useEffect(() => {
    if (!state.enemy.isHurt) return;
    const t1 = schedule(() => dispatch({ kind: 'clearHurt', target: 'enemy' }), 520);
    return () => window.clearTimeout(t1);
  }, [state.enemy.isHurt, schedule]);

  // Clear hero hurt after enemy attack lands.
  useEffect(() => {
    if (!state.hero.isHurt) return;
    const t = schedule(() => dispatch({ kind: 'clearHurt', target: 'hero' }), 520);
    return () => window.clearTimeout(t);
  }, [state.hero.isHurt, schedule]);

  // Clean up damage numbers after their float animation.
  useEffect(() => {
    if (!state.damageNumbers.length) return;
    const timers = state.damageNumbers.map((d) =>
      window.setTimeout(() => dispatch({ kind: 'clearDamage', id: d.id }), 1200),
    );
    return () => timers.forEach(window.clearTimeout);
  }, [state.damageNumbers]);

  // Clean up VFX after their animation finishes.
  useEffect(() => {
    if (!state.vfx.length) return;
    const timers = state.vfx.map((v) =>
      window.setTimeout(() => dispatch({ kind: 'clearVfx', id: v.id }), 1000),
    );
    return () => timers.forEach(window.clearTimeout);
  }, [state.vfx]);

  // Victory cue.
  useEffect(() => {
    if (state.phase !== 'victory') return;
    setBannerVisible(true);
    const t = window.setTimeout(() => setBannerVisible(false), 2200);
    return () => window.clearTimeout(t);
  }, [state.phase]);

  const currentTurn = currentTurnFor(state);

  useEffect(() => {
    if (state.phase !== 'enemyChallenge') return;
    if (pendingVoiceTechnique?.kind === 'counter') return;
    setPendingVoiceTechnique(currentTurn.counter);
    setVoiceError('');
    setVerdict(null);
    setIsAwaitingVoiceResult(false);
    setVoiceStatus(`The Guardian presses: say ${currentTurn.counter.thai} to prevent damage.`);
  }, [currentTurn, pendingVoiceTechnique?.kind, state.phase]);

  // ─────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────

  return (
    <main
      className="bd-stage relative h-dvh w-screen overflow-hidden text-paper"
      aria-label="Phantasy Star 4 style battle demo"
    >
      {/* Top chrome: title + exit */}
      <header className="bd-topbar absolute left-3 right-3 top-3 z-40 flex items-center justify-between sm:left-6 sm:right-6 sm:top-5">
        <div className="flex items-center gap-2">
          <Chip tone="accent">Demo</Chip>
          <span className="font-display text-[0.7rem] font-bold uppercase tracking-[0.22em] text-paper-muted">
            Rift Conversation · Turn {state.turnCount}/10
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={onExit}>
          ✕ Exit Demo
        </Button>
      </header>

      {/* Intro / Victory banner */}
      {bannerVisible && state.phase === 'intro' ? (
        <BattleBanner name={demoEnemy.name} subtitle={demoEnemy.subtitle} />
      ) : null}
      {bannerVisible && state.phase === 'victory' ? (
        <>
          <BattleBanner name="Victory" subtitle="The Rift Guardian opens the gate." accent="jade" />
          <div className="bd-victory" />
        </>
      ) : null}
      {state.phase === 'defeat' ? (
        <BattleBanner name="Defeat" subtitle="Su pulls you back from the Rift." accent="ember" />
      ) : null}

      {/* 3D battle stage — temple gate arena with rigged heroes + boss */}
      <BattleStage3D
        heroCasting={state.hero.isCasting}
        heroHurt={state.hero.isHurt}
        heroDown={state.phase === 'defeat'}
        heroVictory={state.phase === 'victory'}
        suCasting={pendingVoiceTechnique?.kind === 'heal' || pendingVoiceTechnique?.kind === 'defend'}
        suDown={state.phase === 'defeat'}
        enemyHurt={state.enemy.isHurt}
        enemyCasting={state.enemy.isCasting}
        enemyDown={state.enemy.isDefeated || state.phase === 'victory'}
        vfx={state.vfx}
        hasShake={state.hasShake}
      />

      {/* Battlefield HUD overlay (canvas renders behind this) */}
      <section className="bd-layout absolute inset-0 z-10 grid grid-rows-[1fr_auto]">
        <div className="bd-field pointer-events-none relative">
          <div className="bd-damage-zone bd-damage-zone--hero">
            <DamageStack damageNumbers={state.damageNumbers.filter((d) => d.target === 'hero')} />
          </div>
          <div className="bd-damage-zone bd-damage-zone--enemy">
            <DamageStack damageNumbers={state.damageNumbers.filter((d) => d.target === 'enemy')} />
          </div>
        </div>

        {/* Floating character info cards above the HUD */}
        <div className="bd-status-cards pointer-events-none absolute left-3 right-3 top-16 z-20 flex items-start justify-between gap-3 sm:left-12 sm:right-12 sm:top-20">
          <div className="pointer-events-auto flex flex-col gap-2">
            <CharacterCard
              name={demoHero.name}
              subtitle={demoHero.subtitle}
              hp={state.hero.hp}
              maxHp={state.hero.maxHp}
              mp={state.hero.mp}
              maxMp={state.hero.maxMp}
            />
            <CharacterCard
              name={demoAlly.name}
              subtitle={demoAlly.subtitle}
              hp={state.hero.maxHp}
              maxHp={state.hero.maxHp}
              compact
            />
          </div>
          <div className="pointer-events-auto">
            <CharacterCard
              name={demoEnemy.name}
              subtitle={demoEnemy.subtitle}
              hp={state.enemy.hp}
              maxHp={state.enemy.maxHp}
              tone="ember"
              stunned={state.enemy.stunnedTurns > 0}
            />
          </div>
        </div>

        {/* Bottom panel — command menu + log, PS4-style */}
        <div className="bd-command-panel grid grid-cols-1 gap-3 border-t border-hairline bg-ink-raised/95 p-3 backdrop-blur sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-4 sm:p-5">
          {/* Log column */}
          <BattleLog log={state.log} />

          {/* Command / Technique / Conversation column */}
          <div className="min-w-0">
            {state.phase === 'commandSelect' ? (
              <>
                <CommandMenu currentTurn={currentTurn} onPick={(move) => prepareVoiceTechnique(move)} />
                {pendingVoiceTechnique && pendingVoiceTechnique.kind !== 'counter' ? (
                  <VoiceCastPanel
                    technique={pendingVoiceTechnique}
                    voiceMode={voiceMode}
                    voiceStatus={voiceStatus}
                    voiceError={voiceError}
                    verdict={verdict}
                    isConnectingVoice={isConnectingVoice}
                    isRecordingVoice={isRecordingVoice}
                    isAwaitingVoiceResult={isAwaitingVoiceResult}
                    onVoiceStart={handleVoiceStart}
                    onVoiceStop={handleVoiceStop}
                    onCancel={() => setPendingVoiceTechnique(null)}
                  />
                ) : null}
              </>
            ) : null}

            {state.phase === 'enemyChallenge' ? (
              <EnemyChallengePanel
                turn={currentTurn}
                pendingTechnique={pendingVoiceTechnique}
                voiceMode={voiceMode}
                voiceStatus={voiceStatus}
                voiceError={voiceError}
                verdict={verdict}
                isConnectingVoice={isConnectingVoice}
                isRecordingVoice={isRecordingVoice}
                isAwaitingVoiceResult={isAwaitingVoiceResult}
                onVoiceStart={handleVoiceStart}
                onVoiceStop={handleVoiceStop}
              />
            ) : null}

            {state.phase === 'heroAttack' ? <ActionPlayingPanel attacker={demoHero.name} /> : null}

            {state.phase === 'victory' ? (
              <ResolutionPanel
                title="Stage Cleared"
                description="The Rift Guardian yields. Su nods — your Thai grew stronger."
                actionLabel="Replay"
                onAction={() => dispatch({ kind: 'reset' })}
                secondaryLabel="Exit"
                onSecondary={onExit}
                tone="jade"
              />
            ) : null}
            {state.phase === 'defeat' ? (
              <ResolutionPanel
                title="You Fell"
                description="Doubt overwhelmed Patrick. Try again with clearer Thai responses."
                actionLabel="Retry"
                onAction={() => dispatch({ kind: 'reset' })}
                secondaryLabel="Exit"
                onSecondary={onExit}
                tone="ember"
              />
            ) : null}
            {state.phase === 'intro' ? (
              <div className="rounded-md border border-hairline bg-ink-elevated p-4">
                <p className="text-[0.7rem] font-bold uppercase tracking-[0.22em] text-accent">Encounter</p>
                <p className="mt-1 text-sm font-medium text-paper">
                  This is a 10-turn polite conversation. Patrick's Thai score drives damage, Su can coach or
                  protect, and the Guardian forces specific replies between turns.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────────────────

function BattleBanner({
  name,
  subtitle,
  accent,
}: {
  name: string;
  subtitle: string;
  accent?: 'jade' | 'ember';
}) {
  const colorClass = accent === 'jade' ? 'text-jade' : accent === 'ember' ? 'text-ember' : 'text-accent';
  return (
    <div className="bd-banner">
      <div className={`bd-banner__name ${colorClass}`}>{name}</div>
      <div className="bd-banner__sub">{subtitle}</div>
    </div>
  );
}

function DamageStack({ damageNumbers }: { damageNumbers: DamageNumber[] }) {
  return (
    <>
      {damageNumbers.map((d) => (
        <div key={d.id} className={`bd-damage bd-damage--${d.variant}`}>
          {d.variant === 'heal' ? `+${d.amount}` : d.amount}
        </div>
      ))}
    </>
  );
}

function CharacterCard({
  name,
  subtitle,
  hp,
  maxHp,
  mp,
  maxMp,
  tone = 'accent',
  stunned,
  compact = false,
}: {
  name: string;
  subtitle: string;
  hp: number;
  maxHp: number;
  mp?: number;
  maxMp?: number;
  tone?: 'accent' | 'ember';
  stunned?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={`w-full max-w-[16rem] rounded-md border border-hairline bg-ink-raised/85 shadow-card backdrop-blur ${
        compact ? 'p-2' : 'p-3'
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={`font-display font-black uppercase tracking-[0.18em] text-paper ${
            compact ? 'text-xs' : 'text-sm'
          }`}
        >
          {name}
        </span>
        {stunned ? <Chip tone="coach">Stunned</Chip> : null}
      </div>
      {!compact ? (
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-paper-muted">{subtitle}</p>
      ) : null}
      <div className={`space-y-2 ${compact ? 'mt-1' : 'mt-2'}`}>
        <StatBar label="HP" value={hp} max={maxHp} tone={tone === 'ember' ? 'ember' : 'jade'} />
        {typeof mp === 'number' && typeof maxMp === 'number' ? (
          <StatBar label="MP" value={mp} max={maxMp} tone="accent" />
        ) : null}
      </div>
    </div>
  );
}

function BattleLog({ log }: { log: LogEntry[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.scrollTop = ref.current.scrollHeight;
  }, [log]);

  const tone: Record<LogEntry['speaker'], string> = {
    system: 'text-paper-quiet',
    narrator: 'text-paper-muted',
    hero: 'text-accent',
    enemy: 'text-ember',
  };

  return (
    <div className="min-w-0">
      <p className="mb-1 text-[0.65rem] font-bold uppercase tracking-[0.22em] text-paper-muted">Battle Log</p>
      <div
        ref={ref}
        className="h-36 overflow-y-auto rounded-md border border-hairline bg-ink-elevated p-3 text-xs leading-relaxed sm:h-40"
      >
        {log.map((entry) => (
          <p key={entry.id} className={`mt-0.5 font-medium ${tone[entry.speaker]}`}>
            {entry.speaker === 'hero' ? '▶ ' : entry.speaker === 'enemy' ? '◆ ' : '· '}
            {entry.text}
          </p>
        ))}
      </div>
    </div>
  );
}

function CommandMenu({
  currentTurn,
  onPick,
}: {
  currentTurn: ConversationTurn;
  onPick: (move: DemoTechnique) => void;
}) {
  const commands: {
    kind: DemoTechnique['kind'];
    label: string;
    hint: string;
    move: DemoTechnique;
  }[] = [
    {
      kind: 'standard',
      label: 'Respond',
      hint: `Simple: ${currentTurn.simple.romanization}`,
      move: currentTurn.simple,
    },
    {
      kind: 'super',
      label: 'Long Reply',
      hint: `Harder: ${currentTurn.super.romanization}`,
      move: currentTurn.super,
    },
    {
      kind: 'heal',
      label: 'Su Coach',
      hint: 'Heal by drilling the phrase',
      move: currentTurn.heal,
    },
    {
      kind: 'defend',
      label: 'Su Cover',
      hint: "Guard while Su explains Patrick's Thai",
      move: currentTurn.defend,
    },
  ];
  return (
    <div className="rounded-md border border-accent/30 bg-ink-elevated p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-accent">
            ▶ Turn {currentTurn.turnNo} · {currentTurn.topic}
          </p>
          <p className="mt-1 text-sm font-medium text-paper">{currentTurn.enemyLine}</p>
        </div>
        <Chip tone="coach">10-turn talk</Chip>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {commands.map((c) => (
          <button
            key={c.kind}
            type="button"
            onClick={() => onPick(c.move)}
            className="bd-choice-card rounded-md border border-hairline bg-ink-raised px-3 py-2 text-left transition hover:border-accent"
          >
            <div className="font-display text-xs font-black uppercase tracking-[0.18em] text-paper">
              {c.label}
            </div>
            <div className="text-[0.65rem] font-medium text-paper-muted">{c.hint}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function EnemyChallengePanel({
  turn,
  pendingTechnique,
  voiceMode,
  voiceStatus,
  voiceError,
  verdict,
  isConnectingVoice,
  isRecordingVoice,
  isAwaitingVoiceResult,
  onVoiceStart,
  onVoiceStop,
}: {
  turn: ConversationTurn;
  pendingTechnique: DemoTechnique | null;
  voiceMode: VoiceJudgeMode;
  voiceStatus: string;
  voiceError: string;
  verdict: PronunciationVerdict | null;
  isConnectingVoice: boolean;
  isRecordingVoice: boolean;
  isAwaitingVoiceResult: boolean;
  onVoiceStart: () => void;
  onVoiceStop: () => void;
}) {
  return (
    <div className="rounded-md border border-ember/50 bg-ink-elevated p-3">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-ember">Enemy Pressure</p>
          <p className="mt-1 text-sm font-medium text-paper">{turn.counter.prompt}</p>
          <p className="mt-1 text-xs font-medium text-paper-muted">{turn.enemyLine}</p>
        </div>
        <Chip tone="ember">Block damage</Chip>
      </div>
      {pendingTechnique ? (
        <VoiceCastPanel
          technique={pendingTechnique}
          heading="Forced Response"
          micIdleLabel="Hold To Answer"
          micHint="Say this Thai response"
          voiceMode={voiceMode}
          voiceStatus={voiceStatus}
          voiceError={voiceError}
          verdict={verdict}
          isConnectingVoice={isConnectingVoice}
          isRecordingVoice={isRecordingVoice}
          isAwaitingVoiceResult={isAwaitingVoiceResult}
          onVoiceStart={onVoiceStart}
          onVoiceStop={onVoiceStop}
        />
      ) : null}
    </div>
  );
}
function VoiceCastPanel({
  technique,
  heading = 'Response Armed',
  micIdleLabel = 'Hold To Speak',
  micHint = 'Say the Thai response',
  voiceMode,
  voiceStatus,
  voiceError,
  verdict,
  isConnectingVoice,
  isRecordingVoice,
  isAwaitingVoiceResult,
  onVoiceStart,
  onVoiceStop,
  onCancel,
}: {
  technique: DemoTechnique;
  heading?: string;
  micIdleLabel?: string;
  micHint?: string;
  voiceMode: VoiceJudgeMode;
  voiceStatus: string;
  voiceError: string;
  verdict: PronunciationVerdict | null;
  isConnectingVoice: boolean;
  isRecordingVoice: boolean;
  isAwaitingVoiceResult: boolean;
  onVoiceStart: () => void;
  onVoiceStop: () => void;
  onCancel?: () => void;
}) {
  const disabled = isConnectingVoice || isAwaitingVoiceResult || voiceMode === 'no-mic';
  const verdictTone =
    verdict?.pass === true ? 'jade' : verdict && verdict.score >= 45 ? 'coach' : verdict ? 'ember' : null;

  return (
    <div className="bd-voice-cast mb-3 grid gap-3 rounded-md border border-accent/40 bg-ink-raised p-3 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-accent">{heading}</p>
        <p className="mt-1 font-display text-lg text-paper">
          {technique.thai}
          <span className="ml-2 text-sm text-paper-muted">{technique.romanization}</span>
        </p>
        <p className="mt-1 text-xs font-medium leading-relaxed text-paper-muted">{voiceStatus}</p>
        {voiceError ? <p className="mt-1 text-xs font-bold text-ember">{voiceError}</p> : null}
        {verdict && verdictTone ? (
          <VerdictBadge
            className="mt-2"
            tone={verdictTone}
            label={verdict.pass ? 'Accepted' : 'Try Again'}
            detail={`${verdict.score}/100${verdict.heard ? ` · Heard: ${verdict.heard}` : ''}`}
          />
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <MicButton
          isRecording={isRecordingVoice}
          onStart={onVoiceStart}
          onStop={onVoiceStop}
          disabled={disabled}
          label={
            isConnectingVoice
              ? 'Connecting'
              : isAwaitingVoiceResult
                ? 'Judging'
                : isRecordingVoice
                  ? 'Listening'
                  : micIdleLabel
          }
          hint={voiceMode === 'no-mic' ? 'Enable mic judging' : micHint}
          className="min-w-[9.5rem]"
        />
        {onCancel ? (
          <Button variant="quiet" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function ActionPlayingPanel({ attacker }: { attacker: string }) {
  return (
    <div className="grid h-full place-items-center rounded-md border border-hairline bg-ink-elevated p-4">
      <p className="font-display text-[0.7rem] font-bold uppercase tracking-[0.32em] text-accent">
        {attacker} is speaking...
      </p>
    </div>
  );
}

function ResolutionPanel({
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  tone,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  tone: 'jade' | 'ember';
}) {
  return (
    <div
      className={`rounded-md border p-3 ${tone === 'jade' ? 'border-jade/50 bg-jade/5' : 'border-ember/50 bg-ember/5'}`}
    >
      <p
        className={`text-[0.65rem] font-bold uppercase tracking-[0.22em] ${tone === 'jade' ? 'text-jade' : 'text-ember'}`}
      >
        {title}
      </p>
      <p className="mt-1 text-sm font-medium text-paper">{description}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={onAction} variant="primary" size="md">
          {actionLabel}
        </Button>
        {secondaryLabel && onSecondary ? (
          <Button onClick={onSecondary} variant="ghost" size="md">
            {secondaryLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export default PhantasyBattleDemo;
