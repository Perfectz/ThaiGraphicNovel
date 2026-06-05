import * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { AdventureRoom3D } from '../data/adventures/types';
import type { ColliderBounds } from './three/collision';

// Room floor in addRoomShell is 18x12 centered at origin; clamp the player to
// slightly inside that plane so they can't fall off in stages that omit walls.
export const ROOM_BOUNDS: ColliderBounds = { minX: -8.85, maxX: 8.85, minZ: -5.85, maxZ: 5.85 };

export type CinematicMove = {
  startTime: number;
  duration: number;
  startPos: THREE.Vector3;
  startTarget: THREE.Vector3;
  endPos: THREE.Vector3;
  endTarget: THREE.Vector3;
};

export function isPhonePortraitViewport(width: number, height: number) {
  return width < 640 && height > width;
}

export function isPhoneLandscapeViewport(width: number, height: number) {
  return height < 520 && width > height;
}

export function getRoomHotspotFocus(room: AdventureRoom3D, target = new THREE.Vector3()) {
  if (!room.hotspots.length) {
    return target.set(room.patrickStart[0], 1.45, room.patrickStart[2]);
  }

  const sum = room.hotspots.reduce(
    (acc, hotspot) => {
      acc.x += hotspot.position[0];
      acc.z += hotspot.position[2];
      return acc;
    },
    { x: 0, z: 0 },
  );
  return target.set(sum.x / room.hotspots.length, 1.45, sum.z / room.hotspots.length);
}

export function applyResponsiveCameraPreset(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  element: HTMLElement,
  room: AdventureRoom3D,
) {
  const width = element.clientWidth || window.innerWidth;
  const height = element.clientHeight || window.innerHeight;
  const focus = getRoomHotspotFocus(room);

  if (isPhonePortraitViewport(width, height)) {
    camera.fov = 58;
    camera.position.set(focus.x - 1.9, 3.05, focus.z + 11.2);
    controls.target.copy(focus);
    controls.minDistance = 5.2;
    controls.maxDistance = 18;
  } else if (isPhoneLandscapeViewport(width, height)) {
    const start = new THREE.Vector3(room.patrickStart[0], 1.4, room.patrickStart[2]);
    const midpoint = start.clone().lerp(focus, 0.55);
    camera.fov = 54;
    camera.position.set(midpoint.x - 2.2, 2.75, midpoint.z + 9.2);
    controls.target.copy(midpoint);
    controls.minDistance = 3.8;
    controls.maxDistance = 15;
  } else {
    camera.fov = 52;
    camera.position.set(-2.4, 2.7, 8.4);
    controls.target.set(1.6, 1.45, 0.2);
    controls.minDistance = 3.4;
    controls.maxDistance = 14;
  }

  camera.updateProjectionMatrix();
  controls.update();
}

export function createTwoShotCameraMove(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  a: THREE.Vector3,
  b: THREE.Vector3,
  durationMs = 1200,
): CinematicMove {
  const midpoint = a.clone().add(b).multiplyScalar(0.5);
  const lookAt = new THREE.Vector3(midpoint.x, 1.55, midpoint.z);

  const axis = new THREE.Vector3(b.x - a.x, 0, b.z - a.z);
  if (axis.lengthSq() < 1e-4) axis.set(1, 0, 0);
  axis.normalize();

  const perp = new THREE.Vector3(-axis.z, 0, axis.x);
  const toCamera = camera.position.clone().sub(midpoint);
  toCamera.y = 0;
  if (toCamera.dot(perp) < 0) perp.negate();

  const endPos = midpoint.clone().add(perp.multiplyScalar(3.6));
  endPos.y = 2.1;

  return {
    startTime: performance.now(),
    duration: durationMs,
    startPos: camera.position.clone(),
    startTarget: controls.target.clone(),
    endPos,
    endTarget: lookAt,
  };
}

export function getCameraAutoFollowTarget(
  room: AdventureRoom3D,
  playerPosition: THREE.Vector3,
  width: number,
  height: number,
  target = new THREE.Vector3(),
) {
  const hotspotFocus = getRoomHotspotFocus(room, target);
  const isPortraitPhone = isPhonePortraitViewport(width, height);
  const isLandscapePhone = isPhoneLandscapeViewport(width, height);
  if (isPortraitPhone) {
    target.copy(hotspotFocus).multiplyScalar(0.82).addScaledVector(playerPosition, 0.18);
  } else if (isLandscapePhone) {
    target.copy(hotspotFocus).multiplyScalar(0.55).addScaledVector(playerPosition, 0.45);
  } else {
    target.copy(playerPosition).multiplyScalar(0.25);
  }
  target.y = 1.45;
  return { target, isPortraitPhone, isLandscapePhone };
}
