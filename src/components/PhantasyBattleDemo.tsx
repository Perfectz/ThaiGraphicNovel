import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import '../styles/battle-demo.css';
import {
  defaultBattleEncounter,
  type BattleElement,
  type BattleEncounterConfig,
  type ConversationTurn,
  type DemoTechnique,
} from '../data/phantasyBattleDemo';
import { getBattleEncounter } from '../data/battleEncounters';
import {
  BATTLE_ITEMS,
  INITIAL_BATTLE_INVENTORY,
  focusRestoreFor,
  getAttackOptions,
  getMagicOptions,
  hasConversationObjectivesComplete,
  rapportGainFor,
  type BattleInventory,
  type BattleMenuPane,
  type InventoryItemId,
  type SupportSkillId,
} from '../data/phantasyBattleCommands';
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
import { loadBattleVitals, saveBattleVitals } from '../systems/battleVitals';
import {
  addBattleRewards,
  EQUIPMENT,
  grantEquipment,
  hasEquipment,
  heroStatBonus,
  loadProgression,
  type BattleSpoils,
} from '../systems/progression';

// ─────────────────────────────────────────────────────────────────────────
// Type definitions
// ─────────────────────────────────────────────────────────────────────────

type BattlePhase =
  | 'intro' // Banner flash on entry
  | 'commandSelect' // Hero picks a conversational move
  | 'heroAttack' // VFX animates on the enemy
  | 'enemyChallenge' // Enemy forces a required response
  | 'victory'
  | 'retreat'
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
  /** Clean-hit emphasis: a bigger golden number with a PERFECT / streak tag. */
  crit?: boolean;
  /** Optional flourish printed above the number ("PERFECT!", "FINISHER!", "x3"). */
  tag?: string;
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
    luckyWard: boolean;
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
  activeTechnique: DemoTechnique | null;
  rapport: number;
  combo: number;
  awkwardness: number;
  inventory: BattleInventory;
  hasShake: boolean;
  /** XP earned this battle — banked into persistent progression on victory. */
  xpEarned: number;
};

// ─────────────────────────────────────────────────────────────────────────
// State machine
// ─────────────────────────────────────────────────────────────────────────

type Action =
  | { kind: 'init' }
  | { kind: 'enterCommandSelect' }
  | { kind: 'startHeroMove'; technique: DemoTechnique }
  | { kind: 'startCounterResponse'; technique: DemoTechnique }
  | { kind: 'resolveHeroMove'; technique: DemoTechnique; verdict: PronunciationVerdict }
  | { kind: 'resolveEnemyChallenge'; technique: DemoTechnique; verdict: PronunciationVerdict }
  | { kind: 'useSupportSkill'; skill: SupportSkillId; turn: ConversationTurn }
  | { kind: 'useInventoryItem'; item: InventoryItemId; turn: ConversationTurn }
  | { kind: 'retreat'; objectivesComplete: boolean }
  | { kind: 'clearShake' }
  | { kind: 'clearVfx'; id: number }
  | { kind: 'clearDamage'; id: number }
  | { kind: 'clearHurt'; target: 'hero' | 'enemy' }
  | { kind: 'clearCast'; target: 'hero' | 'enemy' }
  | { kind: 'declareVictory' }
  | { kind: 'declareDefeat' }
  | { kind: 'softRevive' }
  | { kind: 'reset' };

let idCounter = 0;
function nextId() {
  idCounter += 1;
  return idCounter;
}

// Active encounter — set from the component's `encounter` prop on every
// render (defaults back to the demo config). Module scope so the reducer,
// which is also module scope, reads the same battle the component renders.
let enc: BattleEncounterConfig = defaultBattleEncounter;

/**
 * Resolve the encounter for the standalone /battle-demo route. Honours an
 * optional `?enc=<id>` query so any registered story duel (e.g.
 * `?enc=clerk-check-in-duel`) can be staged directly for QA; falls back to the
 * Rift Guardian demo.
 */
function resolveDemoEncounter(): BattleEncounterConfig {
  if (typeof window !== 'undefined') {
    const id = new URLSearchParams(window.location.search).get('enc');
    if (id) return getBattleEncounter(id) ?? defaultBattleEncounter;
  }
  return defaultBattleEncounter;
}

function makeInitialState(): BattleState {
  // Persistent levels raise the max pools for story duels (the standalone
  // demo stays at base stats so it always plays the same for newcomers).
  const bonus = enc.persistVitals ? heroStatBonus(loadProgression().level) : { hp: 0, mp: 0 };
  const maxHp = enc.hero.maxHp + bonus.hp;
  const maxMp = enc.hero.maxMp + bonus.mp;
  // Story duels carry Patrick's vitals from the previous encounter in the
  // stage; the standalone demo (and the first duel of a stage) starts fresh.
  const carried = enc.persistVitals ? loadBattleVitals(maxHp, maxMp) : null;
  return {
    hero: {
      hp: carried?.hp ?? maxHp,
      maxHp,
      mp: carried?.mp ?? maxMp,
      maxMp,
      nextAttackMultiplier: 1,
      guard: 0,
      luckyWard: false,
      isCasting: false,
      isHurt: false,
    },
    enemy: {
      hp: enc.enemy.hp,
      maxHp: enc.enemy.maxHp,
      stunnedTurns: 0,
      isHurt: false,
      isCasting: false,
      isDefeated: false,
    },
    phase: 'intro',
    turnCount: 1,
    log: [
      { id: nextId(), speaker: 'narrator', text: enc.introLine },
      {
        id: nextId(),
        speaker: 'enemy',
        text: enc.turns[0]?.enemyLine ?? enc.fallbackOpener,
      },
    ],
    damageNumbers: [],
    vfx: [],
    turnIndex: 0,
    lastScore: null,
    activeTechnique: null,
    rapport: 24,
    combo: 0,
    awkwardness: 0,
    inventory: carried?.inventory ?? startingInventory(),
    hasShake: false,
    xpEarned: 0,
  };
}

function startingInventory(): BattleInventory {
  const inventory = { ...INITIAL_BATTLE_INVENTORY };
  // Tourist's Lucky Charm — the lobby side-quest reward — adds a spare amulet.
  if (enc.persistVitals && hasEquipment('lucky-charm')) {
    inventory['lucky-amulet'] += 1;
  }
  return inventory;
}

/** Score → XP for one resolved phrase. Supers pay more; clean scores pay more. */
function xpForAttempt(technique: DemoTechnique, verdict: PronunciationVerdict) {
  const base = technique.kind === 'super' ? 6 : 3;
  return base + Math.round(clampScore(verdict.score) / 20);
}

/**
 * No-Mic mode is a real recognition test now, not a free pass: the player picks
 * the correct Thai from three options with the answer hidden. A right pick reads
 * as a clean attempt; a wrong pick is an honest miss, so the battle's normal
 * failure path (lost streak, enemy pressure) lands — stakes the auto-confirm
 * never had.
 */
function createNoMicVerdict(technique: DemoTechnique, correct: boolean): PronunciationVerdict {
  if (correct) {
    return {
      score: 88,
      pass: true,
      heard: technique.romanization,
      feedback: 'Correct phrase — you recognised the Thai.',
      tip: 'Now try saying it aloud with a mic for full marks.',
    };
  }
  return {
    score: 32,
    pass: false,
    heard: '(wrong phrase)',
    feedback: `Not quite — the answer was "${technique.romanization}".`,
    tip: `${technique.romanization} — ${technique.translation}. Listen for the rhythm.`,
  };
}

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

/** Equipment effects only apply in story duels (persistVitals encounters). */
function equipped(id: string) {
  return enc.persistVitals === true && hasEquipment(id);
}

// ── Streak / crit tuning ───────────────────────────────────────────────────
// A "clean" phrase (or a no-mic confirm, which always passes) extends the
// combo streak; a weak one breaks it. The streak you have already built
// multiplies your next hit, so chaining clear phrases snowballs — the flow
// reward the duels were missing. A crit is a near-perfect read; a super thrown
// on top of a hot streak becomes a Clarity finisher.
const CLEAN_SCORE = 70;
const CRIT_SCORE = 85;
const MAX_STREAK = 5; // streak levels past this stop adding damage
const STREAK_DAMAGE_STEP = 0.12; // +12% per streak level, up to +60%
const FINISHER_STREAK = 3; // super + this streak = finisher
const FOCUS_SURGE_EVERY = 3; // every Nth streak level refunds Focus
const FOCUS_SURGE_AMOUNT = 10;

function scoredDamage(technique: DemoTechnique, verdict: PronunciationVerdict) {
  const ratio = scoreRatio(verdict);
  const floor = technique.kind === 'super' ? 12 : 5;
  const base = Math.max(0, Math.round(floor + technique.power * ratio));
  // Spoon Saber — simple phrases hit harder.
  if (technique.kind === 'standard' && equipped('spoon-saber')) return Math.round(base * 1.15);
  return base;
}

function scoredHeal(technique: DemoTechnique, verdict: PronunciationVerdict) {
  const base = Math.max(8, Math.round(10 + technique.power * scoreRatio(verdict)));
  // Traveler's Notebook — re-practice restores more Confidence.
  return equipped('traveler-notebook') ? Math.round(base * 1.5) : base;
}

function scoredGuard(verdict: PronunciationVerdict) {
  const base = Math.round(10 + clampScore(verdict.score) * 0.45);
  // Keycard Buckler — Polite Stance guards much harder.
  return equipped('keycard-buckler') ? base + 14 : base;
}

function incomingDamage(basePower: number, guard: number, verdict: PronunciationVerdict) {
  const score = clampScore(verdict.score);
  if (score >= 65 || verdict.pass) return 0;
  return Math.max(4, Math.round(basePower + (65 - score) * 0.45 - guard));
}

function currentTurnFor(state: BattleState) {
  return enc.turns[Math.min(state.turnIndex, enc.turns.length - 1)] ?? enc.turns[0];
}

function reduce(state: BattleState, action: Action): BattleState {
  switch (action.kind) {
    case 'init':
      return { ...makeInitialState(), phase: 'intro' };

    case 'enterCommandSelect':
      return { ...state, phase: 'commandSelect' };

    case 'startHeroMove': {
      const t = action.technique;
      if (state.hero.mp < t.mpCost) return appendLog(state, { speaker: 'system', text: 'Not enough Focus.' });
      return {
        ...state,
        hero: {
          ...state.hero,
          mp: Math.max(0, state.hero.mp - t.mpCost),
          isCasting: true,
        },
        phase: 'heroAttack',
        activeTechnique: t,
      };
    }

    case 'startCounterResponse':
      return {
        ...state,
        hero: { ...state.hero, isCasting: true },
        enemy: { ...state.enemy, isCasting: false },
        phase: 'heroAttack',
        activeTechnique: action.technique,
      };

    case 'resolveHeroMove': {
      const { technique, verdict } = action;
      const score = clampScore(verdict.score);
      const focusRestore = focusRestoreFor(technique);
      let next: BattleState = {
        ...state,
        lastScore: score,
        xpEarned: state.xpEarned + xpForAttempt(technique, verdict),
        activeTechnique: null,
        hero: {
          ...state.hero,
          isCasting: false,
          mp: Math.min(state.hero.maxMp, state.hero.mp + focusRestore),
        },
      };

      if (technique.menuRole === 'tease' && state.rapport < 40) {
        const confidenceLoss = 8;
        next = {
          ...next,
          hero: {
            ...next.hero,
            hp: Math.max(0, next.hero.hp - confidenceLoss),
            isHurt: true,
          },
          awkwardness: next.awkwardness + 1,
          damageNumbers: [
            ...next.damageNumbers,
            { id: nextId(), target: 'hero', amount: confidenceLoss, variant: 'shadow' },
          ],
          vfx: [...next.vfx, { id: nextId(), element: 'shadow', target: 'hero', techniqueId: technique.id }],
          hasShake: true,
        };
        next = appendLog(next, {
          speaker: 'system',
          text: 'Too soon. The joke did not land.',
        });
      } else if (technique.kind === 'heal') {
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
        // ── Streak & crit math ───────────────────────────────────────────
        // The streak carried INTO this hit multiplies it, then a clean read
        // extends the streak for next time (a weak one breaks it). A super on
        // a hot streak becomes a Clarity finisher — the duel's payoff moment.
        const clean = score >= CLEAN_SCORE || verdict.pass;
        const crit = score >= CRIT_SCORE;
        const streak = next.combo;
        const streakMult = 1 + Math.min(streak, MAX_STREAK) * STREAK_DAMAGE_STEP;
        const finisher = technique.kind === 'super' && streak >= FINISHER_STREAK && clean;
        const critMult = crit ? 1.25 : 1;
        const finisherMult = finisher ? 1.5 : 1;
        const damage = Math.max(
          0,
          Math.round(scoredDamage(technique, verdict) * streakMult * critMult * finisherMult),
        );
        const newHp = Math.max(0, next.enemy.hp - damage);
        const rapportGain = rapportGainFor(technique, score);
        const newCombo = clean ? streak + 1 : 0;
        // Hitting a streak milestone refunds Focus so supers stay affordable —
        // the streak literally fuels its own escalation.
        const focusSurge = clean && newCombo > 0 && newCombo % FOCUS_SURGE_EVERY === 0 ? FOCUS_SURGE_AMOUNT : 0;
        const tag = finisher
          ? 'FINISHER!'
          : crit
            ? 'PERFECT!'
            : clean && newCombo >= 2
              ? `x${newCombo}`
              : undefined;
        next = {
          ...next,
          enemy: { ...next.enemy, hp: newHp, isHurt: true, isDefeated: newHp <= 0 },
          rapport: Math.min(100, next.rapport + rapportGain),
          combo: newCombo,
          hero: { ...next.hero, mp: Math.min(next.hero.maxMp, next.hero.mp + focusSurge) },
          damageNumbers: [
            ...next.damageNumbers,
            {
              id: nextId(),
              target: 'enemy',
              amount: damage,
              variant: elementToDamageVariant(technique.element),
              crit: crit || finisher,
              tag,
            },
          ],
          vfx: [
            ...next.vfx,
            {
              id: nextId(),
              element: finisher ? 'holy' : technique.element,
              target: 'enemy',
              techniqueId: technique.id,
            },
          ],
          hasShake: damage > 0,
        };
        if (finisher) {
          next = appendLog(next, {
            speaker: 'system',
            text: `Clarity unleashed! A streak-${streak} finisher tears through ${enc.enemy.name} for ${damage}.`,
          });
        } else if (focusSurge > 0) {
          next = appendLog(next, {
            speaker: 'system',
            text: `Streak x${newCombo} — Clarity surges, +${focusSurge} Focus.`,
          });
        }
        next = appendLog(next, {
          speaker: 'narrator',
          text: `Patrick's phrase scored ${score}/100${crit ? ' — perfect!' : ''}. ${enc.enemy.name} takes ${damage} resolve damage${
            clean && newCombo >= 2 ? ` (streak x${newCombo})` : ''
          }.`,
        });
      }

      next = appendLog(next, { speaker: 'hero', text: `${technique.thai} — ${technique.translation}` });
      if (next.hero.hp <= 0) return { ...next, phase: 'defeat' };
      if (next.enemy.hp <= 0 || next.enemy.isDefeated) return { ...next, phase: 'victory' };
      return { ...next, phase: 'enemyChallenge', enemy: { ...next.enemy, isCasting: true } };
    }

    case 'resolveEnemyChallenge': {
      const { technique, verdict } = action;
      const score = clampScore(verdict.score);
      state = { ...state, xpEarned: state.xpEarned + xpForAttempt(technique, verdict) };
      // Per-stage escalation: the press grows each round by the enemy's
      // pressureRamp, so a service counter's "rapid Thai" or a wok flare gets
      // genuinely harder as the duel goes on. Guard (Polite Stance) and a clean
      // reply still fully neutralise it.
      const effectivePower = enc.enemy.attackPower + state.turnIndex * (enc.enemy.pressureRamp ?? 0);
      const rawDamage = incomingDamage(effectivePower, state.hero.guard, verdict);
      const wardBlocked = rawDamage > 0 && state.hero.luckyWard;
      const damage = wardBlocked ? 0 : rawDamage;
      const newHp = Math.max(0, state.hero.hp - damage);
      const nextTurnIndex = state.turnIndex + 1;
      const completedScript = nextTurnIndex >= enc.turns.length;
      let next: BattleState = {
        ...state,
        turnIndex: Math.min(nextTurnIndex, enc.turns.length - 1),
        turnCount: Math.min(nextTurnIndex + 1, enc.turns.length),
        lastScore: score,
        activeTechnique: null,
        enemy: { ...state.enemy, isCasting: false },
        hero: {
          ...state.hero,
          hp: newHp,
          guard: 0,
          luckyWard: wardBlocked ? false : state.hero.luckyWard,
          isCasting: false,
          isHurt: damage > 0,
        },
        phase: damage > 0 && newHp <= 0 ? 'defeat' : completedScript ? 'victory' : 'commandSelect',
      };

      if (wardBlocked) {
        next = appendLog(next, {
          speaker: 'system',
          text: 'Lucky Amulet flashes. One awkward mistake is prevented.',
        });
      }

      if (damage > 0) {
        // A press that lands breaks the streak — the cost of fumbling a reply.
        next = {
          ...next,
          combo: 0,
          damageNumbers: [
            ...next.damageNumbers,
            { id: nextId(), target: 'hero', amount: damage, variant: 'shadow' },
          ],
          vfx: [...next.vfx, { id: nextId(), element: enc.enemy.attackElement, target: 'hero' }],
          hasShake: true,
        };
        next = appendLog(next, {
          speaker: 'enemy',
          text: `${enc.enemy.attackName}: score ${score}/100. Patrick takes ${damage} damage. Streak broken.`,
        });
      } else {
        // A held reply keeps the streak alive and counters — clean reads land
        // a crit. Wai of Clarity makes forced replies counter even harder.
        const crit = score >= CRIT_SCORE;
        const counterMultiplier = (equipped('wai-of-clarity') ? 1.25 : 1) * (crit ? 1.25 : 1);
        const counterDamage = Math.round((8 + technique.power * scoreRatio(verdict)) * counterMultiplier);
        const enemyHp = Math.max(0, next.enemy.hp - counterDamage);
        next = {
          ...next,
          combo: next.combo + 1,
          enemy: { ...next.enemy, hp: enemyHp, isHurt: true, isDefeated: enemyHp <= 0 },
          damageNumbers: [
            ...next.damageNumbers,
            { id: nextId(), target: 'enemy', amount: counterDamage, variant: 'holy', crit, tag: crit ? 'PERFECT!' : undefined },
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
        const upcoming = enc.turns[next.turnIndex];
        if (upcoming) next = appendLog(next, { speaker: 'enemy', text: upcoming.enemyLine });
      }
      return next;
    }

    case 'useSupportSkill': {
      if (action.skill === 'listen') {
        return appendLog(
          {
            ...state,
            hero: {
              ...state.hero,
              mp: Math.min(state.hero.maxMp, state.hero.mp + 14),
              guard: Math.max(state.hero.guard, 18),
            },
            vfx: [...state.vfx, { id: nextId(), element: 'wind', target: 'hero' }],
          },
          {
            speaker: 'narrator',
            text: `You take a breath and listen carefully. ${action.turn.enemyLine}`,
          },
        );
      }
      return appendLog(
        {
          ...state,
          hero: { ...state.hero, mp: Math.max(0, state.hero.mp - 5) },
          vfx: [...state.vfx, { id: nextId(), element: 'holy', target: 'hero' }],
        },
        {
          speaker: 'narrator',
          text: `Coach suggests a safe response: ${action.turn.simple.thai} (${action.turn.simple.romanization}) - ${action.turn.simple.translation}`,
        },
      );
    }

    case 'useInventoryItem': {
      const remaining = state.inventory[action.item] ?? 0;
      if (remaining <= 0) {
        const item = BATTLE_ITEMS.find((entry) => entry.id === action.item);
        return appendLog(state, {
          speaker: 'system',
          text: `${item?.label ?? 'Item'} is out of stock.`,
        });
      }
      const inventory = { ...state.inventory, [action.item]: remaining - 1 };
      switch (action.item) {
        case 'phrase-card':
          return appendLog(
            {
              ...state,
              inventory,
            },
            {
              speaker: 'system',
              text: `Phrase Card reveals: ${action.turn.super.thai} (${action.turn.super.romanization}) - ${action.turn.super.translation}`,
            },
          );
        case 'confidence-drink': {
          const healed = Math.min(36, state.hero.maxHp - state.hero.hp);
          return appendLog(
            {
              ...state,
              inventory,
              hero: { ...state.hero, hp: Math.min(state.hero.maxHp, state.hero.hp + 36) },
              damageNumbers: [
                ...state.damageNumbers,
                { id: nextId(), target: 'hero', amount: healed, variant: 'heal' },
              ],
              vfx: [...state.vfx, { id: nextId(), element: 'holy', target: 'hero' }],
            },
            { speaker: 'system', text: `Confidence Drink restores ${healed} Confidence.` },
          );
        }
        case 'focus-tea':
          return appendLog(
            {
              ...state,
              inventory,
              hero: { ...state.hero, mp: Math.min(state.hero.maxMp, state.hero.mp + 28) },
              vfx: [...state.vfx, { id: nextId(), element: 'wind', target: 'hero' }],
            },
            { speaker: 'system', text: 'Focus Tea restores Focus.' },
          );
        case 'lucky-amulet':
          return appendLog(
            {
              ...state,
              inventory,
              hero: { ...state.hero, luckyWard: true },
              vfx: [...state.vfx, { id: nextId(), element: 'holy', target: 'hero' }],
            },
            { speaker: 'system', text: 'Lucky Amulet will prevent one awkward mistake.' },
          );
        default:
          return state;
      }
    }

    case 'retreat':
      if (action.objectivesComplete) {
        return appendLog(
          {
            ...state,
            phase: 'victory',
            rapport: Math.min(100, state.rapport + 8),
          },
          {
            speaker: 'hero',
            text: 'ขอบคุณครับ แล้วจะมาอีกครับ - Thank you. I will come again.',
          },
        );
      }
      return appendLog(
        {
          ...state,
          phase: 'retreat',
        },
        { speaker: 'system', text: 'You ended the conversation early.' },
      );

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

    case 'reset': {
      idCounter = 0;
      const fresh = makeInitialState();
      return {
        ...fresh,
        inventory: { ...INITIAL_BATTLE_INVENTORY },
      };
    }

    case 'softRevive': {
      // Soft defeat: Patrick steadies himself with the ally's help. Confidence
      // refills, the duel resumes at the SAME round — lesson progress is never
      // erased by a bad streak.
      let next: BattleState = {
        ...state,
        phase: 'commandSelect',
        hero: {
          ...state.hero,
          hp: state.hero.maxHp,
          guard: 0,
          isHurt: false,
          isCasting: false,
        },
      };
      next = appendLog(next, {
        speaker: 'narrator',
        text: `${enc.ally.name} steadies Patrick. Confidence restored — the conversation continues.`,
      });
      const upcoming = enc.turns[next.turnIndex];
      if (upcoming) next = appendLog(next, { speaker: 'enemy', text: upcoming.enemyLine });
      return next;
    }

    default:
      return state;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────

export type PhantasyBattleDemoProps = {
  onExit?: () => void;
  /**
   * Optional encounter config — when provided, the screen stages THIS battle
   * instead of the default Rift Guardian demo. Story stages pass their own
   * social-duel configs (see src/data/battleEncounters/).
   */
  encounter?: BattleEncounterConfig;
  /** Called when the player wins and chooses to continue (stage mode). */
  onVictory?: (spoils?: BattleSpoils) => void;
  /**
   * True when winning THIS duel clears the whole stage. The victory panel
   * then defers its reward fanfare to the Stage Clear card (one celebration
   * beat, not two back-to-back end screens).
   */
  completesStage?: boolean;
};

function techniqueToPronunciationPrompt(technique: DemoTechnique): PronunciationPrompt {
  return {
    targetPhrase: technique.thai,
    romanization: technique.romanization,
    translation: technique.translation,
  };
}

export function PhantasyBattleDemo({ onExit, encounter, onVictory, completesStage }: PhantasyBattleDemoProps) {
  // Must run before the reducer's lazy init below — the module-scope reducer
  // reads `enc` for everything (HP pools, turn deck, copy). When no encounter
  // prop is supplied (the /battle-demo route), allow `?enc=<id>` to stage any
  // registered story encounter directly — a QA shortcut for play-testing the
  // real stage duels without walking the whole 3D adventure.
  enc = encounter ?? resolveDemoEncounter();
  const [state, dispatch] = useReducer(reduce, undefined, makeInitialState);
  const [bannerVisible, setBannerVisible] = useState(true);
  const [pendingVoiceTechnique, setPendingVoiceTechnique] = useState<DemoTechnique | null>(null);
  const [menuPane, setMenuPane] = useState<BattleMenuPane>('root');
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

  // Victory bookkeeping for story duels: carry vitals forward, bank XP/baht
  // into persistent progression, and loot any equipment reward — once.
  const [rewardSummary, setRewardSummary] = useState('');
  const lastSpoilsRef = useRef<BattleSpoils | null>(null);
  useEffect(() => {
    if (state.phase !== 'victory') {
      setRewardSummary('');
      return;
    }
    if (!enc.persistVitals) return;
    saveBattleVitals({ hp: state.hero.hp, mp: state.hero.mp, inventory: state.inventory });
    const baht = enc.bahtReward ?? 20;
    const { levelsGained, progression } = addBattleRewards({ xp: state.xpEarned, baht });
    let equipmentLabel: string | undefined;
    if (enc.equipmentReward) {
      const gear = EQUIPMENT[enc.equipmentReward];
      if (gear && grantEquipment(gear.id)) {
        equipmentLabel = `${gear.label} — ${gear.effect}`;
      }
    }
    lastSpoilsRef.current = {
      xp: state.xpEarned,
      baht,
      level: progression.level,
      levelsGained,
      equipmentLabel,
    };
    const parts = [`+${state.xpEarned} XP`, `+฿${baht}`];
    if (levelsGained > 0) {
      const bonus = heroStatBonus(progression.level);
      parts.push(
        `LEVEL UP! Patrick is now Lv ${progression.level} (max Confidence ${220 + bonus.hp}, Focus ${90 + bonus.mp}).`,
      );
    }
    if (equipmentLabel) parts.push(`Looted ${equipmentLabel}`);
    setRewardSummary(parts.join('  ·  '));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

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
      setVoiceError('Not enough Focus for that response.');
      return;
    }
    const selectedMode = getVoiceJudgeMode();
    setVoiceMode(selectedMode);
    setPendingVoiceTechnique(technique);
    setVoiceError('');
    setVerdict(null);
    setIsAwaitingVoiceResult(false);
    setVoiceStatus(
      selectedMode === 'no-mic'
        ? `Which Thai means "${technique.translation}"? Pick the right one.`
        : `Say ${technique.thai} clearly to use ${technique.name}.`,
    );
  }, []);

  const resolvePendingVoiceTechnique = useCallback(
    (technique: DemoTechnique, nextVerdict: PronunciationVerdict, status: string) => {
      setIsAwaitingVoiceResult(false);
      setIsRecordingVoice(false);
      setVerdict(nextVerdict);
      setVoiceStatus(status);
      if (technique.kind === 'counter') {
        dispatch({ kind: 'startCounterResponse', technique });
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
    },
    [schedule],
  );

  const connectVoiceCoach = useCallback(async (): Promise<PronunciationSession | null> => {
    const selectedMode = getVoiceJudgeMode();
    setVoiceMode(selectedMode);

    if (selectedMode === 'no-mic') {
      setVoiceError('');
      setVoiceStatus('No-Mic mode is active. Pick the correct Thai from the choices.');
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
          const technique = pendingVoiceTechniqueRef.current;
          if (technique) {
            resolvePendingVoiceTechnique(
              technique,
              nextVerdict,
              `${technique.kind === 'counter' ? 'Response' : 'Phrase'} scored ${nextVerdict.score}/100.`,
            );
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
  }, [pronunciationPrompt, resolvePendingVoiceTechnique]);

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

  const handleNoMicResult = useCallback(
    (correct: boolean) => {
      const technique = pendingVoiceTechniqueRef.current;
      if (!technique) {
        setVoiceError('Pick a response first.');
        return;
      }
      const nextVerdict = createNoMicVerdict(technique, correct);
      setVoiceError('');
      resolvePendingVoiceTechnique(
        technique,
        nextVerdict,
        correct ? 'Correct phrase chosen.' : 'Wrong phrase — the moment slips.',
      );
    },
    [resolvePendingVoiceTechnique],
  );

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
  const objectivesComplete = hasConversationObjectivesComplete(state.turnIndex, enc.turns.length);

  const handleSupportSkill = useCallback(
    (skill: SupportSkillId) => {
      setPendingVoiceTechnique(null);
      setMenuPane('root');
      dispatch({ kind: 'useSupportSkill', skill, turn: currentTurn });
    },
    [currentTurn],
  );

  const handleInventoryItem = useCallback(
    (item: InventoryItemId) => {
      setPendingVoiceTechnique(null);
      setMenuPane('root');
      dispatch({ kind: 'useInventoryItem', item, turn: currentTurn });
    },
    [currentTurn],
  );

  const handleRetreat = useCallback(() => {
    setPendingVoiceTechnique(null);
    setMenuPane('root');
    dispatch({ kind: 'retreat', objectivesComplete });
  }, [objectivesComplete]);

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
          Title
        </Button>
      </header>

      {/* Intro / Victory banner */}
      {bannerVisible && state.phase === 'intro' ? (
        <BattleBanner name={enc.enemy.name} subtitle={enc.enemy.subtitle} />
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
        stageOptions={{ opponent: enc.opponentVisual, hideAlly: enc.hideAllyRig }}
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
              name={enc.hero.name}
              subtitle={enc.hero.subtitle}
              hp={state.hero.hp}
              maxHp={state.hero.maxHp}
              mp={state.hero.mp}
              maxMp={state.hero.maxMp}
              hpLabel="Confidence"
              mpLabel="Focus"
            />
            <CharacterCard
              name={enc.ally.name}
              subtitle={enc.ally.subtitle}
              hp={state.hero.maxHp}
              maxHp={state.hero.maxHp}
              compact
            />
          </div>
          <div className="pointer-events-auto">
            <CharacterCard
              name={enc.enemy.name}
              subtitle={enc.enemy.subtitle}
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
                <CommandMenu
                  currentTurn={currentTurn}
                  pane={menuPane}
                  rapport={state.rapport}
                  combo={state.combo}
                  luckyWard={state.hero.luckyWard}
                  inventory={state.inventory}
                  hideRomanization={voiceMode === 'no-mic'}
                  onPane={setMenuPane}
                  onPick={(move) => prepareVoiceTechnique(move)}
                  onSupport={handleSupportSkill}
                  onItem={handleInventoryItem}
                  onRetreat={handleRetreat}
                />
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
                    onNoMicResult={handleNoMicResult}
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
                onNoMicResult={handleNoMicResult}
              />
            ) : null}

            {state.phase === 'heroAttack' ? (
              <ActionPlayingPanel attacker={enc.hero.name} technique={state.activeTechnique} />
            ) : null}

            {state.phase === 'victory' ? (
              <ResolutionPanel
                title={enc.victoryTitle}
                // Stage-completing duels hand the reward fanfare to the Stage
                // Clear card (one celebration); mid-stage duels show it here.
                description={
                  completesStage
                    ? enc.victoryDescription
                    : rewardSummary
                      ? `${enc.victoryDescription}  ${rewardSummary}`
                      : enc.victoryDescription
                }
                actionLabel={onVictory ? (completesStage ? 'Stage Clear ➜' : 'Continue') : 'Replay'}
                onAction={
                  onVictory
                    ? () => onVictory(lastSpoilsRef.current ?? undefined)
                    : () => dispatch({ kind: 'reset' })
                }
                secondaryLabel={onVictory ? 'Replay' : (enc.exitLabel ?? 'Title')}
                onSecondary={onVictory ? () => dispatch({ kind: 'reset' }) : onExit}
                tone="jade"
              />
            ) : null}
            {state.phase === 'retreat' ? (
              <ResolutionPanel
                title="Conversation Ended"
                description="Partial XP awarded. No mastery reward this time."
                actionLabel="Retry"
                onAction={() => dispatch({ kind: 'reset' })}
                secondaryLabel={enc.exitLabel ?? 'Title'}
                onSecondary={onExit}
                tone="ember"
              />
            ) : null}
            {state.phase === 'defeat' ? (
              <ResolutionPanel
                title={enc.softDefeat ? 'Patrick Wavers' : 'You Fell'}
                description={enc.defeatDescription}
                actionLabel={enc.softDefeat ? 'Steady Yourself' : 'Retry'}
                onAction={() =>
                  dispatch(enc.softDefeat ? { kind: 'softRevive' } : { kind: 'reset' })
                }
                secondaryLabel={enc.exitLabel ?? 'Title'}
                onSecondary={onExit}
                tone="ember"
              />
            ) : null}
            {state.phase === 'intro' ? (
              <div className="rounded-md border border-hairline bg-ink-elevated p-4">
                <p className="text-[0.7rem] font-bold uppercase tracking-[0.22em] text-accent">Encounter</p>
                <p className="mt-1 text-sm font-medium text-paper">{enc.introHint}</p>
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
        <div key={d.id} className={`bd-damage bd-damage--${d.variant}${d.crit ? ' bd-damage--crit' : ''}`}>
          {d.tag ? <span className="bd-damage__tag">{d.tag}</span> : null}
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
  hpLabel = 'HP',
  mpLabel = 'MP',
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
  hpLabel?: string;
  mpLabel?: string;
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
        <StatBar label={hpLabel} value={hp} max={maxHp} tone={tone === 'ember' ? 'ember' : 'jade'} />
        {typeof mp === 'number' && typeof maxMp === 'number' ? (
          <StatBar label={mpLabel} value={mp} max={maxMp} tone="accent" />
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
  pane,
  rapport,
  combo,
  luckyWard,
  inventory,
  hideRomanization,
  onPane,
  onPick,
  onSupport,
  onItem,
  onRetreat,
}: {
  currentTurn: ConversationTurn;
  pane: BattleMenuPane;
  rapport: number;
  combo: number;
  luckyWard: boolean;
  inventory: BattleInventory;
  /** No-mic mode: hide romanization in the menu so the recognition challenge
   *  isn't pre-answered. The player picks the move by its English meaning. */
  hideRomanization: boolean;
  onPane: (pane: BattleMenuPane) => void;
  onPick: (move: DemoTechnique) => void;
  onSupport: (skill: SupportSkillId) => void;
  onItem: (item: InventoryItemId) => void;
  onRetreat: () => void;
}) {
  const attackOptions = getAttackOptions(currentTurn);
  const magicOptions = getMagicOptions(currentTurn);
  const isRoot = pane === 'root';
  const title =
    pane === 'attack'
      ? 'Attack'
      : pane === 'magic'
        ? 'Magic'
        : pane === 'skills'
          ? 'Skills'
          : pane === 'items'
            ? 'Items'
            : 'Command';
  return (
    <div className="bd-jrpg-window rounded-md border border-accent/30 bg-ink-elevated p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-accent">
            {isRoot ? 'Command' : title} · Turn {currentTurn.turnNo}
          </p>
          <p className="sr-only">
            ▶ Turn {currentTurn.turnNo} · {currentTurn.topic}
          </p>
          <p className="mt-1 text-sm font-medium text-paper">{currentTurn.enemyLine}</p>
        </div>
        <div className="flex flex-wrap gap-1">
          <Chip tone="coach">Rapport {rapport}</Chip>
          {combo > 0 ? (
            <Chip tone="accent">
              Streak x{combo} · +{Math.round(Math.min(combo, MAX_STREAK) * STREAK_DAMAGE_STEP * 100)}%
            </Chip>
          ) : null}
          {luckyWard ? <Chip tone="jade">Amulet</Chip> : null}
        </div>
      </div>
      {isRoot ? (
        <div className="bd-jrpg-root-menu mt-3" role="menu" aria-label="Battle command menu">
          <RootCommandButton label="Attack" onClick={() => onPane('attack')} />
          <RootCommandButton label="Magic" onClick={() => onPane('magic')} />
          <RootCommandButton label="Skills" onClick={() => onPane('skills')} />
          <RootCommandButton label="Items" onClick={() => onPane('items')} />
          <RootCommandButton label="Retreat" onClick={onRetreat} />
        </div>
      ) : null}

      {pane === 'attack' ? (
        <SubMenuGrid onBack={() => onPane('root')}>
          {attackOptions.map((move) => (
            <MenuButton
              key={move.id}
              label={move.name}
              hint={hideRomanization ? 'Choose by meaning · Focus +5' : `${move.romanization} · Focus +5`}
              detail={move.translation}
              onClick={() => onPick(move)}
            />
          ))}
        </SubMenuGrid>
      ) : null}

      {pane === 'magic' ? (
        <SubMenuGrid onBack={() => onPane('root')}>
          {magicOptions.map((move) => (
            <MenuButton
              key={move.id}
              label={move.name}
              hint={
                move.kind === 'heal'
                  ? `Recover Confidence · Focus ${move.mpCost}`
                  : move.kind === 'defend'
                    ? `Raise Guard · Focus ${move.mpCost}`
                    : `Strong line · Focus ${move.mpCost}`
              }
              detail={hideRomanization ? move.translation : `${move.romanization} — ${move.translation}`}
              onClick={() => onPick(move)}
            />
          ))}
        </SubMenuGrid>
      ) : null}

      {pane === 'skills' ? (
        <SubMenuGrid onBack={() => onPane('root')}>
          <MenuButton
            label="Listen"
            hint="Guard · Focus restore"
            detail="You take a breath and listen carefully."
            onClick={() => onSupport('listen')}
          />
          <MenuButton
            label="Coach"
            hint="Hint · Focus cost"
            detail="Coach suggests a safe response."
            onClick={() => onSupport('coach')}
          />
        </SubMenuGrid>
      ) : null}

      {pane === 'items' ? (
        <SubMenuGrid onBack={() => onPane('root')}>
          {BATTLE_ITEMS.map((item) => (
            <MenuButton
              key={item.id}
              label={`${item.label} x${inventory[item.id] ?? 0}`}
              hint={item.hint}
              detail={item.detail}
              disabled={(inventory[item.id] ?? 0) <= 0}
              onClick={() => onItem(item.id)}
            />
          ))}
        </SubMenuGrid>
      ) : null}
    </div>
  );
}

function RootCommandButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" role="menuitem" onClick={onClick} className="bd-jrpg-root-command">
      <span className="bd-jrpg-cursor" aria-hidden="true">
        ▶
      </span>
      <span>{label}</span>
    </button>
  );
}

function SubMenuGrid({ children, onBack }: { children: ReactNode; onBack: () => void }) {
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={onBack}
        className="mb-2 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-paper-muted transition hover:text-accent"
      >
        ← Back
      </button>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">{children}</div>
    </div>
  );
}

function MenuButton({
  label,
  hint,
  detail,
  disabled = false,
  onClick,
}: {
  label: string;
  hint: string;
  detail?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="bd-choice-card bd-menu-option rounded-md border border-hairline bg-ink-raised px-3 py-2 text-left transition hover:border-accent disabled:cursor-not-allowed disabled:opacity-45"
    >
      <div className="font-display text-xs font-black uppercase tracking-[0.18em] text-paper">{label}</div>
      <div className="text-[0.65rem] font-medium text-paper-muted">{hint}</div>
      {detail ? <div className="mt-1 text-[0.65rem] font-medium leading-snug text-paper-quiet">{detail}</div> : null}
    </button>
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
  onNoMicResult,
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
  onNoMicResult: (correct: boolean) => void;
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
          onNoMicResult={onNoMicResult}
        />
      ) : null}
    </div>
  );
}
/** Every romanization in the active encounter — the distractor pool for the
 *  no-mic recognition challenge. Module scope so it can read `enc`. */
function buildRomanizationPool(): string[] {
  const set = new Set<string>();
  for (const turn of enc.turns) {
    [turn.simple, turn.super, turn.counter, turn.heal, turn.defend].forEach((m) => {
      if (m?.romanization) set.add(m.romanization);
    });
  }
  return [...set];
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * The no-mic recognition challenge: with the Thai answer hidden, the player
 * picks the correct romanization from three (one right + two real phrases from
 * this encounter). A right pick is a clean attempt; a wrong pick reveals the
 * answer and resolves as a miss, so the battle's failure path actually bites.
 */
function NoMicChallenge({
  technique,
  disabled,
  onResult,
}: {
  technique: DemoTechnique;
  disabled: boolean;
  onResult: (correct: boolean) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const options = useMemo(() => {
    const correct = technique.romanization;
    const distractors = shuffle(buildRomanizationPool().filter((r) => r !== correct)).slice(0, 2);
    while (distractors.length < 2) distractors.push(`${correct} …`);
    return shuffle([correct, ...distractors]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [technique.id]);

  const handlePick = (opt: string) => {
    if (picked || disabled) return;
    setPicked(opt);
    const correct = opt === technique.romanization;
    window.setTimeout(() => onResult(correct), 380);
  };

  return (
    <div className="mt-3">
      <p className="mb-2 text-[0.6rem] font-bold uppercase tracking-[0.2em] text-accent">
        No-mic · which Thai is it?
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        {options.map((opt) => {
          const isCorrect = opt === technique.romanization;
          let style: CSSProperties = {};
          if (picked) {
            if (opt === picked && isCorrect) style = { borderColor: '#34d399', color: '#34d399', background: 'rgba(52,211,153,0.16)' };
            else if (opt === picked) style = { borderColor: '#fb7185', color: '#fb7185', background: 'rgba(251,113,133,0.16)' };
            else if (isCorrect) style = { borderColor: 'rgba(52,211,153,0.7)', color: '#34d399' };
            else style = { opacity: 0.4 };
          }
          return (
            <button
              key={opt}
              type="button"
              disabled={!!picked || disabled}
              onClick={() => handlePick(opt)}
              className="rounded-md border border-hairline bg-ink-elevated px-3 py-2 text-sm font-semibold text-paper transition hover:border-accent disabled:cursor-default"
              style={style}
            >
              {opt}
            </button>
          );
        })}
      </div>
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
  onNoMicResult,
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
  onNoMicResult: (correct: boolean) => void;
  onCancel?: () => void;
}) {
  const disabled = isConnectingVoice || isAwaitingVoiceResult;
  const noMic = voiceMode === 'no-mic';
  const verdictTone =
    verdict?.pass === true ? 'jade' : verdict && verdict.score >= 45 ? 'coach' : verdict ? 'ember' : null;

  return (
    <div className="bd-voice-cast mb-3 rounded-md border border-accent/40 bg-ink-raised p-3">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-accent">{heading}</p>
          <p className="mt-1 font-display text-lg text-paper">
            {technique.thai}
            {/* In no-mic the romanization IS the answer — hide it so the choice
                is a real recognition test, not a copy. Voice mode keeps it. */}
            {!noMic ? <span className="ml-2 text-sm text-paper-muted">{technique.romanization}</span> : null}
          </p>
          <div className="mt-2 rounded border border-hairline bg-ink-elevated/80 px-2.5 py-2">
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-paper-quiet">English</p>
            <p className="mt-1 text-sm font-semibold leading-snug text-paper">{technique.translation}</p>
          </div>
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
        {!noMic ? (
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
              hint={micHint}
              className="min-w-[9.5rem]"
            />
            {onCancel ? (
              <Button variant="quiet" size="sm" onClick={onCancel}>
                Cancel
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {noMic ? (
        <>
          <NoMicChallenge technique={technique} disabled={disabled} onResult={onNoMicResult} />
          {onCancel ? (
            <Button variant="quiet" size="sm" onClick={onCancel} className="mt-2">
              Cancel
            </Button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function ActionPlayingPanel({ attacker, technique }: { attacker: string; technique: DemoTechnique | null }) {
  return (
    <div className="grid h-full place-items-center rounded-md border border-hairline bg-ink-elevated p-4 text-center">
      <div className="min-w-0">
        <p className="font-display text-[0.7rem] font-bold uppercase tracking-[0.32em] text-accent">
          {attacker} is speaking...
        </p>
        {technique ? (
          <div className="mt-3 min-w-0">
            <p className="font-display text-base text-paper">{technique.thai}</p>
            <p className="mt-1 text-xs font-semibold text-paper-muted">{technique.romanization}</p>
            <p className="mt-2 text-sm font-semibold leading-snug text-paper">{technique.translation}</p>
          </div>
        ) : null}
      </div>
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
