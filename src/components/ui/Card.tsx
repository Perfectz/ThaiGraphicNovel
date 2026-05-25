import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  /** Adds a flat 0 8px 24px shadow for raised visual weight. No neon glow. */
  elevated?: boolean;
  /** Optional accent tone for a 3px left rule — semantic edge. */
  tone?: 'none' | 'accent' | 'jade' | 'ember' | 'coach';
  children?: ReactNode;
};

const TONE_RULE: Record<NonNullable<CardProps['tone']>, string> = {
  none: '',
  accent: 'before:bg-accent',
  jade: 'before:bg-jade',
  ember: 'before:bg-ember',
  coach: 'before:bg-coach',
};

/**
 * Default surface for any panel or grouped content. Ink-raised background,
 * 1px hairline border, no neon glow. Optionally elevated and/or accented
 * with a 3px left rule (the only place tone-colored chrome lives).
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { elevated = false, tone = 'none', className = '', children, ...rest },
  ref,
) {
  const elevation = elevated ? 'shadow-card' : '';
  const rule =
    tone === 'none'
      ? ''
      : `relative before:absolute before:left-0 before:top-0 before:h-full before:w-[3px] before:rounded-l-[10px] ${TONE_RULE[tone]}`;
  return (
    <div
      ref={ref}
      className={`overflow-hidden rounded-[10px] border border-hairline bg-ink-raised text-paper ${elevation} ${rule} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
});
