import * as THREE from 'three';
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { AdventureHotspot3D } from '../data/adventures/types';
import { bellboyAnimationSources, bellboyModelAssetUrl } from './three/bellboyRig';
import { hotelLobbyGirlAnimationSources, hotelLobbyGirlModelAssetUrl } from './three/hotelLobbyGirlRig';
import { stage3CharacterAnimationSources, stage3CharacterModelAssetUrl } from './three/stage3CharacterRig';
import { suAnimationSources, suModelAssetUrl } from './three/suRig';
import type { NpcAnimationController } from './Stage3DAdventure.types';

/**
 * Helpers that own the per-rig knowledge (model URL, animation source list,
 * fallback animation, default height) for every NPC type a Stage3DAdventure
 * hotspot can reference. Adding a new rig (e.g. a stage-2 front desk clerk)
 * means: extend AdventureHotspot3D.model in data/adventures/types.ts, add a
 * branch to getRiggedNpcConfig below, and import its rig module here.
 */

export type AdventureModelId = NonNullable<AdventureHotspot3D['model']>['id'];

export function getRiggedNpcConfig(modelId: AdventureModelId) {
  if (modelId === 'su') {
    return {
      modelUrl: suModelAssetUrl,
      animationSources: suAnimationSources,
      fallbackAnimationId: 'idle',
      defaultHeight: 1.72,
    };
  }

  if (modelId === 'bellboy') {
    return {
      modelUrl: bellboyModelAssetUrl,
      animationSources: bellboyAnimationSources,
      // The bellboy rig ships with a "wave" pose preload but no static idle —
      // wave reads as friendly and on-brand for an Azure Vanguard hotelier.
      fallbackAnimationId: 'wave',
      defaultHeight: 1.78,
    };
  }

  if (modelId === 'hotelLobbyGirl') {
    return {
      modelUrl: hotelLobbyGirlModelAssetUrl,
      animationSources: hotelLobbyGirlAnimationSources,
      // The hostess rig's "idle" source is actually the base model GLB used as
      // a static pose; "wave" is a proper greeting animation and reads better
      // as the default when the player approaches the front desk.
      fallbackAnimationId: 'wave',
      defaultHeight: 1.66,
    };
  }

  return {
    modelUrl: stage3CharacterModelAssetUrl,
    animationSources: stage3CharacterAnimationSources,
    fallbackAnimationId: 'wave',
    defaultHeight: 1.72,
  };
}

export function getDefaultNpcAnimationId(hotspot: AdventureHotspot3D) {
  if (!hotspot.model) return 'idle';
  return hotspot.model.animation ?? getRiggedNpcConfig(hotspot.model.id).fallbackAnimationId;
}

/**
 * Load a hotspot's NPC GLTF, scale it to the configured height, attach it
 * under the hotspot group, and install an animation controller that the
 * Stage3DAdventure command flow can call to switch idle/talk/wave. Falls
 * back to the caller-supplied billboard or marker on any failure.
 */
export async function attachRiggedNpcModelToHotspot(
  group: THREE.Group,
  modelLoader: GLTFLoader,
  hotspot: AdventureHotspot3D,
  npcMixers: THREE.AnimationMixer[],
  npcFacingTargets: Array<{ object: THREE.Object3D; parent: THREE.Object3D }>,
  npcControllers: Map<string, NpcAnimationController>,
  onLoadFailure: () => void,
) {
  const modelConfig = hotspot.model;
  if (!modelConfig) return;
  const rig = getRiggedNpcConfig(modelConfig.id);

  try {
    const gltf = await modelLoader.loadAsync(rig.modelUrl);
    if (!group.parent) return;

    const model = gltf.scene;
    applyHotspotId(model, hotspot.id);
    model.traverse((object) => {
      object.userData.clickPriority = 20;
    });
    group.add(model);
    model.updateMatrixWorld(true);

    const unscaledBox = new THREE.Box3().setFromObject(model);
    const unscaledSize = unscaledBox.getSize(new THREE.Vector3());
    const height = modelConfig.height ?? rig.defaultHeight;
    model.scale.setScalar(unscaledSize.y > 0 ? height / unscaledSize.y : 1);
    model.updateMatrixWorld(true);

    const scaledBox = new THREE.Box3().setFromObject(model);
    const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
    // scaledBox / scaledCenter come from setFromObject and are in WORLD
    // coordinates — model.position is in PARENT LOCAL coordinates. For
    // hotspots placed at any non-origin world location, subtracting the
    // world center directly puts the model at world (0,0,0) instead of at
    // the hotspot. Convert to local first so the centering only zeroes the
    // model's own footprint, not the parent's translation. Y already works
    // out because the group is at floor level (y=0) for every stage.
    const localCenter = group.worldToLocal(scaledCenter.clone());
    model.position.x -= localCenter.x;
    model.position.y += -scaledBox.min.y + (modelConfig.yOffset ?? 0);
    model.position.z -= localCenter.z;
    model.rotation.y = modelConfig.rotationY ?? 0;
    model.updateMatrixWorld(true);
    npcFacingTargets.push({ object: model, parent: group });

    const mixer = new THREE.AnimationMixer(model);
    npcMixers.push(mixer);
    const actionMap = new Map<string, THREE.AnimationAction>();
    const loadingActions = new Map<string, Promise<boolean>>();
    let currentAction: THREE.AnimationAction | null = null;

    const loadAction = async (id: string) => {
      if (actionMap.has(id)) return true;
      const source =
        rig.animationSources.find((candidate) => candidate.id === id) ??
        rig.animationSources.find((candidate) => candidate.id === rig.fallbackAnimationId);
      if (!source) return false;

      const existing = loadingActions.get(source.id);
      if (existing) return existing;

      const loadPromise = modelLoader
        .loadAsync(source.url)
        .then((animationGltf) => {
          if (!group.parent) return false;
          const clip = animationGltf.animations[0]?.clone();
          if (!clip) return false;
          clip.name = source.label;
          const action = mixer.clipAction(clip, model);
          action.enabled = true;
          action.setEffectiveWeight(1);
          action.setLoop(THREE.LoopRepeat, Infinity);
          actionMap.set(source.id, action);
          if (source.id !== id) actionMap.set(id, action);
          return true;
        })
        .catch(() => false)
        .finally(() => loadingActions.delete(source.id));

      loadingActions.set(source.id, loadPromise);
      return loadPromise;
    };

    const playAction = (id: string, fadeDuration = 0.18) => {
      const nextAction = actionMap.get(id);
      if (!nextAction || nextAction === currentAction) return;
      nextAction.reset();
      nextAction.enabled = true;
      nextAction.setEffectiveWeight(1);
      nextAction.play();
      if (currentAction) {
        currentAction.crossFadeTo(nextAction, fadeDuration, false);
      }
      currentAction = nextAction;
    };

    npcControllers.set(hotspot.id, { loadAction, playAction });

    const animationId = getDefaultNpcAnimationId(hotspot);
    const loadedDefault = await loadAction(animationId);
    if (!group.parent || !loadedDefault) return;
    playAction(animationId, 0);
    mixer.update(0.016);
  } catch {
    if (!group.parent) return;
    onLoadFailure();
  }
}

/**
 * Tag every descendant of `root` with the hotspot id so a raycast hit can
 * walk back up to find which hotspot owns the hit object. Also enables shadow
 * casting/receiving across the imported GLB.
 *
 * Re-exported from this module because attachRiggedNpcModelToHotspot uses it
 * internally and the hotspot builder module wants the same helper.
 */
export function applyHotspotId(root: THREE.Object3D, hotspotId: string) {
  root.traverse((object) => {
    object.userData.hotspotId = hotspotId;
    const mesh = object as THREE.Mesh;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });
}
