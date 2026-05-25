import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

export type ChipTone = 'default' | 'accent' | 'jade' | 'ember' | 'coach';

export type ChipProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: ChipTone;
  /** Optional leading glyph (small icon or dot). */
  iconBefore?: ReactNode;
  children?: ReactNode;
};

const TONE: Record<ChipTone, string> = {
  default: 'border-hairline bg-ink-raised text-paper-muted',
  accent: 'border-accent/40 bg-accent/10 text-accent',
  jade: 'border-jade/40 bg-jade/10 text-jade',
  ember: 'border-ember/40 bg-ember/10 text-ember',
  coach: 'border-coach/40 bg-coach/10 text-coach',
};

/**
 * Compact label primitive. Collapses the three legacy chip styles
 * (vn-status-chip, vn-voice-chip, adventure-3d-badge) into one tone-driven
 * component. Always Meta-type — see plan §1.2.
 */
export const Chip = forwardRef<HTMLSpanElement, ChipProps>(function Chip(
  { tone = 'default', iconBefore, className = '', children, ...rest },
  ref,
) {
  return (
    <span
      ref={ref}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.22em] ${TONE[tone]} ${className}`}
      {...rest}
    >
      {iconBefore ? (
        <span aria-hidden="true" className="text-[0.7em]">
          {iconBefore}
        </span>
      ) : null}
      <span>{children}</span>
    </span>
  );
});
