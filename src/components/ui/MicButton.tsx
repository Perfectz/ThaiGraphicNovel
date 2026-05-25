import { forwardRef, useCallback, type PointerEvent as ReactPointerEvent } from 'react';

export type MicButtonProps = {
  /** True while the user is actively recording (pointer/key held). */
  isRecording: boolean;
  /** Called when capture should start (pointer-down or Space/Enter-down). */
  onStart: () => void;
  /** Called when capture should stop (pointer-up/cancel/leave or key-up). */
  onStop: () => void;
  /** Optional visible label. Defaults to a contextual "Hold to speak" / "Listening…". */
  label?: string;
  /** Optional sub-label under the main label (e.g. "Connect Whisper mic"). */
  hint?: string;
  /** When true, button is non-interactive and shows the disabled chrome. */
  disabled?: boolean;
  className?: string;
};

/**
 * Single mic primitive shared by BattleHUD and the Adventure HUDs.
 *
 * Visual contract: same shape, same position, same color set everywhere.
 *   idle      → accent fill, ink text
 *   recording → ember outline + 2px pulse, ember text "Listening…"
 *   disabled  → hairline border, paper-quiet text, no interaction
 *
 * Replaces:
 *   - bg-emerald-300 / bg-red-500 in BattleHUD.tsx (the only green button)
 *   - .adventure-3d-mic gradient + .adventure-3d-mic--recording in index.css
 *
 * Keyboard alternative: Space and Enter act as press-and-hold while focused.
 */
export const MicButton = forwardRef<HTMLButtonElement, MicButtonProps>(function MicButton(
  { isRecording, onStart, onStop, label, hint, disabled = false, className = '' },
  ref,
) {
  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (disabled) return;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      onStart();
    },
    [disabled, onStart],
  );

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (disabled) return;
      try {
        event.currentTarget.releasePointerCapture?.(event.pointerId);
      } catch {
        /* pointer capture may already be released */
      }
      onStop();
    },
    [disabled, onStop],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return;
      if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) {
        event.preventDefault();
        onStart();
      }
    },
    [disabled, onStart],
  );

  const handleKeyUp = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return;
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        onStop();
      }
    },
    [disabled, onStop],
  );

  const resolvedLabel = label ?? (isRecording ? 'Listening…' : 'Hold to speak');
  const recordingClass = isRecording
    ? 'mic-button--recording border-ember text-ember bg-transparent'
    : 'border-transparent bg-accent text-ink hover:enabled:bg-[#93EFFB]';

  return (
    <button
      ref={ref}
      type="button"
      aria-pressed={isRecording}
      aria-label={resolvedLabel}
      disabled={disabled}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={isRecording ? handlePointerUp : undefined}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      className={
        `mic-button inline-flex flex-col items-center justify-center gap-1 rounded-md border-2 px-5 py-3 ` +
        `font-display text-sm font-black uppercase tracking-[0.18em] ` +
        `transition-[transform,background-color,border-color,color] duration-[120ms] ease-out ` +
        `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink ` +
        `disabled:cursor-not-allowed disabled:border-hairline disabled:bg-transparent disabled:text-paper-quiet ` +
        `${recordingClass} ${className}`
      }
    >
      <span aria-hidden="true" className="text-[1rem]">
        ●
      </span>
      <span>{resolvedLabel}</span>
      {hint ? (
        <span className="text-[0.6rem] font-medium normal-case tracking-normal text-paper-muted">{hint}</span>
      ) : null}
    </button>
  );
});
