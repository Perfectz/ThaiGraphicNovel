export type VerdictTone = 'jade' | 'paper' | 'coach' | 'ember';

export type VerdictBadgeProps = {
  tone: VerdictTone;
  label: string;
  /** Optional secondary line — score, "needs work", etc. */
  detail?: string;
  /** When true, the badge gets larger Display-type label (used by the score-flash). */
  emphasis?: boolean;
  className?: string;
};

const TONE: Record<VerdictTone, { dot: string; border: string; label: string }> = {
  jade: { dot: 'bg-jade', border: 'border-jade/60', label: 'text-paper' },
  paper: { dot: 'bg-paper/60', border: 'border-hairline', label: 'text-paper' },
  coach: { dot: 'bg-coach', border: 'border-coach/60', label: 'text-paper' },
  ember: { dot: 'bg-ember', border: 'border-ember/60', label: 'text-paper' },
};

/**
 * Replaces ten Tailwind color states in SuPronunciationJudge AND the five
 * .pronunciation-score-flash--* gradient tones with a single primitive whose
 * verdict signal lives in a colored dot, not a full-card re-skin. See plan
 * §2.2 + §2.7.
 *
 * Tone semantics:
 *   jade   — success (verdict pass with high score, stage clear)
 *   paper  — pass without celebration (mid-range pass)
 *   coach  — coaching / try again (didn't pass but close)
 *   ember  — fail / error (low score, voice error)
 */
export function VerdictBadge({ tone, label, detail, emphasis = false, className = '' }: VerdictBadgeProps) {
  const palette = TONE[tone];
  const labelClass = emphasis
    ? 'font-display text-2xl font-black tracking-tight'
    : 'font-display text-sm font-bold uppercase tracking-[0.18em]';
  return (
    <div
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-3 rounded-md border bg-ink-raised px-3 py-2 ${palette.border} ${className}`}
    >
      <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-full ${palette.dot}`} />
      <div className="flex flex-col gap-0.5">
        <span className={`${labelClass} ${palette.label}`}>{label}</span>
        {detail ? <span className="text-xs font-medium text-paper-muted">{detail}</span> : null}
      </div>
    </div>
  );
}
