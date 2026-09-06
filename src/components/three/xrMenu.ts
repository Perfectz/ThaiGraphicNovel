import * as THREE from 'three';
import {
  type XRComfortSettings,
  TURN_LABEL,
  VIGNETTE_LABEL,
  HAND_LABEL,
} from './xrComfort';

/**
 * In-session VR menu panel.
 *
 * The flat-screen menus (title, Settings modal) are React DOM and invisible
 * inside an immersive session, and the title screen has no renderer to enter VR
 * from in the first place. This panel is the in-VR equivalent: a canvas-backed
 * surface the player summons with the controller (the HUD's menu button or the
 * B/Y face button) to change the handful of settings that matter mid-stage and
 * to leave the stage — without taking the headset off.
 *
 * Same interaction contract as the HUD: ray hit-test on press, ray hover for
 * focus feedback. Visibility is toggled by the caller via `setOpen`.
 */

const CANVAS_W = 860;
const CANVAS_H = 1040;
const PANEL_WIDTH_M = 1.05;
const PANEL_HEIGHT_M = (PANEL_WIDTH_M * CANVAS_H) / CANVAS_W;

const COLOR = {
  cyan: '#67E8F9',
  cyanBright: '#A5F3FF',
  cyanDeep: '#22D3EE',
  paper: '#F4F1EB',
  muted: 'rgba(244, 241, 235, 0.62)',
  faint: 'rgba(244, 241, 235, 0.16)',
  red: '#F87171',
  ink: '#06121A',
} as const;

export type XRMenuSnapshot = {
  musicEnabled: boolean;
  voiceMode: 'whisper' | 'realtime' | 'no-mic';
  tutorLevel: 'easy' | 'medium' | 'hard';
  /** Live VR comfort settings, shown as their own section. */
  comfort: XRComfortSettings;
};

export type XRMenuAction =
  | { kind: 'resume' }
  | { kind: 'toggleMusic' }
  | { kind: 'cycleVoice' }
  | { kind: 'cycleTutor' }
  | { kind: 'cycleTurn' }
  | { kind: 'cycleVignette' }
  | { kind: 'toggleHandedness' }
  | { kind: 'returnToTitle' };

type RowTone = 'primary' | 'normal' | 'danger';

type Row = {
  x: number;
  y: number;
  w: number;
  h: number;
  action: XRMenuAction;
  key: string;
  label: string;
  /** Right-aligned current value (settings rows), or null for plain buttons. */
  value: string | null;
  tone: RowTone;
  /** Section header to draw ABOVE this row (first row of a group), or null. */
  section?: string;
};

export type XRMenuHandle = {
  group: THREE.Group;
  update: (snapshot: XRMenuSnapshot) => void;
  setOpen: (open: boolean) => void;
  isOpen: () => boolean;
  hitTest: (raycaster: THREE.Raycaster) => XRMenuAction | null;
  peekHover: (raycaster: THREE.Raycaster) => boolean;
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

const VOICE_LABEL: Record<XRMenuSnapshot['voiceMode'], string> = {
  whisper: 'Whisper',
  realtime: 'Realtime',
  'no-mic': 'No mic',
};

const TUTOR_LABEL: Record<XRMenuSnapshot['tutorLevel'], string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

function buildRows(snapshot: XRMenuSnapshot): Row[] {
  const left = 56;
  const w = CANVAS_W - left * 2;
  const h = 70;
  const gap = 14;
  const sectionGap = 46; // extra space above a section header
  let y = 150;
  const settingRow = (
    key: string,
    label: string,
    value: string,
    action: XRMenuAction,
    section?: string,
  ): Row => {
    if (section) y += sectionGap;
    const row: Row = { x: left, y, w, h, action, key, label, value, tone: 'normal', section };
    y += h + gap;
    return row;
  };

  const rows: Row[] = [
    settingRow('toggleMusic', 'Music', snapshot.musicEnabled ? 'On' : 'Off', { kind: 'toggleMusic' }, 'GAMEPLAY'),
    settingRow('cycleVoice', 'Voice mode', VOICE_LABEL[snapshot.voiceMode], { kind: 'cycleVoice' }),
    settingRow('cycleTutor', 'Tutor level', TUTOR_LABEL[snapshot.tutorLevel], { kind: 'cycleTutor' }),
    // --- Comfort section: the settings that keep players from getting sick. ---
    settingRow('cycleTurn', 'Turning', TURN_LABEL[snapshot.comfort.turn], { kind: 'cycleTurn' }, 'COMFORT'),
    settingRow('cycleVignette', 'Vignette', VIGNETTE_LABEL[snapshot.comfort.vignette], { kind: 'cycleVignette' }),
    settingRow('toggleHandedness', 'Turn hand', HAND_LABEL[snapshot.comfort.handedness], { kind: 'toggleHandedness' }),
  ];

  // Resume (primary) sits above the destructive Return to title, separated from
  // the settings list by the gap.
  y += sectionGap;
  rows.push({ x: left, y, w, h: 86, action: { kind: 'resume' }, key: 'resume', label: 'Resume', value: null, tone: 'primary' });
  y += 86 + gap;
  rows.push({
    x: left,
    y,
    w,
    h: 70,
    action: { kind: 'returnToTitle' },
    key: 'returnToTitle',
    label: 'Return to title',
    value: null,
    tone: 'danger',
  });

  return rows;
}

function drawRow(ctx: CanvasRenderingContext2D, row: Row, hovered: boolean) {
  ctx.save();
  if (row.tone === 'primary' || row.tone === 'danger') {
    ctx.shadowColor = row.tone === 'danger' ? 'rgba(248,113,113,0.5)' : 'rgba(103,232,249,0.5)';
    ctx.shadowBlur = hovered ? 30 : 16;
    ctx.shadowOffsetY = 5;
  } else if (hovered) {
    ctx.shadowColor = 'rgba(103,232,249,0.4)';
    ctx.shadowBlur = 20;
  }
  roundRect(ctx, row.x, row.y, row.w, row.h, 18);

  if (row.tone === 'primary') {
    const g = ctx.createLinearGradient(0, row.y, 0, row.y + row.h);
    g.addColorStop(0, hovered ? COLOR.cyanBright : COLOR.cyan);
    g.addColorStop(1, hovered ? COLOR.cyan : COLOR.cyanDeep);
    ctx.fillStyle = g;
  } else if (row.tone === 'danger') {
    ctx.fillStyle = hovered ? 'rgba(248,113,113,0.22)' : 'rgba(248,113,113,0.12)';
  } else {
    ctx.fillStyle = hovered ? 'rgba(103,232,249,0.16)' : 'rgba(244,241,235,0.05)';
  }
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.lineWidth = hovered ? 3 : 2;
  if (row.tone === 'danger') {
    ctx.strokeStyle = hovered ? COLOR.red : 'rgba(248,113,113,0.55)';
  } else if (row.tone === 'primary') {
    ctx.strokeStyle = hovered ? COLOR.cyanBright : 'rgba(6,18,26,0.35)';
  } else {
    ctx.strokeStyle = hovered ? COLOR.cyan : COLOR.faint;
  }
  ctx.stroke();

  const midY = row.y + row.h / 2;
  ctx.textBaseline = 'middle';
  if (row.tone === 'primary') {
    // Centered label for the big primary action.
    ctx.fillStyle = COLOR.ink;
    ctx.font = '600 32px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(row.label, row.x + row.w / 2, midY);
  } else if (row.tone === 'danger') {
    ctx.fillStyle = hovered ? COLOR.cyanBright : COLOR.red;
    ctx.font = '600 28px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(row.label, row.x + row.w / 2, midY);
  } else {
    // Setting row: label left, value chip right.
    ctx.fillStyle = hovered ? COLOR.cyanBright : COLOR.paper;
    ctx.font = '500 28px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(row.label, row.x + 28, midY);
    if (row.value) {
      ctx.font = '700 26px system-ui, sans-serif';
      const valueW = ctx.measureText(row.value).width;
      const chipW = valueW + 36;
      const chipX = row.x + row.w - chipW - 20;
      roundRect(ctx, chipX, midY - 24, chipW, 48, 24);
      ctx.fillStyle = hovered ? 'rgba(103,232,249,0.22)' : 'rgba(103,232,249,0.12)';
      ctx.fill();
      ctx.fillStyle = COLOR.cyan;
      ctx.textAlign = 'center';
      ctx.fillText(row.value, chipX + chipW / 2, midY + 1);
    }
  }
  ctx.restore();
}

/** Pure painter — exported so the panel can be verified outside a session. */
export function renderXRMenu(
  ctx: CanvasRenderingContext2D,
  snapshot: XRMenuSnapshot,
  hoverKey: string | null = null,
): Row[] {
  const left = 56;
  const right = CANVAS_W - 56;
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // Panel.
  ctx.save();
  ctx.shadowColor = 'rgba(103,232,249,0.24)';
  ctx.shadowBlur = 38;
  roundRect(ctx, 20, 20, CANVAS_W - 40, CANVAS_H - 40, 32);
  const slab = ctx.createLinearGradient(0, 20, 0, CANVAS_H - 20);
  slab.addColorStop(0, 'rgba(16,20,27,0.96)');
  slab.addColorStop(1, 'rgba(7,10,15,0.96)');
  ctx.fillStyle = slab;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(103,232,249,0.5)';
  ctx.stroke();
  ctx.restore();

  // Header.
  ctx.save();
  ctx.beginPath();
  ctx.arc(left + 7, 70, 7, 0, Math.PI * 2);
  ctx.fillStyle = COLOR.cyan;
  ctx.shadowColor = 'rgba(103,232,249,0.8)';
  ctx.shadowBlur = 14;
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = COLOR.cyan;
  ctx.font = '700 26px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  if ('letterSpacing' in ctx) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '4px';
  }
  ctx.fillText('MENU', left + 28, 71);
  if ('letterSpacing' in ctx) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '0px';
  }
  ctx.strokeStyle = 'rgba(103,232,249,0.22)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(left, 108);
  ctx.lineTo(right, 108);
  ctx.stroke();

  const rows = buildRows(snapshot);
  for (const row of rows) {
    if (row.section) {
      // Section eyebrow drawn just above the first row of the group.
      ctx.save();
      ctx.fillStyle = 'rgba(103,232,249,0.7)';
      ctx.font = '700 19px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      if ('letterSpacing' in ctx) {
        (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '3px';
      }
      ctx.fillText(row.section, left, row.y - 14);
      if ('letterSpacing' in ctx) {
        (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '0px';
      }
      ctx.restore();
    }
    drawRow(ctx, row, row.key === hoverKey);
  }
  return rows;
}

export function createXRMenu(): XRMenuHandle {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;

  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(PANEL_WIDTH_M, PANEL_HEIGHT_M), material);
  mesh.name = 'xr-menu-panel';
  // Modal-style: centered and close, slightly above the HUD's dock so it reads
  // as "in front of everything" when summoned. renderOrder lifts it over the HUD.
  mesh.position.set(0, 1.4, -1.2);
  mesh.rotation.x = -0.16;
  mesh.renderOrder = 10;

  const group = new THREE.Group();
  group.name = 'xr-menu';
  group.add(mesh);
  group.visible = false;

  const raycastTargets: THREE.Object3D[] = [mesh];
  let snapshot: XRMenuSnapshot = {
    musicEnabled: true,
    voiceMode: 'whisper',
    tutorLevel: 'medium',
    comfort: { turn: 'snap-30', vignette: 'strong', handedness: 'right' },
  };
  let rows: Row[] = [];
  let hoverKey: string | null = null;

  function paint() {
    rows = renderXRMenu(ctx, snapshot, hoverKey);
    texture.needsUpdate = true;
  }

  function update(next: XRMenuSnapshot) {
    snapshot = next;
    paint();
  }

  function hoverKeyFromRay(raycaster: THREE.Raycaster): string | null {
    const hit = raycaster.intersectObjects(raycastTargets, false)[0];
    if (!hit?.uv) return null;
    const px = hit.uv.x * CANVAS_W;
    const py = (1 - hit.uv.y) * CANVAS_H;
    for (const row of rows) {
      if (px >= row.x && px <= row.x + row.w && py >= row.y && py <= row.y + row.h) {
        return row.key;
      }
    }
    return null;
  }

  function hitTest(raycaster: THREE.Raycaster): XRMenuAction | null {
    const key = hoverKeyFromRay(raycaster);
    if (!key) return null;
    const row = rows.find((entry) => entry.key === key);
    return row ? row.action : null;
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

  function setOpen(open: boolean) {
    group.visible = open;
    if (!open && hoverKey !== null) {
      hoverKey = null;
      paint();
    }
  }

  function dispose() {
    mesh.geometry.dispose();
    material.dispose();
    texture.dispose();
  }

  paint();

  return {
    group,
    update,
    setOpen,
    isOpen: () => group.visible,
    hitTest,
    peekHover,
    setHover,
    dispose,
  };
}
