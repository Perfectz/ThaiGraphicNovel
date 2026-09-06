/**
 * Persistent RPG progression — XP, levels, baht, and equipment — earned from
 * the social duels and saved across sessions (localStorage). This is what
 * turns the three stages into a campaign: speaking Thai well literally makes
 * Patrick stronger.
 *
 * Level curve: cumulative XP threshold for level n is 40·(n-1)·n
 * (80, 240, 480, 800… per level gained — early levels land inside the demo).
 * Each level past 1 grants +15 max Confidence and +6 max Focus, applied in
 * the battle screen via heroStatBonus().
 */

export type Progression = {
  xp: number;
  level: number;
  baht: number;
  /** Owned equipment ids (see EQUIPMENT below). */
  equipment: string[];
};

/** What one duel paid out — handed from the battle screen to the stage so
 *  the Stage Clear card can show the whole stage's spoils in one place. */
export type BattleSpoils = {
  xp: number;
  baht: number;
  level: number;
  levelsGained: number;
  equipmentLabel?: string;
};

export type EquipmentDefinition = {
  id: string;
  label: string;
  /** Player-facing effect line, shown when looted and in reward text. */
  effect: string;
};

/** Equipment forged from the lessonScenarios gear names. Effects are read by
 *  the battle math in PhantasyBattleDemo via hasEquipment(). */
export const EQUIPMENT: Record<string, EquipmentDefinition> = {
  'traveler-notebook': {
    id: 'traveler-notebook',
    label: 'Traveler’s Notebook',
    effect: 'Heal moves restore 50% more Confidence.',
  },
  'wai-of-clarity': {
    id: 'wai-of-clarity',
    label: 'Wai of Clarity',
    effect: 'Forced replies counter 25% harder.',
  },
  'keycard-buckler': {
    id: 'keycard-buckler',
    label: 'Keycard Buckler',
    effect: 'Polite Stance guards much harder.',
  },
  'spoon-saber': {
    id: 'spoon-saber',
    label: 'Spoon Saber',
    effect: 'Simple phrases hit 15% harder.',
  },
  'lucky-charm': {
    id: 'lucky-charm',
    label: 'Tourist’s Lucky Charm',
    effect: 'Start every duel with an extra Lucky Amulet.',
  },
};

const STORAGE_KEY = 'isekai-progression-v1';
export const PROGRESSION_CHANGED_EVENT = 'isekai-progression-changed';

const DEFAULT_PROGRESSION: Progression = { xp: 0, level: 1, baht: 0, equipment: [] };

function xpThresholdFor(level: number) {
  return 40 * (level - 1) * level;
}

export function levelForXp(xp: number) {
  let level = 1;
  while (xp >= xpThresholdFor(level + 1)) level += 1;
  return level;
}

/** Max-stat bonuses on top of the base hero block. */
export function heroStatBonus(level: number) {
  return { hp: (level - 1) * 15, mp: (level - 1) * 6 };
}

export function loadProgression(): Progression {
  if (typeof window === 'undefined') return { ...DEFAULT_PROGRESSION };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PROGRESSION };
    const parsed = JSON.parse(raw) as Partial<Progression>;
    const xp = typeof parsed.xp === 'number' && parsed.xp >= 0 ? parsed.xp : 0;
    return {
      xp,
      level: levelForXp(xp),
      baht: typeof parsed.baht === 'number' && parsed.baht >= 0 ? parsed.baht : 0,
      equipment: Array.isArray(parsed.equipment) ? parsed.equipment.filter((e) => typeof e === 'string') : [],
    };
  } catch {
    return { ...DEFAULT_PROGRESSION };
  }
}

function persist(progression: Progression) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progression));
    window.dispatchEvent(new CustomEvent(PROGRESSION_CHANGED_EVENT));
  } catch {
    /* Private-mode storage failures are non-fatal — progression just won't persist. */
  }
}

/** Apply duel rewards. Returns the new state plus how many levels were gained. */
export function addBattleRewards(rewards: { xp: number; baht: number }): {
  progression: Progression;
  levelsGained: number;
} {
  const current = loadProgression();
  const xp = current.xp + Math.max(0, Math.round(rewards.xp));
  const level = levelForXp(xp);
  const next: Progression = {
    ...current,
    xp,
    level,
    baht: current.baht + Math.max(0, Math.round(rewards.baht)),
  };
  persist(next);
  return { progression: next, levelsGained: level - current.level };
}

/** Grant a piece of equipment (idempotent). Returns true if newly acquired. */
export function grantEquipment(id: string): boolean {
  const current = loadProgression();
  if (current.equipment.includes(id)) return false;
  persist({ ...current, equipment: [...current.equipment, id] });
  return true;
}

export function hasEquipment(id: string): boolean {
  return loadProgression().equipment.includes(id);
}
