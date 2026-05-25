/**
 * Shared types for microgame mechanic components.
 *
 * Every mechanic component receives the same minimal interface so the runner
 * can swap them in/out without knowing internal details. The mechanic owns its
 * own input handling and decides when to call `onResult(true|false)`. The
 * runner owns the countdown timer — if it hits zero before the mechanic calls
 * onResult, the runner forces a fail.
 */
import { type MicrogameConfig } from '../../data/microgames';

export type MicrogameMechanicProps = {
  config: MicrogameConfig;
  /**
   * Call exactly once with whether the player succeeded. The runner ignores
   * subsequent calls so a double-click can't corrupt the score.
   */
  onResult: (passed: boolean) => void;
  /**
   * Remaining ms until the runner force-fails. Mechanics that want to render
   * their own urgency cue (shaking, color shift) can read this.
   */
  timeLeftMs: number;
};
