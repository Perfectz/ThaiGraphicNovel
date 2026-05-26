import type * as THREE from 'three';
import type { BellboyAnimationId } from '../../components/three/bellboyRig';
import type { HotelLobbyGirlAnimationId } from '../../components/three/hotelLobbyGirlRig';
import type { RoomPalette } from '../../components/three/sceneHelpers';
import type { SuAnimationId } from '../../components/three/suRig';
import type { Stage3CharacterAnimationId } from '../../components/three/stage3CharacterRig';

export type AdventureVerb = 'look' | 'take' | 'use' | 'talk';
export type HotspotKind = 'item' | 'person' | 'prop';

export type AdventurePronunciationPrompt = {
  targetPhrase: string;
  romanization: string;
  phoneticSpelling: string;
  translation: string;
};

export type AdventureConversationTurn = {
  id: string;
  npcSpeaker: string;
  npcLineThai: string;
  npcRomanization: string;
  npcEnglish: string;
  response: AdventurePronunciationPrompt;
  successText: string;
};

export type AdventureCharacterVoiceLine = {
  speaker: string;
  text: string;
};

export type AdventureCommand = AdventurePronunciationPrompt & {
  verb: AdventureVerb;
  label: string;
  successText: string;
  characterVoice?: AdventureCharacterVoiceLine;
  blockedText?: string;
  conversationBlockedText?: string;
  givesItem?: string;
  requiresItems?: string[];
  requiresConversation?: string;
  conversationId?: string;
  conversation?: AdventureConversationTurn[];
  conversationCompleteText?: string;
  completesAdventure?: boolean;
};

export type AdventureHotspot3D = {
  id: string;
  label: string;
  kind: HotspotKind;
  /** World-space position of the hotspot anchor in the room. */
  position: [number, number, number];
  /** Where Patrick stands when approaching this hotspot. */
  standPosition?: [number, number, number];
  /** Optional sprite URL — billboards in 3D. */
  sprite?: string;
  /** Sprite scale (width, height). Defaults to person=2.15x3.05, item=0.9x0.9. */
  spriteScale?: [number, number];
  /** Optional ring color override. */
  ringColor?: number;
  /** Optional 3D model replacing the billboard sprite. */
  model?:
    | {
        id: 'su';
        animation?: SuAnimationId;
        height?: number;
        rotationY?: number;
        yOffset?: number;
      }
    | {
        id: 'stage3Vendor';
        animation?: Stage3CharacterAnimationId;
        height?: number;
        rotationY?: number;
        yOffset?: number;
      }
    | {
        id: 'bellboy';
        animation?: BellboyAnimationId;
        height?: number;
        rotationY?: number;
        yOffset?: number;
      }
    | {
        id: 'hotelLobbyGirl';
        animation?: HotelLobbyGirlAnimationId;
        height?: number;
        rotationY?: number;
        yOffset?: number;
      };
  commands: Partial<Record<AdventureVerb, AdventureCommand>>;
  /**
   * When true, clicking this hotspot also auto-starts its `talk` command's
   * conversation (if any), bypassing the verb UI and the talk command's
   * own targetPhrase practice. Used for Stage 1 Su, whose talk-command
   * targetPhrase ('sawatdee khrap') duplicates the first conversation
   * turn — drilling it twice in a row felt repetitive. Conversations that
   * have already been completed do not auto-restart.
   */
  autoTalk?: boolean;
};

export type AdventureRoom3D = {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  palette: RoomPalette;
  /** Procedurally adds geometry/lights to the provided group when the room is entered. */
  build: (group: THREE.Group, palette: RoomPalette) => void;
  /** Patrick's starting position when entering this room. */
  patrickStart: [number, number, number];
  hotspots: AdventureHotspot3D[];
  /** Per-room ambiance overrides — applied on top of stage defaults. */
  ambianceOverride?: Partial<SceneAmbiance>;
  /**
   * Optional opener that plays before normal control returns. 'stand-up' plays
   * the 'dead' clip in reverse so Patrick rises from the floor — used for
   * Stage 1 where he wakes after falling through the rift. The intro VN
   * dialogue keeps running on top of it.
   */
  introAnimation?: 'stand-up';
};

export type AdventureInventoryItem = {
  id: string;
  label: string;
  thaiNoun: string;
  romanization: string;
  sprite: string;
};

export type SceneAmbiance = {
  background: number;
  fogColor: number;
  fogNear: number;
  fogFar: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  keyColor: number;
  keyIntensity: number;
  keyPosition: [number, number, number];
  rimColor: number;
  rimIntensity: number;
  rimPosition: [number, number, number];
};

export type AdventureSceneConfig = {
  scenarioId: string;
  scenarioNumber: number;
  title: string;
  subtitle: string;
  description: string;
  badge: string;
  rooms: AdventureRoom3D[];
  inventoryItems: Record<string, AdventureInventoryItem>;
  requiredInventory: string[];
  ambiance: SceneAmbiance;
  /** Final encounter text shown when the stage is cleared. */
  completionMessage: string;
  /**
   * Optional pre-roll movie played before the per-stage VN intro dialogue.
   * When set, a full-screen video overlay covers the 3D scene and the VN
   * bubble + input gate stay locked until the video ends or the player
   * taps Skip. Used by Stage 1 to bring back the rift-arrival cinematic
   * that the original CharacterDebugPage shipped with.
   */
  introVideoUrl?: string;
  /**
   * Stage-themed one-liner shown on the load overlay between the stage
   * badge and the spinner. Replaces the engineering-grade "Loading <Title>"
   * with prose that matches the stage's mood ("Tuning the Bangkok rift…",
   * "Setting up the night market…"). When omitted the overlay falls back
   * to a generic "Bringing the scene online…".
   */
  loadingTagline?: string;
};
