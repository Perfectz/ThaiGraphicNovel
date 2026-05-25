import {
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
import { disposeObjectTree } from './three/sceneHelpers';
import { collectColliders, resolveCircleCollision, PLAYER_COLLISION_RADIUS } from './three/collision';
import { patrickAnimationSources, patrickModelAssetUrl, type PatrickAnimationId } from './three/patrickRig';
import type {
  AdventureCommand,
  AdventureHotspot3D,
  AdventureSceneConfig,
  AdventureVerb,
} from '../data/adventures/types';
import {
  getVoiceJudgeMode,
  VOICE_JUDGE_MODE_CHANGED_EVENT,
  type VoiceJudgeMode,
} from '../services/openAiSettings';
import {
  createPronunciationSession,
  type PronunciationPrompt,
  type PronunciationSession,
  type PronunciationVerdict,
} from '../services/realtimePronunciation';
import { createWhisperPronunciationSession } from '../services/whisperPronunciation';
import { SuPronunciationJudge } from './SuPronunciationJudge';
import { CharacterDebugIntroDialogue } from './CharacterDebugIntroDialogue';
import { getStageIntroLines } from '../data/adventures/stageIntros';
import { getStageOneSuAudioSrc, getSuAudioSrc } from '../services/suLineAudio';
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
  createHotspotObject,
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
  isPhoneLandscapeViewport,
  isPhonePortraitViewport,
  ROOM_BOUNDS,
  type CinematicMove,
} from './Stage3DAdventure.camera';

const adventureVerbs: Array<{ id: AdventureVerb; label: string }> = [
  { id: 'look', label: 'Look' },
  { id: 'take', label: 'Take' },
  { id: 'use', label: 'Use' },
  { id: 'talk', label: 'Talk' },
];

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
};

export function Stage3DAdventure({ config, onComplete, onReturnToOverworld }: Stage3DAdventureProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRefs = useRef<SceneRefs | null>(null);
  const roomRef = useRef<string>(config.rooms[0].id);
  const selectHotspotRef = useRef<(hotspot: AdventureHotspot3D) => void>(() => {});
  const moveToRef = useRef<(position: THREE.Vector3) => void>(() => {});
  const completionTimerRef = useRef<number | null>(null);
  const stageIntroAudioRef = useRef<HTMLAudioElement | null>(null);
  const soundSettings = useSoundSettings();
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
  // Per-conversation cursor — saved each time advanceConversation advances.
  // Lets the player click away from an in-progress conversation and click
  // back later to resume at the last unfinished turn instead of restarting
  // at turn 0. Cleared on conversation completion so re-clicks fall
  // through the completedConversations guard above instead.
  const [conversationProgress, setConversationProgress] = useState<Record<string, number>>({});
  const [inventory, setInventory] = useState<string[]>([]);
  const [message, setMessage] = useState(config.rooms[0].description);
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
  const [voiceMode, setVoiceMode] = useState<VoiceJudgeMode>(() => getVoiceJudgeMode());
  const [verdict, setVerdict] = useState<PronunciationVerdict | null>(null);
  // Review mode — when set, the cue card + voice judge target a PRIOR turn
  // of the active conversation instead of the current one. Lets the player
  // re-practice a phrase they already passed. Auto-clears after one attempt
  // (mirrors the legacy battle 'Try Previous Phrase Again' behaviour).
  const [reviewTurnIndex, setReviewTurnIndex] = useState<number | null>(null);
  const reviewTurnIndexRef = useRef<number | null>(null);
  reviewTurnIndexRef.current = reviewTurnIndex;
  const [stageComplete, setStageComplete] = useState(false);
  const [loadStatus, setLoadStatus] = useState(`Loading ${config.title}...`);
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
  const sceneReady = /ready/i.test(loadStatus);
  // Pre-roll cinematic. When the config has an introVideoUrl, the full-screen
  // video overlay becomes the visible loading screen while the Three.js room
  // and assets mount behind it.
  const hasIntroMovie = Boolean(config.introVideoUrl);
  const [isIntroMovieDone, setIsIntroMovieDone] = useState(!hasIntroMovie);
  const isIntroMovieActive = hasIntroMovie && !isIntroMovieDone;
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
  function advanceStageIntro() {
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
  const activeSpeechRomanization =
    activeConversationTurn?.response.romanization ?? activeCommand?.command.romanization;
  const inventoryCount = inventory.length;
  const requiredCount = config.requiredInventory.length;

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

    const camera = new THREE.PerspectiveCamera(52, mount.clientWidth / mount.clientHeight, 0.1, 80);
    // Stage 1 opens with Patrick rising on the left and Su waving on the right.
    // The camera is pulled slightly stage-left and lowered to roughly chest
    // height so both rigs read at full body in the same frame, and there's
    // headroom to orbit and admire either character without snapping past the
    // soft polar/distance limits below.
    camera.position.set(-2.4, 2.7, 8.4);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.className = 'h-full w-full';
    renderer.domElement.dataset.testid = 'stage-3d-adventure-canvas';
    mount.appendChild(renderer.domElement);

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
    scene.add(keyLight);
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

    let disposed = false;
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
              deadAction.timeScale = -1;
              deadAction.play();
              currentAction = deadAction;
              currentPatrickActionId = 'dead';
              // Apply the prone pose immediately so we don't flash the T-pose
              // for a frame before the reverse playback kicks in.
              mixer.update(0);
              setLoadStatus(`${config.title} ready.`);
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
              return;
            }
          }
        }

        playPatrickAction('idle', 0);
        mixer.update(0.016);
        setLoadStatus(`${config.title} ready.`);
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
      },
    );

    function onResize() {
      if (!mountRef.current) return;
      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
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
      const hotspotObjects = Array.from(refs.objectsByHotspot.values());
      const hotspotHit = refs.raycaster
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
      const floorHit = refs.raycaster.intersectObject(floor)[0];
      if (floorHit) {
        moveToRef.current(new THREE.Vector3(floorHit.point.x, 0, floorHit.point.z));
        // Floor click — no NPC to face. Cancel any pending hotspot facing
        // so Patrick stays in his last-travel direction at the new spot.
        refs.playerArrivalFacing = null;
      }
    }

    let lastTime = performance.now();
    let animationFrameId = 0;
    function animate(now: number) {
      if (disposed) return;
      const delta = Math.min(0.04, (now - lastTime) / 1000);
      lastTime = now;
      mixer?.update(delta);
      refs.npcMixers.forEach((npcMixer) => npcMixer.update(delta));
      refs.npcFacingTargets.forEach(({ object, parent }) => {
        const localTarget = refs.playerRoot.position.clone();
        parent.worldToLocal(localTarget);
        faceToward(object, localTarget);
      });

      // Update any per-frame animated children (rift portals, lanterns, particles)
      const elapsed = now / 1000;
      refs.roomGroup.children.forEach((child) => {
        if (child.userData.spin) {
          child.rotation.y += delta * (child.userData.spin as number);
        }
        if (child.userData.bob) {
          const amp = child.userData.bob as number;
          child.position.y =
            (child.userData.baseY as number) +
            Math.sin(elapsed * 1.4 + (child.userData.phase as number)) * amp;
        }
      });

      const target = refs.targetPosition;
      const player = refs.playerRoot;
      const distance = player.position.distanceTo(target);
      if (distance > 0.035) {
        const step = Math.min(distance, delta * 3.2);
        const next = player.position.clone().lerp(target, step / distance);
        // Resolve collision BEFORE committing the new position. If the desired
        // step would land inside an obstacle, the resolver slides Patrick along
        // it; the original `target` stays put so he keeps trying to reach it
        // from a different angle as the player moves the camera.
        resolveCircleCollision(next, PLAYER_COLLISION_RADIUS, refs.colliders, ROOM_BOUNDS);
        faceToward(player, target);
        player.position.copy(next);
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
          const facingTarget = new THREE.Vector3(refs.playerArrivalFacing.x, 0, refs.playerArrivalFacing.z);
          faceToward(player, facingTarget);
          refs.playerArrivalFacing = null;
        }
      }
      // Publish Patrick's live state every frame (including idle frames so
      // the arrival-facing rotation is observable from the dev probe).
      if (import.meta.env.DEV) {
        (window as unknown as Record<string, unknown>).__patrickPos = {
          x: player.position.x,
          y: player.position.y,
          z: player.position.z,
          ry: player.rotation.y,
          colliders: refs.colliders.length,
        };
      }
      if (import.meta.env.DEV) {
        const projectScreen = (world: THREE.Vector3) => {
          const ndc = world.clone().project(camera);
          return { x: ndc.x, y: ndc.y };
        };
        const npcPositions: Record<string, unknown> = {};
        refs.hotspotGroup.children.forEach((child) => {
          const id = child.userData.hotspotId;
          if (typeof id !== 'string') return;
          const npcModel = child.children.find((c) => c.type === 'Group') ?? child;
          npcPositions[id] = {
            groupX: child.position.x,
            groupZ: child.position.z,
            modelX: npcModel.position.x,
            modelZ: npcModel.position.z,
            modelRy: npcModel.rotation.y,
            ndc: projectScreen(new THREE.Vector3(child.position.x, 1.5, child.position.z)),
            childTypes: child.children.map((c) => c.type).join(','),
          };
        });
        (window as unknown as Record<string, unknown>).__sceneDebug = {
          cameraPos: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
          target: { x: controls.target.x, y: controls.target.y, z: controls.target.z },
          viewport: {
            width: renderer.domElement.clientWidth || window.innerWidth,
            height: renderer.domElement.clientHeight || window.innerHeight,
            portraitPhone: isPhonePortraitViewport(
              renderer.domElement.clientWidth || window.innerWidth,
              renderer.domElement.clientHeight || window.innerHeight,
            ),
            landscapePhone: isPhoneLandscapeViewport(
              renderer.domElement.clientWidth || window.innerWidth,
              renderer.domElement.clientHeight || window.innerHeight,
            ),
          },
          cinematicActive: Boolean(cinematic),
          patrickNdc: projectScreen(new THREE.Vector3(player.position.x, 1.5, player.position.z)),
          npcs: npcPositions,
        };
      }
      if (cinematic) {
        // Cinematic two-shot is in flight. Drive camera + target along the
        // pre-computed lerp; the auto-bias below is skipped so it doesn't
        // fight the motion. Ease-in-out cubic gives a film-style move that
        // settles smoothly on the framing.
        const elapsed = now - cinematic.startTime;
        const t = Math.min(1, elapsed / cinematic.duration);
        const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        camera.position.lerpVectors(cinematic.startPos, cinematic.endPos, eased);
        controls.target.lerpVectors(cinematic.startTarget, cinematic.endTarget, eased);
        if (t >= 1) cinematic = null;
      } else if (refs.conversationAnchor) {
        // Conversation is in progress — anchor the auto-bias to the midpoint
        // of Patrick and the NPC he's talking to, at chest height. Otherwise
        // the player-biased drift below would pull the camera target away
        // from the two-shot framing the cinematic just established, and the
        // camera (which OrbitControls keeps positionally fixed and only
        // rotates) would end up pointing at empty space with both
        // characters skewed to one edge of the screen.
        const conversationTarget = new THREE.Vector3(
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
        );
        controls.target.lerp(target, isPortraitPhone || isLandscapePhone ? 0.035 : 0.022);
      }
      controls.update();
      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    }

    window.addEventListener('resize', onResize);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    animationFrameId = requestAnimationFrame(animate);

    return () => {
      disposed = true;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = 0;
      }
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      controls.dispose();
      renderer.dispose();
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose?.();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
        else material?.dispose?.();
      });
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
      sceneRefs.current = null;
    };
    // Bootstrap once. Config changes are not expected — a parent should remount with a new key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Rebuild room geometry & hotspots when roomId changes ---
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs) return;
    const currentRoom = config.rooms.find((entry) => entry.id === roomId) ?? config.rooms[0];
    disposeObjectTree(refs.roomGroup);
    refs.roomGroup.clear();
    disposeObjectTree(refs.hotspotGroup);
    refs.hotspotGroup.clear();
    refs.npcMixers.length = 0;
    refs.npcFacingTargets.length = 0;
    refs.npcControllers.clear();
    refs.objectsByHotspot.clear();

    currentRoom.build(refs.roomGroup, currentRoom.palette);

    const textureLoader = new THREE.TextureLoader();
    currentRoom.hotspots.forEach((hotspot) => {
      const object = createHotspotObject(
        textureLoader,
        new GLTFLoader(),
        hotspot,
        refs.npcMixers,
        refs.npcFacingTargets,
        refs.npcControllers,
      );
      refs.objectsByHotspot.set(hotspot.id, object);
      refs.hotspotGroup.add(object);
    });

    // Collision: collect colliders from the freshly-built room + hotspots.
    // NPC GLTF models load asynchronously, so re-collect a few times over the
    // next couple of seconds — once an NPC's geometry resolves, its bounding
    // box will appear and the synthetic placeholder rect (set on the hotspot
    // root via colliderRadius) gets superseded by the real footprint on the
    // next collection pass.
    const recollect = () => {
      const live = sceneRefs.current;
      if (!live || live !== refs) return;
      live.colliders = collectColliders([live.roomGroup, live.hotspotGroup]);
    };
    recollect();
    const recollectTimers = [400, 1000, 2000, 3500].map((ms) => window.setTimeout(recollect, ms));

    // Apply per-room ambiance overrides if any. Hoist `refs.scene.fog` into a
    // local so the `instanceof Fog` narrowing actually applies to subsequent
    // member access (TS won't re-narrow `refs.scene.fog` across statements).
    const fog = refs.scene.fog;
    if (currentRoom.ambianceOverride) {
      const o = currentRoom.ambianceOverride;
      if (typeof o.background === 'number') refs.scene.background = new THREE.Color(o.background);
      if (fog instanceof THREE.Fog) {
        if (typeof o.fogColor === 'number') fog.color = new THREE.Color(o.fogColor);
        if (typeof o.fogNear === 'number') fog.near = o.fogNear;
        if (typeof o.fogFar === 'number') fog.far = o.fogFar;
      }
    } else {
      // restore stage defaults
      refs.scene.background = new THREE.Color(config.ambiance.background);
      if (fog instanceof THREE.Fog) {
        fog.color = new THREE.Color(config.ambiance.fogColor);
        fog.near = config.ambiance.fogNear;
        fog.far = config.ambiance.fogFar;
      }
    }

    return () => {
      recollectTimers.forEach((id) => window.clearTimeout(id));
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
      if (completionTimerRef.current !== null) {
        window.clearTimeout(completionTimerRef.current);
        completionTimerRef.current = null;
      }
    };
  }, []);

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
    const sources = characterTurnAudioSrc
      ? [characterTurnAudioSrc]
      : [getStageOneSuAudioSrc(entry?.suAudioId), getStageOneSuAudioSrc(entry?.coachingAudioId)].filter(
          (src): src is string => Boolean(src),
        );
    if (!sources.length) return;
    const runId = suPlaybackRunRef.current;
    void (async () => {
      for (const src of sources) {
        if (suPlaybackRunRef.current !== runId) return;
        await suAudioPlayer.playUntilEnded(src, soundSettings.guideAudioVolume);
      }
    })();
    return () => {
      if (suPlaybackRunRef.current === runId) stopSuPlayback();
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
    setReviewTurnIndex(null);
    setVerdict(null);
    setVoiceError('');
    setMessage(`${hotspot.label}: choose a command, then say the Thai sentence.`);
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
            advanceConversation(acceptedConversation);
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
      setVoiceError(error instanceof Error ? error.message : String(error));
      setVoiceStatus(
        `${selectedMode === 'whisper' ? 'Local Whisper' : 'Realtime'} voice coach could not connect.`,
      );
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

  function advanceConversation(conversation: ActiveConversation) {
    const turns = conversation.command.conversation ?? [];
    const currentTurn = turns[conversation.turnIndex];
    const nextTurnIndex = conversation.turnIndex + 1;
    const nextTurn = turns[nextTurnIndex];

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
      setStageComplete(true);
      setVoiceStatus(config.completionMessage);
      const refs = sceneRefs.current;
      void refs?.loadPatrickAction('victory').then((loaded) => {
        if (loaded) refs.playPatrickAction('victory', 0.16);
      });
      if (onComplete) {
        completionTimerRef.current = window.setTimeout(() => {
          onComplete();
        }, 1600);
      }
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
      className="adventure-3d-shell relative h-dvh min-h-dvh w-screen overflow-hidden bg-slate-950 text-white lg:min-h-[620px]"
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

      {/* Load overlay — premium spinner over the scene until GLB + room are ready */}
      <div
        className={`adventure-3d-load-overlay ${
          sceneReady || isIntroMovieActive ? 'adventure-3d-load-overlay--hidden' : ''
        }`}
      >
        <div className="flex flex-col items-center">
          <div className="adventure-3d-load-spinner" />
          <p className="adventure-3d-load-label">{config.badge}</p>
          <p className="adventure-3d-load-sublabel">{config.title}</p>
        </div>
      </div>

      {/* Header — stage badge + room nav. Tighter than before and uses the per-stage accent. */}
      <header className="adventure-3d-topbar pointer-events-none absolute left-3 right-3 top-3 z-30 flex flex-wrap items-start justify-between gap-3 sm:left-6 sm:right-6 sm:top-5">
        <div className="adventure-3d-header pointer-events-auto max-w-md px-4 py-2.5">
          <span className="adventure-3d-badge">{config.badge}</span>
          <p className="mt-1.5 text-lg font-black leading-tight text-white sm:text-xl">{room.title}</p>
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/60">
            {config.subtitle}
          </p>
        </div>
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
      </header>

      {/* Objective banner — pinned top-center, telegraphs the current beat */}
      <div className="adventure-3d-objective-wrap pointer-events-none absolute left-1/2 top-[5.8rem] z-25 -translate-x-1/2 sm:top-[6.4rem]">
        <div className="adventure-3d-objective">
          <span className="adventure-3d-objective__eyebrow">
            {selectedHotspot?.label ?? 'Stage Objective'}
          </span>
          <span className="adventure-3d-objective__text">{message}</span>
        </div>
      </div>

      {/* Stage completion celebration */}
      {stageComplete ? (
        <div className="pointer-events-none absolute inset-0 z-[55] grid place-items-center">
          <div className="adventure-3d-completion">
            <span className="adventure-3d-completion__eyebrow">Stage Clear</span>
            <h2 className="adventure-3d-completion__title">{config.completionMessage}</h2>
            <p className="adventure-3d-completion__body">
              {config.title} — Patrick is ready for the next rift.
            </p>
            <button
              type="button"
              onClick={() => onComplete?.()}
              className="adventure-3d-connect mt-4"
              style={{ display: 'inline-grid' }}
            >
              Continue Journey
            </button>
          </div>
        </div>
      ) : null}

      {/* Bottom action panel */}
      <section className="adventure-3d-panel pointer-events-auto absolute inset-x-3 bottom-10 z-50 grid max-h-[min(20rem,42dvh)] gap-3 overflow-y-auto p-3 text-white sm:inset-x-6 sm:bottom-10 sm:grid-cols-[minmax(0,1fr)_minmax(13rem,0.58fr)_minmax(17rem,0.78fr)] sm:p-4 lg:inset-x-10">
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
                <p className="mt-1 text-lg font-black leading-tight text-white sm:text-xl">
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
                <p className="mt-1 text-lg font-black leading-tight text-white sm:text-xl">
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
                Tap a person, item, or prop in the 3D scene, choose a verb, then hold the mic to say the Thai
                sentence.
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
        </div>

        {/* COLUMN 3 — Su judge panel */}
        <details className="adventure-3d-drawer min-w-0" open>
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

      {/* Auto-hiding hint strip — visible until first interaction. Hidden while
          the intro dialogue is active so the bubble has the whole bottom strip. */}
      <div
        className={`adventure-3d-hint-strip ${hintsDismissed || !isIntroComplete ? 'adventure-3d-hint-strip--hidden' : ''}`}
      >
        <span>Tap floor to move</span>
        <span>Tap hotspots</span>
        <span>Pinch or scroll to zoom</span>
      </div>

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
    </main>
  );
}
