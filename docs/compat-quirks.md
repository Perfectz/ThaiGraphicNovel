# Browser Compat Quirks

Living document of browser-specific behaviour we've hit while shipping the demo. Update whenever something surprises you on a real device.

Run the multi-engine smoke any time you change rendering, audio, or input code:

```bash
npm run dev              # one terminal
npm run test:multi-engine   # another terminal
```

Engines tested: Chromium, Firefox, WebKit (Safari approximation). Screenshots saved to `tmp/multi-engine/`.

---

## Safari (desktop + iOS)

### Autoplay policy

Safari blocks unmuted video/audio playback until the page has received a user interaction. We handle this in `Stage3DAdventure.tsx` — the intro-video `play()` promise has a `.catch()` that swallows `NotAllowedError`, and the Skip Intro button is always available as the explicit user gesture. Same pattern for Su voice-over: any audio playback is initiated from a click/tap handler, never from a bare effect.

**Symptom if broken:** intro1.mp4 stays on screen with the spinner; no audio; player taps Skip Intro to recover.

### AudioContext suspended on first load

`AudioContext` starts in the `suspended` state on Safari until user gesture. Three.js doesn't use WebAudio directly, but the captions strip + Su VO use `HTMLAudioElement.play()` which is governed by the same policy. We never construct a free-standing `AudioContext`.

### iOS Safari `getUserMedia` requires HTTPS

`navigator.mediaDevices` is `undefined` on `http://` URLs on iOS Safari (except `localhost`). The mic-denied auto-fallback in `connectVoiceCoach` catches this — when `getUserMedia` doesn't even exist, we treat it as a `NotAllowedError` and switch the player into No-mic mode silently.

**Symptom if broken:** a deployed http:// URL on iOS surfaces "could not connect" with no recovery. Fix: deploy over https.

### WebGL fragment-precision warnings

WebKit logs `WebGL warning: highp precision` chatter for some shader programs. Cosmetic; filtered out of the multi-engine smoke by an ERROR_FILTERS entry.

### iOS pixel-ratio crush

iPhones report `devicePixelRatio` of 2 or 3 but their GPUs can't sustain 3× pixel work at 60fps. We cap `renderer.setPixelRatio` at `1.0` for mobile in `browserCapabilities.ts → recommendedPixelRatio`. Without this, Stage 3's particle field melts the frame rate.

---

## Firefox (desktop)

### WebRTC SDP differences

The Realtime relay (`server/realtime-session.mjs`) forwards SDP between the browser and OpenAI. Firefox's SDP varies subtly from Chrome's; the relay is pass-through and so far this hasn't surfaced an issue. If a Firefox user reports Realtime mode failing while Chrome works, capture the SDP offer and check for missing `m=audio` lines.

### GLB loader timing

GLTFLoader on Firefox can fire its `onLoad` callback ~200ms later than on Chrome for the same asset. The `minDisplayElapsed` timer (900ms) covers this — by the time the spinner is allowed to fade, the GLB has always landed.

### Console: "downloadable font" warnings

Firefox logs warnings about non-`woff2` fallbacks. Cosmetic; we ship system fonts as the primary stack so this is a no-op.

---

## Chromium (desktop, primary dev target)

### `console.warn` from HMR

Vite's HMR layer can log "WebSocket connection failed" if the dev server restarted mid-session. Cosmetic. Production builds don't include HMR.

### Hardware concurrency reporting

Chrome reports the actual `navigator.hardwareConcurrency`. Firefox caps it at 16 (for fingerprinting resistance). Safari reports 8 max. We treat `≤4 cores` as a "low-end device" hint in `browserCapabilities.ts`, which is conservative enough for all three.

---

## Chromium Android

### Touch-vs-click pointer-down latency

Mobile Chrome can debounce touch events ~300ms when no `touch-action` is set. The action panel uses `pointer-events: auto` and the verb buttons are regular `<button>` elements, so this shouldn't surface — but if you add a custom touch handler, set `touch-action: manipulation` on its element.

### Loud OS-level intent toasts

Some Android skins surface "Use the microphone?" as a system bar toast rather than a permission dialog. The mic-denied auto-fallback handles refusal correctly; the visual experience just looks different.

---

## iOS Safari (Mobile)

### `100dvh` rounding

iOS Safari rounds `dvh` to integer pixels per frame, which can cause a 1-pixel jitter at the bottom of the viewport during scroll. The action panel uses `bottom-10` plus a `min-h` constraint so the jitter is masked.

### Pinch-zoom on the canvas

We don't disable pinch-zoom globally. The Three.js canvas absorbs pinch via OrbitControls and remaps it to camera dolly, which is the intent. Page-level zoom outside the canvas still works.

### `prefers-reduced-motion`

iOS exposes this via System Settings → Accessibility → Motion. When enabled, the intro cinematic is skipped (`browserCapabilities.prefersReducedMotion`).

---

## Cross-engine: dpr cap + reduced motion summary

| Engine / device | Pixel ratio cap | prefers-reduced-motion | Notes |
|---|---|---|---|
| Chromium desktop | 1.5 | Honoured | Primary dev target |
| Firefox desktop | 1.5 | Honoured | GLB loader slightly slower |
| Safari desktop | 1.5 | Honoured | Autoplay needs gesture |
| Chrome Android | 1.0 | Honoured | Mic toast varies by skin |
| iOS Safari | 1.0 | Honoured | HTTPS required for mic |

---

## When you find a new quirk

Add it here with:

1. **Symptom** — what the user sees
2. **Cause** — the underlying browser behaviour
3. **Fix or workaround** — what we did, with file references
4. **How to verify** — what command or device confirms the fix

Then update the multi-engine smoke's `ERROR_FILTERS` only if the issue is truly cosmetic noise; if it's a real bug, fix it instead of filtering it.
