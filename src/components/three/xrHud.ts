import * as THREE from 'three';

/**
 * In-world HUD for the VR session.
 *
 * The flat-screen game's HUD is React DOM, which is invisible inside an
 * immersive WebXR session. This module mirrors the HUD-relevant React state
 * onto a CanvasTexture-backed panel that floats in front of the player, and
 * exposes a hit-test so VR controller rays can press its buttons. The buttons
 * dispatch back into the EXACT same handlers the DOM HUD uses (via refs in the
 * component), so gameplay logic is never duplicated.
 *
 * State flows IN through `update(snapshot)` (called from a React effect keyed
 * on the relevant useState values) and OUT through `hitTest(raycaster)` →
 * action id → the component's dispatch table.
 *
 * A controller ray that merely *points* at a button (without pressing) calls
 * `setHover(raycaster)` each frame, which repaints that button in a focused
 * style — VR has no system cursor, so this is the only way the player can tell
 * what their trigger is about to activate.
 */

const CANVAS_W = 1024;
const CANVAS_H = 768;
const PANEL_WIDTH_M = 1.3;
const PANEL_HEIGHT_M = (PANEL_WIDTH_M * CANVAS_H) / CANVAS_W;

// Palette is aligned to the flat-screen UI (Ink / Paper / Cyan with jade &
// red accents) so the VR panel feels like the same product, not a separate
// debug overlay.
const COLOR = {
  cyan: '#67E8F9',
  cyanBright: '#A5F3FF',
  cyanDeep: '#22D3EE',
  paper: '#F4F1EB',
  muted: 'rgba(244, 241, 235, 0.62)',
  faint: 'rgba(244, 241, 235, 0.16)',
  jade: '#7AE3B3',
  red: '#F87171',
  ink: '#06121A',
} as const;

export type XRHudVerb = { id: string; label: string; enabled: boolean };

export type XRHudSnapshot = {
  /** Stage objective / latest message line. */
  objective: string;
  /** Current caption or coach/voice status line. */
  status: string;
  /** Label of the selected hotspot, if any (drives the verb row). */
  selectedLabel: string | null;
  /** Verb buttons to show when a hotspot is selected. */
  verbs: XRHudVerb[];
  /** Whether a mic/voice prompt is active (a command or conversation turn). */
  promptActive: boolean;
  /**
   * Which primary mic affordance to show while a prompt is active:
   *   'record'  → hold-to-speak (mic connected)
   *   'connect' → connect the mic first
   *   'confirm' → no-mic "read & tap" confirm
   *   'none'    → no prompt
   */
  micRow: 'record' | 'connect' | 'confirm' | 'none';
  /** Whether the player is currently recording. */
  recording: boolean;
  /** Verdict feedback line after a spoken attempt, or null. */
  verdict: string | null;
  /** Stage finished — show the Continue button. */
  stageComplete: boolean;
  /**
   * Active per-stage intro (VN) line, or null when the intro is done. When
   * present the panel switches to a "story" layout: speaker name + the line,
   * with a single advance button. Takes priority over the verb/mic rows.
   */
  intro?: { speaker: string; line: string; canAdvance: boolean } | null;
};

/** Action ids emitted by hitTest, consumed by the component dispatch table. */
export type XRHudAction =
  | { kind: 'verb'; verb: string }
  | { kind: 'record' }
  | { kind: 'skip' }
  | { kind: 'confirm' }
  | { kind: 'connectMic' }
  | { kind: 'continue' }
  | { kind: 'introNext' }
  | { kind: 'openMenu' };

type ButtonTone = 'primary' | 'normal' | 'danger';

type Button = {
  x: number;
  y: number;
  w: number;
  h: number;
  action: XRHudAction;
  /** Stable identity for hover comparison (e.g. 'verb:ask', 'record'). */
  key: string;
  label: string;
  enabled: boolean;
  tone: ButtonTone;
};

export type XRHudHandle = {
  group: THREE.Group;
  update: (snapshot: XRHudSnapshot) => void;
  /** Returns the action under the ray, or null if it misses every button. */
  hitTest: (raycaster: THREE.Raycaster) => XRHudAction | null;
  /** True if the ray is over any enabled button (no state change / repaint). */
  peekHover: (raycaster: THREE.Raycaster) => boolean;
  /** Focus the button under the ray (or clear with null); repaints on change. */
  setHover: (raycaster: THREE.Raycaster | null) => void;
  dispose: () => void;
};

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** Draws wrapped text and returns the baseline y AFTER the last line drawn. */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 4,
): number {
  const words = text.split(/\s+/);
  let line = '';
  let lines = 0;
  let cursorY = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cursorY);
      line = word;
      cursorY += lineHeight;
      lines += 1;
      if (lines >= maxLines - 1) break;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cursorY);
  return cursorY + lineHeight;
}

/**
 * Pure layout pass: derive the button hitboxes for a snapshot. Shared by the
 * painter (to draw them) and the hit/hover tests (to resolve a ray), so the
 * pressable rectangle always matches the pixels exactly.
 */
function buildButtons(snapshot: XRHudSnapshot): Button[] {
  const buttons: Button[] = [];
  const left = 56;
  const contentWidth = CANVAS_W - left * 2;

  if (snapshot.stageComplete) {
    buttons.push({
      x: CANVAS_W / 2 - 210,
      y: 590,
      w: 420,
      h: 104,
      action: { kind: 'continue' },
      key: 'continue',
      label: 'Continue →',
      enabled: true,
      tone: 'primary',
    });
    return buttons;
  }

  // Always-available menu opener — a small hamburger in the header's top-right.
  // Lets the player reach Settings / Return to title from any in-session state.
  buttons.push({
    x: CANVAS_W - 56 - 54,
    y: 38,
    w: 54,
    h: 54,
    action: { kind: 'openMenu' },
    key: 'openMenu',
    label: '',
    enabled: true,
    tone: 'normal',
  });

  // Story / intro line — a single advance button, no verb or mic rows.
  if (snapshot.intro) {
    buttons.push({
      x: left,
      y: 624,
      w: contentWidth,
      h: 104,
      action: { kind: 'introNext' },
      key: 'introNext',
      label: snapshot.intro.canAdvance ? 'Continue →' : 'Tap to continue →',
      enabled: true,
      tone: 'primary',
    });
    return buttons;
  }

  // Verb row — only when a hotspot is selected.
  if (snapshot.selectedLabel && snapshot.verbs.length) {
    const gap = 18;
    const count = snapshot.verbs.length;
    const w = (contentWidth - gap * (count - 1)) / count;
    snapshot.verbs.forEach((verb, i) => {
      buttons.push({
        x: left + i * (w + gap),
        y: 512,
        w,
        h: 92,
        action: { kind: 'verb', verb: verb.id },
        key: `verb:${verb.id}`,
        label: verb.label,
        enabled: verb.enabled,
        tone: 'normal',
      });
    });
  }

  // Mic / prompt row — only while a command or conversation turn is live.
  if (snapshot.promptActive && snapshot.micRow !== 'none') {
    const rowY = 624;
    const rowH = 104;
    if (snapshot.micRow === 'connect') {
      buttons.push({
        x: left,
        y: rowY,
        w: contentWidth,
        h: rowH,
        action: { kind: 'connectMic' },
        key: 'connectMic',
        label: 'Connect mic',
        enabled: true,
        tone: 'primary',
      });
    } else {
      const skipW = 168;
      const primaryW = contentWidth - skipW - 18;
      const isRecord = snapshot.micRow === 'record';
      buttons.push({
        x: left,
        y: rowY,
        w: primaryW,
        h: rowH,
        action: isRecord ? { kind: 'record' } : { kind: 'confirm' },
        key: isRecord ? 'record' : 'confirm',
        label: isRecord
          ? snapshot.recording
            ? 'Recording — release'
            : 'Hold to speak'
          : 'Confirm phrase',
        enabled: true,
        tone: isRecord && snapshot.recording ? 'danger' : 'primary',
      });
      buttons.push({
        x: left + primaryW + 18,
        y: rowY,
        w: skipW,
        h: rowH,
        action: { kind: 'skip' },
        key: 'skip',
        label: 'Skip',
        enabled: true,
        tone: 'normal',
      });
    }
  }

  return buttons;
}

function drawButton(ctx: CanvasRenderingContext2D, btn: Button, hovered: boolean) {
  const radius = 20;
  ctx.save();

  if (!btn.enabled) {
    ctx.globalAlpha = 0.4;
  }

  // Soft glow under emphasised buttons; the hovered button glows brighter so
  // the focus target reads from across the room.
  if (btn.tone === 'primary' || btn.tone === 'danger') {
    ctx.shadowColor = btn.tone === 'danger' ? 'rgba(248, 113, 113, 0.55)' : 'rgba(103, 232, 249, 0.5)';
    ctx.shadowBlur = hovered ? 34 : 20;
    ctx.shadowOffsetY = 6;
  } else if (hovered) {
    ctx.shadowColor = 'rgba(103, 232, 249, 0.4)';
    ctx.shadowBlur = 22;
  }

  roundRect(ctx, btn.x, btn.y, btn.w, btn.h, radius);

  if (btn.tone === 'primary' || btn.tone === 'danger') {
    const gradient = ctx.createLinearGradient(0, btn.y, 0, btn.y + btn.h);
    if (btn.tone === 'danger') {
      gradient.addColorStop(0, hovered ? '#FCA5A5' : '#F87171');
      gradient.addColorStop(1, hovered ? '#F87171' : '#EF4444');
    } else if (!btn.enabled) {
      gradient.addColorStop(0, '#2A4A52');
      gradient.addColorStop(1, '#1E3A41');
    } else {
      gradient.addColorStop(0, hovered ? COLOR.cyanBright : COLOR.cyan);
      gradient.addColorStop(1, hovered ? COLOR.cyan : COLOR.cyanDeep);
    }
    ctx.fillStyle = gradient;
  } else {
    ctx.fillStyle = hovered ? 'rgba(103, 232, 249, 0.16)' : 'rgba(244, 241, 235, 0.05)';
  }
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Border.
  ctx.lineWidth = hovered ? 3 : 2;
  if (btn.tone === 'normal') {
    ctx.strokeStyle = hovered ? COLOR.cyan : COLOR.faint;
  } else {
    ctx.strokeStyle = hovered ? COLOR.cyanBright : 'rgba(6, 18, 26, 0.35)';
  }
  ctx.stroke();

  // Hamburger glyph for the menu opener (drawn, not a font glyph, so it renders
  // identically everywhere).
  if (btn.key === 'openMenu') {
    const cx = btn.x + btn.w / 2;
    const cy = btn.y + btn.h / 2;
    const bw = 22;
    ctx.strokeStyle = hovered ? COLOR.cyanBright : '#E8F6FF';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (const dy of [-7, 0, 7]) {
      ctx.beginPath();
      ctx.moveTo(cx - bw / 2, cy + dy);
      ctx.lineTo(cx + bw / 2, cy + dy);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  // Label.
  if (btn.tone === 'primary' || btn.tone === 'danger') {
    ctx.fillStyle = btn.tone === 'danger' ? '#1A0606' : COLOR.ink;
  } else {
    ctx.fillStyle = hovered ? COLOR.cyanBright : '#E8F6FF';
  }
  ctx.font = `600 ${btn.w < 220 ? 26 : 30}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // The active recording button gets a leading dot so it reads as "live".
  if (btn.tone === 'danger') {
    const dotR = 9;
    const textW = ctx.measureText(btn.label).width;
    const startX = btn.x + btn.w / 2 - textW / 2 - dotR - 14;
    ctx.beginPath();
    ctx.arc(startX, btn.y + btn.h / 2, dotR, 0, Math.PI * 2);
    ctx.fillStyle = '#1A0606';
    ctx.fill();
    ctx.fillStyle = btn.tone === 'danger' ? '#1A0606' : COLOR.ink;
    ctx.fillText(btn.label, btn.x + btn.w / 2 + dotR + 4, btn.y + btn.h / 2);
  } else {
    ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2);
  }

  ctx.restore();
}

/**
 * Pure painter — draws a full HUD frame from a snapshot. Exported so the panel
 * can be previewed/verified outside an immersive session. Returns the button
 * layout so callers can reuse it for ray hit-testing.
 */
export function renderXRHud(
  ctx: CanvasRenderingContext2D,
  snapshot: XRHudSnapshot,
  hoverKey: string | null = null,
): Button[] {
  const left = 56;
  const right = CANVAS_W - 56;
  const contentWidth = right - left;
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // --- Panel: gradient slab + rim + soft outer glow ---
  ctx.save();
  ctx.shadowColor = 'rgba(103, 232, 249, 0.22)';
  ctx.shadowBlur = 36;
  roundRect(ctx, 22, 22, CANVAS_W - 44, CANVAS_H - 44, 34);
  const slab = ctx.createLinearGradient(0, 22, 0, CANVAS_H - 22);
  slab.addColorStop(0, 'rgba(16, 20, 27, 0.94)');
  slab.addColorStop(1, 'rgba(7, 10, 15, 0.94)');
  ctx.fillStyle = slab;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(103, 232, 249, 0.5)';
  ctx.stroke();
  ctx.restore();

  // --- Header: brand dot + contextual eyebrow ---
  const headerY = 58;
  ctx.save();
  ctx.beginPath();
  ctx.arc(left + 7, headerY, 7, 0, Math.PI * 2);
  ctx.fillStyle = COLOR.cyan;
  ctx.shadowColor = 'rgba(103, 232, 249, 0.8)';
  ctx.shadowBlur = 14;
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = COLOR.cyan;
  ctx.font = '700 24px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  if ('letterSpacing' in ctx) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '3px';
  }
  const eyebrow = snapshot.intro
    ? snapshot.intro.speaker.toUpperCase()
    : snapshot.selectedLabel
      ? snapshot.selectedLabel.toUpperCase()
      : 'OBJECTIVE';
  ctx.fillText(eyebrow, left + 28, headerY + 1);
  if ('letterSpacing' in ctx) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '0px';
  }

  // Header hairline.
  ctx.strokeStyle = 'rgba(103, 232, 249, 0.22)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(left, 92);
  ctx.lineTo(right, 92);
  ctx.stroke();

  if (snapshot.intro) {
    // --- Story layout: the VN line gets the whole body, large and airy ---
    ctx.fillStyle = COLOR.paper;
    ctx.font = '400 38px system-ui, sans-serif';
    ctx.textBaseline = 'top';
    wrapText(ctx, snapshot.intro.line, left, 150, contentWidth, 50, 6);
  } else {
    // --- Objective body ---
    ctx.fillStyle = COLOR.paper;
    ctx.font = '400 32px system-ui, sans-serif';
    ctx.textBaseline = 'top';
    let cursorY = wrapText(
      ctx,
      snapshot.objective || 'Look around — point at people and objects.',
      left,
      124,
      contentWidth,
      42,
      3,
    );

    // --- Status / caption line (muted, with leading tick) ---
    if (snapshot.status) {
      cursorY += 14;
      ctx.fillStyle = 'rgba(103, 232, 249, 0.7)';
      ctx.font = '700 26px system-ui, sans-serif';
      ctx.fillText('›', left, cursorY);
      ctx.fillStyle = COLOR.muted;
      ctx.font = '400 26px system-ui, sans-serif';
      wrapText(ctx, snapshot.status, left + 26, cursorY, contentWidth - 26, 34, 2);
    }
  }

  // --- Verdict pill ---
  if (!snapshot.intro && snapshot.verdict) {
    const pass = snapshot.verdict.trim().startsWith('✓');
    const pillY = 410;
    const accent = pass ? COLOR.jade : COLOR.red;
    ctx.font = '600 27px system-ui, sans-serif';
    const text = snapshot.verdict;
    const textW = Math.min(ctx.measureText(text).width, contentWidth - 56);
    const pillW = textW + 56;
    ctx.save();
    roundRect(ctx, left, pillY, pillW, 56, 28);
    ctx.fillStyle = pass ? 'rgba(122, 227, 179, 0.14)' : 'rgba(248, 113, 113, 0.14)';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = accent;
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, left + 28, pillY + 30, contentWidth - 56);
    ctx.restore();
  }

  // --- Action dock ---
  const buttons = buildButtons(snapshot);
  // The header menu button sits at the top; it must not drag the dock divider
  // up with it, so it's excluded from the "topmost action" measurement.
  const dockButtons = buttons.filter((b) => b.key !== 'openMenu');
  if (dockButtons.length) {
    const dockTop = dockButtons.reduce((min, b) => Math.min(min, b.y), CANVAS_H) - 26;
    ctx.strokeStyle = 'rgba(244, 241, 235, 0.1)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(left, dockTop);
    ctx.lineTo(right, dockTop);
    ctx.stroke();
  }
  for (const btn of buttons) {
    drawButton(ctx, btn, btn.enabled && btn.key === hoverKey);
  }

  return buttons;
}

export function createXRHud(): XRHudHandle {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(PANEL_WIDTH_M, PANEL_HEIGHT_M), material);
  mesh.name = 'xr-hud-panel';

  const group = new THREE.Group();
  group.name = 'xr-hud';
  // Dock the panel to the UPPER-LEFT of the player's forward view rather than
  // dead-centre, so the straight-ahead sightline (NPCs, hotspots) stays clear.
  // Parented to the rig by the caller, so it follows teleport/turn but is not
  // head-locked — you can look away from it.
  //   x −0.62  → shifted left of centre
  //   y  1.32  → raised toward the top of the field of view
  //   z −1.42  → comfortable arm's-length reading distance
  // It is then tilted up toward the face (rotation.x) AND yawed back toward the
  // player (rotation.y) so an off-centre panel still reads head-on instead of
  // edge-on.
  mesh.position.set(-0.62, 1.32, -1.42);
  mesh.rotation.set(-0.24, 0.34, 0);
  group.add(mesh);

  const raycastTargets: THREE.Object3D[] = [mesh];
  let snapshot: XRHudSnapshot = {
    objective: '',
    status: '',
    selectedLabel: null,
    verbs: [],
    promptActive: false,
    micRow: 'none',
    recording: false,
    verdict: null,
    stageComplete: false,
  };
  let buttons: Button[] = [];
  let hoverKey: string | null = null;

  function paint() {
    buttons = renderXRHud(ctx, snapshot, hoverKey);
    texture.needsUpdate = true;
  }

  function update(next: XRHudSnapshot) {
    snapshot = next;
    paint();
  }

  function hoverKeyFromRay(raycaster: THREE.Raycaster): string | null {
    const hit = raycaster.intersectObjects(raycastTargets, false)[0];
    if (!hit?.uv) return null;
    const px = hit.uv.x * CANVAS_W;
    const py = (1 - hit.uv.y) * CANVAS_H;
    for (const btn of buttons) {
      if (btn.enabled && px >= btn.x && px <= btn.x + btn.w && py >= btn.y && py <= btn.y + btn.h) {
        return btn.key;
      }
    }
    return null;
  }

  function hitTest(raycaster: THREE.Raycaster): XRHudAction | null {
    const key = hoverKeyFromRay(raycaster);
    if (!key) return null;
    const btn = buttons.find((entry) => entry.key === key);
    return btn ? btn.action : null;
  }

  function peekHover(raycaster: THREE.Raycaster): boolean {
    return hoverKeyFromRay(raycaster) !== null;
  }

  function setHover(raycaster: THREE.Raycaster | null) {
    const nextKey = raycaster ? hoverKeyFromRay(raycaster) : null;
    if (nextKey === hoverKey) return;
    hoverKey = nextKey;
    paint();
  }

  function dispose() {
    mesh.geometry.dispose();
    material.dispose();
    texture.dispose();
  }

  // Seed the first frame so the panel isn't blank before the first update.
  paint();

  return { group, update, hitTest, peekHover, setHover, dispose };
}
