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
  /**
   * lessonScenarios phrase id behind this command's target phrase, when the
   * command was built from one. Lets the runtime look up Su's recorded
   * per-phrase prompt + coaching audio (`stage-NN-<phraseId>-su` / `-coach`).
   */
  phraseId?: string;
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
  /** Optional in-world room transition fired after this command succeeds. */
  entersRoom?: string;
  /**
   * Overworld portal: when set, succeeding at this command travels to the
   * scenario at this index (0-based) via the host's `onEnterStage` callback,
   * instead of completing a lesson. Used by the walkable Sukhumvit overworld so
   * a stage "gate" hotspot — once the player says its Thai destination phrase —
   * launches that stage. Ignored when no `onEnterStage` handler is wired.
   */
  entersStageIndex?: number;
  /**
   * When set, starting this command's conversation launches the SNES-style
   * turn-based social duel from src/data/battleEncounters/ instead of the
   * scrolling conversation UI. Victory marks `conversationId` complete (and
   * honours `completesAdventure`), so all downstream gating works unchanged.
   */
  battleEncounterId?: string;
  /**
   * Marks this conversation as the stage's *lesson* drill — the one whose
   * phrases the Stage Clear card recaps. Set on the teaching drill when a
   * later "apply it" exchange is what actually completes the stage, so the
   * recap still shows the full lesson rather than the short apply-it turns.
   */
  recapDrill?: boolean;
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
  /**
   * Optional panoramic sky backdrop. The bare filename (no extension) of an
   * asset dropped into `src/assets/skies/` — see `CHATGPT_IMAGE_ASSETS.md` §1.
   * When present and the asset exists, an image-backed dome replaces the
   * procedural gradient dome; otherwise the gradient dome is used.
   */
  skyTexture?: string;
};

/**
 * Per-stage cinematic colour grade applied as the final post pass (after tone
 * mapping). All fields optional; omitted → a tasteful neutral default. Lets
 * each stage carry its own mood — warm lobby, hot night market, cool neon
 * street — without touching geometry or lights.
 */
export type StageGrade = {
  /** Multiplicative tint pushed into the image, 0..1 per channel. */
  tint?: [number, number, number];
  /** How strongly the tint is mixed in (0 = none, 1 = full). */
  tintAmount?: number;
  /** Contrast around mid-grey. 1 = unchanged; ~1.05–1.15 reads cinematic. */
  contrast?: number;
  /** Saturation. 1 = unchanged; >1 richer, <1 desaturated. */
  saturation?: number;
  /** Vignette strength, 0 (off) … 1 (heavy edge darkening). */
  vignette?: number;
  /** Overall exposure multiplier applied before grading. Default 1. */
  exposure?: number;
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
   * Chapter card shown big on the load overlay ("Day Two — The Front Desk").
   * Turns the between-stage load into a scene break instead of a reload.
   */
  chapterTitle?: string;
  /**
   * Stage-themed one-liner shown on the load overlay between the stage
   * badge and the spinner. Replaces the engineering-grade "Loading <Title>"
   * with prose that matches the stage's mood ("Tuning the Bangkok rift…",
   * "Setting up the night market…"). When omitted the overlay falls back
   * to a generic "Bringing the scene online…".
   */
  loadingTagline?: string;
  /**
   * Optional HDRI (equirectangular `.exr`/`.hdr`) used as the scene's
   * image-based lighting environment. When set, the runtime loads it through a
   * PMREMGenerator and assigns `scene.environment`, so every PBR material
   * (the GLB props + character rigs) picks up realistic reflections and
   * ambient bounce. Does NOT touch `scene.background` — the flat colour + sky
   * dome art direction stays intact. Stage 1 uses the "Royal Esplanade" hall
   * HDRI to ground the marble/brass lobby.
   */
  environmentMapUrl?: string;
  /**
   * Multiplier on the environment map's contribution (`scene.environmentIntensity`).
   * Defaults to 1. Lower it (e.g. 0.6) so IBL flatters the scene without
   * washing out the authored per-stage key/rim lighting.
   */
  environmentIntensity?: number;
  /**
   * Per-stage UnrealBloom overrides. Omitted → the global defaults
   * (strength 0.62 desktop / 0.45 low-end, threshold 0.85). Stage 1 raises the
   * threshold and lowers the strength so the daylit lobby doesn't bloom-clip,
   * while the night-market showpiece keeps the punchy global default.
   */
  bloomStrength?: number;
  bloomThreshold?: number;
  /**
   * Per-stage cinematic colour grade (final post pass). Omitted → the neutral
   * default grade (gentle contrast + vignette). Set a `tint`/`saturation` to
   * give the stage its own mood.
   */
  grade?: StageGrade;
};
