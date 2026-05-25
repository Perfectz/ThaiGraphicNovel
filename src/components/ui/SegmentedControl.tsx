import { useCallback, useRef, type KeyboardEvent } from 'react';

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  /** Optional one-line caption rendered under the label in a smaller weight. */
  description?: string;
};

export type SegmentedControlProps<T extends string> = {
  /** Required aria-label for the radiogroup. */
  ariaLabel: string;
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (next: T) => void;
  /** Number of columns at sm+. Defaults to options.length (auto). */
  columns?: 2 | 3 | 4;
  className?: string;
};

const COLUMNS: Record<NonNullable<SegmentedControlProps<string>['columns']>, string> = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-4',
};

/**
 * WAI-ARIA conformant radiogroup with roving-tabindex keyboard navigation.
 * Only the currently-selected option is in the tab order; ← → ↑ ↓ move
 * selection, Home/End jump to first/last.
 *
 * Visual: selected option fills with accent on ink, unselected options are
 * outlined ghosts. The container is a single bordered surface that visually
 * groups the choices, not a row of independent buttons — which is what the
 * "segmented" pattern signals semantically.
 */
export function SegmentedControl<T extends string>({
  ariaLabel,
  options,
  value,
  onChange,
  columns,
  className = '',
}: SegmentedControlProps<T>) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  const focusIndex = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(options.length - 1, index));
      const button = buttonRefs.current[clamped];
      if (button) button.focus({ preventScroll: true });
      onChange(options[clamped].value);
    },
    [onChange, options],
  );

  const handleKey = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          event.preventDefault();
          focusIndex(selectedIndex === options.length - 1 ? 0 : selectedIndex + 1);
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          event.preventDefault();
          focusIndex(selectedIndex === 0 ? options.length - 1 : selectedIndex - 1);
          break;
        case 'Home':
          event.preventDefault();
          focusIndex(0);
          break;
        case 'End':
          event.preventDefault();
          focusIndex(options.length - 1);
          break;
        default:
      }
    },
    [focusIndex, options.length, selectedIndex],
  );

  const colClass = columns ? COLUMNS[columns] : `sm:grid-cols-${Math.min(4, options.length)}`;

  return (
    // tabIndex={-1} makes the radiogroup container programmatically focusable
    // (required by jsx-a11y/interactive-supports-focus) without inserting an
    // extra tab stop — the individual radio buttons own the tab order via
    // their roving tabindex.
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      tabIndex={-1}
      onKeyDown={handleKey}
      className={`grid grid-cols-1 gap-px overflow-hidden rounded-md border border-hairline bg-hairline ${colClass} ${className}`}
    >
      {options.map((option, index) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              buttonRefs.current[index] = el;
            }}
            role="radio"
            type="button"
            aria-checked={isSelected}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={
              `relative flex flex-col items-start gap-0.5 px-3 py-2.5 text-left transition-colors duration-[120ms] ease-out ` +
              `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-0 focus-visible:z-10 ` +
              (isSelected ? 'bg-accent text-ink' : 'bg-ink-raised text-paper hover:bg-ink-elevated')
            }
          >
            <span className="font-display text-[0.7rem] font-black uppercase tracking-[0.16em]">
              {option.label}
            </span>
            {option.description ? (
              <span
                className={`text-[0.65rem] font-medium leading-snug ${
                  isSelected ? 'text-ink/75' : 'text-paper-muted'
                }`}
              >
                {option.description}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
