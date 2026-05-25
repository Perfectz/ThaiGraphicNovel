import * as THREE from 'three';
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { AdventureHotspot3D } from '../data/adventures/types';
import type { NpcAnimationController } from './Stage3DAdventure.types';
import { applyHotspotId, attachRiggedNpcModelToHotspot, getRiggedNpcConfig } from './Stage3DAdventure.npcRig';

/**
 * Spatial + raycast helpers and the factory that builds the per-hotspot
 * Three.js Group containing the floor ring, click collider, NPC rig (or
 * billboard sprite, or fallback marker), and movement collider hints.
 */

/** Rotate `object` to face `target` on the XZ plane. Tiny-distance no-op. */
export function faceToward(object: THREE.Object3D, target: THREE.Vector3) {
  const dx = target.x - object.position.x;
  const dz = target.z - object.position.z;
  if (Math.hypot(dx, dz) < 0.001) return;
  object.rotation.y = Math.atan2(dx, dz);
}

/**
 * Walk up the Object3D tree from a raycast hit and find the nearest ancestor
 * tagged with a hotspot id. Returns undefined if no ancestor is tagged.
 */
export function getHotspotIdFromObject(object: THREE.Object3D): string | undefined {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (typeof current.userData.hotspotId === 'string') return current.userData.hotspotId;
    current = current.parent;
  }
  return undefined;
}

/**
 * Highest `clickPriority` value among `object` and its ancestors. Used to
 * prefer e.g. a Su click cylinder over a floor ring when both intersect.
 */
export function getClickPriority(object: THREE.Object3D): number {
  let current: THREE.Object3D | null = object;
  let priority = 0;
  while (current) {
    if (typeof current.userData.clickPriority === 'number') {
      priority = Math.max(priority, current.userData.clickPriority);
    }
    current = current.parent;
  }
  return priority;
}

export function addSpriteBillboard(
  textureLoader: THREE.TextureLoader,
  group: THREE.Group,
  hotspot: AdventureHotspot3D,
): boolean {
  if (!hotspot.sprite) return false;

  const texture = textureLoader.load(hotspot.sprite);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.userData.hotspotId = hotspot.id;
  sprite.userData.clickPriority = 1;
  const scale =
    hotspot.spriteScale ??
    (hotspot.kind === 'person' ? ([2.15, 3.05] as [number, number]) : ([0.9, 0.9] as [number, number]));
  sprite.scale.set(scale[0], scale[1], 1);
  group.add(sprite);
  return true;
}

export function addFallbackMarker(group: THREE.Group, hotspot: AdventureHotspot3D) {
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(hotspot.kind === 'person' ? 0.55 : 0.32, 22, 14),
    new THREE.MeshStandardMaterial({
      color: hotspot.kind === 'person' ? 0xf0abfc : 0x67e8f9,
      roughness: 0.5,
      metalness: 0.1,
      emissive: hotspot.kind === 'person' ? 0xf0abfc : 0x67e8f9,
      emissiveIntensity: 0.45,
    }),
  );
  marker.userData.hotspotId = hotspot.id;
  group.add(marker);
}

/**
 * Build the THREE.Group that visually represents one hotspot in the world:
 * floor ring + (rigged NPC | sprite billboard | fallback sphere) + a click
 * collider sized appropriately. Sets `userData.hotspotId` on every node so
 * raycasts can resolve back to this hotspot.
 *
 * For person/item/prop hotspots without a 3D model, a synthetic collider
 * radius is recorded on the group so the movement system has something to
 * bump into until a real GLB footprint is available.
 */
export function createHotspotObject(
  textureLoader: THREE.TextureLoader,
  modelLoader: GLTFLoader,
  hotspot: AdventureHotspot3D,
  npcMixers: THREE.AnimationMixer[],
  npcFacingTargets: Array<{ object: THREE.Object3D; parent: THREE.Object3D }>,
  npcControllers: Map<string, NpcAnimationController>,
) {
  const group = new THREE.Group();
  group.position.set(...hotspot.position);
  group.userData.hotspotId = hotspot.id;

  // Floor ring marker (always visible to hint clickability)
  const ringColor =
    hotspot.ringColor ??
    (hotspot.kind === 'person' ? 0xf0abfc : hotspot.kind === 'item' ? 0x67e8f9 : 0xfde68a);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.38, 0.5, 32),
    new THREE.MeshBasicMaterial({
      color: ringColor,
      transparent: true,
      opacity: 0.78,
      side: THREE.DoubleSide,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -hotspot.position[1] + 0.04;
  ring.userData.hotspotId = hotspot.id;
  group.add(ring);

  if (hotspot.model) {
    const rig = getRiggedNpcConfig(hotspot.model.id);
    const colliderHeight = (hotspot.model.height ?? rig.defaultHeight) + 0.28;
    const clickCollider = new THREE.Mesh(
      new THREE.CylinderGeometry(0.72, 0.72, colliderHeight, 20),
      new THREE.MeshBasicMaterial({ color: ringColor, transparent: true, opacity: 0, depthWrite: false }),
    );
    clickCollider.position.y = colliderHeight / 2;
    clickCollider.userData.hotspotId = hotspot.id;
    clickCollider.userData.clickPriority = 20;
    // Movement collision: the click cylinder is already shaped like Su's body —
    // reuse it as a physical blocker so Patrick can't walk through her.
    clickCollider.userData.collider = true;
    group.add(clickCollider);
    void attachRiggedNpcModelToHotspot(
      group,
      modelLoader,
      hotspot,
      npcMixers,
      npcFacingTargets,
      npcControllers,
      () => {
        if (!addSpriteBillboard(textureLoader, group, hotspot)) {
          addFallbackMarker(group, hotspot);
        }
      },
    );
  } else if (!addSpriteBillboard(textureLoader, group, hotspot)) {
    addFallbackMarker(group, hotspot);
  }
  // Non-rigged hotspots (items, props, billboard people) get a small synthetic
  // collider around their position so Patrick can't walk through them. Rigged
  // NPCs already get the explicit click-cylinder collider above.
  if (!hotspot.model) {
    group.userData.collider = true;
    group.userData.colliderRadius = hotspot.kind === 'person' ? 0.45 : 0.35;
  }
  return group;
}

// Re-export applyHotspotId so callers that already import from this module
// don't need a second import path.
export { applyHotspotId };

/** Format the inventory shortfall as a human-readable list. */
export function formatInventoryList(itemIds: string[], items: Record<string, { label: string }>) {
  return itemIds.map((id) => items[id]?.label ?? id).join(', ');
}

/** Subset of `required` that the player has not yet collected. */
export function getMissing(inventory: string[], required: string[] = []): string[] {
  return required.filter((id) => !inventory.includes(id));
}
