import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import '../styles/battle-demo.css';
import {
  demoAlly,
  demoConversationPrompts,
  demoEnemy,
  demoHero,
  demoTechniques,
  type BattleElement,
  type ConversationChoice,
  type ConversationPrompt,
  type DemoTechnique,
} from '../data/phantasyBattleDemo';
import { Button, Chip, StatBar } from './ui';

// Real visual assets — Bangkok-rift temple gate background plus character
// sprites and the Rift Guardian boss in 4 emotional states.
import battleBackgroundUrl from '../assets/backgrounds/rift-negotiation-temple-gate.png';
import patrickBackSpriteUrl from '../assets/battle/patrick-back-sprite.png';
import suBattleSpriteUrl from '../assets/battle/su-battle-sprite.png';
import riftGuardianDefaultUrl from '../assets/characters/stage-10/rift-guardian/rift-guardian-determined.png';
import riftGuardianCastUrl from '../assets/characters/stage-10/rift-guardian/rift-guardian-explaining.png';
import riftGuardianHurtUrl from '../assets/characters/stage-10/rift-guardian/rift-guardian-surprised.png';
import riftGuardianDefeatedUrl from '../assets/characters/stage-10/rift-guardian/rift-guardian-worried.png';
import riftGuardianTauntUrl from '../assets/characters/stage-10/rift-guardian/rift-guardian-playful.png';

// ─────────────────────────────────────────────────────────────────────────
// Type definitions
// ─────────────────────────────────────────────────────────────────────────

type BattlePhase =
  | 'intro' // Banner flash on entry
  | 'commandSelect' // Hero picks Fight / Technique / Defend / Run
  | 'techniqueMenu' // Hero browses the Technique grid
  | 'heroAttack' // VFX animates on the enemy
  | 'enemyAttack' // VFX animates on the hero
  | 'conversation' // Dialogue choice prompt
  | 'victory'
  | 'defeat';

type CommandKind = 'fight' | 'technique' | 'defend' | 'flee';

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
};

type BattleState = {
  hero: {
    hp: number;
    maxHp: number;
    mp: number;
    maxMp: number;
    nextAttackMultiplier: number;
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
  conversationPromptIndex: number;
  hasShake: boolean;
};

// ─────────────────────────────────────────────────────────────────────────
// State machine
// ─────────────────────────────────────────────────────────────────────────

type Action =
  | { kind: 'init' }
  | { kind: 'enterCommandSelect' }
  | { kind: 'openTechniqueMenu' }
  | { kind: 'closeTechniqueMenu' }
  | { kind: 'heroCast'; technique: DemoTechnique }
  | { kind: 'heroBasicAttack' }
  | { kind: 'heroDefend' }
  | { kind: 'applyHeroDamageToEnemy'; amount: number; element: BattleElement; cry: string }
  | { kind: 'applyHealToHero'; amount: number }
  | { kind: 'enemyAttack' }
  | { kind: 'applyEnemyDamageToHero'; amount: number }
  | { kind: 'startConversation' }
  | { kind: 'resolveConversationChoice'; choice: ConversationChoice; prompt: ConversationPrompt }
  | { kind: 'clearShake' }
  | { kind: 'clearVfx'; id: number }
  | { kind: 'clearDamage'; id: number }
  | { kind: 'clearHurt'; target: 'hero' | 'enemy' }
  | { kind: 'clearCast'; target: 'hero' | 'enemy' }
  | { kind: 'declareVictory' }
  | { kind: 'declareDefeat' }
  | { kind: 'stunEnemy' }
  | { kind: 'advanceToEnemyTurn' }
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
    { id: nextId(), speaker: 'narrator', text: `A ${demoEnemy.name} blocks your path…` },
    { id: nextId(), speaker: 'enemy', text: '"Your tongue stumbles. You will fall here."' },
  ],
  damageNumbers: [],
  vfx: [],
  conversationPromptIndex: 0,
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

function reduce(state: BattleState, action: Action): BattleState {
  switch (action.kind) {
    case 'init':
      return { ...initialState, phase: 'intro' };

    case 'enterCommandSelect':
      return { ...state, phase: 'commandSelect' };

    case 'openTechniqueMenu':
      return { ...state, phase: 'techniqueMenu' };

    case 'closeTechniqueMenu':
      return { ...state, phase: 'commandSelect' };

    case 'heroCast': {
      const t = action.technique;
      if (state.hero.mp < t.mpCost) {
        return appendLog(state, { speaker: 'system', text: 'Not enough MP.' });
      }
      const next: BattleState = {
        ...state,
        hero: {
          ...state.hero,
          mp: state.hero.mp - t.mpCost,
          isCasting: true,
        },
        phase: 'heroAttack',
      };
      return appendLog(next, { speaker: 'hero', text: `${t.battleCry} — ${t.name}!` });
    }

    case 'heroBasicAttack': {
      return {
        ...state,
        hero: { ...state.hero, isCasting: true },
        phase: 'heroAttack',
        log: [...state.log.slice(-20), { id: nextId(), speaker: 'hero', text: 'A basic blow!' }],
      };
    }

    case 'heroDefend': {
      return appendLog(
        {
          ...state,
          hero: { ...state.hero, nextAttackMultiplier: state.hero.nextAttackMultiplier * 1.3 },
          enemy: { ...state.enemy, isCasting: true },
          phase: 'enemyAttack',
        },
        { speaker: 'system', text: 'You brace yourself. Next strike strengthened.' },
      );
    }

    case 'applyHeroDamageToEnemy': {
      const variance = 0.85 + Math.random() * 0.3;
      const rawDamage = Math.round(action.amount * state.hero.nextAttackMultiplier * variance);
      const newHp = Math.max(0, state.enemy.hp - rawDamage);
      const defeated = newHp <= 0;
      const next: BattleState = {
        ...state,
        hero: { ...state.hero, isCasting: false, nextAttackMultiplier: 1 },
        enemy: {
          ...state.enemy,
          hp: newHp,
          isHurt: true,
          isDefeated: defeated,
        },
        damageNumbers: [
          ...state.damageNumbers,
          {
            id: nextId(),
            target: 'enemy',
            amount: rawDamage,
            variant: elementToDamageVariant(action.element),
          },
        ],
        vfx: [...state.vfx, { id: nextId(), element: action.element, target: 'enemy' }],
        hasShake: true,
      };
      return appendLog(next, {
        speaker: 'narrator',
        text: `${demoEnemy.name} takes ${rawDamage} damage!`,
      });
    }

    case 'applyHealToHero': {
      const newHp = Math.min(state.hero.maxHp, state.hero.hp + action.amount);
      const restored = newHp - state.hero.hp;
      return appendLog(
        {
          ...state,
          hero: { ...state.hero, hp: newHp, isCasting: false, nextAttackMultiplier: 1 },
          damageNumbers: [
            ...state.damageNumbers,
            { id: nextId(), target: 'hero', amount: restored, variant: 'heal' },
          ],
          vfx: [...state.vfx, { id: nextId(), element: 'holy', target: 'hero' }],
        },
        { speaker: 'narrator', text: `You restore ${restored} HP.` },
      );
    }

    case 'enemyAttack': {
      // Stunned enemies skip their turn.
      if (state.enemy.stunnedTurns > 0) {
        return appendLog(
          {
            ...state,
            enemy: { ...state.enemy, stunnedTurns: state.enemy.stunnedTurns - 1 },
            phase: 'commandSelect',
            turnCount: state.turnCount + 1,
          },
          { speaker: 'narrator', text: `${demoEnemy.name} is stunned and cannot act!` },
        );
      }
      return {
        ...state,
        enemy: { ...state.enemy, isCasting: true },
        phase: 'enemyAttack',
      };
    }

    case 'applyEnemyDamageToHero': {
      const newHp = Math.max(0, state.hero.hp - action.amount);
      const defeated = newHp <= 0;
      const next: BattleState = {
        ...state,
        enemy: { ...state.enemy, isCasting: false },
        hero: { ...state.hero, hp: newHp, isHurt: true },
        damageNumbers: [
          ...state.damageNumbers,
          { id: nextId(), target: 'hero', amount: action.amount, variant: 'shadow' },
        ],
        vfx: [...state.vfx, { id: nextId(), element: demoEnemy.attackElement, target: 'hero' }],
        hasShake: true,
        phase: defeated ? 'defeat' : state.turnCount % 2 === 0 ? 'conversation' : 'commandSelect',
        turnCount: state.turnCount + 1,
      };
      return appendLog(next, {
        speaker: 'enemy',
        text: `${demoEnemy.attackName}! ${demoEnemy.attackFlavor}`,
      });
    }

    case 'startConversation':
      return { ...state, phase: 'conversation' };

    case 'resolveConversationChoice': {
      const { choice, prompt } = action;
      let next = appendLog(state, { speaker: 'hero', text: choice.label });
      next = appendLog(next, { speaker: 'narrator', text: choice.outcome });

      switch (choice.effect.kind) {
        case 'damage': {
          const newHp = Math.max(0, next.enemy.hp - choice.effect.amount);
          next = {
            ...next,
            enemy: { ...next.enemy, hp: newHp, isHurt: true, isDefeated: newHp <= 0 },
            damageNumbers: [
              ...next.damageNumbers,
              { id: nextId(), target: 'enemy', amount: choice.effect.amount, variant: 'phys' },
            ],
          };
          break;
        }
        case 'heal': {
          const delta = choice.effect.amount;
          const newHp = Math.max(0, Math.min(next.hero.maxHp, next.hero.hp + delta));
          next = {
            ...next,
            hero: { ...next.hero, hp: newHp, isHurt: delta < 0 },
            damageNumbers: [
              ...next.damageNumbers,
              {
                id: nextId(),
                target: 'hero',
                amount: Math.abs(delta),
                variant: delta >= 0 ? 'heal' : 'shadow',
              },
            ],
          };
          break;
        }
        case 'buff':
          next = {
            ...next,
            hero: { ...next.hero, nextAttackMultiplier: choice.effect.nextAttackMultiplier },
          };
          break;
        case 'mp': {
          const newMp = Math.max(0, Math.min(next.hero.maxMp, next.hero.mp + choice.effect.amount));
          next = { ...next, hero: { ...next.hero, mp: newMp } };
          break;
        }
        case 'stun':
          next = { ...next, enemy: { ...next.enemy, stunnedTurns: 1 } };
          break;
      }

      // Advance prompt pointer so the next conversation pulls a fresh prompt.
      next = {
        ...next,
        conversationPromptIndex: (next.conversationPromptIndex + 1) % demoConversationPrompts.length,
      };

      if (next.enemy.hp <= 0) {
        return { ...next, phase: 'victory' };
      }
      if (next.hero.hp <= 0) {
        return { ...next, phase: 'defeat' };
      }

      // Unused param suppression — prompt id might be useful for analytics later.
      void prompt;

      return { ...next, phase: 'commandSelect' };
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

    case 'stunEnemy':
      return appendLog(
        { ...state, enemy: { ...state.enemy, stunnedTurns: state.enemy.stunnedTurns + 1 } },
        { speaker: 'narrator', text: `${demoEnemy.name} is reeling from the breeze!` },
      );

    case 'advanceToEnemyTurn': {
      if (state.enemy.hp <= 0 || state.enemy.isDefeated) {
        return { ...state, phase: 'victory' };
      }
      // Stunned enemies skip their turn and return command to the hero.
      if (state.enemy.stunnedTurns > 0) {
        return appendLog(
          {
            ...state,
            enemy: { ...state.enemy, stunnedTurns: state.enemy.stunnedTurns - 1 },
            phase: 'commandSelect',
            turnCount: state.turnCount + 1,
          },
          { speaker: 'narrator', text: `${demoEnemy.name} is stunned and cannot act!` },
        );
      }
      return { ...state, phase: 'enemyAttack', enemy: { ...state.enemy, isCasting: true } };
    }

    case 'reset':
      idCounter = 0;
      return {
        ...initialState,
        hero: { ...initialState.hero },
        enemy: { ...initialState.enemy },
        log: [
          { id: nextId(), speaker: 'narrator', text: `The ${demoEnemy.name} bars the Bangkok Rift…` },
          {
            id: nextId(),
            speaker: 'enemy',
            text: '"Your tongue stumbles, traveler. The Rift will swallow you."',
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

export function PhantasyBattleDemo({ onExit }: PhantasyBattleDemoProps) {
  const [state, dispatch] = useReducer(reduce, initialState);
  const [bannerVisible, setBannerVisible] = useState(true);
  const timers = useRef<Set<number>>(new Set());

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

  // ── Hero attack pipeline: when a hero technique starts casting, fire its
  //    VFX/damage after the cast wind-up, then queue the enemy turn.
  const pendingTechnique = useRef<DemoTechnique | null>(null);
  const handleCommandFight = useCallback(() => {
    dispatch({ kind: 'heroBasicAttack' });
    pendingTechnique.current = null;
    schedule(() => {
      dispatch({
        kind: 'applyHeroDamageToEnemy',
        amount: 22,
        element: 'slash',
        cry: 'Basic strike',
      });
    }, 380);
  }, [schedule]);

  const handleTechniquePicked = useCallback(
    (technique: DemoTechnique) => {
      if (state.hero.mp < technique.mpCost) return;
      pendingTechnique.current = technique;
      dispatch({ kind: 'heroCast', technique });
      schedule(() => {
        if (technique.isHeal) {
          dispatch({ kind: 'applyHealToHero', amount: technique.power });
        } else {
          dispatch({
            kind: 'applyHeroDamageToEnemy',
            amount: technique.power,
            element: technique.element,
            cry: technique.battleCry,
          });
          if (technique.effect === 'stun') {
            // Stun applies on the resolve phase below.
          }
        }
      }, 480);
    },
    [schedule, state.hero.mp],
  );

  // After hero attack resolves: clear hurt, apply technique side effects, queue enemy.
  useEffect(() => {
    if (state.phase !== 'heroAttack') return;
    if (state.hero.isCasting) return; // still casting

    // Once the damage has landed (isCasting false), schedule cleanup & enemy turn.
    const t1 = schedule(() => dispatch({ kind: 'clearHurt', target: 'enemy' }), 520);
    const t2 = schedule(() => {
      // If the technique had a stun side effect, apply it before the enemy attempts to act.
      const tech = pendingTechnique.current;
      if (tech?.effect === 'stun') {
        dispatch({ kind: 'stunEnemy' });
      }
      pendingTechnique.current = null;
      dispatch({ kind: 'advanceToEnemyTurn' });
    }, 720);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.hero.isCasting]);

  // ── Enemy attack pipeline ──
  useEffect(() => {
    if (state.phase !== 'enemyAttack') return;
    if (!state.enemy.isCasting) return;
    const t = schedule(() => {
      dispatch({ kind: 'applyEnemyDamageToHero', amount: demoEnemy.attackPower });
    }, 460);
    return () => window.clearTimeout(t);
  }, [state.phase, state.enemy.isCasting, schedule]);

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

  const currentPrompt = demoConversationPrompts[state.conversationPromptIndex] ?? demoConversationPrompts[0];

  // ─────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────

  const showShake = state.hasShake;

  return (
    <main
      className={`bd-stage ${showShake ? 'bd-stage--shake' : ''} relative h-dvh w-screen overflow-hidden text-paper`}
      aria-label="Phantasy Star 4 style battle demo"
    >
      {/* Top chrome: title + exit */}
      <header className="bd-topbar absolute left-3 right-3 top-3 z-40 flex items-center justify-between sm:left-6 sm:right-6 sm:top-5">
        <div className="flex items-center gap-2">
          <Chip tone="accent">Demo</Chip>
          <span className="font-display text-[0.7rem] font-bold uppercase tracking-[0.22em] text-paper-muted">
            Rift Battle · Turn {state.turnCount}
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
          <BattleBanner name="Victory" subtitle="The Wraith dissolves into mist." accent="jade" />
          <div className="bd-victory" />
        </>
      ) : null}
      {state.phase === 'defeat' ? (
        <BattleBanner name="Defeat" subtitle="Su pulls you back from the Rift." accent="ember" />
      ) : null}

      {/* Background image + rift glow */}
      <div
        className="bd-stage__bg"
        style={{ backgroundImage: `url(${battleBackgroundUrl})` }}
        aria-hidden="true"
      />
      <div className="bd-stage__rift" aria-hidden="true" />

      {/* Battlefield */}
      <section className="bd-layout absolute inset-0 z-10 grid grid-rows-[1fr_auto]">
        <div className="bd-field relative grid grid-cols-[1.1fr_1fr] items-end gap-4 px-4 pb-4 pt-24 sm:px-12 sm:pt-28">
          {/* Hero side (left) — Patrick from back + Su as ally */}
          <div className="relative flex items-end justify-center gap-6">
            <BattlerSprite
              variant="hero"
              spriteUrl={patrickBackSpriteUrl}
              alt="Patrick from behind, facing the Rift Guardian"
              isHurt={state.hero.isHurt}
              isCasting={state.hero.isCasting}
              isDown={state.phase === 'defeat'}
              isActive={state.phase === 'commandSelect' || state.phase === 'techniqueMenu'}
            />
            <BattlerSprite
              variant="ally"
              spriteUrl={suBattleSpriteUrl}
              alt="Su, gesturing in support"
              isHurt={false}
              isCasting={state.phase === 'conversation'}
              isDown={state.phase === 'defeat'}
            />
            {/* Hero VFX layer (for heals / on-self buffs) */}
            <VfxOverlay vfx={state.vfx.filter((v) => v.target === 'hero')} />
            <DamageStack damageNumbers={state.damageNumbers.filter((d) => d.target === 'hero')} />
          </div>

          {/* Enemy side (right) */}
          <div className="relative flex items-end justify-center">
            <BattlerSprite
              variant="enemy"
              spriteUrl={getRiftGuardianSprite(state)}
              alt="The Rift Guardian, a regal opponent"
              isHurt={state.enemy.isHurt}
              isCasting={state.enemy.isCasting}
              isDown={state.enemy.isDefeated || state.phase === 'victory'}
            />
            <VfxOverlay vfx={state.vfx.filter((v) => v.target === 'enemy')} />
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
              <CommandMenu
                onPick={(kind) => {
                  if (kind === 'fight') return handleCommandFight();
                  if (kind === 'technique') return dispatch({ kind: 'openTechniqueMenu' });
                  if (kind === 'defend') return dispatch({ kind: 'heroDefend' });
                  if (kind === 'flee') {
                    dispatch({
                      kind: 'resolveConversationChoice',
                      choice: {
                        id: 'flee',
                        label: 'Attempt to flee.',
                        outcome: 'The Wraith blocks your retreat.',
                        effect: { kind: 'heal', amount: -8 },
                        tone: 'ember',
                      },
                      prompt: demoConversationPrompts[0],
                    });
                  }
                }}
              />
            ) : null}

            {state.phase === 'techniqueMenu' ? (
              <TechniqueMenu
                techniques={demoTechniques}
                heroMp={state.hero.mp}
                onPick={handleTechniquePicked}
                onCancel={() => dispatch({ kind: 'closeTechniqueMenu' })}
              />
            ) : null}

            {state.phase === 'conversation' ? (
              <ConversationPanel
                prompt={currentPrompt}
                onChoose={(choice) =>
                  dispatch({ kind: 'resolveConversationChoice', choice, prompt: currentPrompt })
                }
              />
            ) : null}

            {state.phase === 'heroAttack' || state.phase === 'enemyAttack' ? (
              <ActionPlayingPanel attacker={state.phase === 'heroAttack' ? demoHero.name : demoEnemy.name} />
            ) : null}

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
                description="Doubt overwhelmed you. Try again with sharper Techniques."
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
                  Each Thai phrase you have learned is a Technique. Spend MP. Watch the VFX. Pick the right
                  conversational reply between turns.
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

function BattlerSprite({
  variant,
  spriteUrl,
  alt,
  isHurt,
  isCasting,
  isDown,
  isActive = false,
}: {
  variant: 'hero' | 'ally' | 'enemy';
  spriteUrl: string;
  alt: string;
  isHurt: boolean;
  isCasting: boolean;
  isDown: boolean;
  isActive?: boolean;
}) {
  const classes = [
    'bd-battler',
    `bd-battler--${variant}`,
    isHurt ? 'bd-battler--hurt' : '',
    isCasting ? 'bd-battler--cast' : '',
    isDown ? 'bd-battler--down' : '',
    isActive ? 'bd-battler--active' : '',
  ]
    .filter(Boolean)
    .join(' ');

  // Enemy sprites are roughly half-portraits; size them bigger to anchor the
  // composition like a PS4 boss. Heroes are full-bodies so they need less.
  const sizeStyle =
    variant === 'enemy'
      ? { width: 'clamp(13rem, 32vw, 22rem)', height: 'clamp(13rem, 32vw, 22rem)' }
      : variant === 'ally'
        ? { width: 'clamp(7rem, 17vw, 11rem)', height: 'clamp(11rem, 26vw, 16rem)' }
        : { width: 'clamp(9rem, 20vw, 13rem)', height: 'clamp(12rem, 28vw, 17rem)' };

  return (
    <div className={classes} style={sizeStyle}>
      <div className="bd-battler__aura" aria-hidden="true" />
      <img
        src={spriteUrl}
        alt={alt}
        className="bd-battler__img"
        draggable={false}
        style={{ width: '100%', height: '100%' }}
      />
      <div className="bd-battler__shadow" aria-hidden="true" />
    </div>
  );
}

function getRiftGuardianSprite(state: BattleState): string {
  if (state.phase === 'victory') return riftGuardianTauntUrl; // playful taunt after fight ends humorously
  if (state.enemy.isDefeated) return riftGuardianDefeatedUrl;
  if (state.enemy.hp < state.enemy.maxHp * 0.35) return riftGuardianDefeatedUrl; // low-HP worried
  if (state.enemy.isHurt) return riftGuardianHurtUrl;
  if (state.enemy.isCasting) return riftGuardianCastUrl;
  return riftGuardianDefaultUrl;
}

function VfxOverlay({ vfx }: { vfx: ActiveVfx[] }) {
  return (
    <div className="bd-vfx-layer" aria-hidden="true">
      {vfx.map((v) => (
        <div key={v.id} className={`bd-vfx-target bd-vfx-${v.element}`} />
      ))}
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

function CommandMenu({ onPick }: { onPick: (kind: CommandKind) => void }) {
  const commands: { kind: CommandKind; label: string; hint: string; variant: 'primary' | 'ghost' }[] = [
    { kind: 'technique', label: 'Technique', hint: 'Cast a Thai-phrase Technique', variant: 'primary' },
    { kind: 'fight', label: 'Fight', hint: 'Basic 22 damage strike', variant: 'ghost' },
    { kind: 'defend', label: 'Defend', hint: 'Brace; next strike +30%', variant: 'ghost' },
    { kind: 'flee', label: 'Flee', hint: 'Try to escape', variant: 'ghost' },
  ];
  return (
    <div className="rounded-md border border-accent/30 bg-ink-elevated p-3">
      <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-accent">
        ▶ Your turn — choose a command
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {commands.map((c) => (
          <button
            key={c.kind}
            type="button"
            onClick={() => onPick(c.kind)}
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

function TechniqueMenu({
  techniques,
  heroMp,
  onPick,
  onCancel,
}: {
  techniques: DemoTechnique[];
  heroMp: number;
  onPick: (t: DemoTechnique) => void;
  onCancel: () => void;
}) {
  const [hover, setHover] = useState<DemoTechnique | null>(techniques[0] ?? null);
  const elementChipTone = useMemo(
    () => ({
      slash: 'default' as const,
      fire: 'ember' as const,
      ice: 'accent' as const,
      lightning: 'accent' as const,
      holy: 'coach' as const,
      wind: 'jade' as const,
      shadow: 'default' as const,
    }),
    [],
  );

  return (
    <div className="rounded-md border border-accent/40 bg-ink-elevated p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-accent">▶ Choose Technique</p>
        <Button variant="quiet" size="sm" onClick={onCancel}>
          ← Back
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <ul className="max-h-44 overflow-y-auto rounded-md border border-hairline bg-ink-raised">
          {techniques.map((t) => {
            const disabled = heroMp < t.mpCost;
            const active = hover?.id === t.id;
            return (
              <li key={t.id}>
                <button
                  type="button"
                  disabled={disabled}
                  onMouseEnter={() => setHover(t)}
                  onFocus={() => setHover(t)}
                  onClick={() => onPick(t)}
                  className={`bd-choice-card flex w-full items-center justify-between gap-3 border-b border-hairline px-3 py-2 text-left last:border-b-0 ${
                    disabled ? 'opacity-40' : 'hover:bg-ink-elevated'
                  } ${active ? 'bg-ink-elevated' : ''}`}
                >
                  <span className="flex flex-col">
                    <span className="font-display text-xs font-black uppercase tracking-[0.18em] text-paper">
                      {active ? <span className="bd-cursor-pulse mr-1 text-accent">▶</span> : null}
                      {t.name}
                    </span>
                    <span className="font-display text-[0.7rem] text-accent">
                      {t.thai} · {t.romanization}
                    </span>
                  </span>
                  <span className="flex items-center gap-2 text-[0.65rem]">
                    <Chip tone={elementChipTone[t.element]}>{t.element}</Chip>
                    <span className="font-bold uppercase tracking-[0.18em] text-paper-muted">
                      {t.mpCost} MP
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {/* Selected detail card */}
        <div className="rounded-md border border-hairline bg-ink-raised p-3">
          {hover ? (
            <>
              <p className="font-display text-xs font-black uppercase tracking-[0.18em] text-paper">
                {hover.name}
              </p>
              <p className="font-display text-base text-accent">
                {hover.thai}
                <span className="ml-2 text-sm text-paper-muted">{hover.romanization}</span>
              </p>
              <p className="mt-1 text-[0.7rem] font-medium text-paper-muted">{hover.translation}</p>
              <p className="mt-2 text-xs font-medium leading-relaxed text-paper">{hover.description}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[0.65rem] font-bold uppercase tracking-[0.18em]">
                <div className="rounded-md border border-hairline bg-ink-elevated px-2 py-1.5 text-paper-muted">
                  <span className="block text-paper">{hover.isHeal ? `+${hover.power}` : hover.power}</span>
                  <span>{hover.isHeal ? 'Restore' : 'Power'}</span>
                </div>
                <div className="rounded-md border border-hairline bg-ink-elevated px-2 py-1.5 text-paper-muted">
                  <span className="block text-paper">{hover.mpCost}</span>
                  <span>MP Cost</span>
                </div>
              </div>
              {hover.effect ? (
                <p className="mt-2 text-[0.65rem] font-bold uppercase tracking-[0.22em] text-coach">
                  Effect · {hover.effect}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-xs text-paper-muted">Hover a Technique to preview.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ConversationPanel({
  prompt,
  onChoose,
}: {
  prompt: ConversationPrompt;
  onChoose: (choice: ConversationChoice) => void;
}) {
  return (
    <div className="rounded-md border border-coach/40 bg-ink-elevated p-3">
      <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-coach">✦ Conversation Beat</p>
      <p className="mt-1 text-sm font-medium text-paper">{prompt.enemyLine}</p>
      <p className="mt-1 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-paper-muted">
        {prompt.promptLabel}
      </p>
      <div className="mt-2 grid grid-cols-1 gap-2">
        {prompt.choices.map((choice) => {
          const toneClass =
            choice.tone === 'jade'
              ? 'border-jade/50 hover:border-jade text-paper'
              : choice.tone === 'ember'
                ? 'border-ember/50 hover:border-ember text-paper'
                : 'border-accent/50 hover:border-accent text-paper';
          return (
            <button
              key={choice.id}
              type="button"
              onClick={() => onChoose(choice)}
              className={`bd-choice-card rounded-md border bg-ink-raised px-3 py-2 text-left transition ${toneClass}`}
            >
              <span className="block font-display text-xs font-bold leading-snug">{choice.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ActionPlayingPanel({ attacker }: { attacker: string }) {
  return (
    <div className="grid h-full place-items-center rounded-md border border-hairline bg-ink-elevated p-4">
      <p className="font-display text-[0.7rem] font-bold uppercase tracking-[0.32em] text-accent">
        {attacker} is acting…
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
