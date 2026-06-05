import type * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { ColliderRect } from './three/collision';
import type { PatrickAnimationId } from './three/patrickRig';
import type { XRControlsHandle } from './three/xrControls';
import type { XRHudHandle } from './three/xrHud';
import type { XRCinemaHandle } from './three/xrCinema';
import type { XRMenuHandle } from './three/xrMenu';

/**
 * Animation controller surface for any rigged NPC hosted by a hotspot. Each
 * rig (Su, stage-3 vendor, future stage-2-clerk, etc.) installs one of these
 * into SceneRefs.npcControllers so the Stage3DAdventure state machine can
 * switch animations without knowing which rig it's poking.
 */
export type NpcAnimationController = {
  loadAction: (id: string) => Promise<boolean>;
  playAction: (id: string, fadeDuration?: number) => void;
};

/**
 * The mutable Three.js scene handles owned by the Stage3DAdventure component.
 * Kept in a single ref so the React state and the render loop can both reach
 * them without redundant lookups.
 *
 * Lifetime: created once in the bootstrap effect, mutated in-place across
 * room transitions, and torn down on unmount.
 */
export type SceneRefs = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /**
   * The XR "player rig" / camera dolly. The camera is a child of this Group.
   * In flat-screen mode the rig sits at the origin and OrbitControls drives the
   * camera directly (so the rig is a transparent pass-through). When an XR
   * session is presenting, OrbitControls is disabled, the headset drives the
   * camera's local pose, and this rig is positioned/rotated to move the player
   * through the room (teleport + snap-turn in Phase B).
   */
  playerRig: THREE.Group;
  /** VR controllers + locomotion layer (null until the bootstrap effect runs). */
  xrControls: XRControlsHandle | null;
  /** In-world VR HUD panel (null until the bootstrap effect runs). */
  xrHud: XRHudHandle | null;
  /** In-world VR pre-roll cinema screen (created lazily when the intro plays). */
  xrCinema: XRCinemaHandle | null;
  /** In-world VR menu panel (null until the bootstrap effect runs). */
  xrMenu: XRMenuHandle | null;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  floor: THREE.Mesh;
  roomGroup: THREE.Group;
  hotspotGroup: THREE.Group;
  playerRoot: THREE.Group;
  targetMarker: THREE.Mesh;
  objectsByHotspot: Map<string, THREE.Object3D>;
  raycaster: THREE.Raycaster;
  pointer: THREE.Vector2;
  targetPosition: THREE.Vector3;
  loadPatrickAction: (id: PatrickAnimationId) => Promise<boolean>;
  playPatrickAction: (id: PatrickAnimationId, fadeDuration?: number) => void;
  npcMixers: THREE.AnimationMixer[];
  npcFacingTargets: Array<{ object: THREE.Object3D; parent: THREE.Object3D }>;
  npcControllers: Map<string, NpcAnimationController>;
  animatedGroups: THREE.Group[];
  /**
   * AABB rectangles in the XZ plane that block player movement. Rebuilt
   * after each room change; re-collected briefly after to capture
   * async-loaded NPC geometry.
   */
  colliders: ColliderRect[];
  /**
   * Kick off a cinematic camera move to a "two-shot" framing of points
   * `a` and `b` (typically Patrick's stand position and the NPC he's
   * talking to). The camera arcs to a 3/4 angle that shows both faces,
   * with the OrbitControls target ending at chest height of the midpoint.
   * The per-frame target-bias auto-follow is paused for the duration so
   * the move is smooth, then resumes — letting the player still orbit
   * freely afterwards.
   */
  frameTwoShot: (a: THREE.Vector3, b: THREE.Vector3, durationMs?: number) => void;
  /**
   * XZ anchor for the auto-bias target while a conversation is active —
   * the per-frame drift retargets toward the midpoint of Patrick and
   * this point instead of the usual player-only bias, so the cinematic
   * two-shot framing doesn't unravel the instant the cinematic ends.
   * Null when no conversation is active.
   */
  conversationAnchor: { x: number; z: number } | null;
  /**
   * XZ point Patrick should turn to face the next time he comes to rest.
   * Set by the click handler when the player clicks a hotspot (so Patrick
   * ends the walk looking at the NPC, not in his last travel direction),
   * cleared by the animate loop the first idle frame after arrival.
   */
  playerArrivalFacing: { x: number; z: number } | null;
};
