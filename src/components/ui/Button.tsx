import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'ghost' | 'quiet' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Optional glyph rendered before the label. */
  iconBefore?: ReactNode;
  /** Optional glyph rendered after the label (chevron, arrow, etc.). */
  iconAfter?: ReactNode;
};

const BASE =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-display font-black uppercase tracking-[0.18em] ' +
  'transition-[transform,background-color,border-color,color,box-shadow] duration-[120ms] ease-out ' +
  'rounded-md border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-ink disabled:cursor-not-allowed disabled:opacity-50';

const SIZE: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-[0.7rem]',
  md: 'px-4 py-2.5 text-[0.78rem]',
  lg: 'px-5 py-3 text-[0.85rem]',
};

const VARIANT: Record<ButtonVariant, string> = {
  // Primary — solid accent on ink.
  primary:
    'bg-accent text-ink border-transparent shadow-[0_8px_22px_rgba(103,232,249,0.18)] ' +
    'hover:enabled:bg-[#93EFFB] hover:enabled:-translate-y-px active:enabled:translate-y-0',
  // Ghost — outlined hairline, paper text, transparent fill.
  ghost:
    'bg-transparent text-paper border-hairline ' +
    'hover:enabled:border-accent hover:enabled:text-accent hover:enabled:-translate-y-px active:enabled:translate-y-0',
  // Quiet — text-only tertiary, no border, no fill.
  quiet: 'bg-transparent text-paper-muted border-transparent ' + 'hover:enabled:text-paper',
  // Destructive — ember outline (used for "Clear Key" and similar).
  destructive:
    'bg-transparent text-ember border-ember/60 ' +
    'hover:enabled:bg-ember/10 hover:enabled:border-ember hover:enabled:-translate-y-px active:enabled:translate-y-0',
};

/**
 * The single button primitive for the modern design system. Replaces ad-hoc
 * Tailwind class strings on every CTA across the app.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    iconBefore,
    iconAfter,
    className = '',
    type = 'button',
    children,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`${BASE} ${SIZE[size]} ${VARIANT[variant]} ${className}`}
      {...rest}
    >
      {iconBefore ? <span aria-hidden="true">{iconBefore}</span> : null}
      <span>{children}</span>
      {iconAfter ? <span aria-hidden="true">{iconAfter}</span> : null}
    </button>
  );
});
