import type { PronunciationVerdict } from '../services/realtimePronunciation';

/**
 * Small presentation helpers used by Stage3DAdventure.tsx. Kept colocated by
 * filename rather than tucked into a generic util so the call graph for the
 * stage is easy to navigate.
 */

export type PronunciationFlashTone = 'excellent' | 'great' | 'passed' | 'try-harder' | 'failure';

export type PronunciationScoreFlash = {
  id: number;
  tone: PronunciationFlashTone;
  label: string;
  detail: string;
};

export function getPronunciationScoreFlash(
  verdict: PronunciationVerdict,
): Omit<PronunciationScoreFlash, 'id'> {
  if (verdict.score >= 95)
    return { tone: 'excellent', label: 'Excellent', detail: `${verdict.score}/100 — Su heard it clearly.` };
  if (verdict.score >= 85)
    return { tone: 'great', label: 'Great', detail: `${verdict.score}/100 — rhythm landed.` };
  if (verdict.pass)
    return { tone: 'passed', label: 'Passed', detail: `${verdict.score}/100 — keep sharpening it.` };
  if (verdict.score >= 45)
    return { tone: 'try-harder', label: 'Try Harder', detail: `${verdict.score}/100 — slow it down.` };
  return { tone: 'failure', label: 'Failure', detail: `${verdict.score}/100 — listen and retry.` };
}

export function colorToCss(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

export function withAlpha(hex: number, alpha: number): string {
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
