import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { addSkyDome, addSkyDomeFromTexture, lighten } from './three/sceneHelpers';
import { loadSkyTexture } from './three/imageTextures';
import { resolveCircleCollision, PLAYER_COLLISION_RADIUS } from './three/collision';
import { createXRControls } from './three/xrControls';
import { createXRHud, type XRHudSnapshot } from './three/xrHud';
import { createXRCinema } from './three/xrCinema';
import { createXRMenu } from './three/xrMenu';
import { createXRVignette } from './three/xrVignette';
import {
  type XRComfortSettings,
  loadComfort,
  saveComfort,
  cycleTurnStyle,
  cycleVignette,
  toggleHandedness,
} from './three/xrComfort';
import { patrickAnimationSources, patrickModelAssetUrl, type PatrickAnimationId } from './three/patrickRig';
import type {
  AdventureCommand,
  AdventureConversationTurn,
  AdventureHotspot3D,
  AdventureSceneConfig,
  AdventureVerb,
} from '../data/adventures/types';
import { applyResult, type PhraseResult, type PhraseResultMap } from './stageClear';
import { StageClearPayoff } from './StageClearPayoff';
import {
  getTutoringLevel,
  getVoiceJudgeMode,
  saveTutoringLevel,
  saveVoiceJudgeMode,
  VOICE_JUDGE_MODE_CHANGED_EVENT,
  type TutoringLevel,
  type VoiceJudgeMode,
} from '../services/openAiSettings';
import { getSoundSettings, saveSoundSettings } from '../services/soundSettings';
import { useGameStore } from '../store/gameStore';
import {
  createPronunciationSession,
  type PronunciationPrompt,
  type PronunciationSession,
  type PronunciationVerdict,
} from '../services/realtimePronunciation';
import { createWhisperPronunciationSession } from '../services/whisperPronunciation';
import { DemoEndSplash } from './DemoEndSplash';
import { SuPronunciationJudge } from './SuPronunciationJudge';
import { TECH_DEMO_PLAYABLE_STAGE_COUNT } from '../data/techDemoConfig';
import { getBrowserCapabilities } from '../services/browserCapabilities';
import { CharacterDebugIntroDialogue } from './CharacterDebugIntroDialogue';
import { getStageIntroLines } from '../data/adventures/stageIntros';
import { getStageOneSuAudioSrc, getSuAudioSrc } from '../services/suLineAudio';
import { stagePhraseCoachTextById } from '../data/stagePhraseCoachLines';
import { getBattleEncounter } from '../data/battleEncounters';
import { enterStageForVitals } from '../systems/battleVitals';
import {
  loadProgression,
  PROGRESSION_CHANGED_EVENT,
  type BattleSpoils,
} from '../systems/progression';
import type { BattleEncounterConfig } from '../data/phantasyBattleDemo';

// Turn-based social-duel screen — lazy so stages that never trigger a battle
// don't pay for the battle bundle (3D battle stage, VFX, battle CSS).
const PhantasyBattleScreen = lazy(() =>
  import('./PhantasyBattleDemo').then((module) => ({ default: module.PhantasyBattleDemo })),
);
import { stageOneConversationDeck } from '../data/stageOneSuVoiceLines';
import { getCharacterVoiceAudioSrc } from '../services/characterVoiceAudio';
import {
  getCommandCharacterVoiceAudioId,
  getConversationTurnCharacterVoiceAudioId,
  getStageIntroCharacterVoiceAudioId,
} from '../data/characterVoiceIds';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { useSoundSettings } from '../hooks/useSoundSettings';
import type { SceneRefs } from './Stage3DAdventure.types';
import { getDefaultNpcAnimationId } from './Stage3DAdventure.npcRig';
import {
  faceToward,
  formatInventoryList,
  getClickPriority,
  getHotspotIdFromObject,
  getMissing,
} from './Stage3DAdventure.hotspots';
import {
  colorToCss,
  getPronunciationScoreFlash,
  withAlpha,
  type PronunciationScoreFlash,
} from './Stage3DAdventure.ui';
import {
  applyResponsiveCameraPreset,
  createTwoShotCameraMove,
  getCameraAutoFollowTarget,
  ROOM_BOUNDS,
  type CinematicMove,
} from './Stage3DAdventure.camera';
import {
  advanceCinematicCamera,
  applyTrailerOrbitCamera,
  configureShadowCaster,
  configureStageRenderer,
  createStagePostFX,
  enableStageXR,
  disposeMountedStageScene,
  publishStage3DDevState,
  readTrailerOrbitDebugConfig,
  resolveTrailerOrbitCenter,
  updateAnimatedRoomDecor,
  type StagePostFX,
  type TrailerOrbitDebugConfig,
} from './Stage3DAdventure.runtime';
import { rebuildAdventureRoom } from './Stage3DAdventure.rooms';

const adventureVerbs: Array<{ id: AdventureVerb; label: string }> = [
  { id: 'look', label: 'Look' },
  { id: 'take', label: 'Take' },
  { id: 'use', label: 'Use' },
  { id: 'talk', label: 'Talk' },
];

// --- Trailer-capture debug flags ---
// Surfaced via URL query so scripts/record-promo.mjs can drive HUD-off and
// orbit-camera clips deterministically without code edits between takes.
// Both are read once at module-load (queries don't change inside a single
// page lifetime), and both are gated behind a query param presence check so
// they're invisible to normal users.
function readTrailerDebugFlags() {
  if (typeof window === 'undefined') {
    return {
      hideHud: false,
      debugOrbit: null as TrailerOrbitDebugConfig | null,
    };
  }
  const params = new URLSearchParams(window.location.search);
  const hideHud = params.get('no-hud') === '1';
  const debugOrbit = readTrailerOrbitDebugConfig(params);
  return { hideHud, debugOrbit };
}

type ActiveCommand = {
  hotspot: AdventureHotspot3D;
  command: AdventureCommand;
};

type ActiveConversation = ActiveCommand & {
  conversationId: string;
  turnIndex: number;
};

export type Stage3DAdventureProps = {
  config: AdventureSceneConfig;
  onComplete?: () => void;
  onReturnToOverworld?: () => void;
  /**
   * Overworld portal handler. When a hotspot command carries an
   * `entersStageIndex`, the engine calls this with that index instead of
   * running the lesson-completion flow. The walkable Sukhumvit overworld wires
   * this to the store's `jumpToScenario` so a street gate launches its stage.
   */
  onEnterStage?: (scenarioIndex: number) => void;
};

export function Stage3DAdventure({
  config,
  onComplete,
  onReturnToOverworld,
  onEnterStage,
}: Stage3DAdventureProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRefs = useRef<SceneRefs | null>(null);
  const roomRef = useRef<string>(config.rooms[0].id);
  const selectHotspotRef = useRef<(hotspot: AdventureHotspot3D) => void>(() => {});
  const moveToRef = useRef<(position: THREE.Vector3) => void>(() => {});
  // --- VR (WebXR) HUD dispatch bridge ---
  // The in-world VR HUD's controller-ray buttons call these refs, which always
  // point at the latest-render closures of the same handlers the DOM HUD uses.
  // No gameplay logic is duplicated — only routed to a 3D surface.
  const vrSelectCommandRef = useRef<(verb: AdventureVerb) => void>(() => {});
  const vrStartVoiceRef = useRef<() => void>(() => {});
  const vrStopVoiceRef = useRef<() => void>(() => {});
  const vrSkipRef = useRef<() => void>(() => {});
  const vrConfirmNoMicRef = useRef<() => void>(() => {});
  const vrConnectMicRef = useRef<() => void>(() => {});
  const vrContinueRef = useRef<() => void>(() => {});
  // Intro (VN) + menu bridges — same pattern, routed to the in-world panels.
  const vrAdvanceIntroRef = useRef<() => void>(() => {});
  const vrToggleMusicRef = useRef<() => void>(() => {});
  const vrCycleVoiceRef = useRef<() => void>(() => {});
  const vrCycleTutorRef = useRef<() => void>(() => {});
  const vrReturnTitleRef = useRef<() => void>(() => {});
  const vrSkipIntroMovieRef = useRef<() => void>(() => {});
  // Tracks whether the current HUD trigger-hold started a recording, so the
  // release knows to stop it (hold-to-speak).
  const vrRecordingRef = useRef(false);
  // The live <video> element of the flat pre-roll, handed to the VR cinema
  // screen so the headset can show the same playing footage.
  const introVideoElRef = useRef<HTMLVideoElement | null>(null);
  // In-VR UI bookkeeping read by the once-bound session/controller closures.
  const menuOpenRef = useRef(false);
  const xrPresentingRef = useRef(false);
  const isIntroMovieActiveRef = useRef(false);
  const syncXRSurfacesRef = useRef<() => void>(() => {});
  // VR comfort settings (snap turn / vignette / handedness). State so the menu
  // panel repaints on change; a mirror ref so the per-frame XR loop reads the
  // latest value without re-binding its once-bound closures.
  const [comfort, setComfort] = useState<XRComfortSettings>(() => loadComfort());
  const comfortRef = useRef<XRComfortSettings>(comfort);
  useEffect(() => {
    comfortRef.current = comfort;
    saveComfort(comfort);
  }, [comfort]);
  const stageIntroAudioRef = useRef<HTMLAudioElement | null>(null);
  const soundSettings = useSoundSettings();
  const returnToTitle = useGameStore((state) => state.returnToTitle);
  // Su's recorded VO for each conversation turn — plays her prompt then her
  // coaching line in sequence. Each entry in stageOneConversationDeck is
  // keyed by the same phrase id used in the turn data, so the lookup below
  // (by turn.id) just works.
  const suAudioPlayer = useAudioPlayer('Su voice audio could not be played.');
  // Increment-on-cancel run id — guards the sequential await loop so an
  // in-flight playback discards itself if a newer turn (or speak press)
  // already moved on.
  const suPlaybackRunRef = useRef(0);

  const [roomId, setRoomId] = useState<string>(config.rooms[0].id);
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);
  const [activeCommand, setActiveCommand] = useState<ActiveCommand | null>(null);
  const [activeConversation, setActiveConversation] = useState<ActiveConversation | null>(null);
  const [completedConversations, setCompletedConversations] = useState<string[]>([]);
  // Active turn-based social duel (SNES battle screen) — set when a talk
  // command with a battleEncounterId starts, cleared on victory/leave.
  const [activeBattle, setActiveBattle] = useState<{
    hotspot: AdventureHotspot3D;
    command: AdventureCommand;
    encounter: BattleEncounterConfig;
  } | null>(null);

  // Campaign-continuous battle vitals: advancing to the next stage keeps
  // Patrick's Confidence/Focus/items; replays or stage-jumps start clean.
  // The per-stage spoils tally (for the Stage Clear card) resets either way.
  const stageSpoilsRef = useRef({ xp: 0, baht: 0, equipment: [] as string[], level: 1 });
  useEffect(() => {
    enterStageForVitals(config.scenarioNumber);
    stageSpoilsRef.current = { xp: 0, baht: 0, equipment: [], level: loadProgression().level };
  }, [config.scenarioId, config.scenarioNumber]);

  // Persistent RPG progression (level + baht) for the header badge — kept in
  // sync with duel rewards via the progression-changed event.
  const [progression, setProgression] = useState(() => loadProgression());
  useEffect(() => {
    const refresh = () => setProgression(loadProgression());
    window.addEventListener(PROGRESSION_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(PROGRESSION_CHANGED_EVENT, refresh);
  }, []);
  // Per-conversation cursor — saved each time advanceConversation advances.
  // Lets the player click away from an in-progress conversation and click
  // back later to resume at the last unfinished turn instead of restarting
  // at turn 0. Cleared on conversation completion so re-clicks fall
  // through the completedConversations guard above instead.
  const [conversationProgress, setConversationProgress] = useState<Record<string, number>>({});
  const [inventory, setInventory] = useState<string[]>([]);
  const [message, setMessage] = useState(config.rooms[0].description);
  const standUpIntroTriggerRef = useRef<(() => void) | null>(null);
  const standUpIntroPendingRef = useRef(false);
  const standUpIntroStartedRef = useRef(false);
  const [isLocationView, setIsLocationView] = useState(false);
  const [isHudMenuOpen, setIsHudMenuOpen] = useState(false);

  // Trailer-capture flags — see readTrailerDebugFlags. useMemo with [] deps
  // because query params don't change inside a page lifetime; capturing once
  // avoids re-running the parser every render.
  const trailerFlags = useMemo(() => readTrailerDebugFlags(), []);

  // When no-hud is on, promote a marker attribute to <body> so CSS can also
  // hide UI rendered OUTSIDE this component's shell (MusicToggle in App,
  // DialoguePanel from intro lines, etc.). Scoping to body keeps the
  // selectors loud and the cleanup unambiguous on unmount.
  useEffect(() => {
    if (!trailerFlags.hideHud) return;
    document.body.setAttribute('data-trailer-capture-no-hud', '1');
    return () => {
      document.body.removeAttribute('data-trailer-capture-no-hud');
    };
  }, [trailerFlags.hideHud]);

  useEffect(() => {
    if (!isLocationView) {
      document.body.removeAttribute('data-adventure-location-view');
      return;
    }
    document.body.setAttribute('data-adventure-location-view', '1');
    function restoreHudFromKeyboard(event: KeyboardEvent) {
      if (event.key === 'Escape' || event.key.toLowerCase() === 'h') {
        setIsLocationView(false);
      }
    }
    window.addEventListener('keydown', restoreHudFromKeyboard);
    return () => {
      window.removeEventListener('keydown', restoreHudFromKeyboard);
      document.body.removeAttribute('data-adventure-location-view');
    };
  }, [isLocationView]);

  // Trailer-capture room-jump (?enter-room=<id>). Lets record-promo.mjs
  // jump straight to a stage's secondary room (cookline / frontDesk /
  // bathroom) without clicking the room-nav pill — which is invisible in
  // no-hud mode. Fires once on mount after the scene refs are populated.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const target = new URLSearchParams(window.location.search).get('enter-room');
    if (!target || target === config.rooms[0].id) return;
    // The scene mounts asynchronously; defer one tick so sceneRefs.current
    // is populated before enterRoom needs it.
    const handle = window.setTimeout(() => {
      enterRoom(target);
    }, 1200);
    return () => window.clearTimeout(handle);
    // We intentionally read enterRoom + config.rooms via closure here — the
    // effect is fire-once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [voiceStatus, setVoiceStatus] = useState('Choose a command to practice.');
  const [voiceError, setVoiceError] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [hasVoiceCoach, setHasVoiceCoach] = useState(false);
  // Skip tally — counts every prompt the player advanced past without a
  // passing voice verdict. Surfaced in the Su judge panel so a player who
  // skipped a lot knows it was tracked, and so future SRS work (Q3) can use
  // the count as a "needs review" signal per stage.
  const [skipCount, setSkipCount] = useState(0);
  // Captions strip text — set by the conversation VO effect when audio
  // starts playing, cleared when it ends. Rendered at the bottom of the
  // screen only when soundSettings.captionsEnabled is true (default on),
  // so deaf/HoH players and muted-playthrough players still get every Su
  // line.
  const [playbackCaption, setPlaybackCaption] = useState('');
  const [voiceMode, setVoiceMode] = useState<VoiceJudgeMode>(() => getVoiceJudgeMode());
  const [tutorLevel, setTutorLevel] = useState<TutoringLevel>(() => getTutoringLevel());
  const [verdict, setVerdict] = useState<PronunciationVerdict | null>(null);
  // Review mode — when set, the cue card + voice judge target a PRIOR turn
  // of the active conversation instead of the current one. Lets the player
  // re-practice a phrase they already passed. Auto-clears after one attempt
  // (mirrors the legacy battle 'Try Previous Phrase Again' behaviour).
  const [reviewTurnIndex, setReviewTurnIndex] = useState<number | null>(null);
  const reviewTurnIndexRef = useRef<number | null>(null);
  reviewTurnIndexRef.current = reviewTurnIndex;
  const [stageComplete, setStageComplete] = useState(false);
  // Per-phrase outcomes recorded across the drill (id → best score/confirmed/
  // skipped) plus the turn list captured at completion. Together these drive
  // the Stage Clear mastery recap so the level pays off the learning.
  const [phraseResults, setPhraseResults] = useState<PhraseResultMap>({});
  const [clearedTurns, setClearedTurns] = useState<AdventureConversationTurn[]>([]);
  const [loadStatus, setLoadStatus] = useState(`Loading ${config.title}...`);
  // MVP 5 — Loading polish. We track three independent signals so the
  // overlay can render a progressive checklist and decide when it's truly
  // safe to fade out:
  //   - patrickLoaded:  GLB+animations or fallback Patrick mounted
  //   - roomBuilt:      the room-rebuild effect has placed geometry
  //   - minDisplayElapsed: a 900ms timer that guarantees the overlay
  //     stays on screen long enough to register, even on a fast machine
  //     where everything loads in <100ms. Prevents a strobing pop.
  const [patrickLoaded, setPatrickLoaded] = useState(false);
  const [roomBuilt, setRoomBuilt] = useState(false);
  const [minDisplayElapsed, setMinDisplayElapsed] = useState(false);
  useEffect(() => {
    // Held just long enough that the load chrome registers visually but
    // doesn't feel artificial. 900ms is below the threshold where a user
    // starts feeling impatient (~1s) and above the strobe threshold (~250ms).
    const timeoutId = window.setTimeout(() => setMinDisplayElapsed(true), 900);
    return () => window.clearTimeout(timeoutId);
  }, []);
  const [pronunciationFlash, setPronunciationFlash] = useState<PronunciationScoreFlash | null>(null);
  const [hintsDismissed, setHintsDismissed] = useState(false);

  // Per-stage intro dialogue (Patrick reacts → Su orients → Su tutorial → Su goal).
  // Mirrors the Stage 1 pre-training intro. Lines come from stageIntros.ts and
  // are looked up by scenarioId. If a stage has no registered intro we treat
  // the intro as immediately "complete" so input flows like before.
  const introLines = useMemo(() => getStageIntroLines(config.scenarioId), [config.scenarioId]);
  const hasIntro = introLines.length > 0;
  const [introIndex, setIntroIndex] = useState(0);
  const [isIntroComplete, setIsIntroComplete] = useState(!hasIntro);
  // "Logically ready" means the engine has done its job; "can hide overlay"
  // adds the min-display guard so the spinner doesn't strobe. We use the
  // logical state for downstream guards (input gates, audio start) and the
  // composite for the overlay opacity.
  const sceneReady = /ready/i.test(loadStatus);
  const canHideLoadOverlay = sceneReady && patrickLoaded && roomBuilt && minDisplayElapsed;
  // Pre-roll cinematic. When the config has an introVideoUrl, the full-screen
  // video overlay becomes the visible loading screen while the Three.js room
  // and assets mount behind it.
  // Respect prefers-reduced-motion by skipping the pre-roll cinematic
  // entirely — the VN dialogue still covers the narrative beats.
  const hasIntroMovie = Boolean(config.introVideoUrl) && !getBrowserCapabilities().prefersReducedMotion;
  const [isIntroMovieDone, setIsIntroMovieDone] = useState(!hasIntroMovie);
  const isIntroMovieActive = hasIntroMovie && !isIntroMovieDone;
  isIntroMovieActiveRef.current = isIntroMovieActive;
  const canShowIntroDialogue = isIntroMovieDone && sceneReady;
  const currentIntroLine = introLines[introIndex] ?? introLines[introLines.length - 1];
  const isFinalIntroLine = introIndex >= introLines.length - 1;
  useEffect(() => {
    stageIntroAudioRef.current?.pause();
    stageIntroAudioRef.current = null;
    // Hold the Su VN audio while the pre-roll movie is still playing — the
    // movie has its own soundtrack and we don't want them stepping on each
    // other. As soon as the movie finishes or is skipped and the scene is
    // ready, the standard line-by-line audio kicks in for the bubble.
    if (
      !canShowIntroDialogue ||
      isIntroComplete ||
      !currentIntroLine ||
      currentIntroLine.speaker !== 'Su' ||
      !soundSettings.guideAudioEnabled
    ) {
      return;
    }
    const characterAudioSrc = getCharacterVoiceAudioSrc(
      getStageIntroCharacterVoiceAudioId(config.scenarioId, currentIntroLine.id, currentIntroLine.speaker),
    );
    const audioSrc = characterAudioSrc ?? getSuAudioSrc(currentIntroLine.audioId);
    if (!audioSrc) return;

    const audio = new Audio(audioSrc);
    audio.volume = soundSettings.guideAudioVolume;
    stageIntroAudioRef.current = audio;
    void audio.play().catch(() => {
      if (stageIntroAudioRef.current === audio) stageIntroAudioRef.current = null;
    });

    return () => {
      audio.pause();
      if (stageIntroAudioRef.current === audio) stageIntroAudioRef.current = null;
    };
  }, [
    currentIntroLine,
    config.scenarioId,
    canShowIntroDialogue,
    isIntroComplete,
    soundSettings.guideAudioEnabled,
    soundSettings.guideAudioVolume,
  ]);
  // Mirror the gate into a ref so the pointerup handler (registered once in
  // the bootstrap effect) can read the latest value without re-binding.
  // Input stays locked while EITHER the movie is playing OR the VN intro is
  // still in progress.
  const introInputUnlockedRef = useRef<boolean>(!hasIntro && !hasIntroMovie);
  introInputUnlockedRef.current = isIntroComplete && canShowIntroDialogue;
  function requestStandUpIntro() {
    if (standUpIntroStartedRef.current) return;
    const trigger = standUpIntroTriggerRef.current;
    if (!trigger) {
      standUpIntroPendingRef.current = true;
      return;
    }
    trigger();
  }
  function advanceStageIntro() {
    requestStandUpIntro();
    if (introIndex < introLines.length - 1) {
      setIntroIndex(introIndex + 1);
    }
    setIsIntroComplete(true);
  }
  function dismissIntroMovie() {
    setIsIntroMovieDone(true);
  }

  const room = useMemo(
    () => config.rooms.find((entry) => entry.id === roomId) ?? config.rooms[0],
    [config.rooms, roomId],
  );
  const selectedHotspot = useMemo(
    () => room.hotspots.find((hotspot) => hotspot.id === selectedHotspotId) ?? null,
    [room.hotspots, selectedHotspotId],
  );

  const pronunciationSession = useRef<PronunciationSession | null>(null);
  const connectionPromise = useRef<Promise<PronunciationSession | null> | null>(null);
  const pressedSpeakPointers = useRef<Set<number>>(new Set());
  const activeCommandRef = useRef<ActiveCommand | null>(null);
  const activeConversationRef = useRef<ActiveConversation | null>(null);

  // Effective turn index used for cue card + voice judge — uses
  // reviewTurnIndex when set (the player is reviewing a prior phrase),
  // otherwise the live conversation cursor. Clamped to valid range so a
  // stale review value can't index out of bounds after a conversation
  // shrinks or resets.
  const effectiveTurnIndex = (() => {
    if (!activeConversation) return 0;
    const conversationLength = activeConversation.command.conversation?.length ?? 0;
    const live = activeConversation.turnIndex;
    if (reviewTurnIndex === null) return live;
    return Math.max(0, Math.min(reviewTurnIndex, conversationLength - 1));
  })();
  const activeConversationTurn = activeConversation?.command.conversation?.[effectiveTurnIndex] ?? null;
  const isReviewing = activeConversation !== null && reviewTurnIndex !== null;

  const pronunciationPrompt = useMemo<PronunciationPrompt>(
    () =>
      activeConversationTurn
        ? activeConversationTurn.response
        : activeCommand
          ? {
              targetPhrase: activeCommand.command.targetPhrase,
              romanization: activeCommand.command.romanization,
              phoneticSpelling: activeCommand.command.phoneticSpelling,
              translation: activeCommand.command.translation,
            }
          : {
              targetPhrase: 'ผมดูครับ',
              romanization: 'phom duu khrap',
              phoneticSpelling: 'pom doo khrap',
              translation: 'I look.',
            },
    [activeCommand, activeConversationTurn],
  );

  const activeConversationProgress = activeConversation?.command.conversation
    ? `${effectiveTurnIndex + 1}/${activeConversation.command.conversation.length}${isReviewing ? ' · Review' : ''}`
    : '';
  const hudMenuSummary = activeConversation
    ? activeConversationProgress || 'Conversation'
    : activeCommand
      ? activeCommand.command.label
      : (selectedHotspot?.label ?? 'Actions');
  const activeSpeechRomanization =
    activeConversationTurn?.response.romanization ?? activeCommand?.command.romanization;
  const inventoryCount = inventory.length;
  const requiredCount = config.requiredInventory.length;
  const hasActiveSpeechPrompt = Boolean(activeCommand || activeConversation) && !stageComplete;
  const contextualActions = useMemo(
    () =>
      selectedHotspot
        ? adventureVerbs.flatMap((verb) => {
            const command = selectedHotspot.commands[verb.id];
            if (!command) return [];
            const missing = getMissing(inventory, command.requiresItems);
            const needsConversation =
              command.requiresConversation &&
              !completedConversations.includes(command.requiresConversation);
            const blocked = Boolean(needsConversation || missing.length > 0);
            const blockedReason = needsConversation
              ? 'Finish the required talk first'
              : missing.length > 0
                ? `Need ${formatInventoryList(missing, config.inventoryItems)}`
                : '';
            return [
              {
                verb: verb.id,
                verbLabel: verb.label,
                label: command.label,
                hint: blocked ? blockedReason : command.romanization,
                blocked,
              },
            ];
          })
        : [],
    [selectedHotspot, inventory, completedConversations, config.inventoryItems],
  );
  const showContextualActions =
    Boolean(selectedHotspot) &&
    contextualActions.length > 0 &&
    !hasActiveSpeechPrompt &&
    !isHudMenuOpen &&
    !stageComplete;

  roomRef.current = roomId;
  activeCommandRef.current = activeCommand;
  activeConversationRef.current = activeConversation;

  // --- Three.js bootstrap ---
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(config.ambiance.background);
    scene.fog = new THREE.Fog(config.ambiance.fogColor, config.ambiance.fogNear, config.ambiance.fogFar);
    // Gradient sky dome behind the room — the flat background colour stays as
    // the fog/clear colour, the dome adds a vertical two-tone so the horizon
    // reads with depth. Sky top lifts toward the hemi sky colour.
    // Prefer an image-backed dome if the stage names a sky asset that exists;
    // otherwise fall back to the procedural two-tone gradient dome.
    const skyTexture = config.ambiance.skyTexture
      ? loadSkyTexture(config.ambiance.skyTexture)
      : null;
    if (skyTexture) {
      addSkyDomeFromTexture(scene, skyTexture);
    } else {
      addSkyDome(scene, lighten(config.ambiance.hemiSky, 0.15), config.ambiance.background);
    }

    const camera = new THREE.PerspectiveCamera(52, mount.clientWidth / mount.clientHeight, 0.1, 80);
    // Stage 1 opens with Patrick rising on the left and Su waving on the right.
    // The camera is pulled slightly stage-left and lowered to roughly chest
    // height so both rigs read at full body in the same frame, and there's
    // headroom to orbit and admire either character without snapping past the
    // soft polar/distance limits below.
    camera.position.set(-2.4, 2.7, 8.4);

    // XR player rig (camera dolly). The camera lives inside this Group so that
    // in VR the headset drives the camera's *local* pose while the rig is moved
    // through the room (teleport / snap-turn, Phase B). The rig stays at the
    // identity transform in flat-screen mode, so OrbitControls — which mutates
    // the camera's local position/quaternion — behaves exactly as before
    // (local space == world space when the parent is identity).
    const playerRig = new THREE.Group();
    playerRig.name = 'xr-player-rig';
    scene.add(playerRig);
    playerRig.add(camera);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    // Pixel ratio is capped per-device class:
    //   mobile / iOS → 1.0  (a phone GPU pushing 3× the pixels of a
    //                         desktop crushes the frame rate)
    //   desktop      → 1.5  (perceived quality stops scaling past this on
    //                         most displays, but cost keeps climbing)
    // The browser's reported devicePixelRatio is still the upper bound,
    // so a 1× display gets 1× regardless of our cap.
    configureStageRenderer(renderer, mount);
    enableStageXR(renderer);
    mount.appendChild(renderer.domElement);

    // "Enter VR" button, appended into the mount div outside React's tree so
    // React never re-renders over it. VRButton self-disables to "VR NOT
    // SUPPORTED" when the browser/headset has no immersive-vr session, so it is
    // inert and harmless on a normal desktop. Removed in the cleanup below.
    // Require 'local-floor' so the session only starts when the runtime can
    // actually report a floor-relative pose — otherwise our standing-height and
    // rig-on-the-floor assumptions silently break and the player floats/sinks.
    // 'hand-tracking' is optional: nice when present, never blocking.
    const vrButton = VRButton.createButton(renderer, {
      requiredFeatures: ['local-floor'],
      optionalFeatures: ['hand-tracking'],
    });
    vrButton.dataset.testid = 'stage-3d-vr-button';
    const hideUnsupportedVrButton = () => {
      if (/not supported/i.test(vrButton.textContent ?? '')) {
        vrButton.style.display = 'none';
        vrButton.setAttribute('aria-hidden', 'true');
      }
    };
    const vrButtonObserver = new MutationObserver(hideUnsupportedVrButton);
    vrButtonObserver.observe(vrButton, { childList: true, characterData: true, subtree: true });
    hideUnsupportedVrButton();
    window.setTimeout(hideUnsupportedVrButton, 0);
    // Lift it clear of the bottom HUD dock and sit it above all overlays so the
    // "ENTER VR" affordance stays tappable on a headset-capable browser.
    vrButton.style.bottom = 'auto';
    vrButton.style.top = '0.75rem';
    vrButton.style.left = 'auto';
    vrButton.style.right = '7.5rem';
    vrButton.style.transform = 'none';
    // Above the pre-roll overlay (z-80) so the player can put the headset on and
    // tap "Enter VR" while the intro is still playing — the intro then continues
    // on the in-world cinema screen instead of being skipped.
    vrButton.style.zIndex = '90';
    mount.appendChild(vrButton);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    // Looser pitch + closer min distance so the player can swing the camera
    // around to admire either character model from different angles — drag to
    // orbit, scroll to zoom. minPolarAngle keeps it out of a flat top-down
    // and maxPolarAngle stops just shy of clipping through the floor.
    controls.minPolarAngle = 0.18;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.minDistance = 3.4;
    controls.maxDistance = 14;
    // Target is biased toward Su's side of the room (positive X) so her full
    // rig sits cleanly in frame when the scene first opens.
    controls.target.set(1.6, 1.45, 0.2);
    applyResponsiveCameraPreset(camera, controls, renderer.domElement, config.rooms[0]);

    // Trailer-capture orbit mode (?debug-orbit=<hotspotId>&orbit-radius=N&orbit-speed=N).
    // Looks up the hotspot's world position from any room (room transitions
    // are not used during beauty-orbit clips, so first-match is fine) and
    // freezes user camera input. The animate loop below overrides the
    // camera each frame to a circular path around that point.
    const orbitConfig = trailerFlags.debugOrbit;
    const orbitCenter = resolveTrailerOrbitCenter(config, orbitConfig);
    if (orbitConfig && orbitCenter) {
      controls.enabled = false;
    }

    // Hemisphere intensity is bumped 35% over config so the scene reads brighter without
    // washing out the per-stage palette.
    const hemi = new THREE.HemisphereLight(
      config.ambiance.hemiSky,
      config.ambiance.hemiGround,
      config.ambiance.hemiIntensity * 1.35,
    );
    scene.add(hemi);
    const keyLight = new THREE.DirectionalLight(config.ambiance.keyColor, config.ambiance.keyIntensity * 1.2);
    keyLight.position.set(...config.ambiance.keyPosition);
    configureShadowCaster(keyLight);
    scene.add(keyLight);
    scene.add(keyLight.target);
    const rimLight = new THREE.PointLight(config.ambiance.rimColor, config.ambiance.rimIntensity, 14);
    rimLight.position.set(...config.ambiance.rimPosition);
    scene.add(rimLight);
    // Small camera fill light keeps Patrick's face readable when his back is to the key light.
    const fillLight = new THREE.PointLight(0xffffff, 0.45, 9);
    fillLight.position.set(0, 3.0, 5.0);
    scene.add(fillLight);

    const roomGroup = new THREE.Group();
    scene.add(roomGroup);
    const hotspotGroup = new THREE.Group();
    scene.add(hotspotGroup);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 12),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    // Post-processing: bloom so the stages' emissives (neon, lanterns, woks,
    // rift portal) glow. RenderPass holds scene+camera by reference, so room
    // geometry added later still renders through the composer.
    const postFx: StagePostFX = createStagePostFX(
      renderer,
      scene,
      camera,
      mount.clientWidth || window.innerWidth || 1,
      mount.clientHeight || window.innerHeight || 1,
      { strength: config.bloomStrength, threshold: config.bloomThreshold },
      config.grade,
    );

    let disposed = false;

    // --- Image-based lighting (optional per-stage HDRI) --------------------
    // When the stage config supplies an equirectangular .exr/.hdr, run it
    // through a PMREMGenerator and assign it as `scene.environment` only — the
    // flat background + sky dome art direction is left untouched. This gives
    // the GLB props and character rigs real reflections + ambient bounce.
    // The generated render target is disposed in the effect cleanup below.
    let environmentRT: THREE.WebGLRenderTarget | null = null;
    if (config.environmentMapUrl) {
      const pmrem = new THREE.PMREMGenerator(renderer);
      pmrem.compileEquirectangularShader();
      new EXRLoader().load(
        config.environmentMapUrl,
        (texture) => {
          if (disposed) {
            texture.dispose();
            pmrem.dispose();
            return;
          }
          texture.mapping = THREE.EquirectangularReflectionMapping;
          environmentRT = pmrem.fromEquirectangular(texture);
          scene.environment = environmentRT.texture;
          scene.environmentIntensity = config.environmentIntensity ?? 1;
          texture.dispose();
          pmrem.dispose();
        },
        undefined,
        (err) => {
          console.warn('[Stage3DAdventure] HDRI environment load failed', err);
          pmrem.dispose();
        },
      );
    }

    let mixer: THREE.AnimationMixer | null = null;
    let modelRoot: THREE.Object3D | null = null;
    let currentAction: THREE.AnimationAction | null = null;
    let currentPatrickActionId: PatrickAnimationId | null = null;
    let desiredTravelActionId: PatrickAnimationId = 'idle';
    const actionMap = new Map<PatrickAnimationId, THREE.AnimationAction>();
    const loadingActions = new Map<PatrickAnimationId, Promise<boolean>>();

    const playerRoot = new THREE.Group();
    playerRoot.position.set(...config.rooms[0].patrickStart);
    scene.add(playerRoot);

    const targetMarker = new THREE.Mesh(
      new THREE.RingGeometry(0.35, 0.5, 36),
      new THREE.MeshBasicMaterial({
        color: 0x67e8f9,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
      }),
    );
    targetMarker.rotation.x = -Math.PI / 2;
    targetMarker.visible = false;
    scene.add(targetMarker);

    // Cinematic camera state — populated by frameTwoShot and consumed in the
    // animate loop. While non-null, the loop lerps camera position +
    // controls.target along it and suspends the regular auto-follow drift.
    let cinematic: CinematicMove | null = null;

    const frameTwoShot = (a: THREE.Vector3, b: THREE.Vector3, durationMs = 1200) => {
      cinematic = createTwoShotCameraMove(camera, controls, a, b, durationMs);
    };

    const refs: SceneRefs = {
      scene,
      camera,
      playerRig,
      xrControls: null,
      xrHud: null,
      xrCinema: null,
      xrMenu: null,
      xrVignette: null,
      renderer,
      controls,
      floor,
      roomGroup,
      hotspotGroup,
      playerRoot,
      targetMarker,
      objectsByHotspot: new Map(),
      raycaster: new THREE.Raycaster(),
      pointer: new THREE.Vector2(),
      targetPosition: playerRoot.position.clone(),
      loadPatrickAction: async () => false,
      playPatrickAction: () => {},
      npcMixers: [],
      npcFacingTargets: [],
      npcControllers: new Map(),
      animatedGroups: [roomGroup, hotspotGroup],
      colliders: [],
      frameTwoShot,
      conversationAnchor: null,
      playerArrivalFacing: null,
    };
    sceneRefs.current = refs;

    const loader = new GLTFLoader();

    const loadPatrickAction = async (id: PatrickAnimationId) => {
      if (actionMap.has(id)) return true;
      if (!mixer || !modelRoot) return false;

      const source = patrickAnimationSources.find((candidate) => candidate.id === id);
      if (!source) return false;

      const existingLoad = loadingActions.get(id);
      if (existingLoad) return existingLoad;

      const loadPromise = loader
        .loadAsync(source.url)
        .then((animationGltf) => {
          if (disposed || !mixer || !modelRoot) return false;
          const clip = animationGltf.animations[0]?.clone();
          if (!clip) return false;
          clip.name = source.label;
          const action = mixer.clipAction(clip, modelRoot);
          action.enabled = true;
          action.setEffectiveWeight(1);
          actionMap.set(id, action);
          return true;
        })
        .catch(() => false)
        .finally(() => loadingActions.delete(id));

      loadingActions.set(id, loadPromise);
      return loadPromise;
    };

    const playPatrickAction = (id: PatrickAnimationId, fadeDuration = 0.16) => {
      const nextAction = actionMap.get(id);
      if (!nextAction || nextAction === currentAction) return;
      const source = patrickAnimationSources.find((candidate) => candidate.id === id);
      nextAction.reset();
      nextAction.enabled = true;
      nextAction.setEffectiveWeight(1);
      if (source?.loop === 'once') {
        nextAction.setLoop(THREE.LoopOnce, 1);
        nextAction.clampWhenFinished = id === 'dead';
      } else {
        nextAction.setLoop(THREE.LoopRepeat, Infinity);
        nextAction.clampWhenFinished = false;
      }
      nextAction.play();
      if (currentAction) {
        currentAction.crossFadeTo(nextAction, fadeDuration, false);
      }
      currentAction = nextAction;
      currentPatrickActionId = id;
    };

    const ensureAndPlayPatrickAction = (id: PatrickAnimationId, fadeDuration = 0.16) => {
      if (actionMap.has(id)) {
        playPatrickAction(id, fadeDuration);
        return;
      }
      void loadPatrickAction(id).then((loaded) => {
        if (!disposed && loaded) playPatrickAction(id, fadeDuration);
      });
    };

    refs.loadPatrickAction = loadPatrickAction;
    refs.playPatrickAction = playPatrickAction;

    loader.load(
      patrickModelAssetUrl,
      async (gltf) => {
        const model = gltf.scene;
        modelRoot = model;
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);
        const scale = size.y > 0 ? 1.85 / size.y : 1;
        model.scale.setScalar(scale);
        model.position.y = 0;
        model.traverse((object) => {
          if ((object as THREE.Mesh).isMesh) {
            object.castShadow = true;
            object.receiveShadow = true;
          }
        });
        playerRoot.add(model);
        mixer = new THREE.AnimationMixer(model);
        mixer.addEventListener('finished', (event) => {
          const finishedId = Array.from(actionMap.entries()).find(
            ([, action]) => action === event.action,
          )?.[0];
          if (!finishedId || finishedId === 'dead') return;
          if (refs.playerRoot.position.distanceTo(refs.targetPosition) > 0.05) return;
          ensureAndPlayPatrickAction('idle', 0.16);
        });
        const preloadIds = patrickAnimationSources
          .filter((source) => source.preload)
          .map((source) => source.id);
        await Promise.all(preloadIds.map((id) => loadPatrickAction(id)));
        if (disposed) return;

        // Optional stand-up opener — used by Stage 1 (Patrick wakes after
        // tumbling through the rift). Plays the 'dead' clip in reverse so the
        // character rises from a prone pose to standing, then crossfades into
        // the regular idle. The dead action's timeScale is restored to +1
        // afterward so future death sequences still play forward.
        const startingRoom = config.rooms.find((entry) => entry.id === roomRef.current) ?? config.rooms[0];
        if (startingRoom.introAnimation === 'stand-up') {
          const standUpReady = await loadPatrickAction('dead');
          if (!disposed && standUpReady && mixer) {
            const deadAction = actionMap.get('dead');
            if (deadAction) {
              const reverseDuration = deadAction.getClip().duration;
              deadAction.reset();
              deadAction.enabled = true;
              deadAction.setEffectiveWeight(1);
              deadAction.setLoop(THREE.LoopOnce, 1);
              deadAction.clampWhenFinished = true;
              deadAction.time = reverseDuration;
              deadAction.timeScale = 1;
              deadAction.paused = true;
              deadAction.play();
              currentAction = deadAction;
              currentPatrickActionId = 'dead';
              // Apply the prone pose immediately so we don't flash the T-pose
              // for a frame while waiting for the player's first tap.
              mixer.update(0);
              setLoadStatus(`${config.title} ready.`);
              setPatrickLoaded(true);
              standUpIntroTriggerRef.current = () => {
                if (disposed || standUpIntroStartedRef.current) return;
                standUpIntroStartedRef.current = true;
                standUpIntroPendingRef.current = false;
                deadAction.paused = false;
                deadAction.time = reverseDuration;
                deadAction.timeScale = -1;
                deadAction.play();
                currentAction = deadAction;
                currentPatrickActionId = 'dead';
                window.setTimeout(
                  () => {
                    if (disposed) return;
                    ensureAndPlayPatrickAction('idle', 0.45);
                    // Re-arm the dead action so a future game-over uses it
                    // normally (forward, from frame 0).
                    window.setTimeout(() => {
                      if (disposed) return;
                      deadAction.timeScale = 1;
                      deadAction.time = 0;
                      deadAction.paused = true;
                    }, 600);
                  },
                  Math.max(220, reverseDuration * 1000 + 80),
                );
              };
              if (standUpIntroPendingRef.current) {
                standUpIntroTriggerRef.current();
              }
              return;
            }
          }
        }

        playPatrickAction('idle', 0);
        mixer.update(0.016);
        setLoadStatus(`${config.title} ready.`);
        setPatrickLoaded(true);
      },
      undefined,
      () => {
        const fallback = new THREE.Mesh(
          new THREE.BoxGeometry(0.55, 1.7, 0.42),
          new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.6 }),
        );
        fallback.position.y = 0.85;
        playerRoot.add(fallback);
        const head = new THREE.Mesh(
          new THREE.BoxGeometry(0.44, 0.44, 0.44),
          new THREE.MeshStandardMaterial({ color: 0xb77947, roughness: 0.6 }),
        );
        head.position.y = 1.95;
        playerRoot.add(head);
        setLoadStatus(`${config.title} ready with fallback Patrick.`);
        setPatrickLoaded(true);
      },
    );

    function onResize() {
      // While an XR session is presenting, the headset owns the framebuffer
      // size and projection — touching renderer/composer/camera here would
      // fight the WebXR manager. The flat canvas is resized again on exit.
      if (renderer.xr.isPresenting) return;
      if (!mountRef.current) return;
      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      postFx.setSize(width, height);
    }

    // Shared pick core: given a configured raycaster (built either from the 2D
    // pointer in flat mode, or from a VR controller's world matrix), resolve a
    // hotspot/floor hit and drive the existing select + walk-Patrick flow. This
    // is the single source of truth for world interaction so the flat click
    // path and the VR controller path stay in lockstep.
    function handleWorldPick(raycaster: THREE.Raycaster) {
      if (!introInputUnlockedRef.current) return;
      requestStandUpIntro();
      const hotspotObjects = Array.from(refs.objectsByHotspot.values());
      const hotspotHit = raycaster
        .intersectObjects(hotspotObjects, true)
        .sort(
          (a, b) => getClickPriority(b.object) - getClickPriority(a.object) || a.distance - b.distance,
        )[0];
      if (hotspotHit?.object) {
        const hotspotId = getHotspotIdFromObject(hotspotHit.object);
        const currentRoom = config.rooms.find((entry) => entry.id === roomRef.current) ?? config.rooms[0];
        const hotspot = currentRoom.hotspots.find((entry) => entry.id === hotspotId);
        if (hotspot) {
          selectHotspotRef.current(hotspot);
          const standPosition = hotspot.standPosition ?? [
            hotspot.position[0],
            0,
            Math.max(-4.7, Math.min(5.1, hotspot.position[2] + 1.6)),
          ];
          moveToRef.current(new THREE.Vector3(...standPosition));
          // Queue Patrick's arrival facing so when he stops he turns to
          // look at the NPC (not in the direction he was walking from).
          refs.playerArrivalFacing = { x: hotspot.position[0], z: hotspot.position[2] };
          return;
        }
      }
      const floorHit = raycaster.intersectObject(floor)[0];
      if (floorHit) {
        moveToRef.current(new THREE.Vector3(floorHit.point.x, 0, floorHit.point.z));
        // Floor click — no NPC to face. Cancel any pending hotspot facing
        // so Patrick stays in his last-travel direction at the new spot.
        refs.playerArrivalFacing = null;
      }
    }

    function onPointerUp(event: PointerEvent) {
      // Block all world clicks until the per-stage intro dialogue completes.
      // Otherwise the player can stumble onto a hotspot or walk before they
      // know what verb does what.
      if (!introInputUnlockedRef.current) return;
      const rect = renderer.domElement.getBoundingClientRect();
      refs.pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -(((event.clientY - rect.top) / rect.height) * 2 - 1),
      );
      refs.raycaster.setFromCamera(refs.pointer, camera);
      handleWorldPick(refs.raycaster);
    }

    // In-world VR HUD panel — mirrors the React HUD state and floats in front
    // of the player. Parented to the rig so it follows teleport/turn.
    const xrHud = createXRHud();
    playerRig.add(xrHud.group);
    // Hidden on the flat screen — only shown while an immersive session presents
    // (toggled in the session handlers below). Otherwise it would float in the
    // world during normal desktop play.
    xrHud.group.visible = false;
    refs.xrHud = xrHud;

    // In-world VR menu — summoned over the HUD by the menu button or a face
    // button. Hidden until opened.
    const xrMenu = createXRMenu();
    playerRig.add(xrMenu.group);
    refs.xrMenu = xrMenu;

    // Comfort vignette — head-locked, so it's parented to the CAMERA (not the
    // rig) and stays pinned to the eyes as the head moves. Driven each frame by
    // xrControls via onVignette below.
    const xrVignette = createXRVignette();
    camera.add(xrVignette.group);
    refs.xrVignette = xrVignette;

    function setMenuOpen(open: boolean) {
      menuOpenRef.current = open;
      xrMenu.setOpen(open);
    }

    // A controller trigger first asks the active panel whether it hit a button;
    // if so we route to the matching handler (via the dispatch refs) instead of
    // the world pick. Returns true when the press is consumed by a panel.
    function onUiSelectStart(raycaster: THREE.Raycaster): boolean {
      // While the pre-roll cinema is playing, any trigger skips it (and never
      // falls through to a world pick behind the screen).
      if (xrPresentingRef.current && isIntroMovieActiveRef.current) {
        vrSkipIntroMovieRef.current();
        return true;
      }
      // The menu is modal: while it's open it eats every trigger so a press on
      // empty space can't fall through to a world pick behind it.
      if (menuOpenRef.current) {
        const menuAction = xrMenu.hitTest(raycaster);
        if (menuAction) {
          switch (menuAction.kind) {
            case 'resume':
              setMenuOpen(false);
              break;
            case 'toggleMusic':
              vrToggleMusicRef.current();
              break;
            case 'cycleVoice':
              vrCycleVoiceRef.current();
              break;
            case 'cycleTutor':
              vrCycleTutorRef.current();
              break;
            case 'cycleTurn':
              setComfort((c) => ({ ...c, turn: cycleTurnStyle(c.turn) }));
              break;
            case 'cycleVignette':
              setComfort((c) => ({ ...c, vignette: cycleVignette(c.vignette) }));
              break;
            case 'toggleHandedness':
              setComfort((c) => ({ ...c, handedness: toggleHandedness(c.handedness) }));
              break;
            case 'returnToTitle':
              vrReturnTitleRef.current();
              break;
          }
        }
        return true;
      }

      const action = xrHud.hitTest(raycaster);
      if (!action) return false;
      switch (action.kind) {
        case 'verb':
          vrSelectCommandRef.current(action.verb as AdventureVerb);
          break;
        case 'record':
          vrStartVoiceRef.current();
          vrRecordingRef.current = true;
          break;
        case 'skip':
          vrSkipRef.current();
          break;
        case 'confirm':
          vrConfirmNoMicRef.current();
          break;
        case 'connectMic':
          vrConnectMicRef.current();
          break;
        case 'continue':
          vrContinueRef.current();
          break;
        case 'introNext':
          vrAdvanceIntroRef.current();
          break;
        case 'openMenu':
          setMenuOpen(true);
          break;
      }
      return true;
    }

    function onUiSelectEnd() {
      // Release of a hold-to-speak press stops the recording.
      if (vrRecordingRef.current) {
        vrRecordingRef.current = false;
        vrStopVoiceRef.current();
      }
    }

    // VR controllers + comfort locomotion. Inert until a session presents; the
    // trigger reuses handleWorldPick (world) and onUiSelectStart (panel) so VR
    // interaction matches flat clicks. Hover/select route to whichever panel is
    // active — the menu when open, otherwise the HUD.
    const xrControls = createXRControls({
      renderer,
      playerRig,
      camera,
      playerRoot,
      onPick: handleWorldPick,
      onUiSelectStart,
      onUiSelectEnd,
      onUiPeekHover: (raycaster) =>
        menuOpenRef.current ? xrMenu.peekHover(raycaster) : xrHud.peekHover(raycaster),
      onUiApplyHover: (raycaster) =>
        menuOpenRef.current ? xrMenu.setHover(raycaster) : xrHud.setHover(raycaster),
      onMenuToggle: () => setMenuOpen(!menuOpenRef.current),
      // Freeze locomotion while the menu is open OR the pre-roll is playing.
      isMenuOpen: () => menuOpenRef.current || (xrPresentingRef.current && isIntroMovieActiveRef.current),
      getColliders: () => refs.colliders,
      roomBounds: ROOM_BOUNDS,
      getComfort: () => comfortRef.current,
      onVignette: (amount) => xrVignette.setAmount(amount),
    });
    refs.xrControls = xrControls;

    // --- WebXR session lifecycle ---
    // The flat-screen camera pose is captured so it can be restored when the
    // player exits VR (the headset mutates camera.position while presenting).
    const flatCameraPosition = camera.position.clone();
    let controlsEnabledBeforeXR = controls.enabled;
    function onXRSessionStart() {
      controlsEnabledBeforeXR = controls.enabled;
      controls.enabled = false;
      // Fixed-foveation rendering: drop shading rate toward the periphery where
      // the lenses are blurry anyway. Near-free GPU headroom on standalone
      // headsets, which keeps the frame rate (and therefore comfort) stable.
      try {
        renderer.xr.setFoveation(1);
      } catch {
        // Older runtimes may not support foveation control — harmless to skip.
      }
      // FIRST PERSON: the player *is* Patrick. Drop the rig onto Patrick's
      // current floor position so the headset opens at his eyes, hide his
      // avatar (you're inside him), and stop any pending click-to-move so the
      // flat walk system doesn't drag him while the stick drives movement.
      playerRig.position.set(playerRoot.position.x, 0, playerRoot.position.z);
      playerRig.rotation.set(0, 0, 0);
      playerRoot.visible = false;
      refs.targetPosition.copy(playerRoot.position);
      // The DOM intro is invisible in a session, but instead of force-skipping
      // it we now mirror it into the world: the pre-roll plays on the cinema
      // screen and the VN dialogue routes through the HUD panel. syncXRSurfaces
      // shows the right surface for the current intro phase.
      xrPresentingRef.current = true;
      syncXRSurfacesRef.current();
      xrControls.startWakeUp();
    }
    function onXRSessionEnd() {
      // Restore the flat-screen camera + rig + avatar so OrbitControls resumes
      // exactly where it left off.
      playerRig.position.set(0, 0, 0);
      playerRig.rotation.set(0, 0, 0);
      camera.position.copy(flatCameraPosition);
      playerRoot.visible = true;
      controls.enabled = controlsEnabledBeforeXR;
      xrPresentingRef.current = false;
      setMenuOpen(false);
      // Clear any residual comfort vignette so it can't linger on the flat path.
      xrVignette.setAmount(0);
      syncXRSurfacesRef.current();
    }
    renderer.xr.addEventListener('sessionstart', onXRSessionStart);
    renderer.xr.addEventListener('sessionend', onXRSessionEnd);

    let lastTime = performance.now();
    const npcFacingTarget = new THREE.Vector3();
    const nextPlayerPosition = new THREE.Vector3();
    const arrivalFacingTarget = new THREE.Vector3();
    const conversationTarget = new THREE.Vector3();
    const cameraFollowTarget = new THREE.Vector3();

    function animate(now: number) {
      if (disposed) return;
      // In an immersive XR session the headset owns the camera pose, so all the
      // OrbitControls-driven camera logic below is suspended; only the world
      // simulation (mixers, movement, decor) keeps running. EffectComposer
      // post-processing can't render per-eye, so VR renders the scene directly.
      const presenting = renderer.xr.isPresenting;
      const delta = Math.min(0.04, (now - lastTime) / 1000);
      lastTime = now;
      mixer?.update(delta);
      refs.npcMixers.forEach((npcMixer) => npcMixer.update(delta));
      refs.npcFacingTargets.forEach(({ object, parent }) => {
        npcFacingTarget.copy(refs.playerRoot.position);
        parent.worldToLocal(npcFacingTarget);
        faceToward(object, npcFacingTarget);
      });

      updateAnimatedRoomDecor(refs.animatedGroups, delta, now / 1000);

      const target = refs.targetPosition;
      const player = refs.playerRoot;
      // Flat-screen click-to-move. In VR this is suspended — the player is
      // first-person and the controller sticks drive playerRoot directly (see
      // xrControls.update below), so the walk-to-target lerp must not fight it.
      if (!presenting) {
        const distance = player.position.distanceTo(target);
        if (distance > 0.035) {
          const step = Math.min(distance, delta * 3.2);
          nextPlayerPosition.copy(player.position).lerp(target, step / distance);
          // Resolve collision BEFORE committing the new position. If the desired
          // step would land inside an obstacle, the resolver slides Patrick along
          // it; the original `target` stays put so he keeps trying to reach it
          // from a different angle as the player moves the camera.
          resolveCircleCollision(nextPlayerPosition, PLAYER_COLLISION_RADIUS, refs.colliders, ROOM_BOUNDS);
          faceToward(player, target);
          player.position.copy(nextPlayerPosition);
          targetMarker.visible = true;
          targetMarker.position.set(target.x, 0.04, target.z);
          const nextTravelActionId: PatrickAnimationId = distance > 3.1 ? 'run' : 'walk';
          desiredTravelActionId = nextTravelActionId;
          if (currentPatrickActionId !== nextTravelActionId) {
            ensureAndPlayPatrickAction(nextTravelActionId, 0.12);
          }
        } else {
          targetMarker.visible = false;
          if (desiredTravelActionId !== 'idle') {
            desiredTravelActionId = 'idle';
            ensureAndPlayPatrickAction('idle', 0.18);
          }
          // First idle frame after arrival — if the player clicked a hotspot
          // to get here, rotate Patrick to face the NPC instead of leaving
          // him pointing in his last travel direction (which is some
          // tangential approach vector, not the conversation partner).
          if (refs.playerArrivalFacing) {
            arrivalFacingTarget.set(refs.playerArrivalFacing.x, 0, refs.playerArrivalFacing.z);
            faceToward(player, arrivalFacingTarget);
            refs.playerArrivalFacing = null;
          }
        }
      }
      publishStage3DDevState({
        refs,
        camera,
        controls,
        renderer,
        cinematicActive: Boolean(cinematic),
        currentPatrickActionId,
        standUpStarted: standUpIntroStartedRef.current,
      });
      if (presenting) {
        // VR: process controller locomotion/turn, then render the scene
        // directly (headset owns the camera; no EffectComposer per-eye).
        xrControls.update(delta);
        renderer.render(scene, camera);
        return;
      }
      if (orbitConfig && orbitCenter) {
        // Trailer beauty-orbit mode overrides all auto-follow. The camera
        // moves on a circular path at constant angular velocity around the
        // chosen hotspot, looking at it the whole time. speed===0 freezes
        // the camera on its initial angle (used for locked-off beauty shots
        // like the lantern dust loop).
        applyTrailerOrbitCamera(camera, controls, orbitCenter, orbitConfig, now);
      } else if (cinematic) {
        // Cinematic two-shot is in flight. Drive camera + target along the
        // pre-computed lerp; the auto-bias below is skipped so it doesn't
        // fight the motion. Ease-in-out cubic gives a film-style move that
        // settles smoothly on the framing.
        cinematic = advanceCinematicCamera(camera, controls, cinematic, now);
      } else if (refs.conversationAnchor) {
        // Conversation is in progress — anchor the auto-bias to the midpoint
        // of Patrick and the NPC he's talking to, at chest height. Otherwise
        // the player-biased drift below would pull the camera target away
        // from the two-shot framing the cinematic just established, and the
        // camera (which OrbitControls keeps positionally fixed and only
        // rotates) would end up pointing at empty space with both
        // characters skewed to one edge of the screen.
        conversationTarget.set(
          (player.position.x + refs.conversationAnchor.x) / 2,
          1.55,
          (player.position.z + refs.conversationAnchor.z) / 2,
        );
        controls.target.lerp(conversationTarget, 0.05);
      } else {
        // Auto-follow the active play space. Desktop keeps the old gentle
        // Patrick bias; phone portrait favors hotspots so side-placed NPCs
        // stay reachable instead of drifting outside the narrow view.
        const width = renderer.domElement.clientWidth || window.innerWidth;
        const height = renderer.domElement.clientHeight || window.innerHeight;
        const currentRoom = config.rooms.find((entry) => entry.id === roomRef.current) ?? config.rooms[0];
        const { target, isPortraitPhone, isLandscapePhone } = getCameraAutoFollowTarget(
          currentRoom,
          player.position,
          width,
          height,
          cameraFollowTarget,
        );
        controls.target.lerp(target, isPortraitPhone || isLandscapePhone ? 0.035 : 0.022);
      }
      controls.update();
      postFx.composer.render();
    }

    window.addEventListener('resize', onResize);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    // setAnimationLoop drives both the flat path and the XR path: the WebXR
    // manager swaps the loop onto the headset's frame callback while presenting
    // and back to rAF on exit, with no change needed here.
    renderer.setAnimationLoop(animate);

    return () => {
      disposed = true;
      renderer.setAnimationLoop(null);
      renderer.xr.removeEventListener('sessionstart', onXRSessionStart);
      renderer.xr.removeEventListener('sessionend', onXRSessionEnd);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      vrButtonObserver.disconnect();
      if (vrButton.parentElement === mount) {
        mount.removeChild(vrButton);
      }
      xrControls.dispose();
      playerRig.remove(xrHud.group);
      xrHud.dispose();
      playerRig.remove(xrMenu.group);
      xrMenu.dispose();
      camera.remove(xrVignette.group);
      xrVignette.dispose();
      if (refs.xrCinema) {
        playerRig.remove(refs.xrCinema.group);
        refs.xrCinema.dispose();
        refs.xrCinema = null;
      }
      scene.environment = null;
      environmentRT?.dispose();
      environmentRT = null;
      disposeMountedStageScene({ scene, renderer, controls, mount, postFx });
      standUpIntroTriggerRef.current = null;
      sceneRefs.current = null;
    };
    // Bootstrap once. Config changes are not expected — a parent should remount with a new key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Mirror the HUD-relevant React state into the in-world VR panel ---
  // Builds a plain snapshot from the same state the DOM HUD renders and pushes
  // it to the canvas-backed VR panel. Only redraws when a dependency changes,
  // so it costs nothing on idle frames. No-op until the bootstrap effect has
  // created refs.xrHud.
  useEffect(() => {
    const hud = sceneRefs.current?.xrHud;
    if (!hud) return;
    const promptActive = Boolean(activeCommand || activeConversation) && !stageComplete;
    const micRow: XRHudSnapshot['micRow'] = !promptActive
      ? 'none'
      : voiceMode === 'no-mic'
        ? 'confirm'
        : !hasVoiceCoach
          ? 'connect'
          : 'record';
    // While the per-stage VN intro is mid-flight, route it through the panel so
    // the headset can read + advance it (the DOM DialoguePanel is invisible in
    // a session). Takes priority over the verb/mic rows inside the painter.
    const introActive = canShowIntroDialogue && !isIntroComplete && Boolean(currentIntroLine);
    const snapshot: XRHudSnapshot = {
      objective: message,
      status: playbackCaption || voiceStatus,
      selectedLabel: selectedHotspot?.label ?? null,
      verbs: adventureVerbs.map((verb) => ({
        id: verb.id,
        label: verb.label,
        enabled: Boolean(selectedHotspot?.commands[verb.id]),
      })),
      promptActive,
      micRow,
      recording: isRecording,
      verdict: verdict ? `${verdict.pass ? '✓' : '✗'} ${verdict.feedback}` : null,
      stageComplete,
      intro: introActive
        ? { speaker: currentIntroLine.speaker, line: currentIntroLine.text, canAdvance: true }
        : null,
    };
    hud.update(snapshot);
  }, [
    message,
    playbackCaption,
    voiceStatus,
    selectedHotspot,
    activeCommand,
    activeConversation,
    voiceMode,
    hasVoiceCoach,
    isRecording,
    verdict,
    stageComplete,
    canShowIntroDialogue,
    isIntroComplete,
    currentIntroLine,
  ]);

  // Re-sync the VR surfaces (cinema vs HUD visibility) whenever the pre-roll
  // transitions between playing and done.
  useEffect(() => {
    syncXRSurfacesRef.current();
  }, [isIntroMovieActive]);

  // Mirror the menu-relevant settings onto the in-world menu panel.
  useEffect(() => {
    const menu = sceneRefs.current?.xrMenu;
    if (!menu) return;
    menu.update({ musicEnabled: soundSettings.musicEnabled, voiceMode, tutorLevel, comfort });
  }, [soundSettings.musicEnabled, voiceMode, tutorLevel, comfort]);

  // --- Rebuild room geometry & hotspots when roomId changes ---
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs) return;
    const currentRoom = config.rooms.find((entry) => entry.id === roomId) ?? config.rooms[0];
    const rebuiltRoom = rebuildAdventureRoom({
      refs,
      room: currentRoom,
      defaultAmbiance: config.ambiance,
      isCurrent: (rebuiltRoomId) => sceneRefs.current === refs && roomRef.current === rebuiltRoomId,
    });
    // Geometry and hotspots are in place - flip the milestone so the load overlay
    // checklist crosses off "Building room" and the overlay can hide
    // once the min-display timer also elapses.
    setRoomBuilt(true);

    return () => {
      rebuiltRoom.dispose();
    };
  }, [roomId, config]);

  useEffect(() => {
    pronunciationSession.current?.updatePrompt(pronunciationPrompt);
    if ((activeCommand || activeConversation) && pronunciationSession.current) {
      setVoiceStatus(
        activeConversation
          ? 'Conversation response ready. Hold to answer in Thai.'
          : 'Command ready. Hold to say the Thai sentence.',
      );
    }
  }, [activeCommand, activeConversation, pronunciationPrompt]);

  useEffect(() => {
    function syncVoiceMode() {
      setVoiceMode(getVoiceJudgeMode());
    }
    window.addEventListener(VOICE_JUDGE_MODE_CHANGED_EVENT, syncVoiceMode);
    window.addEventListener('focus', syncVoiceMode);
    return () => {
      window.removeEventListener(VOICE_JUDGE_MODE_CHANGED_EVENT, syncVoiceMode);
      window.removeEventListener('focus', syncVoiceMode);
      pronunciationSession.current?.disconnect();
      pronunciationSession.current = null;
    };
  }, []);

  // Trailer-capture voice-injection hook. Exposes
  // `window.__injectVoiceAttempt(wavUrl)` whenever the Whisper voice coach is
  // connected so scripts/record-promo.mjs can feed a pre-recorded WAV through
  // the real judge during the voice-loop clips (23/24/25). Gated behind DEV
  // and an opt-in `window.__CLIP_CAPTURE` flag so it can never reach
  // production, even if the build flag is somehow forced.
  useEffect(() => {
    if (!import.meta.env.DEV && !(window as unknown as { __CLIP_CAPTURE?: boolean }).__CLIP_CAPTURE) {
      return;
    }
    if (!hasVoiceCoach) return;
    const session = pronunciationSession.current;
    const inject = session?.injectAudioFile;
    if (!inject) return; // Realtime sessions don't implement it.
    const win = window as unknown as Record<string, unknown>;
    win.__injectVoiceAttempt = async (wavUrl: string) => {
      // Always refresh the prompt before injection — the active command can
      // change between captures and the previous prompt would judge against
      // the wrong target phrase.
      session?.updatePrompt(pronunciationPrompt);
      await inject(wavUrl);
    };
    return () => {
      if (win.__injectVoiceAttempt && session?.injectAudioFile === inject) {
        delete win.__injectVoiceAttempt;
      }
    };
  }, [hasVoiceCoach, pronunciationPrompt]);

  // Auto-clear pronunciation score flash after the CSS animation finishes (~1450ms)
  useEffect(() => {
    if (!pronunciationFlash) return;
    const timeoutId = window.setTimeout(() => setPronunciationFlash(null), 1450);
    return () => window.clearTimeout(timeoutId);
  }, [pronunciationFlash]);

  // Su voice-over for each conversation turn — plays her prompt then her
  // coaching line in sequence the moment a new turn becomes active. Lookup
  // uses the turn id (e.g. 'hello', 'thank-you') against stageOneConversationDeck,
  // so any Stage 1 turn whose id matches a deck entry gets VO automatically;
  // stages without a deck just stay silent here, which matches existing behavior.
  // The audio stops on:
  //   - the turn advancing or the conversation ending (effect cleanup),
  //   - the player pressing the speak button (stopSuPlayback() in the speak handler),
  //   - the player skipping the prompt (stopSuPlayback() in skipActivePrompt),
  //   - stage completion or unmount (deps + cleanup).
  // We intentionally do NOT depend on isRecording or verdict — a single play
  // per turn avoids fighting the Realtime "Su coaching" reply that comes back
  // after a failed attempt, and the imperative stops above cover the cases
  // where playback should be cut short.
  function stopSuPlayback() {
    suPlaybackRunRef.current += 1;
    suAudioPlayer.stop();
  }

  function playCommandCharacterVoice(hotspot: AdventureHotspot3D, command: AdventureCommand) {
    if (!command.characterVoice || !soundSettings.guideAudioEnabled) return;
    const audioSrc = getCharacterVoiceAudioSrc(
      getCommandCharacterVoiceAudioId(
        config.scenarioId,
        hotspot.id,
        command.verb,
        command.characterVoice.speaker,
      ),
    );
    if (!audioSrc) return;
    stopSuPlayback();
    void suAudioPlayer.play(audioSrc, soundSettings.guideAudioVolume);
  }

  useEffect(() => {
    stopSuPlayback();
    setPlaybackCaption('');
    if (!activeConversation || stageComplete || !soundSettings.guideAudioEnabled) return;
    const turn = activeConversation.command.conversation?.[activeConversation.turnIndex];
    if (!turn) return;
    const characterTurnAudioSrc = getCharacterVoiceAudioSrc(
      getConversationTurnCharacterVoiceAudioId(
        config.scenarioId,
        activeConversation.conversationId,
        turn.id,
        turn.npcSpeaker,
      ),
    );
    const entry = stageOneConversationDeck[turn.id];
    // Pair each audio source with the line text we should surface as a
    // caption when it's the one currently playing. For Stage 1 conversation
    // turns we play suLine then coachingLine — both have matching text in
    // the deck. For other stages (no deck entry) we fall back to the
    // turn's npcEnglish so something still shows when captions are on.
    const playback: Array<{ src: string; caption: string }> = characterTurnAudioSrc
      ? [{ src: characterTurnAudioSrc, caption: turn.npcEnglish }]
      : [
          { src: getStageOneSuAudioSrc(entry?.suAudioId) ?? '', caption: entry?.suLine ?? turn.npcEnglish },
          { src: getStageOneSuAudioSrc(entry?.coachingAudioId) ?? '', caption: entry?.coachingLine ?? '' },
        ].filter((slot) => Boolean(slot.src));
    if (!playback.length) return;
    const runId = suPlaybackRunRef.current;
    void (async () => {
      for (const slot of playback) {
        if (suPlaybackRunRef.current !== runId) return;
        setPlaybackCaption(slot.caption);
        await suAudioPlayer.playUntilEnded(slot.src, soundSettings.guideAudioVolume);
      }
      // Clear the caption once the run finishes so the strip doesn't
      // linger after audio ends.
      if (suPlaybackRunRef.current === runId) setPlaybackCaption('');
    })();
    return () => {
      if (suPlaybackRunRef.current === runId) stopSuPlayback();
      setPlaybackCaption('');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeConversation?.conversationId,
    activeConversation?.turnIndex,
    config.scenarioId,
    stageComplete,
    soundSettings.guideAudioEnabled,
    soundSettings.guideAudioVolume,
  ]);

  // Su prompt + coaching VO for non-conversation command cues. Stage 1's
  // conversation turns get VO from stageOneConversationDeck above; this
  // covers the Stage 2/3 command cards (and any future stage) by looking up
  // the recorded per-phrase pair `stage-NN-<phraseId>-su` / `-coach` from the
  // generated all-Su manifest. Stays silent when no recording exists, which
  // matches the old behavior.
  useEffect(() => {
    if (!activeCommand || activeConversation || stageComplete || !soundSettings.guideAudioEnabled) {
      return;
    }
    const phraseId = activeCommand.command.phraseId;
    if (!phraseId) return;
    const slug = `stage-${String(config.scenarioNumber).padStart(2, '0')}-${phraseId}`;
    const playback = [`${slug}-su`, `${slug}-coach`]
      .map((audioId) => ({
        src: getSuAudioSrc(audioId) ?? '',
        caption: stagePhraseCoachTextById[audioId] ?? '',
      }))
      .filter((slot) => Boolean(slot.src));
    if (!playback.length) return;
    stopSuPlayback();
    const runId = suPlaybackRunRef.current;
    void (async () => {
      for (const slot of playback) {
        if (suPlaybackRunRef.current !== runId) return;
        setPlaybackCaption(slot.caption);
        await suAudioPlayer.playUntilEnded(slot.src, soundSettings.guideAudioVolume);
      }
      if (suPlaybackRunRef.current === runId) setPlaybackCaption('');
    })();
    return () => {
      if (suPlaybackRunRef.current === runId) stopSuPlayback();
      setPlaybackCaption('');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeCommand,
    activeConversation,
    config.scenarioNumber,
    stageComplete,
    soundSettings.guideAudioEnabled,
    soundSettings.guideAudioVolume,
  ]);

  function moveTo(position: THREE.Vector3) {
    const refs = sceneRefs.current;
    if (!refs) return;
    refs.targetPosition.copy(position);
  }

  moveToRef.current = moveTo;

  function enterRoom(nextRoomId: string) {
    if (nextRoomId === roomId) return;
    const nextRoom = config.rooms.find((entry) => entry.id === nextRoomId);
    if (!nextRoom) return;
    setRoomId(nextRoomId);
    setSelectedHotspotId(null);
    setActiveCommand(null);
    setActiveConversation(null);
    setIsHudMenuOpen(false);
    setReviewTurnIndex(null);
    setVerdict(null);
    setVoiceError('');
    setMessage(nextRoom.description);
    const refs = sceneRefs.current;
    if (refs) {
      const start = new THREE.Vector3(...nextRoom.patrickStart);
      refs.playerRoot.position.copy(start);
      refs.targetPosition.copy(start);
      refs.playPatrickAction('idle', 0.12);
      refs.conversationAnchor = null;
      applyResponsiveCameraPreset(refs.camera, refs.controls, refs.renderer.domElement, nextRoom);
    }
  }

  function playHotspotNpcAnimation(hotspot: AdventureHotspot3D, animationId?: string) {
    if (!hotspot.model) return;
    const refs = sceneRefs.current;
    const controller = refs?.npcControllers.get(hotspot.id);
    if (!controller) return;

    const nextAnimationId = animationId ?? getDefaultNpcAnimationId(hotspot);
    void controller.loadAction(nextAnimationId).then((loaded) => {
      if (loaded) controller.playAction(nextAnimationId, 0.16);
    });
  }

  function selectHotspot(hotspot: AdventureHotspot3D) {
    setSelectedHotspotId(hotspot.id);
    setActiveCommand(null);
    setActiveConversation(null);
    setIsHudMenuOpen(false);
    setReviewTurnIndex(null);
    setVerdict(null);
    setVoiceError('');
    setMessage(`${hotspot.label}: choose an action.`);
    setHintsDismissed(true);
    playHotspotNpcAnimation(hotspot);
    // Clear any prior conversation anchor — the rigged-person block below
    // re-sets it if this hotspot is a person we want to frame in a
    // two-shot. Without the reset, clicking away to a non-person hotspot
    // would leave the camera glued to the OLD NPC's midpoint.
    if (sceneRefs.current) sceneRefs.current.conversationAnchor = null;

    // For any rigged-person hotspot (Su, the front-desk clerk, the bellhop,
    // the street-food vendor, etc.) arc the camera into the same two-shot
    // framing Stage 1 uses, and anchor the auto-follow drift to the
    // midpoint of Patrick + this NPC. Applies whether or not autoTalk is
    // set — if it isn't, the player still picks the verb manually, but the
    // shot composition reads consistently across the whole game.
    const isRiggedPerson = hotspot.kind === 'person' && Boolean(hotspot.model);
    if (isRiggedPerson) {
      const refs = sceneRefs.current;
      if (refs) {
        const patrickAnchor = new THREE.Vector3(...(hotspot.standPosition ?? hotspot.position));
        const npcAnchor = new THREE.Vector3(...hotspot.position);
        refs.frameTwoShot(patrickAnchor, npcAnchor);
        refs.conversationAnchor = { x: hotspot.position[0], z: hotspot.position[2] };
      }
    }

    // Hotspot-level auto-talk: clicking opens the conversation directly,
    // skipping the talk command's targetPhrase practice. Used by Stage 1 Su
    // so the first 'sawatdee' isn't drilled twice. Guarded against
    // re-opening a conversation the player has already completed and
    // against firing when the stage is already over. startConversation
    // sets its own message and animations, overriding the placeholder
    // above on the same render.
    const talkCommand = hotspot.commands.talk;
    if (
      hotspot.autoTalk &&
      !stageComplete &&
      talkCommand?.conversationId &&
      talkCommand.conversation?.length &&
      !completedConversations.includes(talkCommand.conversationId)
    ) {
      // Mirror the requirement gating that selectCommand applies — autoTalk
      // shouldn't punch through a talk command's required items or required
      // prior conversation, otherwise the player could start a late-stage
      // drill on stages 2-10 just by clicking the NPC out of order.
      const requiresConvNotMet =
        talkCommand.requiresConversation &&
        !completedConversations.includes(talkCommand.requiresConversation);
      const missingItems = getMissing(inventory, talkCommand.requiresItems);
      if (requiresConvNotMet) {
        setMessage(talkCommand.conversationBlockedText ?? 'Complete the required conversation first.');
        return;
      }
      if (missingItems.length > 0) {
        setMessage(
          talkCommand.blockedText ??
            `You still need ${formatInventoryList(missingItems, config.inventoryItems)}.`,
        );
        return;
      }
      const resumeIndex = conversationProgress[talkCommand.conversationId] ?? 0;
      startConversation({ hotspot, command: talkCommand }, resumeIndex);
      // The rigged-person block above already fired frameTwoShot and set
      // conversationAnchor — no need to do it again here. autoTalk just
      // additionally starts the conversation (resuming at the player's
      // last unfinished turn if they walked away and came back) instead of
      // waiting for the player to pick the Talk verb manually.
    }
  }
  selectHotspotRef.current = selectHotspot;

  function selectCommand(verb: AdventureVerb) {
    if (!selectedHotspot) return;
    const command = selectedHotspot.commands[verb];
    if (!command) {
      setMessage(`${selectedHotspot.label} does not respond to ${verb}.`);
      return;
    }

    if (command.requiresConversation && !completedConversations.includes(command.requiresConversation)) {
      setActiveCommand(null);
      setActiveConversation(null);
      setVerdict(null);
      setVoiceError('');
      setMessage(command.conversationBlockedText ?? 'Complete the required conversation first.');
      return;
    }

    const missing = getMissing(inventory, command.requiresItems);
    if (missing.length > 0) {
      setActiveCommand(null);
      setActiveConversation(null);
      setVerdict(null);
      setVoiceError('');
      setMessage(
        command.blockedText ?? `You still need ${formatInventoryList(missing, config.inventoryItems)}.`,
      );
      return;
    }

    setActiveCommand({ hotspot: selectedHotspot, command });
    setActiveConversation(null);
    setIsHudMenuOpen(false);
    setVerdict(null);
    setVoiceError('');
    setVoiceStatus(
      hasVoiceCoach
        ? 'Command ready. Hold to say the Thai sentence.'
        : 'Connect the AI mic when you are ready.',
    );
    setMessage(`Say: ${command.romanization}`);
    if (command.verb === 'talk') {
      const refs = sceneRefs.current;
      void refs?.loadPatrickAction('talk').then((loaded) => {
        if (loaded) refs.playPatrickAction('talk', 0.14);
      });
      playHotspotNpcAnimation(selectedHotspot, 'talk');
    }
  }

  async function connectVoiceCoach(): Promise<PronunciationSession | null> {
    if (pronunciationSession.current) return pronunciationSession.current;
    if (connectionPromise.current) return connectionPromise.current;

    setIsConnecting(true);
    setVoiceError('');
    setVerdict(null);
    const selectedMode = getVoiceJudgeMode();
    setVoiceMode(selectedMode);

    connectionPromise.current = (async () => {
      const createSession =
        selectedMode === 'whisper' ? createWhisperPronunciationSession : createPronunciationSession;
      const session = await createSession({
        prompt: pronunciationPrompt,
        onStatus: setVoiceStatus,
        onError: (nextMessage) => {
          setVoiceError(nextMessage);
          setVoiceStatus('Voice coach needs another try.');
        },
        onVerdict: (nextVerdict) => {
          setVerdict(nextVerdict);
          setPronunciationFlash({ id: Date.now(), ...getPronunciationScoreFlash(nextVerdict) });
          // Review-mode attempts are practice only — show the verdict, then
          // pop back to the current turn regardless of pass/fail. Matches
          // legacy "Try Previous Phrase Again": one rep, then resume.
          if (reviewTurnIndexRef.current !== null) {
            setReviewTurnIndex(null);
            setVoiceStatus(
              nextVerdict.pass
                ? 'Nice review rep. Hold to continue the current phrase.'
                : 'Review attempt logged. Hold to continue the current phrase.',
            );
            return;
          }
          if (!nextVerdict.pass) {
            setVoiceStatus('Pronunciation needs another try.');
            return;
          }
          setVoiceStatus('Command accepted. The action succeeds.');
          const acceptedConversation = activeConversationRef.current;
          if (acceptedConversation) {
            advanceConversation(acceptedConversation, nextVerdict.score);
            return;
          }
          const acceptedCommand = activeCommandRef.current;
          if (acceptedCommand) {
            if (acceptedCommand.command.conversationId && acceptedCommand.command.conversation?.length) {
              startConversation(acceptedCommand);
              return;
            }
            executeCommand(acceptedCommand);
          }
        },
      });
      pronunciationSession.current = session;
      setHasVoiceCoach(true);
      return session;
    })();

    try {
      return await connectionPromise.current;
    } catch (error) {
      // MVP 3 — Mic-denied auto-fallback. If the browser blocked
      // getUserMedia (NotAllowedError / PermissionDenied / SecurityError on
      // insecure origins), automatically flip into No-mic mode and persist
      // it. The player keeps playing instead of staring at a dead Connect
      // Mic button. We deliberately keep the original error string in the
      // voice-error slot so anyone curious can still see why — but the
      // status line and voice mode shift immediately to no-mic.
      const message = error instanceof Error ? error.message : String(error);
      const errorName = error instanceof Error ? error.name : '';
      const isMicDenial =
        /NotAllowed|Permission|denied|getUserMedia/i.test(`${errorName} ${message}`) ||
        // Some browsers (older Safari) reject mic on insecure contexts with
        // SecurityError — treat that as the same "can't get a mic" path.
        errorName === 'SecurityError' ||
        errorName === 'NotFoundError'; // No mic hardware
      if (isMicDenial) {
        saveVoiceJudgeMode('no-mic');
        setVoiceMode('no-mic');
        setVoiceError('');
        setVoiceStatus('Microphone unavailable — switched to No-mic mode. Tap Confirm Phrase to continue.');
      } else {
        setVoiceError(message);
        setVoiceStatus(
          `${selectedMode === 'whisper' ? 'Local Whisper' : 'Realtime'} voice coach could not connect.`,
        );
      }
      setHasVoiceCoach(false);
      return null;
    } finally {
      setIsConnecting(false);
      connectionPromise.current = null;
    }
  }

  function startVoiceAttempt(session = pronunciationSession.current) {
    if (!session || (!activeCommand && !activeConversation) || isRecording) return;
    setVoiceError('');
    setVerdict(null);
    session.updatePrompt(pronunciationPrompt);
    session.startRecording();
    setIsRecording(true);
  }

  function stopVoiceAttempt() {
    if (!pronunciationSession.current || !isRecording) return;
    pronunciationSession.current.stopRecording();
    setIsRecording(false);
  }

  function startVoiceAttemptWithPointerCapture(event: ReactPointerEvent<HTMLButtonElement>) {
    if ((!activeCommand && !activeConversation) || !pronunciationSession.current) return;
    // Su yields the floor the moment the player wants to speak — if her
    // recorded prompt + coaching line is still playing, cut it here.
    stopSuPlayback();
    const pointerId = event.pointerId;
    event.currentTarget.setPointerCapture(pointerId);
    pressedSpeakPointers.current.add(pointerId);
    startVoiceAttempt(pronunciationSession.current);
  }

  function stopVoiceAttemptWithPointerCapture(event: ReactPointerEvent<HTMLButtonElement>) {
    pressedSpeakPointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    stopVoiceAttempt();
  }

  /**
   * Advance past the currently active prompt without requiring a passing
   * voice verdict — the rescue path for players with mic problems (denied
   * permissions, broken hardware, noisy environment) or for accessibility
   * reasons. Mirrors the verdict-pass branch in `connectVoiceCoach` so the
   * downstream state transitions stay consistent:
   *
   *   - If a conversation turn is active, advance to the next turn (or
   *     complete the conversation).
   *   - Else if a command is active and it carries a conversation, start it.
   *   - Else execute the command normally (collect inventory, fire
   *     completion, etc.).
   *
   * The skip is also tracked: the player sees a count in the Su panel so
   * they know the system noticed.
   */
  function skipActivePrompt() {
    if (stageComplete) return;
    const pendingConversation = activeConversationRef.current;
    const pendingCommand = activeCommandRef.current;
    if (!pendingConversation && !pendingCommand) return;

    // If the mic was in the middle of recording, stop cleanly so the
    // session doesn't hold an open audio buffer after the skip.
    if (isRecording) stopVoiceAttempt();
    // Cut Su's recorded prompt too — the player has decided to move on.
    stopSuPlayback();

    // Skipping while reviewing a prior phrase just exits review and snaps
    // back to the live turn — it should not advance the conversation,
    // because nothing happened on the live turn yet.
    if (reviewTurnIndexRef.current !== null) {
      setReviewTurnIndex(null);
      setVerdict(null);
      setVoiceError('');
      setVoiceStatus('Review skipped. Hold to continue the current phrase.');
      return;
    }

    setSkipCount((current) => current + 1);
    setVerdict(null);
    setVoiceError('');
    setVoiceStatus('Skipped this phrase. The action succeeds anyway.');

    if (pendingConversation) {
      advanceConversation(pendingConversation, 'skipped');
      return;
    }
    if (pendingCommand) {
      if (pendingCommand.command.conversationId && pendingCommand.command.conversation?.length) {
        startConversation(pendingCommand);
        return;
      }
      executeCommand(pendingCommand);
    }
  }

  /**
   * No-mic confirm — the primary advance action when voiceMode is 'no-mic'.
   * Mechanically identical to skipActivePrompt but does NOT tally as a skip
   * (in no-mic mode this IS the expected interaction, not a rescue) and
   * reports a neutral "confirmed" status so the Su panel reads as success
   * rather than "Skipped this phrase".
   */
  function confirmNoMicPrompt() {
    if (stageComplete) return;
    const pendingConversation = activeConversationRef.current;
    const pendingCommand = activeCommandRef.current;
    if (!pendingConversation && !pendingCommand) return;

    stopSuPlayback();
    if (reviewTurnIndexRef.current !== null) {
      setReviewTurnIndex(null);
    }
    setVerdict(null);
    setVoiceError('');
    setVoiceStatus('Confirmed without mic. The action succeeds.');

    if (pendingConversation) {
      advanceConversation(pendingConversation);
      return;
    }
    if (pendingCommand) {
      if (pendingCommand.command.conversationId && pendingCommand.command.conversation?.length) {
        startConversation(pendingCommand);
        return;
      }
      executeCommand(pendingCommand);
    }
  }

  /**
   * Drop into review mode on the turn before the live one. The cue card
   * + judge target that phrase for ONE attempt (verdict handler resets
   * reviewTurnIndex regardless of pass/fail), then play returns to the
   * live turn. Mirrors the legacy battle 'Try Previous Phrase Again'.
   * Disabled when there is no active conversation, no prior turn, the
   * stage is already complete, or the player is mid-recording.
   */
  function tryPreviousPhrase() {
    if (stageComplete) return;
    const conversation = activeConversationRef.current;
    if (!conversation) return;
    if (conversation.turnIndex <= 0) return;
    if (isRecording) stopVoiceAttempt();
    stopSuPlayback();
    setReviewTurnIndex(conversation.turnIndex - 1);
    setVerdict(null);
    setVoiceError('');
    setVoiceStatus('Review mode — say the previous phrase once to practice.');
  }

  function startConversation({ hotspot, command }: ActiveCommand, initialTurnIndex = 0) {
    // Social-duel route: when the command names a battle encounter, stage the
    // turn-based fight instead of the scrolling conversation. Victory marks
    // the same conversationId, so gating/completion logic stays identical.
    if (command.battleEncounterId) {
      const encounterConfig = getBattleEncounter(command.battleEncounterId);
      if (encounterConfig) {
        stopSuPlayback();
        setActiveCommand(null);
        setActiveConversation(null);
        setIsHudMenuOpen(false);
        setVerdict(null);
        setVoiceError('');
        setMessage(`${hotspot.label} squares up. The conversation becomes a duel.`);
        setActiveBattle({ hotspot, command, encounter: encounterConfig });
        return;
      }
    }
    if (!command.conversationId || !command.conversation?.length) {
      executeCommand({ hotspot, command });
      return;
    }
    const safeStart = Math.max(0, Math.min(initialTurnIndex, command.conversation.length - 1));
    const nextConversation = {
      hotspot,
      command,
      conversationId: command.conversationId,
      turnIndex: safeStart,
    };
    const firstTurn = command.conversation[safeStart];
    setActiveCommand(null);
    setActiveConversation(nextConversation);
    setIsHudMenuOpen(false);
    setVerdict(null);
    setVoiceError('');
    setVoiceStatus(
      hasVoiceCoach
        ? 'Conversation response ready. Hold to answer in Thai.'
        : 'Connect the AI mic when you are ready.',
    );
    setMessage(`${firstTurn.npcSpeaker}: ${firstTurn.npcEnglish} Say: ${firstTurn.response.romanization}`);
    const refs = sceneRefs.current;
    void refs?.loadPatrickAction('talk').then((loaded) => {
      if (loaded) refs.playPatrickAction('talk', 0.14);
    });
    playHotspotNpcAnimation(hotspot, 'talk');
  }

  function completeCurrentStage() {
    setStageComplete(true);
    setVoiceStatus(config.completionMessage);
    const refs = sceneRefs.current;
    void refs?.loadPatrickAction('victory').then((loaded) => {
      if (loaded) refs.playPatrickAction('victory', 0.16);
    });
  }

  // Battle victory — mirror the conversation-completion path exactly, so the
  // hostess gating, recap card, and completesAdventure flow all work whether
  // the player talked or duelled.
  function handleBattleVictory(spoils?: BattleSpoils) {
    const battle = activeBattle;
    if (!battle) return;
    const { hotspot, command } = battle;
    setActiveBattle(null);
    if (spoils) {
      stageSpoilsRef.current = {
        xp: stageSpoilsRef.current.xp + spoils.xp,
        baht: stageSpoilsRef.current.baht + spoils.baht,
        equipment: spoils.equipmentLabel
          ? [...stageSpoilsRef.current.equipment, spoils.equipmentLabel]
          : stageSpoilsRef.current.equipment,
        level: spoils.level,
      };
    }
    if (command.conversationId) {
      setCompletedConversations((current) =>
        current.includes(command.conversationId!) ? current : [...current, command.conversationId!],
      );
    }
    // Mirror executeCommand's reward path — a duel that "gives" an item (the
    // vendor handing over the plate) must stock the inventory the same way.
    if (command.givesItem) {
      setInventory((current) =>
        current.includes(command.givesItem!) ? current : [...current, command.givesItem!],
      );
    }
    setMessage(command.conversationCompleteText ?? command.successText);
    setVoiceStatus('Duel won. Continue the stage.');
    sceneRefs.current?.playPatrickAction('idle', 0.18);
    playHotspotNpcAnimation(hotspot);
    if (sceneRefs.current) sceneRefs.current.conversationAnchor = null;
    // Seed the Stage Clear recap from the command's lesson turns (same rule
    // as conversation completion: the explicit drill wins; an apply-it duel
    // only seeds if nothing better was captured).
    const turns = command.conversation ?? [];
    if (command.recapDrill) {
      setClearedTurns(turns);
    } else if (command.completesAdventure) {
      setClearedTurns((prev) => (prev.length ? prev : turns));
    }
    if (command.completesAdventure) {
      completeCurrentStage();
    } else if (command.entersRoom) {
      window.setTimeout(() => enterRoom(command.entersRoom!), 260);
    }
  }

  function handleBattleExit() {
    setActiveBattle(null);
    setMessage('You step back from the duel. Talk again when you are ready.');
  }

  // Re-point the VR HUD dispatch refs at the current-render closures every
  // render, so a controller-ray button press runs the same handler the DOM HUD
  // would — with the latest state captured. (Bridge pattern, like
  // selectHotspotRef/moveToRef above.)
  vrSelectCommandRef.current = selectCommand;
  vrStartVoiceRef.current = () => {
    // Mirror the pointer-capture press: yield Su's voice, then record.
    stopSuPlayback();
    startVoiceAttempt();
  };
  vrStopVoiceRef.current = stopVoiceAttempt;
  vrSkipRef.current = skipActivePrompt;
  vrConfirmNoMicRef.current = confirmNoMicPrompt;
  vrConnectMicRef.current = () => void connectVoiceCoach();
  vrContinueRef.current = () => onComplete?.();
  vrAdvanceIntroRef.current = () => advanceStageIntro();
  vrToggleMusicRef.current = () => {
    const current = getSoundSettings();
    saveSoundSettings({ ...current, musicEnabled: !current.musicEnabled });
  };
  vrCycleVoiceRef.current = () => {
    // VR keeps it to the two key-free modes; Realtime needs a pasted API key
    // that there's no way to enter in-headset.
    const next: VoiceJudgeMode = voiceMode === 'no-mic' ? 'whisper' : 'no-mic';
    setVoiceMode(next);
    saveVoiceJudgeMode(next);
  };
  vrCycleTutorRef.current = () => {
    const order: TutoringLevel[] = ['easy', 'medium', 'hard'];
    const next = order[(order.indexOf(tutorLevel) + 1) % order.length];
    setTutorLevel(next);
    saveTutoringLevel(next);
  };
  vrReturnTitleRef.current = () => {
    void sceneRefs.current?.renderer.xr.getSession()?.end();
    returnToTitle();
  };
  vrSkipIntroMovieRef.current = () => dismissIntroMovie();

  // Keep a stable indirection to the latest surface-sync closure so the
  // once-bound WebXR session handlers can call it with current state.
  syncXRSurfacesRef.current = syncXRSurfaces;
  function syncXRSurfaces() {
    const refs = sceneRefs.current;
    if (!refs) return;
    const presenting = xrPresentingRef.current;
    // Lazily build the cinema the first time the intro <video> exists.
    if (isIntroMovieActive && introVideoElRef.current && !refs.xrCinema) {
      const cinema = createXRCinema(introVideoElRef.current);
      refs.playerRig.add(cinema.group);
      refs.xrCinema = cinema;
    }
    // While the pre-roll plays, the cinema owns the view and the HUD hides so
    // its near panel can't overlap the screen. Once the movie is done, the HUD
    // takes over (and carries the VN intro line).
    refs.xrCinema?.setVisible(presenting && isIntroMovieActive);
    if (refs.xrHud) refs.xrHud.group.visible = presenting && !isIntroMovieActive;
  }

  function advanceConversation(conversation: ActiveConversation, result: PhraseResult = 'confirmed') {
    const turns = conversation.command.conversation ?? [];
    const currentTurn = turns[conversation.turnIndex];
    const nextTurnIndex = conversation.turnIndex + 1;
    const nextTurn = turns[nextTurnIndex];

    // Record how the player did on the phrase they just cleared, so the Stage
    // Clear recap can show per-phrase mastery. Re-attempts only ever improve
    // the record (see rankResult in stageClear.ts).
    if (currentTurn) {
      setPhraseResults((prev) => applyResult(prev, currentTurn.id, result));
    }

    if (nextTurn) {
      setActiveConversation({ ...conversation, turnIndex: nextTurnIndex });
      // Persist the cursor so click-away-then-click-back resumes here.
      setConversationProgress((prev) => ({ ...prev, [conversation.conversationId]: nextTurnIndex }));
      setVerdict(null);
      setMessage(
        `${currentTurn?.successText ?? 'Good response.'} ${nextTurn.npcSpeaker}: ${nextTurn.npcEnglish} Say: ${nextTurn.response.romanization}`,
      );
      setVoiceStatus('Next conversation response ready. Hold to answer in Thai.');
      return;
    }

    setCompletedConversations((current) =>
      current.includes(conversation.conversationId) ? current : [...current, conversation.conversationId],
    );
    // Conversation finished — drop the saved cursor (it's no longer needed,
    // and keeping it could mislead future resume logic if the same
    // conversationId is somehow reused).
    setConversationProgress((prev) => {
      if (!(conversation.conversationId in prev)) return prev;
      const { [conversation.conversationId]: _removed, ...rest } = prev;
      return rest;
    });
    setActiveConversation(null);
    setActiveCommand(null);
    setMessage(conversation.command.conversationCompleteText ?? conversation.command.successText);
    setVoiceStatus('Conversation complete. Continue the stage.');
    sceneRefs.current?.playPatrickAction('idle', 0.18);
    playHotspotNpcAnimation(conversation.hotspot);
    // Conversation done — release the two-shot anchor so the camera target
    // can drift back to the normal player-bias point.
    if (sceneRefs.current) sceneRefs.current.conversationAnchor = null;

    // Snapshot the phrase list for the Stage Clear mastery recap. The explicit
    // lesson drill wins; otherwise the completing conversation seeds the recap
    // only if nothing better was captured (so a short "apply it" exchange that
    // completes the stage can't overwrite the full lesson list).
    if (conversation.command.recapDrill) {
      setClearedTurns(turns);
    } else if (conversation.command.completesAdventure) {
      setClearedTurns((prev) => (prev.length ? prev : turns));
    }

    if (conversation.command.completesAdventure) {
      completeCurrentStage();
    }
  }

  function executeCommand({ hotspot, command }: ActiveCommand) {
    if (command.givesItem) {
      setInventory((current) =>
        current.includes(command.givesItem!) ? current : [...current, command.givesItem!],
      );
    }
    setMessage(command.successText);
    playCommandCharacterVoice(hotspot, command);
    if (command.verb !== 'talk') {
      sceneRefs.current?.playPatrickAction('idle', 0.18);
      playHotspotNpcAnimation(hotspot);
    }
    if (command.completesAdventure) {
      completeCurrentStage();
    }
    // Overworld portal — once the destination phrase lands, travel to that
    // stage. Brief delay so the success line registers before the scene swaps.
    if (command.entersStageIndex !== undefined && onEnterStage) {
      const targetIndex = command.entersStageIndex;
      window.setTimeout(() => onEnterStage(targetIndex), 480);
    }
  }

  // Per-stage accent color flows through every adventure-3d-* utility via CSS vars.
  const accentHex = colorToCss(config.ambiance.rimColor);
  const shellStyle = {
    '--adv-accent': accentHex,
    '--adv-accent-soft': withAlpha(config.ambiance.rimColor, 0.34),
    '--adv-accent-glow': withAlpha(config.ambiance.rimColor, 0.46),
  } as CSSProperties;

  return (
    <main
      className={`adventure-3d-shell relative h-dvh min-h-dvh w-screen overflow-hidden bg-slate-950 text-white lg:min-h-[620px] ${
        trailerFlags.hideHud ? 'adventure-3d-shell--no-hud' : ''
      } ${isLocationView ? 'adventure-3d-shell--location-view' : ''}`}
      style={shellStyle}
    >
      <div ref={mountRef} className="absolute inset-0" aria-label={`${config.title} 3D viewport`} />

      {/* Vignette + subtle accent glow on top of canvas */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 0%, ${withAlpha(config.ambiance.rimColor, 0.18)}, transparent 36%), linear-gradient(180deg, rgba(2,6,23,0.04), rgba(2,6,23,0.55))`,
        }}
      />

      {/* Pronunciation score flash — re-uses the BattleHUD treatment */}
      {pronunciationFlash ? (
        <div
          key={pronunciationFlash.id}
          className={`pronunciation-score-flash pronunciation-score-flash--${pronunciationFlash.tone}`}
          style={{ top: '5.5rem' }}
          aria-live="polite"
        >
          <span className="pronunciation-score-flash__label">{pronunciationFlash.label}</span>
          <span className="pronunciation-score-flash__detail">{pronunciationFlash.detail}</span>
        </div>
      ) : null}

      {/* Load overlay — premium spinner over the scene until GLB + room
          are ready. Hides only after a) all milestones flipped and b) the
          900ms min-display timer elapsed (prevents the strobe on fast
          machines). Hidden immediately while the intro movie is playing
          because the movie itself is the loading screen at that point. */}
      <div
        className={`adventure-3d-load-overlay ${
          canHideLoadOverlay || isIntroMovieActive ? 'adventure-3d-load-overlay--hidden' : ''
        }`}
        aria-live="polite"
        aria-busy={!canHideLoadOverlay}
      >
        <div className="flex flex-col items-center gap-3">
          {/* Chapter card — turns the between-stage load into a scene break. */}
          {config.chapterTitle ? (
            <p className="adventure-3d-load-chapter">{config.chapterTitle}</p>
          ) : null}
          <div className="adventure-3d-load-spinner" />
          <p className="adventure-3d-load-label">{config.badge}</p>
          <p className="adventure-3d-load-sublabel">{config.title}</p>
          {config.loadingTagline ? (
            <p className="adventure-3d-load-tagline">{config.loadingTagline}</p>
          ) : (
            <p className="adventure-3d-load-tagline">Bringing the scene online…</p>
          )}
          <ul className="adventure-3d-load-checklist" aria-label="Loading progress">
            <li className={patrickLoaded ? 'is-done' : ''}>
              <span aria-hidden="true">{patrickLoaded ? '✓' : '·'}</span>
              <span>{patrickLoaded ? 'Patrick rig ready' : 'Loading Patrick rig'}</span>
            </li>
            <li className={roomBuilt ? 'is-done' : ''}>
              <span aria-hidden="true">{roomBuilt ? '✓' : '·'}</span>
              <span>{roomBuilt ? 'Room geometry built' : 'Building room geometry'}</span>
            </li>
            <li className={minDisplayElapsed ? 'is-done' : ''}>
              <span aria-hidden="true">{minDisplayElapsed ? '✓' : '·'}</span>
              <span>{minDisplayElapsed ? 'Voice coach armed' : 'Arming voice coach'}</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Header — stage badge + room nav. Tighter than before and uses the per-stage accent. */}
      <header className="adventure-3d-topbar pointer-events-none absolute left-3 right-3 top-3 z-30 flex flex-wrap items-start justify-between gap-3 sm:left-6 sm:right-6 sm:top-5">
        <div className="adventure-3d-header pointer-events-auto max-w-sm px-3 py-2">
          <div className="flex items-center gap-1.5">
            <span className="adventure-3d-badge">{config.badge}</span>
            <span className="adventure-3d-badge" title={`${progression.xp} XP earned`}>
              Lv {progression.level} · ฿{progression.baht}
            </span>
          </div>
          <p className="mt-1 text-base font-black leading-tight text-white sm:text-lg">{room.title}</p>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/60">
            {config.subtitle}
          </p>
        </div>
        {config.rooms.length > 1 ? (
          <nav className="adventure-3d-room-nav pointer-events-auto flex gap-1 p-1" aria-label="Stage rooms">
            {config.rooms.map((nextRoom) => (
              <button
                key={nextRoom.id}
                type="button"
                onClick={() => enterRoom(nextRoom.id)}
                className={`adventure-3d-room-pill ${nextRoom.id === roomId ? 'adventure-3d-room-pill--active' : ''}`}
              >
                {nextRoom.shortTitle}
              </button>
            ))}
          </nav>
        ) : null}
      </header>

      {/* Objective banner — pinned top-center, telegraphs the current beat */}
      <div className="adventure-3d-objective-wrap pointer-events-none absolute left-1/2 top-[5rem] z-25 -translate-x-1/2 sm:top-[5.5rem]">
        <div className="adventure-3d-objective">
          <span className="adventure-3d-objective__eyebrow">
            {selectedHotspot?.label ?? 'Stage Objective'}
          </span>
          <span className="adventure-3d-objective__text">{message}</span>
        </div>
      </div>

      {showContextualActions && selectedHotspot ? (
        <section
          className="adventure-3d-context-actions pointer-events-auto"
          aria-label={`${selectedHotspot.label} actions`}
        >
          <div className="adventure-3d-context-actions__label">
            <span>{selectedHotspot.label}</span>
            <small>{selectedHotspot.kind}</small>
          </div>
          <div className="adventure-3d-context-actions__buttons">
            {contextualActions.map((action) => (
              <button
                key={action.verb}
                type="button"
                onClick={() => selectCommand(action.verb)}
                className={`adventure-3d-context-action ${
                  action.blocked ? 'adventure-3d-context-action--blocked' : ''
                }`}
                aria-label={`${action.verbLabel}: ${action.label}`}
              >
                <span>{action.label}</span>
                <small>{action.hint}</small>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {hasActiveSpeechPrompt ? (
        <section className="adventure-3d-phrase-bar pointer-events-auto" aria-label="Phrase practice">
          <div className="adventure-3d-phrase-card">
            {activeConversation && activeConversationTurn ? (
              <>
                <span className="adventure-3d-phrase-card__eyebrow">
                  {activeConversationTurn.npcSpeaker} - {activeConversationProgress}
                </span>
                <p className="adventure-3d-phrase-card__npc">{activeConversationTurn.npcEnglish}</p>
                <p className="adventure-3d-phrase-card__thai">
                  {activeConversationTurn.response.targetPhrase}
                </p>
                <p className="adventure-3d-phrase-card__roman">
                  {activeConversationTurn.response.romanization}
                </p>
                <p className="adventure-3d-phrase-card__translation">
                  {activeConversationTurn.response.translation}
                </p>
              </>
            ) : activeCommand ? (
              <>
                <span className="adventure-3d-phrase-card__eyebrow">{activeCommand.command.label}</span>
                <p className="adventure-3d-phrase-card__thai">{activeCommand.command.targetPhrase}</p>
                <p className="adventure-3d-phrase-card__roman">{activeCommand.command.romanization}</p>
                <p className="adventure-3d-phrase-card__translation">
                  {activeCommand.command.translation}
                </p>
              </>
            ) : null}
          </div>

          <div className="adventure-3d-phrase-actions">
            {voiceMode === 'no-mic' ? (
              <button
                type="button"
                onClick={confirmNoMicPrompt}
                className="adventure-3d-mic adventure-3d-phrase-actions__primary"
                aria-label="Confirm phrase and continue"
              >
                {activeConversation ? 'Confirm & Continue' : 'Confirm Phrase'}
                <span className="adventure-3d-mic__hint">
                  {activeSpeechRomanization ?? 'Read the prompt'}
                </span>
              </button>
            ) : hasVoiceCoach ? (
              <button
                type="button"
                onPointerDown={startVoiceAttemptWithPointerCapture}
                onPointerUp={stopVoiceAttemptWithPointerCapture}
                onPointerCancel={stopVoiceAttemptWithPointerCapture}
                disabled={isConnecting}
                className={`adventure-3d-mic adventure-3d-phrase-actions__primary ${
                  isRecording ? 'adventure-3d-mic--recording' : ''
                }`}
              >
                {isRecording ? 'Release To Judge' : activeConversation ? 'Hold To Answer' : 'Hold To Speak'}
                <span className="adventure-3d-mic__hint">
                  {activeSpeechRomanization ?? 'Say the Thai phrase'}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void connectVoiceCoach()}
                disabled={isConnecting}
                className="adventure-3d-connect adventure-3d-phrase-actions__primary"
              >
                {isConnecting ? 'Connecting' : `Connect ${voiceMode === 'whisper' ? 'Whisper' : 'Realtime'} Mic`}
              </button>
            )}

            <button
              type="button"
              onClick={skipActivePrompt}
              className="adventure-3d-room-pill text-center"
              title="Advance past this phrase without speaking."
            >
              Skip
            </button>
            <button
              type="button"
              onClick={tryPreviousPhrase}
              disabled={!activeConversation || activeConversation.turnIndex <= 0 || isReviewing}
              className="adventure-3d-room-pill text-center"
              title="Re-practice the previous phrase once."
            >
              Review
            </button>
            <button
              type="button"
              onClick={() => setIsHudMenuOpen((current) => !current)}
              className="adventure-3d-room-pill text-center"
              aria-expanded={isHudMenuOpen}
              aria-controls="adventure-3d-action-panel"
            >
              {isHudMenuOpen ? 'Hide Details' : 'Details'}
            </button>
          </div>
        </section>
      ) : null}

      {/* Stage completion celebration. Two distinct paths:
          - Final stage of the tech demo (scenarioNumber === playable count):
            full DemoEndSplash with phrase roll, feedback CTA, credits.
          - Any earlier stage: a compact Stage Clear prompt that waits for
            the player to explicitly proceed into the next level. */}
      {stageComplete ? (
        config.scenarioNumber >= TECH_DEMO_PLAYABLE_STAGE_COUNT ? (
          <DemoEndSplash onReplay={() => onReturnToOverworld?.()} onContinue={() => onComplete?.()} />
        ) : (
          <StageClearPayoff
            scenarioNumber={config.scenarioNumber}
            completionMessage={config.completionMessage}
            turns={clearedTurns}
            results={phraseResults}
            spoils={stageSpoilsRef.current}
            onProceed={() => onComplete?.()}
          />
        )
      ) : null}

      {/* Collapsible action HUD */}
      <section
        id="adventure-3d-action-panel"
        className={`adventure-3d-panel pointer-events-auto absolute inset-x-3 top-[10rem] z-50 grid max-h-[min(17rem,40dvh)] gap-2 overflow-y-auto p-2.5 text-white sm:inset-x-6 sm:top-[10.8rem] sm:grid-cols-[minmax(0,1fr)_minmax(11.5rem,0.55fr)_minmax(15rem,0.72fr)] sm:p-3 lg:inset-x-10 ${
          isHudMenuOpen ? 'adventure-3d-panel--hud-open' : ''
        }`}
      >
        {/* COLUMN 1 — verbs + command card */}
        <div className="min-w-0">
          <div className="grid grid-cols-4 gap-1.5">
            {adventureVerbs.map((verb) => {
              const command = selectedHotspot?.commands[verb.id] ?? null;
              const missing = command ? getMissing(inventory, command.requiresItems) : [];
              const disabled = !selectedHotspot || !command || stageComplete;
              const blocked = missing.length > 0;
              const isActive =
                activeCommand !== null &&
                activeCommand.hotspot.id === selectedHotspot?.id &&
                activeCommand.command.verb === verb.id;
              return (
                <button
                  key={verb.id}
                  type="button"
                  onClick={() => selectCommand(verb.id)}
                  disabled={disabled}
                  className={`adventure-3d-verb ${isActive ? 'adventure-3d-verb--active' : ''} ${blocked && !isActive ? 'adventure-3d-verb--blocked' : ''}`}
                >
                  <span>{verb.label}</span>
                  <span className="adventure-3d-verb__hint">
                    {command ? (blocked ? 'need item' : command.label) : 'n/a'}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="adventure-3d-card adventure-3d-card--cue mt-2.5">
            {activeConversation && activeConversationTurn ? (
              <>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="adventure-3d-card__eyebrow">
                    {activeConversationTurn.npcSpeaker} · {activeConversationProgress}
                  </span>
                  <span className="text-[9px] font-black uppercase tracking-[0.14em] text-white/56">
                    Listen
                  </span>
                </div>
                <p className="text-base font-black leading-tight text-white">
                  {activeConversationTurn.npcLineThai}
                </p>
                <p className="text-xs font-black leading-tight" style={{ color: accentHex }}>
                  {activeConversationTurn.npcRomanization}
                </p>
                <p className="mt-1 text-xs font-bold leading-snug text-white/72">
                  {activeConversationTurn.npcEnglish}
                </p>
                <div
                  className="my-2 h-px w-full"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${withAlpha(config.ambiance.rimColor, 0.5)}, transparent)`,
                  }}
                />
                <span className="adventure-3d-card__eyebrow" style={{ color: '#fde68a' }}>
                  Patrick responds
                </span>
                <p className="mt-1 text-base font-black leading-tight text-white sm:text-lg">
                  {activeConversationTurn.response.targetPhrase}
                </p>
                <p className="text-sm font-black leading-tight" style={{ color: accentHex }}>
                  {activeConversationTurn.response.romanization}
                </p>
                <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-white/60">
                  Phonetic · {activeConversationTurn.response.phoneticSpelling}
                </p>
                <p className="mt-1 text-xs font-bold leading-snug text-white/78">
                  {activeConversationTurn.response.translation}
                </p>
              </>
            ) : activeCommand ? (
              <>
                <span className="adventure-3d-card__eyebrow">Say it</span>
                <p className="mt-1 text-base font-black leading-tight text-white sm:text-lg">
                  {activeCommand.command.targetPhrase}
                </p>
                <p className="text-sm font-black leading-tight" style={{ color: accentHex }}>
                  {activeCommand.command.romanization}
                </p>
                <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-white/60">
                  Phonetic · {activeCommand.command.phoneticSpelling}
                </p>
                <p className="mt-1 text-xs font-bold leading-snug text-white/78">
                  {activeCommand.command.translation}
                </p>
              </>
            ) : (
              <p className="text-sm font-bold leading-snug text-white/72">
                {voiceMode === 'no-mic'
                  ? 'Tap a person, item, or prop in the 3D scene, choose a verb, then read the Thai and confirm.'
                  : 'Tap a person, item, or prop in the 3D scene, choose a verb, then hold the mic to say the Thai sentence.'}
              </p>
            )}
          </div>
        </div>

        {/* COLUMN 2 — inventory + mic controls */}
        <div className="grid min-w-0 content-start gap-2">
          {requiredCount > 0 ? (
            <div className="adventure-3d-card">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="adventure-3d-card__eyebrow">Inventory</span>
                <span className="text-[10px] font-black uppercase tracking-[0.1em] text-white/68">
                  {inventoryCount}/{requiredCount}
                </span>
              </div>
              <div className="grid gap-1">
                {config.requiredInventory.map((itemId) => {
                  const item = config.inventoryItems[itemId];
                  if (!item) return null;
                  const collected = inventory.includes(itemId);
                  return (
                    <div
                      key={itemId}
                      className={`adventure-3d-inventory-item ${collected ? 'adventure-3d-inventory-item--collected' : ''}`}
                    >
                      {item.sprite ? (
                        <img src={item.sprite} alt="" className="h-7 w-7 object-contain" draggable={false} />
                      ) : (
                        <span className="adventure-3d-inventory-item__icon-empty" />
                      )}
                      <span className="truncate">{item.label}</span>
                      {collected ? <span className="adventure-3d-inventory-item__check">✓</span> : <span />}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {voiceMode === 'no-mic' ? (
            // No-mic mode: the player isn't using a microphone at all. The
            // mic UI collapses to a single primary "Confirm Phrase" button
            // that reads the cue card and advances. Same advance flow as
            // Skip but without tallying as a skip — in no-mic mode the
            // confirm IS the expected interaction, not a rescue.
            <button
              type="button"
              onClick={confirmNoMicPrompt}
              disabled={(!activeCommand && !activeConversation) || stageComplete}
              className="adventure-3d-mic"
              aria-label="Confirm phrase and continue"
            >
              {activeConversation ? 'Confirm & Continue' : 'Confirm Phrase'}
              <span className="adventure-3d-mic__hint">
                {activeSpeechRomanization
                  ? `Read aloud (optional): ${activeSpeechRomanization}`
                  : 'Choose a command first'}
              </span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void connectVoiceCoach()}
                disabled={isConnecting || hasVoiceCoach}
                className="adventure-3d-connect"
              >
                {hasVoiceCoach
                  ? `${voiceMode === 'whisper' ? 'Whisper' : 'Realtime'} Connected`
                  : `Connect ${voiceMode === 'whisper' ? 'Whisper' : 'Realtime'} Mic`}
              </button>

              <button
                type="button"
                onPointerDown={startVoiceAttemptWithPointerCapture}
                onPointerUp={stopVoiceAttemptWithPointerCapture}
                onPointerCancel={stopVoiceAttemptWithPointerCapture}
                disabled={
                  (!activeCommand && !activeConversation) || !hasVoiceCoach || isConnecting || stageComplete
                }
                className={`adventure-3d-mic ${isRecording ? 'adventure-3d-mic--recording' : ''}`}
              >
                {isRecording ? 'Release To Judge' : activeConversation ? 'Hold To Answer' : 'Hold To Speak'}
                <span className="adventure-3d-mic__hint">
                  {activeSpeechRomanization ?? 'Choose a command first'}
                </span>
              </button>
            </>
          )}

          {/* Skip — the rescue button. Available whenever a prompt is queued
              up, regardless of whether the mic is connected. Players with
              broken mics, denied permissions, or noisy rooms can still
              finish the stage. Skips are tallied (see skipCount in the Su
              judge panel) so the player knows the system noticed. */}
          <button
            type="button"
            onClick={skipActivePrompt}
            disabled={(!activeCommand && !activeConversation) || stageComplete}
            className="adventure-3d-room-pill text-center"
            title="Advance past this phrase without speaking — useful if your mic is acting up."
          >
            Skip Phrase
            <span className="adventure-3d-mic__hint">Mic issues? Move on.</span>
          </button>

          {/* Try Previous Phrase — review affordance. Steps back one turn
              for a single practice attempt, then auto-returns to the live
              turn. Only meaningful when a multi-turn conversation is in
              progress AND the player has already advanced past turn 0. */}
          <button
            type="button"
            onClick={tryPreviousPhrase}
            disabled={
              !activeConversation || activeConversation.turnIndex <= 0 || stageComplete || isReviewing
            }
            className="adventure-3d-room-pill text-center"
            title="Re-practice the previous phrase once without losing your place."
          >
            {isReviewing ? 'Reviewing…' : 'Try Previous Phrase'}
            <span className="adventure-3d-mic__hint">
              {isReviewing ? 'One attempt then resume' : 'Reinforce the last turn'}
            </span>
          </button>

          {onReturnToOverworld && !stageComplete ? (
            <button
              type="button"
              onClick={onReturnToOverworld}
              className="adventure-3d-room-pill text-center"
            >
              Return To Map
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => {
              setIsHudMenuOpen(false);
              setIsLocationView(true);
            }}
            className="adventure-3d-room-pill text-center"
            title="Hide the HUD so you can view the location."
          >
            View Location
            <span className="adventure-3d-mic__hint">Hide all HUD views</span>
          </button>
        </div>

        {/* COLUMN 3 — Su judge panel */}
        <details className="adventure-3d-drawer min-w-0" open={Boolean(verdict || voiceError || isRecording)}>
          <summary className="adventure-3d-drawer__summary">Su Coach</summary>
          <SuPronunciationJudge
            hasVoiceCoach={hasVoiceCoach}
            isConnecting={isConnecting}
            isRecording={isRecording}
            verdict={verdict}
            voiceError={voiceError}
            voiceStatus={voiceStatus}
            stageComplete={stageComplete}
            skipCount={skipCount}
            voiceMode={voiceMode}
          />
        </details>
      </section>

      {!stageComplete ? (
        <div className="adventure-3d-mobile-dock pointer-events-auto">
          <button
            type="button"
            onClick={() => setIsHudMenuOpen((current) => !current)}
            className="adventure-3d-mobile-dock__primary"
            aria-expanded={isHudMenuOpen}
            aria-controls="adventure-3d-action-panel"
          >
            <span>{isHudMenuOpen ? 'Close' : 'Menu'}</span>
            <span className="adventure-3d-mobile-dock__hint">{hudMenuSummary}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setIsHudMenuOpen(false);
              setIsLocationView(true);
            }}
            className="adventure-3d-mobile-dock__view"
            aria-label="View location without HUD"
          >
            View
          </button>
        </div>
      ) : null}

      {/* Auto-hiding hint strip — visible until first interaction. Hidden while
          the intro dialogue is active so the bubble has the whole bottom strip. */}
      <div
        className={`adventure-3d-hint-strip ${hintsDismissed || !isIntroComplete ? 'adventure-3d-hint-strip--hidden' : ''}`}
      >
        <span>Tap floor to move</span>
        <span>Tap hotspots</span>
        <span>Pinch or scroll to zoom</span>
      </div>

      {/* Su voiceover captions — pinned mid-bottom so they read above the
          action panel but well below the hotspot ring. Only renders when
          captions are enabled in Settings AND there is line text actively
          playing. Decorated as a subtle film-caption strip rather than a
          UI chip so it disappears into the scene when nothing's playing
          and reads quickly when something is. */}
      {soundSettings.captionsEnabled && playbackCaption ? (
        <div
          aria-live="polite"
          className="pointer-events-none absolute inset-x-3 bottom-6 z-[45] flex justify-center sm:inset-x-12 sm:bottom-8 lg:inset-x-20"
        >
          <div className="max-w-3xl rounded-md border border-white/10 bg-black/70 px-4 py-2 text-center text-sm font-medium leading-relaxed text-white/95 shadow-lg backdrop-blur-sm sm:text-base">
            {playbackCaption}
          </div>
        </div>
      ) : null}

      {isLocationView && !trailerFlags.hideHud ? (
        <button
          type="button"
          onClick={() => setIsLocationView(false)}
          className="adventure-3d-restore-hud"
          aria-label="Show HUD"
          title="Show HUD (Esc or H)"
        >
          HUD
        </button>
      ) : null}

      {/* Per-stage intro dialogue — Patrick reacts then Su walks the player
          through the stage. Reuses the same VN cut-in component as Stage 1
          so the intro reads consistently across the whole game. Gated by
          isIntroMovieDone so the bubble doesn't pop while the pre-roll
          cinematic is still on screen. */}
      {hasIntro && canShowIntroDialogue && !isIntroComplete && currentIntroLine ? (
        <CharacterDebugIntroDialogue
          line={currentIntroLine}
          index={introIndex}
          total={introLines.length}
          isFinalLine={isFinalIntroLine}
          onAdvance={advanceStageIntro}
          progressLabel="Stage intro"
          finalContinueLabel="Tap to start exploring"
        />
      ) : null}

      {/* Pre-roll cinematic. Covers the entire shell while it plays so the
          3D scene and any UI chrome stay hidden. We use a controlled <video>
          (no native controls) plus an explicit Skip button so the rest of
          the design system keeps its visual treatment, and we get a clean
          handoff into the stand-up animation + VN dialogue when the player
          taps Skip or the video reaches the end. */}
      {isIntroMovieActive && config.introVideoUrl ? (
        <div className="pointer-events-auto absolute inset-0 z-[80] grid place-items-center bg-black">
          <video
            src={config.introVideoUrl}
            className="h-full w-full object-contain"
            autoPlay
            playsInline
            preload="auto"
            controls={false}
            onEnded={dismissIntroMovie}
            // Some browsers (notably iOS Safari) reject unmuted autoplay
            // unless the user has interacted with the page; if play() is
            // rejected we still show a Skip button so the player never
            // gets stranded.
            ref={(element) => {
              // Store the element so the VR cinema screen can sample the same
              // playing footage via a VideoTexture.
              introVideoElRef.current = element;
              if (!element) return;
              const promise = element.play();
              if (promise && typeof promise.catch === 'function') {
                promise.catch(() => {
                  // Autoplay blocked — leaving the video paused is fine,
                  // the user will use the Skip button.
                });
              }
            }}
          />
          <div className="adventure-3d-intro-caption pointer-events-none absolute bottom-6 left-6 z-[81] text-left">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/62">
              Loading stage assets
            </p>
            <p className="mt-1 text-sm font-black text-white/88">{config.title}</p>
          </div>
          <button
            type="button"
            onClick={dismissIntroMovie}
            className="adventure-3d-room-pill adventure-3d-intro-skip absolute bottom-6 right-6 z-[81] text-center"
            aria-label="Skip intro video"
          >
            Skip Intro
          </button>
        </div>
      ) : null}

      {/* Turn-based social duel — full-screen overlay above the adventure.
          Lazy-loaded; mounting keyed by encounter id so back-to-back duels
          always start from a fresh battle state. */}
      {activeBattle ? (
        <div
          className="pointer-events-auto absolute inset-0 z-[85] overflow-y-auto bg-[#0A0A0B]"
          data-testid="stage-battle-overlay"
        >
          <Suspense
            fallback={
              <div className="grid h-full place-items-center text-sm font-bold uppercase tracking-[0.2em] text-white/70">
                Entering the duel…
              </div>
            }
          >
            <PhantasyBattleScreen
              key={activeBattle.encounter.id}
              encounter={activeBattle.encounter}
              onVictory={handleBattleVictory}
              onExit={handleBattleExit}
              completesStage={Boolean(activeBattle.command.completesAdventure)}
            />
          </Suspense>
        </div>
      ) : null}
    </main>
  );
}
