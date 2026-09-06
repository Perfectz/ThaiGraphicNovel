/**
 * VR comfort settings — the single source of truth for how locomotion feels.
 *
 * These are deliberately *not* React state: the XR controller loop reads them
 * every frame via a getter, and the in-world menu mutates them through the
 * cycle helpers. The values persist to localStorage so a player's comfort
 * choice survives a reload (motion sensitivity doesn't change between sessions).
 *
 * Pure data + pure helpers only — no THREE, no DOM beyond localStorage — so the
 * cycling/degree logic is unit-testable without a headset.
 */

/** Discrete snap turn (comfort) vs. continuous yaw (intense). */
export type XRTurnStyle = 'snap-30' | 'snap-45' | 'smooth';
/** Peripheral-occlusion strength applied during locomotion. */
export type XRVignetteLevel = 'off' | 'light' | 'strong';
/** Which hand drives movement; the other drives turning. */
export type XRHandPreference = 'right' | 'left';

export type XRComfortSettings = {
  turn: XRTurnStyle;
  vignette: XRVignetteLevel;
  /** The hand that drives TURNING. Movement is always the other hand. */
  handedness: XRHandPreference;
};

/**
 * Comfort-first defaults: snap turn, strong vignette, right-handed turning.
 * A first-time VR player should be protected from nausea by default and opt
 * *into* intensity, never the reverse.
 */
export const DEFAULT_COMFORT: XRComfortSettings = {
  turn: 'snap-30',
  vignette: 'strong',
  handedness: 'right',
};

const STORAGE_KEY = 'itq.xr.comfort.v1';

const TURN_ORDER: XRTurnStyle[] = ['snap-30', 'snap-45', 'smooth'];
const VIGNETTE_ORDER: XRVignetteLevel[] = ['strong', 'light', 'off'];

export const TURN_LABEL: Record<XRTurnStyle, string> = {
  'snap-30': 'Snap 30°',
  'snap-45': 'Snap 45°',
  smooth: 'Smooth',
};

export const VIGNETTE_LABEL: Record<XRVignetteLevel, string> = {
  off: 'Off',
  light: 'Light',
  strong: 'Strong',
};

export const HAND_LABEL: Record<XRHandPreference, string> = {
  right: 'Right',
  left: 'Left',
};

/** Snap increment in radians for a snap turn style (0 for smooth). */
export function snapTurnRadians(style: XRTurnStyle): number {
  switch (style) {
    case 'snap-30':
      return (30 * Math.PI) / 180;
    case 'snap-45':
      return (45 * Math.PI) / 180;
    case 'smooth':
      return 0;
  }
}

/** Peak vignette aperture (0 = no occlusion, 1 = fully closed) for a level. */
export function vignetteStrength(level: XRVignetteLevel): number {
  switch (level) {
    case 'off':
      return 0;
    case 'light':
      return 0.45;
    case 'strong':
      return 0.8;
  }
}

function cycle<T>(order: T[], current: T): T {
  const i = order.indexOf(current);
  return order[(i + 1) % order.length];
}

export function cycleTurnStyle(current: XRTurnStyle): XRTurnStyle {
  return cycle(TURN_ORDER, current);
}

export function cycleVignette(current: XRVignetteLevel): XRVignetteLevel {
  return cycle(VIGNETTE_ORDER, current);
}

export function toggleHandedness(current: XRHandPreference): XRHandPreference {
  return current === 'right' ? 'left' : 'right';
}

function isTurnStyle(v: unknown): v is XRTurnStyle {
  return v === 'snap-30' || v === 'snap-45' || v === 'smooth';
}
function isVignette(v: unknown): v is XRVignetteLevel {
  return v === 'off' || v === 'light' || v === 'strong';
}
function isHand(v: unknown): v is XRHandPreference {
  return v === 'right' || v === 'left';
}

/** Coerce arbitrary parsed JSON into a valid settings object, field by field. */
export function normalizeComfort(raw: unknown): XRComfortSettings {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    turn: isTurnStyle(obj.turn) ? obj.turn : DEFAULT_COMFORT.turn,
    vignette: isVignette(obj.vignette) ? obj.vignette : DEFAULT_COMFORT.vignette,
    handedness: isHand(obj.handedness) ? obj.handedness : DEFAULT_COMFORT.handedness,
  };
}

export function loadComfort(): XRComfortSettings {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_COMFORT };
    return normalizeComfort(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_COMFORT };
  }
}

export function saveComfort(settings: XRComfortSettings): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Private mode / disabled storage — comfort just won't persist. Non-fatal.
  }
}
