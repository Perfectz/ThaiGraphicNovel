import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
import type { ColliderBounds } from './collision';

/**
 * WebXR controller + locomotion layer for the Stage 3D adventure.
 *
 * Responsibilities:
 *  - Build the two XR controllers and their grip models, parented to the
 *    player rig so they move with the dolly.
 *  - Draw a pointer ray from each controller and, on trigger (`selectstart`),
 *    raycast from the controller into the world via the shared `onPick`
 *    callback — the SAME pick core the flat-screen pointer uses (walk Patrick /
 *    select a hotspot). The third-person model is preserved in VR.
 *  - Comfort locomotion driven by the thumbsticks:
 *      • horizontal push  → snap-turn the rig ±30° about the head
 *      • forward push     → teleport the rig along the pointed-at floor point,
 *                           clamped to the room bounds
 *
 * Everything here is inert until an XR session is presenting; `update()` early-
 * returns otherwise, and the controllers simply sit idle in the scene graph.
 */

const SNAP_TURN_RADIANS = THREE.MathUtils.degToRad(30);
const STICK_ENGAGE = 0.7; // push past this to trigger snap / teleport
const STICK_RELEASE = 0.3; // fall back under this to re-arm (debounce)
const RAY_LENGTH = 8;

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
  update: () => void;
  dispose: () => void;
};

type XRControlsOptions = {
  renderer: THREE.WebGLRenderer;
  /** The camera dolly. Controllers parent here; teleport/turn move this. */
  playerRig: THREE.Group;
  /** The headset camera (child of the rig) — used to find head world position. */
  camera: THREE.PerspectiveCamera;
  /** Invisible floor plane to raycast teleport/world picks against. */
  floor: THREE.Object3D;
  /** Shared world-pick core (hotspot/floor → select + walk Patrick). */
  onPick: (raycaster: THREE.Raycaster) => void;
  /**
   * Give the in-world HUD first refusal on a trigger press. Return true if the
   * ray hit a HUD button (press consumed — world pick is skipped). The matching
   * release is reported via `onUiSelectEnd` (used for hold-to-record).
   */
  onUiSelectStart?: (raycaster: THREE.Raycaster) => boolean;
  /** Trigger released after a HUD press was consumed on the same controller. */
  onUiSelectEnd?: () => void;
  /** XZ clamp so the player can't teleport through walls / out of the room. */
  roomBounds: ColliderBounds;
};

function makeRayLine(): THREE.Line {
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -RAY_LENGTH),
  ]);
  const material = new THREE.LineBasicMaterial({
    color: 0x67e8f9,
    transparent: true,
    opacity: 0.75,
  });
  const line = new THREE.Line(geometry, material);
  line.name = 'xr-pointer-ray';
  line.scale.z = 1;
  return line;
}

export function createXRControls({
  renderer,
  playerRig,
  camera,
  floor,
  onPick,
  onUiSelectStart,
  onUiSelectEnd,
  roomBounds,
}: XRControlsOptions): XRControlsHandle {
  const controllerModelFactory = new XRControllerModelFactory();
  const controllers: THREE.Group[] = [];
  const grips: THREE.Group[] = [];
  const inputSources: Array<XRInputSource | null> = [null, null];
  // Per-controller debounce latches so a single stick push fires once.
  const snapArmed = [true, true];
  const teleportArmed = [true, true];
  // Per-controller flag: did this trigger press land on a HUD button? If so the
  // matching release routes to onUiSelectEnd (hold-to-record) instead of world.
  const uiActive = [false, false];

  const tempMatrix = new THREE.Matrix4();
  const raycaster = new THREE.Raycaster();
  const headWorld = new THREE.Vector3();
  const pivotWorld = new THREE.Vector3();

  const aimRayFromController = (controller: THREE.Group) => {
    tempMatrix.identity().extractRotation(controller.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
  };

  const onSelectStart = (event: XRControllerEvent) => {
    const controller = event.target;
    const index = (controller.userData.controllerIndex as number) ?? 0;
    aimRayFromController(controller);
    // HUD gets first refusal: a press on a panel button never also walks Patrick.
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
    });
    controller.addEventListener('disconnected', () => {
      inputSources[i] = null;
    });
    playerRig.add(controller);
    controllers.push(controller);

    const grip = renderer.xr.getControllerGrip(i);
    grip.add(controllerModelFactory.createControllerModel(grip));
    playerRig.add(grip);
    grips.push(grip);
  }

  function clampToRoom() {
    playerRig.position.x = THREE.MathUtils.clamp(
      playerRig.position.x,
      roomBounds.minX,
      roomBounds.maxX,
    );
    playerRig.position.z = THREE.MathUtils.clamp(
      playerRig.position.z,
      roomBounds.minZ,
      roomBounds.maxZ,
    );
  }

  function snapTurn(direction: number) {
    // Rotate the rig about the head's world position so the view pivots around
    // the player, not around the (possibly distant) rig origin.
    camera.getWorldPosition(pivotWorld);
    const angle = -direction * SNAP_TURN_RADIANS;
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    const dx = playerRig.position.x - pivotWorld.x;
    const dz = playerRig.position.z - pivotWorld.z;
    playerRig.position.x = pivotWorld.x + dx * cos - dz * sin;
    playerRig.position.z = pivotWorld.z + dx * sin + dz * cos;
    playerRig.rotation.y += angle;
  }

  function teleport(controller: THREE.Group) {
    tempMatrix.identity().extractRotation(controller.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
    const hit = raycaster.intersectObject(floor)[0];
    if (!hit) return;
    // Move the rig so the player's head ends up over the targeted floor point
    // (XZ only — height stays on the floor reference space).
    camera.getWorldPosition(headWorld);
    playerRig.position.x += hit.point.x - headWorld.x;
    playerRig.position.z += hit.point.z - headWorld.z;
    clampToRoom();
  }

  function update() {
    if (!renderer.xr.isPresenting) return;
    for (let i = 0; i < controllers.length; i += 1) {
      const gamepad = inputSources[i]?.gamepad;
      if (!gamepad) continue;
      const axes = gamepad.axes ?? [];
      // Quest-style sticks live on axes[2]/axes[3]; fall back to [0]/[1].
      const x = axes.length >= 4 ? axes[2] : axes[0] ?? 0;
      const y = axes.length >= 4 ? axes[3] : axes[1] ?? 0;

      if (Math.abs(x) > STICK_ENGAGE && snapArmed[i]) {
        snapTurn(Math.sign(x));
        snapArmed[i] = false;
      } else if (Math.abs(x) < STICK_RELEASE) {
        snapArmed[i] = true;
      }

      if (y < -STICK_ENGAGE && teleportArmed[i]) {
        teleport(controllers[i]);
        teleportArmed[i] = false;
      } else if (y > -STICK_RELEASE) {
        teleportArmed[i] = true;
      }
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

  return { controllers, grips, update, dispose };
}
