/**
 * Centralised browser capability + device-class detection so the rest of
 * the app can adapt without each component re-running its own UA sniff.
 *
 * Computed once on first call and cached for the page lifetime. The
 * captured values are deliberately conservative — when a check is
 * ambiguous we treat the device as lower-spec so we don't over-promise
 * frames or features on a mid-range phone.
 */

export type BrowserCapabilities = {
  /** True when a WebGL2 context can be created on this browser. */
  hasWebGL2: boolean;
  /** True when getUserMedia is available (mic capture). False on insecure origins. */
  hasMicCapture: boolean;
  /** True when the user has set OS-level prefers-reduced-motion. Honour
   *  this by skipping non-essential animations and cinematics. */
  prefersReducedMotion: boolean;
  /** True for iOS Safari (incl. iPadOS). Different autoplay + audio quirks
   *  than every other browser; the cinematic / Su VO paths special-case
   *  this. */
  isIOS: boolean;
  /** True for any Safari (desktop or iOS). */
  isSafari: boolean;
  /** True for Firefox. Used to skip some Chrome-only WebGPU optimisations. */
  isFirefox: boolean;
  /** True for handheld / mobile devices by viewport width OR touch + UA
   *  heuristic. Drives pixel-ratio caps + lower particle counts. */
  isMobile: boolean;
  /** Sensible upper bound on devicePixelRatio for Three.js render targets.
   *  Mobile = 1.0 (no high-DPI scaling) so we don't burn 4× the pixels on
   *  a phone GPU. Desktop = 1.5. Desktop Retina caps at 1.5 because the
   *  perceived quality bump past that doesn't pay for the cost. */
  recommendedPixelRatio: number;
  /** Hardware-concurrency-derived hint. Low = ≤4 cores OR mobile. We use
   *  it to dial down particle field densities. */
  isLowEndDevice: boolean;
};

let cached: BrowserCapabilities | null = null;

function detectWebGL2(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2'));
  } catch {
    return false;
  }
}

function detectMicCapture(): boolean {
  if (typeof navigator === 'undefined') return false;
  return Boolean(navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function');
}

function detectPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function detectMobile(ua: string): boolean {
  if (typeof window === 'undefined') return false;
  // Width-based heuristic catches iPad-in-desktop-mode and uncommon UAs;
  // UA pattern catches everything else.
  const narrowViewport = window.innerWidth <= 820;
  const mobileUa = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  return narrowViewport || mobileUa;
}

export function getBrowserCapabilities(): BrowserCapabilities {
  if (cached) return cached;

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  const isFirefox = /Firefox/i.test(ua);
  const isMobile = detectMobile(ua);
  const cores = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency ?? 4) : 4;
  const isLowEndDevice = isMobile || cores <= 4;

  cached = {
    hasWebGL2: detectWebGL2(),
    hasMicCapture: detectMicCapture(),
    prefersReducedMotion: detectPrefersReducedMotion(),
    isIOS,
    isSafari,
    isFirefox,
    isMobile,
    recommendedPixelRatio: isMobile ? 1.0 : 1.5,
    isLowEndDevice,
  };

  return cached;
}

/**
 * Format a human-readable banner string for the title-screen About modal
 * or for diagnostic logs. Returns "" when nothing notable about the
 * browser needs to be surfaced.
 */
export function getBrowserAdvisory(): string {
  const caps = getBrowserCapabilities();
  if (!caps.hasWebGL2) {
    return 'Your browser does not support WebGL 2. The 3D scenes need WebGL 2 — try a recent Chrome, Edge, Firefox, or Safari.';
  }
  if (caps.isIOS) {
    return 'iOS Safari supported. The intro video starts on your first tap, and Whisper voice mode runs locally — give it ~10 seconds to warm up.';
  }
  if (caps.isMobile) {
    return 'Mobile detected. Visual polish is reduced on phones to keep the frame rate steady.';
  }
  return '';
}
