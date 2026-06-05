import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { AdventureRoom3D, SceneAmbiance } from '../data/adventures/types';
import { collectColliders } from './three/collision';
import { disposeObjectTree } from './three/sceneHelpers';
import { createHotspotObject } from './Stage3DAdventure.hotspots';
import type { SceneRefs } from './Stage3DAdventure.types';

const NPC_COLLIDER_RECOLLECT_DELAYS_MS = [400, 1000, 2000, 3500] as const;
const textureLoader = new THREE.TextureLoader();
const modelLoader = new GLTFLoader();

export type RebuildAdventureRoomOptions = {
  refs: SceneRefs;
  room: AdventureRoom3D;
  defaultAmbiance: SceneAmbiance;
  isCurrent?: (roomId: string) => boolean;
};

export type RebuiltAdventureRoom = {
  dispose: () => void;
};

function resetRoomSceneRefs(refs: SceneRefs) {
  disposeObjectTree(refs.roomGroup);
  refs.roomGroup.clear();
  disposeObjectTree(refs.hotspotGroup);
  refs.hotspotGroup.clear();
  refs.npcMixers.length = 0;
  refs.npcFacingTargets.length = 0;
  refs.npcControllers.clear();
  refs.objectsByHotspot.clear();
}

function applyRoomAmbiance(refs: SceneRefs, room: AdventureRoom3D, defaultAmbiance: SceneAmbiance) {
  const fog = refs.scene.fog;
  const override = room.ambianceOverride;

  if (override) {
    if (typeof override.background === 'number') refs.scene.background = new THREE.Color(override.background);
    if (fog instanceof THREE.Fog) {
      if (typeof override.fogColor === 'number') fog.color = new THREE.Color(override.fogColor);
      if (typeof override.fogNear === 'number') fog.near = override.fogNear;
      if (typeof override.fogFar === 'number') fog.far = override.fogFar;
    }
    return;
  }

  refs.scene.background = new THREE.Color(defaultAmbiance.background);
  if (fog instanceof THREE.Fog) {
    fog.color = new THREE.Color(defaultAmbiance.fogColor);
    fog.near = defaultAmbiance.fogNear;
    fog.far = defaultAmbiance.fogFar;
  }
}

function buildRoomHotspots(refs: SceneRefs, room: AdventureRoom3D, onModelSettled: () => void) {
  room.hotspots.forEach((hotspot) => {
    const object = createHotspotObject(
      textureLoader,
      modelLoader,
      hotspot,
      refs.npcMixers,
      refs.npcFacingTargets,
      refs.npcControllers,
      { onModelSettled },
    );
    refs.objectsByHotspot.set(hotspot.id, object);
    refs.hotspotGroup.add(object);
  });
}

function createRoomColliderRecollector(refs: SceneRefs, roomId: string, isCurrent: (roomId: string) => boolean) {
  let frameId = 0;
  let disposed = false;

  const recollect = () => {
    if (disposed || !isCurrent(roomId)) return;
    refs.colliders = collectColliders([refs.roomGroup, refs.hotspotGroup]);
  };

  const requestRecollect = () => {
    if (disposed || !isCurrent(roomId)) return;
    if (frameId) return;
    frameId = window.requestAnimationFrame(() => {
      frameId = 0;
      recollect();
    });
  };

  const clearPendingFrame = () => {
    if (!frameId) return;
    window.cancelAnimationFrame(frameId);
    frameId = 0;
  };

  const dispose = () => {
    disposed = true;
    clearPendingFrame();
  };

  return { recollect, requestRecollect, dispose };
}

function scheduleColliderRecollectionBackstops(requestRecollect: () => void) {
  const timers = NPC_COLLIDER_RECOLLECT_DELAYS_MS.map((ms) => window.setTimeout(requestRecollect, ms));
  return () => {
    timers.forEach((id) => window.clearTimeout(id));
  };
}

export function rebuildAdventureRoom({
  refs,
  room,
  defaultAmbiance,
  isCurrent = () => true,
}: RebuildAdventureRoomOptions): RebuiltAdventureRoom {
  resetRoomSceneRefs(refs);
  room.build(refs.roomGroup, room.palette);
  const colliderRecollector = createRoomColliderRecollector(refs, room.id, isCurrent);
  buildRoomHotspots(refs, room, colliderRecollector.requestRecollect);
  colliderRecollector.recollect();
  const clearColliderRecollectTimers = scheduleColliderRecollectionBackstops(colliderRecollector.requestRecollect);
  applyRoomAmbiance(refs, room, defaultAmbiance);

  return {
    dispose: () => {
      clearColliderRecollectTimers();
      colliderRecollector.dispose();
    },
  };
}
