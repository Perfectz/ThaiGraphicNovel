import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react';
import { IconButton } from './IconButton';

export type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  /** Title rendered in the header — also wired as aria-labelledby. */
  title: string;
  /** Optional small caption above the title (Meta type, accent color). */
  eyebrow?: string;
  /** Optional footer content (e.g. action buttons). */
  footer?: ReactNode;
  children: ReactNode;
  /** Optional className applied to the dialog panel. */
  className?: string;
  /** When true, the close button is hidden (use for blocking dialogs). Defaults to false. */
  hideClose?: boolean;
};

/**
 * Accessible modal primitive. Extracts the focus-trap / focus-restoration /
 * Escape-to-close / role=dialog logic from the existing LevelSelect overlay
 * so every modal in the app gets the same a11y contract for free.
 *
 * Responsibilities owned by this primitive:
 *   - role=dialog + aria-modal=true + aria-labelledby
 *   - On open: snapshot opener via document.activeElement, focus primary action
 *   - Trap Tab inside the dialog (cycle forward + backward)
 *   - Close on Escape
 *   - On close: restore focus to the opener
 *
 * Plan §1.3 + §1.5.
 */
export function Modal({
  isOpen,
  onClose,
  title,
  eyebrow,
  footer,
  children,
  className = '',
  hideClose = false,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  // Snapshot opener + restore on close.
  useEffect(() => {
    if (!isOpen) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    return () => {
      const opener = previouslyFocusedRef.current;
      if (opener && typeof opener.focus === 'function') {
        opener.focus();
      }
    };
  }, [isOpen]);

  // Move focus inside on open.
  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusables = dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]):not([aria-hidden="true"]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    const target = focusables[0];
    if (target) target.focus({ preventScroll: true });
  }, [isOpen]);

  const handleBackdropClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) onClose();
    },
    [onClose],
  );

  // Keyboard: Esc closes, Tab traps within dialog.
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusables = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]):not([aria-hidden="true"]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[100] grid place-items-center bg-[rgba(10,10,11,0.78)] p-4 backdrop-blur-md"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-[12px] border border-hairline bg-ink-raised text-paper shadow-card ${className}`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-hairline px-5 py-4 sm:px-7">
          <div className="min-w-0">
            {eyebrow ? (
              <p className="font-display text-[10px] font-bold uppercase tracking-[0.32em] text-accent">
                {eyebrow}
              </p>
            ) : null}
            <h2
              id={titleId}
              className="mt-1 font-display text-xl font-black uppercase tracking-tight text-paper sm:text-2xl"
            >
              {title}
            </h2>
          </div>
          {hideClose ? null : (
            <IconButton onClick={onClose} aria-label="Close dialog" size="sm">
              ✕
            </IconButton>
          )}
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">{children}</div>
        {footer ? (
          <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-hairline px-5 py-4 sm:px-7">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
