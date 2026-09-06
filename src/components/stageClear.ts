import type { AdventureConversationTurn } from '../data/adventures/types';

/**
 * Stage-clear payoff logic — the pure, headset-free, render-free core behind
 * the "Stage Clear" card. Kept separate from the React component so the
 * mastery maths and reward lookups are unit-testable without a DOM.
 *
 * The idea: a language level should *pay off* the drill. When the player
 * finishes the conversation we know, per phrase, how they did — a numeric
 * pronunciation score, a no-mic "confirmed", or a "skipped". This module turns
 * that into a recap (per-phrase rows + an overall star rating) and surfaces the
 * stage's reward (which the data has always defined but the UI never showed).
 */

/** Per-phrase outcome: a 0–100 pronunciation score, or a non-numeric outcome. */
export type PhraseResult = number | 'confirmed' | 'skipped';

/** Map of phrase id → best outcome recorded during the drill. */
export type PhraseResultMap = Record<string, PhraseResult>;

/** A single recap row for the card. */
export type PhraseMasteryRow = {
  id: string;
  /** English meaning of the phrase. */
  translation: string;
  /** Romanized Thai the player said. */
  romanization: string;
  /** Thai script. */
  thai: string;
  /** Best outcome for this phrase, or null if it was never reached. */
  result: PhraseResult | null;
};

export type StageMastery = {
  rows: PhraseMasteryRow[];
  /** Average of numeric scores only (null when nothing was scored by mic). */
  numericAverage: number | null;
  /** 0–3 stars derived from the numeric average (0 when not mic-scored). */
  stars: number;
  /** How many phrases were passed/confirmed (i.e. not skipped / not missing). */
  clearedCount: number;
  /** Total phrases in the drill. */
  totalCount: number;
};

/**
 * Rank two outcomes for the same phrase so re-attempts only ever improve the
 * record: any numeric score beats 'confirmed', which beats 'skipped'. Between
 * two numeric scores the higher wins. Returns the outcome to keep.
 */
export function rankResult(prev: PhraseResult | undefined, next: PhraseResult): PhraseResult {
  if (prev === undefined) return next;
  const tier = (r: PhraseResult): number =>
    typeof r === 'number' ? 3 : r === 'confirmed' ? 2 : 1;
  const prevTier = tier(prev);
  const nextTier = tier(next);
  if (nextTier > prevTier) return next;
  if (nextTier < prevTier) return prev;
  // Same tier: for numeric, keep the higher; otherwise they're equal.
  if (typeof prev === 'number' && typeof next === 'number') return Math.max(prev, next);
  return prev;
}

/** Apply a freshly recorded outcome to a result map immutably. */
export function applyResult(
  map: PhraseResultMap,
  phraseId: string,
  result: PhraseResult,
): PhraseResultMap {
  const merged = rankResult(map[phraseId], result);
  if (merged === map[phraseId]) return map;
  return { ...map, [phraseId]: merged };
}

/** Convert a 0–100 average into a 0–3 star rating. */
export function scoreToStars(average: number | null): number {
  if (average === null) return 0;
  if (average >= 88) return 3;
  if (average >= 72) return 2;
  if (average >= 50) return 1;
  return 0;
}

/**
 * Build the recap from the drill's turns (the phrase list, in order) and the
 * per-phrase results recorded during play. Turns drive the order so the recap
 * always reads top-to-bottom like the lesson did.
 */
export function buildMastery(
  turns: AdventureConversationTurn[],
  results: PhraseResultMap,
): StageMastery {
  const rows: PhraseMasteryRow[] = turns.map((t) => ({
    id: t.id,
    translation: t.response.translation,
    romanization: t.response.romanization,
    thai: t.response.targetPhrase,
    result: t.id in results ? results[t.id] : null,
  }));

  const numericScores = rows
    .map((r) => r.result)
    .filter((r): r is number => typeof r === 'number');
  const numericAverage =
    numericScores.length > 0
      ? Math.round(numericScores.reduce((sum, s) => sum + s, 0) / numericScores.length)
      : null;

  const clearedCount = rows.filter(
    (r) => typeof r.result === 'number' || r.result === 'confirmed',
  ).length;

  return {
    rows,
    numericAverage,
    stars: scoreToStars(numericAverage),
    clearedCount,
    totalCount: rows.length,
  };
}

/** Short label for a phrase outcome, used by the recap badge. */
export function resultLabel(result: PhraseResult | null): string {
  if (result === null) return '—';
  if (result === 'skipped') return 'Skipped';
  if (result === 'confirmed') return 'Confirmed';
  return `${result}`;
}
