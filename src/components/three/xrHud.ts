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
 */

const CANVAS_W = 1024;
const CANVAS_H = 768;
const PANEL_WIDTH_M = 1.3;
const PANEL_HEIGHT_M = (PANEL_WIDTH_M * CANVAS_H) / CANVAS_W;

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
};

/** Action ids emitted by hitTest, consumed by the component dispatch table. */
export type XRHudAction =
  | { kind: 'verb'; verb: string }
  | { kind: 'record' }
  | { kind: 'skip' }
  | { kind: 'confirm' }
  | { kind: 'connectMic' }
  | { kind: 'continue' };

type Button = {
  x: number;
  y: number;
  w: number;
  h: number;
  action: XRHudAction;
  label: string;
  enabled: boolean;
  emphasis?: 'primary' | 'normal';
};

export type XRHudHandle = {
  group: THREE.Group;
  update: (snapshot: XRHudSnapshot) => void;
  /** Returns the action under the ray, or null if it misses every button. */
  hitTest: (raycaster: THREE.Raycaster) => XRHudAction | null;
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
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 4,
) {
  const words = text.split(/\s+/);
  let line = '';
  let lines = 0;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = word;
      y += lineHeight;
      lines += 1;
      if (lines >= maxLines - 1) break;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, y);
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
  // Float the panel in front of the player at a comfortable reading height,
  // tilted slightly up toward the face. Parented to the rig by the caller, so
  // it follows teleport/turn but is not head-locked (you can look away from it).
  mesh.position.set(0, 1.05, -1.35);
  mesh.rotation.x = -0.28;
  group.add(mesh);

  let buttons: Button[] = [];
  const raycastTargets: THREE.Object3D[] = [mesh];

  function drawButton(btn: Button) {
    const radius = 16;
    ctx.save();
    ctx.globalAlpha = btn.enabled ? 1 : 0.4;
    roundRect(ctx, btn.x, btn.y, btn.w, btn.h, radius);
    if (btn.emphasis === 'primary') {
      ctx.fillStyle = btn.enabled ? '#22d3ee' : '#155e6b';
    } else {
      ctx.fillStyle = 'rgba(30, 41, 59, 0.92)';
    }
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(103, 232, 249, 0.7)';
    ctx.stroke();
    ctx.fillStyle = btn.emphasis === 'primary' ? '#06121a' : '#e2f6ff';
    ctx.font = '600 30px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2);
    ctx.restore();
  }

  function update(snapshot: XRHudSnapshot) {
    buttons = [];
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // Backdrop.
    ctx.save();
    roundRect(ctx, 8, 8, CANVAS_W - 16, CANVAS_H - 16, 28);
    ctx.fillStyle = 'rgba(8, 14, 24, 0.82)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(103, 232, 249, 0.45)';
    ctx.stroke();
    ctx.restore();

    // Objective.
    ctx.fillStyle = '#67e8f9';
    ctx.font = '700 26px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(snapshot.selectedLabel ? snapshot.selectedLabel.toUpperCase() : 'OBJECTIVE', 48, 44);

    ctx.fillStyle = '#e8f6ff';
    ctx.font = '400 30px system-ui, sans-serif';
    wrapText(ctx, snapshot.objective || '', 48, 88, CANVAS_W - 96, 40, 4);

    // Status / caption line.
    if (snapshot.status) {
      ctx.fillStyle = '#9fd9e8';
      ctx.font = '400 26px system-ui, sans-serif';
      wrapText(ctx, snapshot.status, 48, 250, CANVAS_W - 96, 34, 2);
    }

    // Verdict feedback.
    if (snapshot.verdict) {
      ctx.fillStyle = '#fde68a';
      ctx.font = '600 28px system-ui, sans-serif';
      wrapText(ctx, snapshot.verdict, 48, 330, CANVAS_W - 96, 36, 2);
    }

    if (snapshot.stageComplete) {
      buttons.push({
        x: CANVAS_W / 2 - 200,
        y: 600,
        w: 400,
        h: 96,
        action: { kind: 'continue' },
        label: 'CONTINUE',
        enabled: true,
        emphasis: 'primary',
      });
    } else {
      // Verb row (only when a hotspot is selected).
      if (snapshot.selectedLabel && snapshot.verbs.length) {
        const gap = 20;
        const total = CANVAS_W - 96;
        const w = (total - gap * (snapshot.verbs.length - 1)) / snapshot.verbs.length;
        snapshot.verbs.forEach((verb, i) => {
          buttons.push({
            x: 48 + i * (w + gap),
            y: 430,
            w,
            h: 96,
            action: { kind: 'verb', verb: verb.id },
            label: verb.label,
            enabled: verb.enabled,
          });
        });
      }

      // Mic / prompt row — only while a command or conversation turn is live.
      if (snapshot.promptActive && snapshot.micRow !== 'none') {
        if (snapshot.micRow === 'connect') {
          buttons.push({
            x: 48,
            y: 560,
            w: CANVAS_W - 96,
            h: 110,
            action: { kind: 'connectMic' },
            label: 'CONNECT MIC',
            enabled: true,
            emphasis: 'primary',
          });
        } else {
          const primary: Button =
            snapshot.micRow === 'record'
              ? {
                  x: 48,
                  y: 560,
                  w: 760,
                  h: 110,
                  action: { kind: 'record' },
                  label: snapshot.recording ? 'RECORDING… RELEASE' : 'HOLD TO SPEAK',
                  enabled: true,
                  emphasis: 'primary',
                }
              : {
                  x: 48,
                  y: 560,
                  w: 760,
                  h: 110,
                  action: { kind: 'confirm' },
                  label: 'CONFIRM PHRASE',
                  enabled: true,
                  emphasis: 'primary',
                };
          buttons.push(primary);
          buttons.push({
            x: 832,
            y: 560,
            w: 144,
            h: 110,
            action: { kind: 'skip' },
            label: 'SKIP',
            enabled: true,
          });
        }
      }
    }

    for (const btn of buttons) drawButton(btn);
    texture.needsUpdate = true;
  }

  function hitTest(raycaster: THREE.Raycaster): XRHudAction | null {
    const hit = raycaster.intersectObjects(raycastTargets, false)[0];
    if (!hit?.uv) return null;
    // uv origin is bottom-left; canvas y grows downward.
    const px = hit.uv.x * CANVAS_W;
    const py = (1 - hit.uv.y) * CANVAS_H;
    for (const btn of buttons) {
      if (
        btn.enabled &&
        px >= btn.x &&
        px <= btn.x + btn.w &&
        py >= btn.y &&
        py <= btn.y + btn.h
      ) {
        return btn.action;
      }
    }
    return null;
  }

  function dispose() {
    mesh.geometry.dispose();
    material.dispose();
    texture.dispose();
  }

  // Seed an empty frame so the panel isn't blank before the first update.
  update({
    objective: '',
    status: '',
    selectedLabel: null,
    verbs: [],
    promptActive: false,
    micRow: 'none',
    recording: false,
    verdict: null,
    stageComplete: false,
  });

  return { group, update, hitTest, dispose };
}
