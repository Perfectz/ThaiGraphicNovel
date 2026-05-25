import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** REQUIRED — IconButtons have no visible label, so the aria-label is mandatory. */
  'aria-label': string;
  /** Glyph element (text, emoji, or inline SVG). */
  children: ReactNode;
  /** Size token. Defaults to `md` (40px). */
  size?: 'sm' | 'md' | 'lg';
};

const SIZE: Record<NonNullable<IconButtonProps['size']>, string> = {
  sm: 'h-10 w-10 text-sm',
  md: 'h-11 w-11 text-base',
  lg: 'h-12 w-12 text-lg',
};

/**
 * Circular icon-only button (close affordances, gear menus, overlay toggles).
 * Always requires aria-label since there's no visible text.
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { size = 'md', className = '', type = 'button', children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={
        `grid place-items-center rounded-full border border-hairline bg-ink-raised text-paper ` +
        `transition-colors duration-[120ms] ease-out ` +
        `hover:enabled:border-accent hover:enabled:text-accent ` +
        `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink ` +
        `disabled:cursor-not-allowed disabled:opacity-50 ` +
        `${SIZE[size]} ${className}`
      }
      {...rest}
    >
      {children}
    </button>
  );
});
