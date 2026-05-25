import { useCallback } from 'react';
import { useSoundSettings } from '../hooks/useSoundSettings';
import { getSoundSettings, saveSoundSettings } from '../services/soundSettings';
import { IconButton } from './ui';

export type MusicToggleProps = {
  /** Extra Tailwind classes for positioning. The button itself handles its own
   *  shape, border, focus ring — pass placement (top/right/z) here. */
  className?: string;
  /** Size token forwarded to IconButton. Default `md`. */
  size?: 'sm' | 'md' | 'lg';
};

/**
 * One-click music on/off toggle.
 *
 * Reads + writes the same `soundSettings.musicEnabled` value the full Game
 * Settings modal uses, so the player can mute from anywhere (title screen,
 * in-game) without opening a menu. The volume slider stays in Game Settings.
 *
 * Persists across sessions via localStorage in `soundSettings`, and broadcasts
 * `SOUND_SETTINGS_CHANGED_EVENT` so `useGameMusic` reacts immediately.
 */
export function MusicToggle({ className = '', size = 'md' }: MusicToggleProps) {
  const settings = useSoundSettings();
  const enabled = settings.musicEnabled;

  const toggle = useCallback(() => {
    // Read fresh — the local `settings` could be a frame stale if multiple
    // toggles fire in the same tick (e.g. keyboard shortcut + click).
    const current = getSoundSettings();
    saveSoundSettings({ ...current, musicEnabled: !current.musicEnabled });
  }, []);

  return (
    <IconButton
      onClick={toggle}
      aria-label={enabled ? 'Mute music' : 'Unmute music'}
      aria-pressed={enabled}
      size={size}
      className={className}
      // Keep title for hover-tooltip — quick discovery on desktop without
      // forcing a screen-reader-only role.
      title={enabled ? 'Mute music' : 'Unmute music'}
    >
      {/* Inline SVG so we don't add a font icon dep. Two paths swap based on
          state so screen-readers still see a single button. */}
      {enabled ? (
        // Speaker with sound waves
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="h-[60%] w-[60%]"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M11 5 6 9H3v6h3l5 4z" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M18.36 5.64a9 9 0 0 1 0 12.72" />
        </svg>
      ) : (
        // Speaker muted (with X)
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="h-[60%] w-[60%]"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M11 5 6 9H3v6h3l5 4z" />
          <line x1="22" y1="9" x2="16" y2="15" />
          <line x1="16" y1="9" x2="22" y2="15" />
        </svg>
      )}
    </IconButton>
  );
}
