import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
import {
  resolveCircleCollision,
  PLAYER_COLLISION_RADIUS,
  type ColliderRect,
  type ColliderBounds,
} from './collision';

/**
 * WebXR controller + FIRST-PERSON locomotion layer for the Stage 3D adventure.
 *
 * In VR the player *is* Patrick — the headset sits at his head. Movement is
 * smooth, FPS-style:
 *  - left thumbstick  → glide through the room in the direction you're facing
 *                       (forward/back + strafe), collision-resolved so you can't
 *                       walk through walls or NPCs
 *  - right thumbstick → smooth continuous turn (yaw) about your head
 *
 * Each frame we sync the game's `playerRoot` (Patrick) to the head's world XZ,
 * so all existing proximity / conversation / NPC-facing logic keeps working —
 * walk up to Su and she turns to you. The visible Patrick avatar is hidden by
 * the caller while presenting (you're inside him).
 *
 * The trigger still raycasts: the in-world HUD gets first refusal (`onUiSelect*`)
 * and otherwise a world pick (`onPick`) selects the hotspot you point at.
 *
 * Everything is inert until a session presents; `update()` early-returns.
 */

const MOVE_SPEED = 2.4; // metres / second at full stick
const TURN_SPEED = 2.2; // radians / second at full stick (~125°/s)
const DEADZONE = 0.15;
const RAY_LENGTH = 8;
const WAKE_DROP = 1.1; // metres the view starts below standing height
const WAKE_MS = 2400; // duration of the "getting up off the floor" rise

/**
 * three's typed `Object3DEventMap` doesn't include the WebXR controller events
 * ('selectstart', 'connected', …), so we address the controller through this
 * loosened alias for add/removeEventListener without sprinkling `as never`.
 */
type XRControllerEvent = { target: THREE.Group; data?: XRInputSource };
type XRController = THREE.Group & {
  addEventListener(type: string, listener: (event: XRControllerEvent) => void): void;
  removeEventListener(type: string, listener: (event: XRControllerEvent) => void): void;
};

export type XRControlsHandle = {
  controllers: THREE.Group[];
  grips: THREE.Group[];
  /** Call once per frame from the animate loop. No-op while not presenting. */
  update: (delta: number) => void;
  /** Kick off the one-shot "wake up off the floor" rise (call on session start). */
  startWakeUp: () => void;
  dispose: () => void;
};

type XRControlsOptions = {
  renderer: THREE.WebGLRenderer;
  /** The camera dolly. Controllers parent here; locomotion moves this. */
  playerRig: THREE.Group;
  /** The headset camera (child of the rig). Its world pose is the player head. */
  camera: THREE.PerspectiveCamera;
  /** Patrick's transform — synced to the head each frame so game logic tracks you. */
  playerRoot: THREE.Group;
  /** Shared world-pick core (hotspot/floor → select). */
  onPick: (raycaster: THREE.Raycaster) => void;
  /**
   * Give the in-world HUD first refusal on a trigger press. Return true if the
   * ray hit a HUD button (press consumed — world pick is skipped). The matching
   * release is reported via `onUiSelectEnd` (used for hold-to-record).
   */
  onUiSelectStart?: (raycaster: THREE.Raycaster) => boolean;
  /** Trigger released after a HUD press was consumed on the same controller. */
  onUiSelectEnd?: () => void;
  /**
   * Non-mutating test: is this ray currently over a pressable HUD button?
   * Used per-frame to decide which controller (if any) owns HUD focus.
   */
  onUiPeekHover?: (raycaster: THREE.Raycaster) => boolean;
  /**
   * Apply HUD hover focus for the owning controller's ray each frame, or clear
   * it with null when no ray is over the panel. The HUD repaints only on change.
   */
  onUiApplyHover?: (raycaster: THREE.Raycaster | null) => void;
  /** Fired on a rising edge of a face button (A/X or B/Y) — toggles the menu. */
  onMenuToggle?: () => void;
  /** When this returns true, locomotion is frozen (menu open) for comfort. */
  isMenuOpen?: () => boolean;
  /** Live colliders for the current room (rebuilt per room — read each frame). */
  getColliders: () => ColliderRect[];
  /** XZ clamp so the player can't walk out of the room. */
  roomBounds: ColliderBounds;
};

// Pointer-ray colours: a calm cyan at rest, a bright cyan when the ray is over
// a pressable HUD button so the player gets a clear "you can press this" cue.
const RAY_REST = new THREE.Color(0x67e8f9);
const RAY_HOT = new THREE.Color(0xa5f3ff);

function makeRayLine(): THREE.Line {
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -RAY_LENGTH),
  ]);
  const material = new THREE.LineBasicMaterial({
    color: RAY_REST.getHex(),
    transparent: true,
    opacity: 0.55,
  });
  const line = new THREE.Line(geometry, material);
  line.name = 'xr-pointer-ray';
  return line;
}

function setRayActive(controller: THREE.Group, active: boolean) {
  const line = controller.getObjectByName('xr-pointer-ray') as THREE.Line | undefined;
  const material = line?.material as THREE.LineBasicMaterial | undefined;
  if (!material) return;
  material.color.copy(active ? RAY_HOT : RAY_REST);
  material.opacity = active ? 0.95 : 0.55;
}

export function createXRControls({
  renderer,
  playerRig,
  camera,
  playerRoot,
  onPick,
  onUiSelectStart,
  onUiSelectEnd,
  onUiPeekHover,
  onUiApplyHover,
  onMenuToggle,
  isMenuOpen,
  getColliders,
  roomBounds,
}: XRControlsOptions): XRControlsHandle {
  const controllerModelFactory = new XRControllerModelFactory();
  const controllers: THREE.Group[] = [];
  const grips: THREE.Group[] = [];
  const inputSources: Array<XRInputSource | null> = [null, null];
  const handedness: Array<XRHandedness | undefined> = [undefined, undefined];
  // Per-controller flag: did this trigger press land on a HUD button? If so the
  // matching release routes to onUiSelectEnd (hold-to-record) instead of world.
  const uiActive = [false, false];

  const tempMatrix = new THREE.Matrix4();
  const raycaster = new THREE.Raycaster();
  const headWorld = new THREE.Vector3();
  const pivotWorld = new THREE.Vector3();
  const headQuat = new THREE.Quaternion();
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const desired = new THREE.Vector3();

  let wakeStart = -1;

  const aimRayFromController = (controller: THREE.Group) => {
    tempMatrix.identity().extractRotation(controller.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
  };

  const onSelectStart = (event: XRControllerEvent) => {
    const controller = event.target;
    const index = (controller.userData.controllerIndex as number) ?? 0;
    aimRayFromController(controller);
    // HUD gets first refusal: a press on a panel button never also picks the world.
    if (onUiSelectStart && onUiSelectStart(raycaster)) {
      uiActive[index] = true;
      return;
    }
    onPick(raycaster);
  };

  const onSelectEnd = (event: XRControllerEvent) => {
    const index = (event.target.userData.controllerIndex as number) ?? 0;
    if (uiActive[index]) {
      uiActive[index] = false;
      onUiSelectEnd?.();
    }
  };

  for (let i = 0; i < 2; i += 1) {
    const controller = renderer.xr.getController(i) as XRController;
    controller.userData.controllerIndex = i;
    controller.add(makeRayLine());
    controller.addEventListener('selectstart', onSelectStart);
    controller.addEventListener('selectend', onSelectEnd);
    controller.addEventListener('connected', (event) => {
      inputSources[i] = event.data ?? null;
      handedness[i] = event.data?.handedness;
    });
    controller.addEventListener('disconnected', () => {
      inputSources[i] = null;
      handedness[i] = undefined;
    });
    playerRig.add(controller);
    controllers.push(controller);

    const grip = renderer.xr.getControllerGrip(i);
    grip.add(controllerModelFactory.createControllerModel(grip));
    playerRig.add(grip);
    grips.push(grip);
  }

  function startWakeUp() {
    wakeStart = performance.now();
    playerRig.position.y = -WAKE_DROP;
  }

  function applyWakeUp(now: number) {
    if (wakeStart < 0) return;
    const t = Math.min(1, (now - wakeStart) / WAKE_MS);
    const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic
    playerRig.position.y = -WAKE_DROP * (1 - ease);
    if (t >= 1) {
      playerRig.position.y = 0;
      wakeStart = -1;
    }
  }

  function readSticks() {
    let moveX = 0;
    let moveZ = 0;
    let turn = 0;
    for (let i = 0; i < controllers.length; i += 1) {
      const gamepad = inputSources[i]?.gamepad;
      if (!gamepad) continue;
      const axes = gamepad.axes ?? [];
      // Quest-style sticks live on axes[2]/axes[3]; fall back to [0]/[1].
      const sx = (axes.length >= 4 ? axes[2] : axes[0]) ?? 0;
      const sy = (axes.length >= 4 ? axes[3] : axes[1]) ?? 0;
      if (handedness[i] === 'right') {
        turn += sx;
      } else {
        // Left controller (or unknown handedness) drives movement.
        moveX += sx;
        moveZ += sy;
      }
    }
    return { moveX, moveZ, turn };
  }

  function moveBy(stickX: number, stickZ: number, delta: number) {
    // Forward/right derived from where the head is actually looking, flattened
    // to the floor plane so look-up/down doesn't change walking speed.
    camera.getWorldQuaternion(headQuat);
    forward.set(0, 0, -1).applyQuaternion(headQuat);
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
    forward.normalize();
    right.set(1, 0, 0).applyQuaternion(headQuat);
    right.y = 0;
    if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
    right.normalize();

    camera.getWorldPosition(headWorld);
    desired.set(headWorld.x, 0, headWorld.z);
    // stickZ is negative when pushed forward → move along +forward.
    desired.addScaledVector(forward, -stickZ * MOVE_SPEED * delta);
    desired.addScaledVector(right, stickX * MOVE_SPEED * delta);
    resolveCircleCollision(desired, PLAYER_COLLISION_RADIUS, getColliders(), roomBounds);
    // Shift the rig by the resolved horizontal delta (camera follows the rig).
    playerRig.position.x += desired.x - headWorld.x;
    playerRig.position.z += desired.z - headWorld.z;
  }

  function turnBy(stick: number, delta: number) {
    camera.getWorldPosition(pivotWorld);
    const angle = -stick * TURN_SPEED * delta;
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    const dx = playerRig.position.x - pivotWorld.x;
    const dz = playerRig.position.z - pivotWorld.z;
    playerRig.position.x = pivotWorld.x + dx * cos - dz * sin;
    playerRig.position.z = pivotWorld.z + dx * sin + dz * cos;
    playerRig.rotation.y += angle;
  }

  function update(delta: number) {
    if (!renderer.xr.isPresenting) return;
    applyWakeUp(performance.now());

    pollMenuButton();

    // Comfort: freeze locomotion while the menu is open so the world can't drift
    // out from under a panel the player is reading/pointing at.
    if (!isMenuOpen?.()) {
      const { moveX, moveZ, turn } = readSticks();
      if (Math.abs(moveX) > DEADZONE || Math.abs(moveZ) > DEADZONE) {
        moveBy(moveX, moveZ, delta);
      }
      if (Math.abs(turn) > DEADZONE) {
        turnBy(turn, delta);
      }
    }

    // Sync the game player (Patrick) to the head so proximity / conversation /
    // NPC-facing logic all track the real first-person position.
    camera.getWorldPosition(headWorld);
    playerRoot.position.x = headWorld.x;
    playerRoot.position.z = headWorld.z;

    updateHudHover();
  }

  // Rising-edge detection on the face buttons. On Quest-style mappings the A/X
  // button is index 4 and B/Y is index 5; we accept either so the menu opens
  // from whichever face button the player reaches for.
  let menuButtonWasDown = false;
  function pollMenuButton() {
    if (!onMenuToggle) return;
    let down = false;
    for (const source of inputSources) {
      const buttons = source?.gamepad?.buttons;
      if (!buttons) continue;
      if (buttons[4]?.pressed || buttons[5]?.pressed) down = true;
    }
    if (down && !menuButtonWasDown) onMenuToggle();
    menuButtonWasDown = down;
  }

  // Per-frame HUD focus: find the first controller whose ray is over a HUD
  // button, brighten that controller's pointer ray, and tell the HUD to focus
  // the targeted button. Resolved in two passes so that when only one of the
  // two controllers points at the panel, the non-pointing one can't clobber
  // the focus on the same frame.
  function updateHudHover() {
    if (!onUiApplyHover) return;
    let ownerIndex = -1;
    if (onUiPeekHover) {
      for (let i = 0; i < controllers.length; i += 1) {
        aimRayFromController(controllers[i]);
        if (onUiPeekHover(raycaster)) {
          ownerIndex = i;
          break;
        }
      }
    }
    for (let i = 0; i < controllers.length; i += 1) {
      setRayActive(controllers[i], i === ownerIndex);
    }
    if (ownerIndex >= 0) {
      aimRayFromController(controllers[ownerIndex]);
      onUiApplyHover(raycaster);
    } else {
      onUiApplyHover(null);
    }
  }

  function dispose() {
    for (const controller of controllers) {
      (controller as XRController).removeEventListener('selectstart', onSelectStart);
      (controller as XRController).removeEventListener('selectend', onSelectEnd);
      controller.clear();
      controller.removeFromParent();
    }
    for (const grip of grips) {
      grip.clear();
      grip.removeFromParent();
    }
  }

  return { controllers, grips, update, startWakeUp, dispose };
}
