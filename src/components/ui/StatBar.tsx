import { type CSSProperties } from 'react';

export type StatBarTone = 'accent' | 'jade' | 'ember';
export type StatBarFormat = 'fraction' | 'percent';

export type StatBarProps = {
  /** Visible label rendered top-left (Meta type). */
  label: string;
  /** Current value. Clamped to [0, max]. */
  value: number;
  /** Maximum value the bar tops out at. */
  max: number;
  /** How to render the right-side value text. Defaults to `fraction`. */
  format?: StatBarFormat;
  /** Fill tone. Defaults to `accent` (cyan). */
  tone?: StatBarTone;
  /** Optional helper text rendered below the bar. */
  helper?: string;
  className?: string;
};

const FILL: Record<StatBarTone, string> = {
  accent: 'bg-accent',
  jade: 'bg-jade',
  ember: 'bg-ember',
};

/**
 * Accessible progress bar with consistent labeling. Replaces every ad-hoc
 * `.vn-meter` in the battle/adventure HUDs. Two stat bars on the same
 * screen MUST use the same `format` and the same `tone` unless they carry
 * genuinely different semantics — see plan §intro.3.
 */
export function StatBar({
  label,
  value,
  max,
  format = 'fraction',
  tone = 'accent',
  helper,
  className = '',
}: StatBarProps) {
  const safeMax = Math.max(1, max);
  const clamped = Math.max(0, Math.min(value, safeMax));
  const percent = (clamped / safeMax) * 100;
  const rightText = format === 'percent' ? `${Math.round(percent)}%` : `${clamped}/${safeMax}`;
  const fillStyle: CSSProperties = { width: `${percent}%` };

  return (
    <div className={className}>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-[0.65rem] font-bold uppercase tracking-[0.22em] text-paper-muted">
        <span>{label}</span>
        <span className="tabular-nums text-paper">{rightText}</span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={clamped}
        className="h-1.5 w-full overflow-hidden rounded-full bg-ink-elevated"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-[220ms] ease-out ${FILL[tone]}`}
          style={fillStyle}
        />
      </div>
      {helper ? (
        <p className="mt-1 text-[0.6rem] font-medium uppercase tracking-[0.18em] text-paper-quiet">
          {helper}
        </p>
      ) : null}
    </div>
  );
}
