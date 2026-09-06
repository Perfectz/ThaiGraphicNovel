import { ReunionGathering } from './ReunionGathering';
import { CityScenery } from './CityScenery';
import { RiverBoats } from './RiverBoats';
import { FerryPassengers, type FerryRider } from './FerryPassengers';
import { crossingPose } from './ferryPassage';
import { disposeWorldObject } from './worldResources';
import { CityPeople } from './CityPeople';
import { CityResidents } from './CityResidents';
import { EscortFollower, type EscortSave } from './stationEscort';
import { cameraBlend } from './cityMotion';
import {
  companionMark,
  companionStart,
  conversationCamera,
  playerConversationMark,
} from './conversationStaging';
import { archiveSite } from './archiveLayout';
import { discoveryFor } from './discoveries';
import { DiscoveryModels } from './DiscoveryModels';
import { TravelLantern } from './TravelLantern';
import { lanternRevealRadius } from './lanternTrade';
import { cityAreaAt } from './city';
import { blocksCityView } from './cityVisibility';
import { RiverBattleStage } from './RiverBattleStage';
import type { Battle } from './expeditionCombat';
import * as T from 'three';
import { WorldQuality } from './WorldQuality';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import suUrl from '../assets/debug/su-rig/Meshy_AI_Neon_Circuit_Princess_biped_Animation_Idle_4_withSkin.glb?url';
import patrickUrl from '../assets/debug/patrick-rig/Meshy_AI_Red_Jacket_Rebel_biped_Animation_Idle_02_withSkin.glb?url';
import suWalkUrl from '../assets/debug/su-rig/Meshy_AI_Neon_Circuit_Princess_biped_Animation_Walking_withSkin.glb?url';
import patrickWalkUrl from '../assets/debug/patrick-rig/Meshy_AI_Red_Jacket_Rebel_biped_Animation_Walking_withSkin.glb?url';
import type { District } from './curriculum';
import {
  actors,
  findPath,
  followPath,
  has,
  objective,
  stepPlayer,
  type ActorId,
  type AdventureSave,
  type Point,
} from './adventure';

type WorldMode = 'home' | 'explore' | 'encounter' | 'adventure';
type WorldState = {
  district: District;
  mode: WorldMode;
  trial: boolean;
  progress: number;
  boss?: boolean;
  conversation?: boolean;
  reunion?: boolean;
  contact?: ActorId;
};
const C = {
  jade: '#174f50',
  teal: '#37766d',
  gold: '#cf9b54',
  cream: '#edcf97',
  wood: '#6d3629',
  dark: '#25202e',
  coral: '#c46656',
};

/** Three owns scenery and presentation only; the learning state never lives here. */
export class BangkokWorld {
  private scene = new T.Scene();
  private sunlight = new T.DirectionalLight('#ffca91', 2.7);
  private cityPeople = new CityPeople();
  private cityResidents?: CityResidents;
  private worldCutaways: { object: T.Object3D; bounds: T.Box3 }[] = [];
  private combatStage: RiverBattleStage;
  private cityScenery: CityScenery;
  private combat: Battle | null = null;
  private camera = new T.PerspectiveCamera(43, 1, 0.1, 200);
  private renderer: T.WebGLRenderer;
  private controls: OrbitControls;
  private observer: ResizeObserver;
  private frame = 0;
  private disposed = false;
  private lastTime = 0;
  private elapsed = 0;
  private mixers: T.AnimationMixer[] = [];
  private animated: Array<(time: number, dt: number) => void> = [];
  private riverBoats!: RiverBoats;
  private ferryPassengers!: FerryPassengers;
  private reunionGathering!: ReunionGathering;
  private departure: number | null = null;
  private textures = new Set<T.Texture>();
  private materials = new Map<string, T.MeshStandardMaterial>();
  private targetPosition = new T.Vector3(18, 15, 22);
  private targetLook = new T.Vector3(0, 0, -2);
  private state: WorldState = { district: 'hotel', mode: 'home', trial: false, progress: 0 };
  private party = new T.Group();
  private spirit = new T.Group();
  private burst = new T.Group();
  private hitAt = -10;
  private floor = new T.Group();
  private skyline = new T.Group();
  private readyCount = 0;
  private settledActors = 0;
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private pointerStart = { x: 0, y: 0 };
  private interactingUntil = 0;
  private particles: T.Points;
  private backgroundTexture?: T.Texture;
  private qualityFrames = 0;
  private averageFrameMs = 16;
  private qualityReduced = false;
  private quality = new WorldQuality();
  private walkClips: {
    mixer: T.AnimationMixer;
    idle: T.AnimationAction;
    walk?: T.AnimationAction;
    url: string;
    loading?: boolean;
    player: boolean;
  }[] = [];
  private staging: {
    contact: ActorId;
    current: Point;
    path: Point[];
    playerPath: Point[];
    playerMoved: boolean;
    companionPlanned: boolean;
  } | null = null;
  private isWalking = false;
  private trail: Point[] = [];
  private beaconGlow = new T.Group();
  private adventure?: AdventureSave;
  private adventurePaused = false;
  private adventureCallbacks?: {
    interact: (id: ActorId) => void;
    near: (id: ActorId | null) => void;
    move: (p: Point, escort?: EscortSave) => void;
  };
  private actorObjects = new Map<ActorId, T.Group>();
  private escort = new EscortFollower();
  private worldActors() {
    return actors.map((a) => (a.id === 'traveler' ? { ...a, ...this.escort.state.position } : a));
  }
  private questMarkers = new Map<ActorId, T.Sprite>();
  private discoveryModels = new DiscoveryModels();
  private travelLantern?: TravelLantern;
  private player: Point = { x: -5, z: 4.8 };
  private path: Point[] = [];
  private walkingTo: ActorId | null = null;
  private nearest: ActorId | null = null;
  private keys = new Set<string>();
  private touchDirection = { x: 0, z: 0 };
  private lastMoveReport = 0;
  private chestLid?: T.Group;
  private statusCallback: (status: 'ready' | 'fallback' | 'error') => void;

  constructor(
    private host: HTMLDivElement,
    onStatus: (status: 'ready' | 'fallback' | 'error') => void,
    private onInteract: () => void,
  ) {
    this.statusCallback = onStatus;
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setClearColor(0x000000, 0);
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.setAttribute(
      'aria-label',
      'Interactive 3D Bangkok riverside. Drag to look around. Use the Begin practice button to talk to Su.',
    );
    this.camera.position.copy(this.targetPosition);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minDistance = 9;
    this.controls.maxDistance = 34;
    this.controls.minPolarAngle = 0.3;
    this.controls.maxPolarAngle = Math.PI / 2.2;
    this.controls.target.copy(this.targetLook);
    this.controls.addEventListener('start', this.handleOrbit);
    this.renderer.domElement.addEventListener('pointerdown', this.pointerDown);
    this.renderer.domElement.addEventListener('pointerup', this.pointerUp);
    this.renderer.domElement.addEventListener('webglcontextlost', this.contextLost);
    this.lighting();
    this.buildRiver();
    this.buildGround();
    this.buildHotel();
    this.buildMarket();
    this.buildPier();
    this.batchStatic(this.scene);
    this.worldCutaways.forEach(({ object }) => this.batchStatic(object));
    this.scene.add(this.party, this.spirit, this.burst);
    this.party.position.set(-2, 0.08, 2.3);
    this.makeSpirit();
    this.combatStage = new RiverBattleStage(this.scene);
    this.batchStatic(this.combatStage.environmentFallback);
    this.batchStatic(this.combatStage.root);
    this.cityScenery = new CityScenery(this.scene, (root) => this.batchStatic(root));
    this.cityScenery.chunks.forEach((chunk) => this.batchStatic(chunk));
    this.cityScenery.cutaways.forEach(({ object }) => this.batchStatic(object));
    const positions = new Float32Array(75 * 3);
    for (let i = 0; i < 75; i++) {
      positions[i * 3] = Math.sin(i * 17) * 14;
      positions[i * 3 + 1] = 0.5 + (i % 13) * 0.32;
      positions[i * 3 + 2] = Math.cos(i * 29) * 9;
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.BufferAttribute(positions, 3));
    this.particles = new T.Points(
      geometry,
      new T.PointsMaterial({
        color: 0xffdaa0,
        size: 0.055,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
        blending: T.AdditiveBlending,
      }),
    );
    this.scene.add(this.particles);
    void this.loadActor(patrickUrl, -1.05, 1.8, 0.22);
    void this.loadActor(suUrl, 1.1, 1.7, -0.32);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.resize();
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    window.addEventListener('blur', this.clearKeys);
    this.frame = requestAnimationFrame(this.render);
  }

  private handleOrbit = () => {
    this.interactingUntil = performance.now() + 9000;
  };
  private pointerDown = (e: PointerEvent) => {
    this.pointerStart = { x: e.clientX, y: e.clientY };
  };
  private pointerUp = (e: PointerEvent) => {
    if (this.state.mode === 'adventure') {
      this.adventureClick(e);
      return;
    }
    if (
      this.state.mode !== 'explore' ||
      Math.hypot(e.clientX - this.pointerStart.x, e.clientY - this.pointerStart.y) > 6
    )
      return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const pointer = new T.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      (-(e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const ray = new T.Raycaster();
    ray.setFromCamera(pointer, this.camera);
    if (ray.intersectObject(this.party, true).length) this.onInteract();
  };
  private contextLost = (event: Event) => {
    event.preventDefault();
    this.statusCallback('error');
  };

  private mat(color: string, glow = 0, metalness = 0) {
    const key = `${color}-${glow}-${metalness}`;
    if (!this.materials.has(key))
      this.materials.set(
        key,
        new T.MeshStandardMaterial({
          color,
          roughness: 0.65,
          metalness,
          emissive: glow ? color : '#000000',
          emissiveIntensity: glow,
        }),
      );
    return this.materials.get(key)!;
  }
  private mesh(
    geometry: T.BufferGeometry,
    color: string,
    parent: T.Object3D,
    p: [number, number, number],
    glow = 0,
    metalness = 0,
  ) {
    const m = new T.Mesh(geometry, this.mat(color, glow, metalness));
    m.position.set(...p);
    m.castShadow = !glow;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  private box(
    size: [number, number, number],
    p: [number, number, number],
    color: string,
    parent: T.Object3D = this.scene,
    glow = 0,
  ) {
    return this.mesh(new T.BoxGeometry(...size), color, parent, p, glow);
  }
  private cylinder(
    r: number,
    h: number,
    p: [number, number, number],
    color: string,
    parent: T.Object3D = this.scene,
    top = r,
    glow = 0,
  ) {
    return this.mesh(new T.CylinderGeometry(top, r, h, 16), color, parent, p, glow);
  }
  private line(
    points: T.Vector3[],
    color: string,
    radius = 0.025,
    parent: T.Object3D = this.scene,
    glow = 0,
  ) {
    return this.mesh(
      new T.TubeGeometry(new T.CatmullRomCurve3(points), 24, radius, 6, false),
      color,
      parent,
      [0, 0, 0],
      glow,
    );
  }
  private lighting() {
    this.scene.fog = new T.FogExp2('#555a82', 0.006);
    this.scene.add(new T.HemisphereLight('#a8bad7', '#594439', 0.85));
    const sun = this.sunlight;
    sun.position.set(-12, 18, 9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 17, bottom: -17, near: 1, far: 65 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.04;
    this.scene.add(sun, sun.target);
    const rim = new T.DirectionalLight('#9995ff', 0.85);
    rim.position.set(8, 9, -14);
    this.scene.add(rim);
    const fill = new T.DirectionalLight('#ffdca8', 0.65);
    fill.position.set(0, 5, 13);
    this.scene.add(fill);
    for (const [x, z] of [
      [-6, -1],
      [7, -3],
      [1, 4],
    ]) {
      const l = new T.PointLight('#ffc17b', 8, 13, 2);
      l.position.set(x, 3, z);
      this.scene.add(l);
    }
  }
  private buildRiver() {
    this.scene.add(this.skyline);
    const river = this.mesh(new T.PlaneGeometry(180, 130), '#285775', this.scene, [0, -0.8, -35]);
    river.rotation.x = -Math.PI / 2;
    (river.material as T.MeshStandardMaterial).roughness = 0.32;
    (river.material as T.MeshStandardMaterial).metalness = 0.45;
    // Broken, animated reflections are cheap geometry instead of another scene render.
    for (let i = 0; i < 110; i++) {
      const x = Math.sin(i * 12.12) * 42,
        z = -10 - (i % 28) * 1.35;
      this.box(
        [0.4 + (i % 7) * 0.6, 0.012, 0.035 + (i % 3) * 0.025],
        [x, -0.77, z],
        i % 3 ? '#bb8a83' : '#efc381',
        this.scene,
        0.5,
      );
    }
    // A layered skyline stays dimensional even when the illustrated plate is unavailable.
    for (let i = 0; i < 38; i++) {
      const x = (i - 19) * 2.6,
        h = 2 + ((i * 7) % 12) * 0.5,
        z = -37 - (i % 3) * 4;
      this.box([1.5, h, 1.7], [x, h / 2 - 0.8, z], i % 2 ? '#4c4c6c' : '#49445e', this.skyline);
      for (let y = 0; y < Math.floor(h * 2); y++)
        for (let col = 0; col < 2; col++)
          if ((i + y + col) % 3)
            this.box(
              [0.16, 0.18, 0.02],
              [x - 0.42 + col * 0.8, y * 0.42, z + 0.86],
              '#dfb78e',
              this.skyline,
              1,
            );
    }
    // Small temple silhouettes: tiered plinths, a tapering prang, and gold spires.
    for (const x of [-15, 13]) {
      const temple = new T.Group();
      temple.position.set(x, -0.7, -29);
      this.skyline.add(temple);
      for (let i = 0; i < 6; i++)
        this.cylinder(1.6 - i * 0.21, 0.65, [0, i * 0.62 + 0.3, 0], '#bda284', temple, 1.25 - i * 0.18);
      this.mesh(new T.ConeGeometry(0.4, 2.4, 8), '#edc584', temple, [0, 4.7, 0], 0.4);
      for (const side of [-2, 2]) {
        this.mesh(new T.ConeGeometry(0.6, 2.6, 8), '#cab18c', temple, [side, 1.6, 0.4]);
      }
    }
    this.riverBoats = new RiverBoats(this.scene, (root) => this.batchStatic(root));
    this.ferryPassengers = new FerryPassengers(this.scene);
    this.reunionGathering = new ReunionGathering(this.scene);
  }
  private buildGround() {
    this.scene.add(this.floor);
    this.box([26, 0.75, 14], [0, -0.38, 0], '#4b4450', this.floor);
    this.box([26.1, 0.09, 14.1], [0, -0.07, 0], C.gold, this.floor);
    this.box([26, 0.08, 14], [0, 0, 0], '#ad957f', this.floor);
    // Large terrazzo squares with small brass insets; no noisy tiled bitmap.
    for (let x = -12; x <= 12; x += 2)
      for (let z = -6; z <= 6; z += 2) {
        this.box([1.97, 0.035, 1.97], [x, 0.058, z], (x + z) % 4 ? '#bba897' : '#cdbba3', this.floor);
        if ((x + z) % 4 === 0) {
          const dot = this.box([0.11, 0.04, 0.11], [x - 0.98, 0.078, z - 0.98], C.gold, this.floor);
          dot.rotation.y = Math.PI / 4;
        }
      }
    for (const x of [-12, 12]) for (const z of [-5, 1, 6]) this.palm(x, z, 1 + (z + 5) * 0.02);
    for (let i = 0; i < 7; i++) this.plant(-11 + i * 3.5, -6.2, 0.65);
    for (const x of [-11, 11]) {
      this.box([0.12, 1.15, 12], [x, 0.62, -0.1], '#624330');
      for (let z = -5; z <= 5; z++) this.box([0.08, 0.85, 0.08], [x, 0.46, z], C.gold);
    }
  }
  private palm(x: number, z: number, scale: number) {
    const g = new T.Group();
    g.position.set(x, 0, z);
    g.scale.setScalar(scale);
    this.scene.add(g);
    this.cylinder(0.5, 0.65, [0, 0.3, 0], '#776652', g, 0.65);
    this.cylinder(0.12, 4, [0, 2.2, 0], '#776344', g, 0.075);
    for (let i = 0; i < 10; i++) {
      const angle = (i * Math.PI) / 5;
      const shape = new T.Shape();
      shape.moveTo(0, 0);
      shape.quadraticCurveTo(0.5, 1.1, 0.08, 2.2);
      shape.quadraticCurveTo(-0.4, 0.9, 0, 0);
      const geo = new T.ShapeGeometry(shape, 8);
      geo.rotateX(-Math.PI / 2);
      const leaf = this.mesh(geo, i % 2 ? '#397764' : '#26594f', g, [0, 4.2, 0]);
      (leaf.material as T.MeshStandardMaterial).side = T.DoubleSide;
      leaf.rotation.set(0.32, angle, 0.12);
      leaf.userData.animated = true;
      this.animated.push((t) => {
        leaf.rotation.z = 0.1 + Math.sin(t * 0.65 + i) * 0.035;
      });
      const dir = new T.Vector3(Math.sin(angle), 0, Math.cos(angle));
      this.line(
        [
          new T.Vector3(0, 4.2, 0),
          dir
            .clone()
            .multiplyScalar(1)
            .add(new T.Vector3(0, 4.45, 0)),
          dir
            .clone()
            .multiplyScalar(2.2)
            .add(new T.Vector3(0, 3.95, 0)),
        ],
        '#477864',
        0.018,
        g,
      );
    }
  }
  private plant(x: number, z: number, scale: number) {
    const g = new T.Group();
    g.position.set(x, 0.1, z);
    g.scale.setScalar(scale);
    this.scene.add(g);
    this.cylinder(0.45, 0.7, [0, 0.35, 0], '#b46e57', g, 0.55);
    for (let i = 0; i < 9; i++) {
      const leaf = this.mesh(new T.SphereGeometry(0.3, 8, 6), i % 2 ? '#5b8b62' : '#2f6355', g, [
        Math.sin(i * 2.4) * 0.45,
        0.9 + (i % 3) * 0.25,
        Math.cos(i * 2.4) * 0.45,
      ]);
      leaf.scale.set(0.6, 2, 0.25);
      leaf.rotation.z = Math.sin(i) * 0.65;
    }
  }
  private lantern(x: number, y: number, z: number, parent: T.Object3D = this.scene, color = '#ffc68b') {
    const g = new T.Group();
    g.position.set(x, y, z);
    parent.add(g);
    this.cylinder(0.22, 0.43, [0, 0, 0], color, g, 0.22, 0.9);
    for (const yy of [-0.23, 0.23]) this.cylinder(0.24, 0.045, [0, yy, 0], C.wood, g);
    for (let i = 0; i < 8; i++)
      this.box(
        [0.015, 0.46, 0.015],
        [Math.sin((i * Math.PI) / 4) * 0.225, 0, Math.cos((i * Math.PI) / 4) * 0.225],
        '#bf744f',
        g,
      );
    this.line([new T.Vector3(0, -0.22, 0), new T.Vector3(0, -0.52, 0)], '#dd8060', 0.015, g);
    this.batchStatic(g);
    g.userData.animated = true;
    if (!parent.userData.actorId) this.registerWorldCutaway(g);
    this.animated.push((t) => {
      g.rotation.z = Math.sin(t * 0.7 + x) * 0.035;
    });
  }
  private label(
    text: string,
    w: number,
    h: number,
    p: [number, number, number],
    parent: T.Object3D,
    color = '#f1d391',
  ) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#173f40';
    ctx.fillRect(0, 0, 1024, 256);
    ctx.strokeStyle = '#ac8956';
    ctx.lineWidth = 8;
    ctx.strokeRect(12, 12, 1000, 232);
    ctx.fillStyle = color;
    ctx.font = '48px Georgia';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 512, 128);
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    this.textures.add(texture);
    const mesh = new T.Mesh(
      new T.PlaneGeometry(w, h),
      new T.MeshStandardMaterial({
        map: texture,
        emissive: '#f8cd8b',
        emissiveMap: texture,
        emissiveIntensity: 0.3,
        roughness: 0.65,
      }),
    );
    mesh.position.set(...p);
    parent.add(mesh);
  }
  private buildHotel() {
    const g = new T.Group();
    g.position.set(-5.5, 0.1, -3.2);
    this.scene.add(g);
    this.box([10.4, 0.22, 5.6], [0, 0.03, 0], '#e1c5a2', g);
    const wall = new T.Group();
    wall.name = 'riverside-pavilion-wall';
    g.add(wall);
    this.box([10, 3.9, 0.32], [0, 1.95, -2.4], C.jade, wall);
    for (let x = -4.7; x <= 4.7; x += 1.56) {
      this.box([1.38, 2.4, 0.07], [x, 1.9, -2.18], '#235e58', wall);
      for (const side of [-0.72, 0.72]) this.box([0.025, 3.5, 0.04], [x + side, 1.9, -2.1], C.gold, wall);
      this.box([1.4, 0.025, 0.04], [x, 0.7, -2.1], C.gold, wall);
    }
    this.registerWorldCutaway(wall);
    for (const x of [-4.7, 0, 4.7]) {
      this.cylinder(0.14, 3.65, [x, 1.97, 1.9], C.wood, g);
      for (const y of [0.3, 3.5]) {
        this.cylinder(0.25, 0.14, [x, y, 1.9], C.gold, g);
        this.box([0.42, 0.16, 0.42], [x, y + 0.12, 1.9], '#b7874e', g);
      }
    }
    this.box([10.3, 0.2, 0.28], [0, 3.8, 1.9], C.wood, g);
    this.box([10.5, 0.04, 0.34], [0, 3.72, 1.9], C.gold, g);
    const roofGroup = new T.Group();
    g.add(roofGroup);
    // Keep the layered roof independent so it can reveal the party beneath it.
    for (let layer = 0; layer < 2; layer++) {
      const width = 11.3 - layer * 1.2,
        y = 4 + layer * 0.95;
      for (const side of [-1, 1]) {
        const roof = this.box(
          [width, 0.14, 2.95],
          [0, y + 0.5, side * 0.95 - 0.2],
          layer ? '#286767' : '#345e60',
          roofGroup,
        );
        roof.rotation.x = side * 0.42;
        const trim = this.box([width + 0.12, 0.075, 0.1], [0, y - 0.06, side * 2.3 - 0.2], C.gold, roofGroup);
        trim.rotation.x = side * 0.3;
        for (let x = -width / 2 + 0.3; x < width / 2; x += 0.35) {
          const tile = this.box([0.025, 0.045, 2.92], [x, y + 0.59, side * 0.95 - 0.2], '#4b8580', roofGroup);
          tile.rotation.x = side * 0.42;
        }
      }
      this.box([width + 0.1, 0.12, 0.16], [0, y + 1.1, -0.2], C.gold, roofGroup);
      for (const side of [-1, 1]) {
        this.line(
          [
            new T.Vector3((side * width) / 2, y + 1.1, -0.2),
            new T.Vector3(side * (width / 2 + 0.35), y + 1.5, -0.2),
            new T.Vector3(side * (width / 2 + 0.45), y + 2, -0.2),
          ],
          '#edc56f',
          0.055,
          roofGroup,
        );
      }
    }
    this.registerWorldCutaway(roofGroup);
    this.box([4.8, 1.05, 1.1], [0.4, 0.72, -0.8], C.wood, g);
    this.box([5, 0.13, 1.3], [0.4, 1.3, -0.8], '#e2ccb0', g);
    for (let x = -1.85; x < 2.8; x += 0.18) this.box([0.04, 0.8, 0.04], [x, 0.72, -0.23], '#be8950', g);
    this.label('CHAO PHRAYA  ·  RIVERSIDE HOUSE', 5.8, 1.05, [0, 2.7, -2.16], g);
    this.cylinder(0.13, 0.07, [1.8, 1.4, -0.7], C.gold, g, 0.09);
    this.box([0.45, 0.25, 0.25], [-1.2, 1.47, -0.9], '#376b63', g);
    for (const x of [-3.5, 3.5]) {
      this.lantern(x, 3.2, 0.6, g);
    }
    this.plant(-9, -0.5, 0.9);
    this.plant(-1, -0.5, 0.9);
    // Seating and a woven jade runner draw the eye to the party.
    this.box([5, 0.022, 2.2], [-4, 0.11, 2.2], '#38776b');
    for (const z of [1.2, 3.2]) this.box([4.8, 0.028, 0.045], [-4, 0.115, z], C.gold);
    for (const x of [-8, 0]) {
      this.box([1.4, 0.5, 1], [x, 0.6, 2.2], '#704536');
      this.box([1.3, 0.12, 1], [x, 0.93, 2.2], '#c38462');
    }
  }
  private buildMarket() {
    for (let i = 0; i < 3; i++) {
      const g = new T.Group();
      g.position.set(3.3 + i * 3.1, 0.12, -3.6 + (i % 2) * 0.8);
      this.scene.add(g);
      const color = ['#a6544f', '#b88b4f', '#477e74'][i];
      this.box([2.7, 1, 1.6], [0, 0.65, 0], '#6a4738', g);
      for (let x = -1.2; x <= 1.2; x += 0.15) this.box([0.04, 0.85, 0.035], [x, 0.65, 0.82], '#a3774e', g);
      this.box([2.9, 0.12, 1.85], [0, 1.2, 0], '#c6ae85', g);
      for (const x of [-1.25, 1.25]) this.box([0.07, 2.8, 0.07], [x, 1.6, 0.6], '#55372e', g);
      const canopy = new T.Group();
      g.add(canopy);
      const awning = this.box([3, 0.1, 2.4], [0, 2.95, 0], color, canopy);
      awning.rotation.x = -0.1;
      for (let x = -1.4; x < 1.5; x += 0.4)
        this.box([0.18, 0.17, 2.35], [x, 2.96, 0], '#dec29a', canopy).rotation.x = -0.1;
      this.label(
        ['ก๋วยเตี๋ยว  ·  NOODLES', 'ผลไม้  ·  FRESH FRUIT', 'ชาไทย  ·  THAI TEA'][i],
        2.35,
        0.55,
        [0, 2.5, 0.68],
        canopy,
      );
      this.registerWorldCutaway(canopy);
      for (let j = 0; j < 5; j++) {
        this.cylinder(0.2, 0.08, [j * 0.45 - 0.9, 1.32, 0.3], '#f4d9a7', g, 0.24);
        this.mesh(new T.SphereGeometry(0.15, 8, 6), i === 1 ? ['#e7ad46', '#df6550'][j % 2] : '#c99159', g, [
          j * 0.45 - 0.9,
          1.42,
          0.3,
        ]);
      }
      this.lantern(-0.9, 2.35, 1.2, g);
      this.lantern(0.9, 2.35, 1.2, g);
      for (const x of [-0.9, 0.9]) {
        this.cylinder(0.25, 0.65, [x, 0.34, 2.1], '#955540', g);
        this.cylinder(0.32, 0.08, [x, 0.72, 2.1], '#d8ab68', g);
      }
    }
    for (let row = 0; row < 2; row++) {
      const z = -1 + row * 4;
      this.line(
        [new T.Vector3(-11, 4.6, z), new T.Vector3(0, 3.9, z), new T.Vector3(11, 4.8, z)],
        '#503933',
        0.016,
      );
      for (let i = 0; i < 12; i++) {
        const x = -10 + i * 1.8;
        this.lantern(x, 3.8 + Math.pow(x / 10, 2) * 0.7, z, this.scene, i % 3 === 0 ? '#ffb391' : '#ffdc9a');
      }
    }
  }
  private buildPier() {
    for (let i = 0; i < 11; i++) this.box([3.2, 0.12, 0.48], [1, -0.06, -6.5 - i * 0.5], '#936b51');
    for (const x of [-0.65, 2.65])
      for (const z of [-7, -9.2, -11.4]) {
        this.cylinder(0.08, 1.5, [x, -0.1, z], C.wood);
        this.lantern(x, 1, z);
      }
    // A subtle rift floating above a circular stone in the courtyard.
    this.cylinder(1.6, 0.1, [3.7, 0.14, 2.6], '#927d76', this.scene, 1.6);
    const ring = this.mesh(
      new T.TorusGeometry(1.35, 0.025, 8, 64),
      '#aab8ef',
      this.scene,
      [3.7, 0.22, 2.6],
      2,
    );
    ring.rotation.x = Math.PI / 2;
  }
  private makeSpirit() {
    const core = this.mesh(new T.IcosahedronGeometry(0.65, 1), '#75dccf', this.spirit, [0, 0, 0], 0.75);
    for (const x of [-0.2, 0.2])
      this.mesh(new T.SphereGeometry(0.045, 8, 8), '#193b58', this.spirit, [x, 0.05, 0.61]);
    for (let i = 0; i < 3; i++) {
      const ring = this.mesh(
        new T.TorusGeometry(0.94 + i * 0.13, 0.014, 6, 64),
        i % 2 ? '#f4d195' : '#aa94f3',
        this.spirit,
        [0, 0, 0],
        2,
      );
      ring.rotation.set(i * 0.8, i * 0.5, 0.3);
      this.animated.push((t) => {
        ring.rotation.z = t * 0.2 + i;
      });
    }
    this.animated.push((t) => {
      this.spirit.position.y = 2.3 + Math.sin(t * 1.4) * 0.18;
      core.rotation.y = t * 0.22;
    });
    this.spirit.position.set(3.7, 2.3, 2.6);
    this.spirit.visible = false;
    for (let i = 0; i < 24; i++) {
      const spark = this.mesh(new T.OctahedronGeometry(0.09), '#ffe7a5', this.burst, [0, 0, 0], 3);
      spark.userData.index = i;
    }
    this.burst.visible = false;
  }
  private async loadActor(url: string, x: number, height: number, rotation: number) {
    try {
      const gltf = await new GLTFLoader().loadAsync(url);
      if (this.disposed) {
        this.disposeObject(gltf.scene);
        return;
      }
      const actor = gltf.scene;
      const bounds = new T.Box3().setFromObject(actor);
      const size = bounds.getSize(new T.Vector3());
      actor.scale.setScalar(height / size.y);
      actor.updateMatrixWorld(true);
      const scaled = new T.Box3().setFromObject(actor);
      const center = scaled.getCenter(new T.Vector3());
      actor.position.set(x - center.x, -scaled.min.y, -center.z);
      actor.rotation.y = rotation;
      actor.userData.basePosition = actor.position.clone();
      actor.userData.baseRotation = rotation;
      actor.userData.player = url === patrickUrl;
      actor.traverse((obj) => {
        if (obj instanceof T.Mesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
        }
      });
      this.party.add(actor);
      const mixer = new T.AnimationMixer(actor);
      if (gltf.animations[0]) {
        const idle = mixer.clipAction(gltf.animations[0]).play();
        // Apply a real pose even when ongoing animation is disabled by reduced motion.
        mixer.setTime(0.1);
        this.walkClips.push({
          mixer,
          idle,
          url: url === patrickUrl ? patrickWalkUrl : suWalkUrl,
          player: url === patrickUrl,
        });
      }
      this.mixers.push(mixer);
      if (this.adventure) this.loadWalkClips();
      this.readyCount++;
      if (this.readyCount === 2) this.statusCallback('ready');
    } catch {
      if (!this.disposed) this.statusCallback('fallback');
    } finally {
      this.settledActors++;
    }
  }
  setCombat(battle: Battle | null, target: string | null) {
    const changedMode = !!this.combat !== !!battle;
    this.combat = battle;
    this.renderer.toneMappingExposure = battle ? 0.83 : 1.12;
    this.combatStage.set(battle, target);
    if (battle) this.spirit.visible = false;
    else
      this.party.children.forEach((member) => member.rotation.set(0, member.userData.baseRotation ?? 0, 0));
    if (changedMode) this.setState(this.state);
  }
  setDefenseCharge(progress: number | null) {
    this.combatStage.defense(progress);
  }
  setState(state: WorldState) {
    this.state = state;
    this.interactingUntil = 0;
    const narrow = this.host.clientWidth < 700;
    const x = state.district === 'market' ? 5.5 : state.district === 'river' ? 1 : -3.5;
    if (state.mode === 'adventure') this.party.position.set(this.player.x, 0.09, this.player.z);
    else {
      this.party.position.set(x, 0.09, 2.3);
      this.party.rotation.set(0, 0, 0);
      this.party.children.forEach((actor) => {
        if (actor.userData.basePosition) {
          actor.position.copy(actor.userData.basePosition as T.Vector3);
          actor.rotation.y = actor.userData.baseRotation as number;
        }
      });
    }
    this.spirit.position.x = x + 3.5;
    this.spirit.visible =
      (state.mode === 'encounter' && state.trial) ||
      (state.mode === 'adventure' && !!this.adventure && !has(this.adventure, 'murmur'));
    if (state.mode === 'adventure') {
      const wisp = actors.find((a) => a.id === 'wisp')!;
      this.spirit.position.set(wisp.x, 2.3, wisp.z);
    }
    if (this.combat) this.spirit.visible = false;
    this.actorObjects.forEach((g) => {
      g.visible =
        state.mode === 'adventure' &&
        Math.hypot(g.position.x - this.player.x, g.position.z - this.player.z) < 25;
    });
    this.controls.enabled = state.mode === 'home' || state.mode === 'explore';
    const core = this.spirit.children[0] as T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>;
    core.material.color.set(state.boss ? '#d7a3f0' : '#75dccf');
    core.material.emissive.set(state.boss ? '#b27de3' : '#75dccf');
    if (state.mode === 'home') {
      this.targetPosition.set(this.player.x + 17, 11, this.player.z + 23);
      this.targetLook.set(this.player.x, 1, this.player.z - 1);
    } else if (state.mode === 'adventure') {
      this.targetPosition.set(
        this.player.x + (this.state.conversation ? 6 : 8),
        this.state.conversation ? 8 : 12,
        this.player.z + (this.state.conversation ? 11 : 15),
      );
      this.targetLook.set(this.player.x, 0.6, this.player.z - 1);
    } else if (state.mode === 'explore') {
      this.targetPosition.set(x + 10, 8, 18);
      this.targetLook.set(x, 1.4, -0.6);
    } else {
      this.targetPosition.set(x + (state.trial ? 5.8 : 3.4), narrow ? 5 : 4.1, narrow ? 13.2 : 10);
      this.targetLook.set(x + (state.trial ? 1.5 : 0), narrow ? 1.1 : 0.6, 1.5);
    }
    this.camera.fov = narrow ? 54 : 43;
    // Keep the party above the bottom dialogue on portrait screens.
    if (this.combat)
      this.camera.setViewOffset(
        this.host.clientWidth,
        this.host.clientHeight,
        0,
        this.host.clientHeight * (narrow ? 0.04 : 0.15),
        this.host.clientWidth,
        this.host.clientHeight,
      );
    else if (narrow && state.mode === 'encounter')
      this.camera.setViewOffset(
        this.host.clientWidth,
        this.host.clientHeight,
        0,
        this.host.clientHeight * 0.18,
        this.host.clientWidth,
        this.host.clientHeight,
      );
    else if (state.mode === 'adventure' && state.conversation)
      this.camera.setViewOffset(
        this.host.clientWidth,
        this.host.clientHeight,
        0,
        this.host.clientHeight *
          (state.contact && discoveryFor(state.contact) ? (narrow ? 0.24 : 0.2) : narrow ? 0.18 : 0.12),
        this.host.clientWidth,
        this.host.clientHeight,
      );
    else if (narrow && state.mode === 'adventure')
      this.camera.setViewOffset(
        this.host.clientWidth,
        this.host.clientHeight,
        0,
        this.host.clientHeight * 0.08,
        this.host.clientWidth,
        this.host.clientHeight,
      );
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }
  celebrate() {
    this.hitAt = this.elapsed;
    this.burst.visible = true;
    this.burst.position.copy(
      this.spirit.visible ? this.spirit.position : this.party.position.clone().add(new T.Vector3(0, 1.6, 0)),
    );
  }
  resetCamera() {
    this.interactingUntil = 0;
    this.setState(this.state);
  }
  setBackdrop(url: string) {
    new T.TextureLoader().load(url, (texture) => {
      if (this.disposed) {
        texture.dispose();
        return;
      }
      texture.colorSpace = T.SRGBColorSpace;
      texture.wrapS = T.RepeatWrapping;
      texture.repeat.x = 3;
      this.backgroundTexture?.dispose();
      this.backgroundTexture = texture;
      this.skyline.visible = false;
      const plate = new T.Mesh(
        new T.PlaneGeometry(540, 101.3),
        new T.MeshBasicMaterial({ map: texture, fog: false, toneMapped: false }),
      );
      plate.position.set(0, 24, -61);
      this.scene.add(plate);
      this.resize();
    });
  }
  private resize() {
    const w = this.host.clientWidth,
      h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.setState(this.state);
  }
  private render = (now: number) => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.render);
    if (document.hidden) {
      this.lastTime = now;
      this.quality.pause();
      return;
    }
    const rawMs = now - (this.lastTime || now);
    const dt = Math.min(rawMs / 1000, 0.05);
    this.lastTime = now;
    this.elapsed += dt;
    this.averageFrameMs = this.averageFrameMs * 0.9 + rawMs * 0.1;
    this.qualityFrames++;
    const assetsSettled =
      this.settledActors >= 2 &&
      this.cityScenery.props.state !== 'loading' &&
      this.cityScenery.hotelFurnishings.state !== 'loading' &&
      this.riverBoats.state !== 'loading';
    const reduced = this.quality.sample(rawMs, assetsSettled, this.combat?.phase !== 'defense') === 'low';
    if (reduced !== this.qualityReduced) {
      this.qualityReduced = reduced;
      this.renderer.setPixelRatio(reduced ? 1 : Math.min(window.devicePixelRatio, 1.25));
      this.renderer.shadowMap.enabled = !reduced;
      const changedMaterials = new Set<T.Material>();
      this.scene.traverse((obj) => {
        if (obj instanceof T.Mesh) {
          const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
          materials.forEach((material) => changedMaterials.add(material));
        }
      });
      changedMaterials.forEach((material) => {
        material.needsUpdate = true;
      });
      this.resize();
    }
    this.cityScenery.update(this.player, this.state.mode === 'adventure' || this.state.mode === 'home');
    this.cityScenery.life.update(now / 1000, this.reducedMotion);
    this.riverBoats.setPassage(this.departure === null ? null : crossingPose(this.departure));
    this.riverBoats.update(this.elapsed, this.reducedMotion);
    if (this.state.mode === 'adventure') {
      const movementTime = Math.min(rawMs / 1000, 0.2);
      const steps = Math.max(1, Math.ceil(movementTime / 0.035));
      for (let i = 0; i < steps; i++) this.updateAdventure(movementTime / steps, now);
    }
    if (this.combat)
      this.combatStage.update(
        now / 1000,
        this.party,
        this.targetPosition,
        this.targetLook,
        this.host.clientWidth < 700,
        this.reducedMotion,
      );
    if (now > this.interactingUntil) {
      const smooth = cameraBlend(rawMs / 1000, this.reducedMotion);
      this.camera.position.lerp(this.targetPosition, smooth);
      this.controls.target.lerp(this.targetLook, smooth);
    }
    this.controls.update();
    const residentParty = this.party.children
      .filter((p) => p.userData.basePosition)
      .map((p) => {
        const position = p.getWorldPosition(new T.Vector3());
        return { x: position.x, z: position.z };
      });
    this.cityResidents?.update(
      dt,
      this.player,
      [this.player, ...residentParty, this.escort.state.position],
      this.state.mode === 'adventure' && !this.combat,
      this.adventurePaused || !!this.state.conversation,
      this.reducedMotion,
    );
    this.cityPeople.update(dt, this.player, this.reducedMotion, this.state.contact);
    this.updateReunion();
    const sunAnchor =
      this.state.mode === 'adventure' || this.state.mode === 'home' ? this.player : { x: 0, z: 0 };
    this.sunlight.position.set(sunAnchor.x - 12, 18, sunAnchor.z + 9);
    this.sunlight.target.position.set(sunAnchor.x, 0, sunAnchor.z);
    if (this.state.mode === 'adventure' || this.state.mode === 'home') {
      const focalPoints = [{ x: this.player.x, y: 1.55, z: this.player.z }];
      this.party.children.forEach((actor) => {
        if (actor.userData.basePosition)
          focalPoints.push({
            x: this.party.position.x + actor.position.x,
            y: 1.55,
            z: this.party.position.z + actor.position.z,
          });
      });
      const contact = this.worldActors().find((a) => a.id === this.nearest);
      if (contact) focalPoints.push({ x: contact.x, y: 1.55, z: contact.z });
      if (this.reunionGathering.root.visible)
        this.reunionGathering.root.children.forEach((guest) => {
          const p = new T.Box3().setFromObject(guest).getCenter(new T.Vector3());
          focalPoints.push({ x: p.x, y: 1.55, z: p.z });
        });
      this.cityScenery.revealParty(this.camera.position, focalPoints);
      this.worldCutaways.forEach(({ object, bounds }) => {
        object.visible = !focalPoints.some((point) => blocksCityView(bounds, this.camera.position, point));
      });
    } else {
      this.worldCutaways.forEach(({ object }) => {
        object.visible = true;
      });
    }
    this.walkClips.forEach(({ idle, walk, player }) => {
      if (walk) {
        const moving =
          this.state.mode === 'adventure' &&
          ((this.isWalking && !this.adventurePaused) ||
            (player ? !!this.staging?.playerPath.length : !!this.staging?.path.length));
        const weight = this.reducedMotion
          ? 0
          : T.MathUtils.lerp(walk.getEffectiveWeight(), moving ? 1 : 0, 1 - Math.exp(-dt * 12));
        idle.setEffectiveWeight(1 - weight);
        walk.setEffectiveWeight(weight);
      }
    });
    if (!this.reducedMotion) {
      this.mixers.forEach((m) => m.update(dt));
      this.animated.forEach((fn) => fn(this.elapsed, dt));
      this.particles.rotation.y = this.elapsed * 0.009;
    }
    const since = this.elapsed - this.hitAt;
    if (since < 1.4) {
      this.burst.children.forEach((s, i) => {
        const a = i * 2.4;
        s.position.set(Math.cos(a) * since * 2.6, Math.sin(i * 8.1) * since * 2.4, Math.sin(a) * since * 2.6);
        s.scale.setScalar(Math.max(0, 1 - since / 1.4));
      });
      if (this.spirit.visible)
        this.spirit.scale.setScalar(
          (this.state.boss ? 1.4 : 1) * (1 + Math.sin(since * 24) * 0.05 * (1 - since / 1.4)),
        );
    } else {
      this.burst.visible = false;
      this.spirit.scale.setScalar(this.state.boss ? 1.4 : 1);
    }
    // A single scene pass avoids the cost of multisampling and postprocessing.
    // Emissive lanterns and practical lights carry the mood without a costly blur chain.
    if (this.adventure)
      this.travelLantern?.update(
        this.adventure.lantern,
        this.party.children.find((actor) => actor.userData.basePosition && !actor.userData.player),
        this.state.mode === 'adventure' && !this.combat,
      );
    this.updateDeparture(dt);
    this.renderer.render(this.scene, this.camera);
    if (import.meta.env.DEV && this.qualityFrames % 20 === 0) {
      this.host.dataset.frameMs = this.averageFrameMs.toFixed(1);
      this.host.dataset.graphicsQuality = this.qualityReduced ? 'low' : 'high';
      this.host.dataset.shadowsEnabled = String(this.renderer.shadowMap.enabled);
      this.host.dataset.qualityFrameMs = this.quality.percentileMs.toFixed(1);
      this.host.dataset.renderPixelRatio = String(this.renderer.getPixelRatio());
      this.host.dataset.drawCalls = String(this.renderer.info.render.calls);
      this.host.dataset.riverArena = JSON.stringify(this.combatStage.environment.snapshot());
      this.host.dataset.riverSpirits = JSON.stringify(
        this.combatStage.spirits.snapshot(this.camera, this.host.clientWidth, this.host.clientHeight),
      );
      this.host.dataset.cityArchitecture = JSON.stringify(this.cityScenery.architecture.counts);
      this.host.dataset.cityLandmarks = JSON.stringify(this.cityScenery.landmarks.snapshot());
      this.host.dataset.cityFoodStall = JSON.stringify(this.cityScenery.foodStall.snapshot());
      this.host.dataset.hotelFurnishings = JSON.stringify(this.cityScenery.hotelFurnishings.snapshot());
      this.host.dataset.riverBoats = JSON.stringify(
        this.riverBoats.snapshot(this.camera, this.host.clientWidth, this.host.clientHeight),
      );
      this.host.dataset.ferryPassage = JSON.stringify({
        progress: this.departure,
        ...this.ferryPassengers.snapshot(this.camera, this.host.clientWidth, this.host.clientHeight),
      });
      this.host.dataset.cityShophouses = JSON.stringify(this.cityScenery.shophouses.snapshot());
      this.host.dataset.reunionGathering = JSON.stringify(
        this.reunionGathering.snapshot(this.camera, this.host.clientWidth, this.host.clientHeight),
      );
      this.host.dataset.cityEvening = JSON.stringify(this.cityScenery.evening.snapshot());
      this.host.dataset.travelLantern = JSON.stringify(this.travelLantern?.snapshot() ?? null);
      this.host.dataset.visibleMemories = JSON.stringify(
        [...this.questMarkers].filter(([id, marker]) => discoveryFor(id) && marker.visible).map(([id]) => id),
      );
      this.host.dataset.cityWayfinding = JSON.stringify({
        signs: this.cityScenery.wayfinding.signs.length,
        rearFacades: this.cityScenery.architecture.rearFacades,
        mounts: this.cityScenery.wayfinding.signs.map(({ site, group, support }) => ({
          id: site.id,
          visible: group.visible,
          supportVisible: support?.visible,
        })),
      });
      this.host.dataset.cityBackdrop = JSON.stringify({
        buildings: this.cityScenery.backdrop.buildings.length,
        visible: this.cityScenery.backdrop.zones
          .filter((g) => g.visible && g.parent?.visible)
          .map((g) => g.name),
      });
      this.host.dataset.groundLight = JSON.stringify({
        batches: this.cityScenery.groundLight.meshes.length,
        visible: this.cityScenery.groundLight.meshes.filter((mesh) => mesh.parent?.visible).length,
        patches: this.cityScenery.groundLight.meshes.reduce((n, mesh) => n + mesh.count, 0),
        shadows: this.renderer.shadowMap.enabled,
      });
      this.host.dataset.triangles = String(this.renderer.info.render.triangles);
      this.host.dataset.cityLife = JSON.stringify(this.cityScenery.life.snapshot());
      this.host.dataset.cityFurniture = JSON.stringify(this.cityScenery.props.furniture);
      this.host.dataset.cityPeople = JSON.stringify(this.cityPeople.snapshot());
      this.host.dataset.cityResidents = JSON.stringify(this.cityResidents?.snapshot() ?? []);
      this.host.dataset.conversationCast = JSON.stringify(this.conversationCast());
      this.host.dataset.battleCast = JSON.stringify(
        this.combat
          ? this.party.children
              .filter((h) => h.userData.basePosition)
              .map((h) => {
                const head = (h.getObjectByName('Head') ?? h)
                  .getWorldPosition(new T.Vector3())
                  .project(this.camera);
                return {
                  id: h.userData.player ? 'patrick' : 'su',
                  x: ((head.x + 1) * this.host.clientWidth) / 2,
                  y: ((1 - head.y) * this.host.clientHeight) / 2,
                };
              })
          : [],
      );
    }
  };
  setDeparture(progress: number | null) {
    if (progress === null && this.departure !== null) {
      this.party.visible = true;
      this.setState(this.state);
    }
    this.departure = progress;
  }
  private updateReunion() {
    const active =
      !!this.state.reunion &&
      !!this.staging &&
      !this.staging.path.length &&
      !this.staging.playerPath.length &&
      !this.combat;
    const contact = actors.find((a) => a.id === this.state.contact);
    const sources = ['innkeeper', 'artisan', 'ferry'].flatMap((id) => {
      const actor = this.actorObjects.get(id as ActorId);
      if (!actor?.userData.appearanceReady) return [];
      const object =
        actor.children.find((c) => {
          let skinned = false;
          c.traverse((o) => {
            if (o instanceof T.SkinnedMesh) skinned = true;
          });
          return skinned;
        }) ?? actor.children.find((c) => c.visible && c instanceof T.Group);
      return object ? [{ id, object }] : [];
    });
    const angle = contact ? conversationCamera(this.player, contact) : { x: 6, z: 11 };
    this.reunionGathering.update(
      active,
      contact ?? null,
      [this.player, this.staging?.current ?? this.player],
      sources,
      this.elapsed,
      this.reducedMotion,
      angle,
    );
    if (active && contact && this.reunionGathering.root.visible) {
      const narrow = this.host.clientWidth < 700;
      const center = new T.Box3().setFromObject(this.reunionGathering.root).getCenter(new T.Vector3());
      if (!Number.isFinite(center.x)) return;
      center.lerp(new T.Vector3(contact.x, 1, contact.z), 0.4);
      this.camera.setViewOffset(
        this.host.clientWidth,
        this.host.clientHeight,
        0,
        this.host.clientHeight * 0.24,
        this.host.clientWidth,
        this.host.clientHeight,
      );
      this.camera.position.set(
        center.x + angle.x * (narrow ? 2.1 : 1.4),
        narrow ? 11 : 8,
        center.z + angle.z * (narrow ? 2.1 : 1.4),
      );
      this.camera.lookAt(center.x, 1, center.z);
      this.camera.updateProjectionMatrix();
    }
  }
  private updateDeparture(dt: number) {
    const pose = this.departure === null ? null : crossingPose(this.departure);
    if (pose) {
      const riders: FerryRider[] = this.party.children
        .filter((p) => p.userData.basePosition)
        .map((p) => ({
          id: p.userData.player ? 'patrick' : 'su',
          object: p,
          clip: this.walkClips.find((c) => c.player === !!p.userData.player)?.idle.getClip(),
          x: p.userData.player ? 0.85 : -0.15,
          z: 0,
        }));
      const niran = this.actorObjects.get('ferry');
      const driver =
        niran?.children.find((c) => {
          let skinned = false;
          c.traverse((o) => {
            if (o instanceof T.SkinnedMesh) skinned = true;
          });
          return skinned;
        }) ?? niran?.children.find((c) => c.visible && c instanceof T.Group);
      if (driver) riders.push({ id: 'niran', object: driver, x: -2.1, z: 0.32 });
      this.ferryPassengers.prepare(riders);
      this.party.visible = false;
      if (niran) niran.visible = false;
      const narrow = this.host.clientWidth < 700;
      this.camera.clearViewOffset();
      this.camera.setViewOffset(
        this.host.clientWidth,
        this.host.clientHeight,
        0,
        this.host.clientHeight * 0.12,
        this.host.clientWidth,
        this.host.clientHeight,
      );
      this.camera.position.set(pose.x + (narrow ? 8 : 7), narrow ? 6 : 4.8, pose.z - (narrow ? 16 : 11));
      this.camera.fov = narrow ? 60 : 43;
      this.camera.lookAt(pose.x - 0.4, 0.5, pose.z);
      this.camera.updateProjectionMatrix();
    }
    this.ferryPassengers.update(pose, dt, this.reducedMotion);
  }
  configureAdventure(
    save: AdventureSave,
    callbacks: {
      interact: (id: ActorId) => void;
      near: (id: ActorId | null) => void;
      move: (p: Point, escort?: EscortSave) => void;
    },
    paused: boolean,
  ) {
    if (!this.adventure) {
      this.escort.sync(save.escort, true);
      this.player = { ...save.position };
      this.trail = [companionStart(this.player, { x: this.player.x + 0.8, z: this.player.z + 0.6 })];
      this.buildAdventureActors();
      this.travelLantern = new TravelLantern(this.scene, this.cityScenery.chunks.get('oldtown')!, (root) =>
        this.batchStatic(root),
      );
      void this.discoveryModels.load((root) => this.batchStatic(root));
      this.cityResidents = new CityResidents(this.scene, this.cityPeople);
    }
    if (Math.hypot(save.position.x - this.player.x, save.position.z - this.player.z) > 3) {
      this.player = { ...save.position };
      this.path = [];
      this.trail = [];
    }
    this.adventure = save;
    this.cityScenery.evening.sync(save);
    this.escort.sync(save.escort);
    const canal = this.actorObjects.get('canal-lantern');
    if (canal) {
      const lit = has(save, 'canal-restored');
      canal.getObjectByName('torn-shade')!.visible = !lit;
      canal.getObjectByName('repaired-shade')!.visible = lit;
      const light = canal.getObjectByName('canal-light') as T.PointLight;
      light.intensity = lit ? 7 : 0;
      if (import.meta.env.DEV)
        this.host.dataset.canalLantern = JSON.stringify({
          shade: canal.getObjectByName('repaired-shade')!.visible,
          intensity: light.intensity,
        });
    }
    this.loadWalkClips();
    this.adventureCallbacks = callbacks;
    this.adventurePaused = paused;
    if (paused) {
      this.keys.clear();
      this.touchDirection = { x: 0, z: 0 };
      this.path = [];
      this.walkingTo = null;
    }
    const goal = objective(save).actor;
    this.questMarkers.forEach((sprite, id) => {
      sprite.material.color.set(
        id === goal
          ? '#ffe395'
          : has(save, id === 'waystone' ? 'sentinel' : id === 'canal-lantern' ? 'canal-restored' : id)
            ? '#80afa2'
            : '#b3d7ee',
      );
      const scale = id === goal ? 1.3 : 1;
      sprite.scale.set(1.1 * scale, 0.55 * scale, 1);
    });
    if (this.chestLid) this.chestLid.rotation.x = has(save, 'chest') ? -1.1 : 0;
    this.beaconGlow.visible = has(save, 'keeper');
  }
  moveDirection(x: number, z: number) {
    this.touchDirection = { x, z };
    this.path = [];
    this.walkingTo = null;
  }
  travelPoint(point: Point) {
    if (this.adventurePaused || this.state.mode !== 'adventure') return;
    this.path = findPath(this.player, point);
    this.walkingTo = null;
  }
  travelTo(id: ActorId) {
    if (this.adventurePaused || this.state.mode !== 'adventure') return;
    if (id === 'su' && this.adventure && has(this.adventure, 'intro')) {
      this.adventureCallbacks?.interact('su');
      return;
    }
    const actor = this.worldActors().find((a) => a.id === id)!;
    this.path = findPath(this.player, { x: actor.x, z: Math.max(id === 'ferry' ? -6 : -0.5, actor.z) });
    this.walkingTo = id;
  }
  interactNearby() {
    if (this.nearest && !this.adventurePaused) this.adventureCallbacks?.interact(this.nearest);
  }
  private clearKeys = () => {
    this.keys.clear();
    this.touchDirection = { x: 0, z: 0 };
  };
  private keyDown = (e: KeyboardEvent) => {
    if (
      this.state.mode !== 'adventure' ||
      this.adventurePaused ||
      e.ctrlKey ||
      e.metaKey ||
      e.altKey ||
      (e.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName))
    )
      return;
    const k = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
      e.preventDefault();
      this.keys.add(k);
      this.path = [];
      this.walkingTo = null;
    }
    if (k === 'e' && !e.repeat) {
      e.preventDefault();
      this.interactNearby();
    }
  };
  private keyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key.toLowerCase());
  };
  private adventureClick(e: PointerEvent) {
    if (
      this.adventurePaused ||
      Math.hypot(e.clientX - this.pointerStart.x, e.clientY - this.pointerStart.y) > 8
    )
      return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ray = new T.Raycaster();
    ray.setFromCamera(
      new T.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      this.camera,
    );
    for (const hit of ray.intersectObjects([...this.actorObjects.values()], true)) {
      let obj: T.Object3D | null = hit.object;
      while (obj) {
        if (obj.userData.actorId) {
          this.travelTo(obj.userData.actorId as ActorId);
          return;
        }
        obj = obj.parent;
      }
    }
    const point = ray.ray.intersectPlane(new T.Plane(new T.Vector3(0, 1, 0), -0.1), new T.Vector3());
    if (point) {
      this.path = findPath(this.player, point);
      this.walkingTo = null;
    }
  }
  private updateAdventure(dt: number, now: number) {
    if (!this.adventure) return;
    this.escort.update(this.player, dt, this.adventurePaused);
    const traveler = this.actorObjects.get('traveler');
    if (traveler) {
      traveler.position.x = this.escort.state.position.x;
      traveler.position.z = this.escort.state.position.z;
      traveler.userData.walking = this.escort.moving;
      traveler.userData.walkFacing = this.escort.facing;
    }
    if (this.staging && !this.state.conversation) {
      this.clearConversationStaging();
    }
    if (!this.adventurePaused) {
      let dx =
        this.touchDirection.x +
        (this.keys.has('d') || this.keys.has('arrowright') ? 1 : 0) -
        (this.keys.has('a') || this.keys.has('arrowleft') ? 1 : 0);
      let dz =
        this.touchDirection.z +
        (this.keys.has('s') || this.keys.has('arrowdown') ? 1 : 0) -
        (this.keys.has('w') || this.keys.has('arrowup') ? 1 : 0);
      if (dx || dz) {
        const len = Math.hypot(dx, dz);
        const a = Math.atan2(8, 15);
        const x = dx / len,
          z = dz / len;
        dx = x * Math.cos(a) + z * Math.sin(a);
        dz = -x * Math.sin(a) + z * Math.cos(a);
      }
      const previous = this.player;
      if (dx || dz) this.player = stepPlayer(this.player, dx * dt * 4.5, dz * dt * 4.5);
      else {
        this.player = followPath(this.player, this.path, dt * 4.5);
        dx = this.player.x - previous.x;
        dz = this.player.z - previous.z;
      }
      this.isWalking = Math.hypot(previous.x - this.player.x, previous.z - this.player.z) > 0.001;
      this.party.position.set(
        this.player.x,
        0.09 + (dx || dz ? Math.abs(Math.sin(this.elapsed * 12)) * 0.065 : 0),
        this.player.z,
      );
      this.party.rotation.y = 0;
      if (this.isWalking) {
        this.trail.unshift({ ...previous });
        if (this.trail.length > 100) this.trail.pop();
      }
      const follower = this.trail.find((p) => Math.hypot(p.x - this.player.x, p.z - this.player.z) >= 1.2) ??
        this.trail.at(-1) ?? { x: this.player.x + 0.8, z: this.player.z + 0.6 };
      this.party.children.forEach((actor) => {
        const base = actor.userData.basePosition as T.Vector3 | undefined;
        if (!base) return;
        const player = actor.userData.player as boolean;
        actor.position.set(
          base.x + (player ? 1.05 : -1.1 + follower.x - this.player.x),
          base.y,
          base.z + (player ? 0 : follower.z - this.player.z),
        );
        if (dx || dz) actor.rotation.y = Math.atan2(dx, dz);
      });
      const near =
        this.worldActors()
          .filter((a) => !(a.id === 'su' && has(this.adventure!, 'intro')))
          .map((a) => ({ id: a.id, distance: Math.hypot(a.x - this.player.x, a.z - this.player.z) }))
          .filter((a) => a.distance < 2.1)
          .sort((a, b) => a.distance - b.distance)[0]?.id ?? null;
      if (near !== this.nearest) {
        this.nearest = near;
        this.adventureCallbacks?.near(near);
      }
      if (
        this.walkingTo &&
        Math.hypot(
          this.worldActors().find((a) => a.id === this.walkingTo)!.x - this.player.x,
          this.worldActors().find((a) => a.id === this.walkingTo)!.z - this.player.z,
        ) < 1.8
      ) {
        const id = this.walkingTo;
        this.walkingTo = null;
        this.path = [];
        this.adventureCallbacks?.move({ ...this.player }, this.escort.state);
        this.adventureCallbacks?.interact(id);
      }
      if (now - this.lastMoveReport > 600) {
        this.lastMoveReport = now;
        this.adventureCallbacks?.move({ ...this.player }, this.escort.state);
      }
    }
    this.targetPosition.set(
      this.player.x + (this.state.conversation ? 6 : 8),
      this.state.conversation ? 8 : 12,
      this.player.z + (this.state.conversation ? 11 : 15),
    );
    this.targetLook.set(this.player.x, 0.6, this.player.z - 1);
    this.stageConversation(dt);
    const wisp = actors.find((a) => a.id === 'wisp')!;
    this.spirit.position.x = wisp.x;
    this.spirit.position.z = wisp.z;
    this.spirit.visible = !has(this.adventure, 'murmur');
    this.questMarkers.forEach((marker, id) => {
      marker.position.y = 2.9 + Math.sin(this.elapsed * 2 + id.length) * 0.1;
      const site = discoveryFor(id);
      marker.visible = site
        ? !has(this.adventure!, id) &&
          Math.hypot(site.x - this.player.x, site.z - this.player.z) <
            lanternRevealRadius(this.adventure!.lantern)
        : !(id === 'su' && has(this.adventure!, 'intro'));
    });
    if (import.meta.env.DEV) {
      this.host.dataset.cityArea = cityAreaAt(this.player) ?? 'roads';
      this.host.dataset.cityProps = this.cityScenery.props.state;
      this.host.dataset.discoveryModels = this.discoveryModels.state;
      this.host.dataset.hotelNorthWall = String(
        this.cityScenery.cutaways.find(({ object }) => object.name === 'hotel-north-wall')?.object.visible,
      );
      this.host.dataset.npcReady = String(
        [...this.actorObjects.entries()].filter(
          ([id, g]) =>
            ['innkeeper', 'cook', 'ferry', 'station', 'gardener', 'artisan', 'archivist'].includes(id) &&
            g.userData.appearanceReady,
        ).length,
      );
      this.host.dataset.playerX = this.player.x.toFixed(2);
      this.host.dataset.escort = JSON.stringify({
        ...this.escort.state,
        moving: this.escort.moving,
        ready: !!traveler?.userData.appearanceReady,
      });
      this.host.dataset.playerZ = this.player.z.toFixed(2);
      this.host.dataset.archive = JSON.stringify(this.cityScenery?.archive.snapshot());
    }
  }
  private clearConversationStaging() {
    if (!this.staging) return;
    const previous = this.staging;
    this.staging = null;
    this.trail = [{ ...previous.current }];
    if (previous.playerMoved) this.adventureCallbacks?.move({ ...this.player }, this.escort.state);
  }
  private stageConversation(dt: number) {
    const contact =
      this.state.conversation && !this.combat
        ? this.worldActors().find((a) => a.id === this.state.contact)
        : undefined;
    const members = this.party.children.filter((a) => a.userData.basePosition);
    const companion = members.find((a) => !a.userData.player);
    if (
      !contact ||
      !companion ||
      (!['waystone', 'canal-lantern'].includes(contact.id) &&
        !discoveryFor(contact.id) &&
        !this.actorObjects.get(contact.id)?.userData.appearanceReady)
    ) {
      this.clearConversationStaging();
      return;
    }
    const base = companion.userData.basePosition as T.Vector3;
    if (this.staging?.contact !== contact.id) {
      const current = companionStart(this.player, {
        x: this.player.x + companion.position.x - base.x + 1.1,
        z: this.player.z + companion.position.z - base.z,
      });
      const playerMark = playerConversationMark(this.player, contact, current);
      this.path = [];
      this.walkingTo = null;
      this.staging = {
        contact: contact.id,
        current,
        path: [],
        playerPath: findPath(this.player, playerMark),
        playerMoved: false,
        companionPlanned: false,
      };
    }
    if (this.staging.playerPath.length) {
      const before = this.player;
      this.player = followPath(this.player, this.staging.playerPath, dt * 2.4);
      this.staging.playerMoved ||= Math.hypot(this.player.x - before.x, this.player.z - before.z) > 0.00001;
      this.party.position.set(this.player.x, 0.09, this.player.z);
      if (!this.staging.playerPath.length && this.staging.playerMoved) {
        this.staging.playerMoved = false;
        this.adventureCallbacks?.move({ ...this.player }, this.escort.state);
      }
    }
    if (!this.staging.playerPath.length && !this.staging.companionPlanned) {
      const mark = companionMark(this.player, contact, this.staging.current);
      this.staging.path = findPath(this.staging.current, mark);
      this.staging.companionPlanned = true;
    }
    this.staging.current = followPath(this.staging.current, this.staging.path, dt * 2.4);
    const point = this.staging.current;
    companion.position.set(base.x - 1.1 + point.x - this.player.x, base.y, base.z + point.z - this.player.z);
    for (const member of members) {
      const p = member.userData.player ? this.player : point;
      const route = member.userData.player ? this.staging.playerPath : this.staging.path;
      const target = route[0] ?? contact;
      const facing = Math.atan2(target.x - p.x, target.z - p.z);
      const delta = Math.atan2(Math.sin(facing - member.rotation.y), Math.cos(facing - member.rotation.y));
      member.rotation.y += delta * (this.reducedMotion ? 1 : 1 - Math.exp(-dt * 9));
    }
    const center = {
      x: (this.player.x + point.x + contact.x) / 3,
      z: (this.player.z + point.z + contact.z) / 3,
    };
    const camera = conversationCamera(this.staging.playerPath.at(-1) ?? this.player, contact);
    this.targetPosition.set(center.x + camera.x, 7.4, center.z + camera.z);
    this.targetLook.set(center.x, 0.85, center.z);
  }
  private conversationCast() {
    if (!this.staging) return null;
    const discovery = discoveryFor(this.staging.contact);
    const points = [
      { id: 'patrick', ...this.player },
      { id: 'su', ...this.staging.current },
      this.worldActors().find((a) => a.id === this.staging!.contact)!,
    ];
    return {
      moving: !!this.staging.path.length || !!this.staging.playerPath.length,
      objectFrame: discovery
        ? this.discoveryModels.frame(discovery.id, this.camera, this.host.clientWidth, this.host.clientHeight)
        : null,
      members: points.map((p) => {
        const screen = new T.Vector3(p.x, 1, p.z).project(this.camera);
        return {
          id: p.id,
          x: p.x,
          z: p.z,
          screenX: ((screen.x + 1) * this.host.clientWidth) / 2,
          screenY: ((1 - screen.y) * this.host.clientHeight) / 2,
        };
      }),
    };
  }
  private loadWalkClips() {
    for (const entry of this.walkClips) {
      if (entry.loading) continue;
      entry.loading = true;
      void new GLTFLoader()
        .loadAsync(entry.url)
        .then((gltf) => {
          if (!this.disposed && gltf.animations[0]) {
            const clip = gltf.animations[0].clone();
            // Movement belongs to the controller, not imported animation root motion.
            clip.tracks = clip.tracks.filter((track) => !track.name.endsWith('.position'));
            entry.walk = entry.mixer.clipAction(clip).setEffectiveWeight(0).play();
          }
          this.disposeObject(gltf.scene);
        })
        .catch(() => {
          /* The idle rig and movement remain usable if an optional clip fails. */
        });
    }
  }
  private buildAdventureActors() {
    for (const a of actors) {
      const group = new T.Group();
      group.position.set(a.x, a.id === 'gardener' ? 0.27 : 0.15, a.z);
      group.userData.actorId = a.id;
      this.scene.add(group);
      this.actorObjects.set(a.id, group);
      const discovery = discoveryFor(a.id);
      if (archiveSite(a.id) && a.id !== 'archivist') {
        // The archive model owns the records and their furniture; markers remain interactive.
        group.userData.appearanceReady = true;
        this.box([0.55, 0.035, 0.4], [0, 0.88, 0.7], '#e1c98c', group);
      } else if (discovery) this.discoveryModels.add(discovery, group, (root) => this.batchStatic(root));
      else if (
        ['innkeeper', 'cook', 'ferry', 'station', 'gardener', 'artisan', 'traveler', 'archivist'].includes(
          a.id,
        )
      ) {
        const fallback = new T.Group();
        group.add(fallback);
        this.cylinder(0.28, 0.85, [0, 0.85, 0], a.color, fallback, 0.2);
        this.mesh(new T.SphereGeometry(0.24, 12, 8), '#bc8d6a', fallback, [0, 1.48, 0]);
        this.mesh(new T.SphereGeometry(0.25, 12, 8), '#292b35', fallback, [0, 1.6, -0.03]).scale.y = 0.6;
        for (const x of [-0.16, 0.16]) {
          this.cylinder(0.1, 0.5, [x, 0.3, 0], '#303a43', fallback);
          this.box([0.18, 0.15, 0.3], [x, 0.08, 0.09], '#41322b', fallback);
        }
        for (const x of [-0.34, 0.34]) this.cylinder(0.075, 0.55, [x, 1, 0], '#bc8d6a', fallback);
        if (a.id === 'cook') this.cylinder(0.28, 0.18, [0, 1.76, 0], '#f5edda', fallback);
        if (a.id === 'ferry') this.cylinder(0.32, 0.08, [0, 1.79, 0], '#c99c57', fallback);
        void this.cityPeople.load(a.id, group, fallback);
      } else if (a.id === 'canal-lantern') {
        this.cylinder(0.45, 0.2, [0, 0.12, 0], '#697569', group);
        this.cylinder(0.065, 1.3, [0, 0.78, 0], '#9b8055', group);
        const torn = this.mesh(
          new T.CylinderGeometry(0.3, 0.34, 0.68, 8, 1, true, 0, Math.PI * 1.45),
          '#8d9076',
          group,
          [0, 1.62, 0],
        );
        torn.name = 'torn-shade';
        torn.rotation.z = 0.2;
        const repaired = this.mesh(
          new T.CylinderGeometry(0.3, 0.34, 0.68, 12),
          '#ffe2a0',
          group,
          [0, 1.62, 0],
          1.6,
        );
        repaired.name = 'repaired-shade';
        repaired.visible = false;
        for (const y of [1.26, 1.98]) this.cylinder(0.35, 0.06, [0, y, 0], '#ad8c52', group);
        const light = new T.PointLight('#ffd494', 0, 6, 2);
        light.name = 'canal-light';
        light.position.y = 1.65;
        group.add(light);
        this.box([0.48, 0.3, 0.04], [0, 0.8, 0.12], '#d0bea0', group);
      } else if (a.id === 'waystone') {
        this.cylinder(0.85, 0.18, [0, 0.1, 0], '#625d4c', group);
        this.cylinder(0.55, 0.55, [0, 0.42, 0], '#314c4e', group, 0.7);
        const compass = new T.Group();
        compass.position.y = 1.3;
        group.add(compass);
        this.mesh(new T.TorusGeometry(0.65, 0.045, 8, 48), '#e4bb72', compass, [0, 0, 0], 0.7);
        this.mesh(new T.IcosahedronGeometry(0.22, 0), '#b8f1e0', compass, [0, 0, 0], 1.7);
        for (let i = 0; i < 4; i++) {
          const angle = (i * Math.PI) / 2;
          const arrow = this.mesh(
            new T.ConeGeometry(0.12, 0.45, 4),
            '#e4bb72',
            compass,
            [Math.sin(angle) * 0.43, Math.cos(angle) * 0.43, 0],
            0.4,
          );
          arrow.rotation.z = -angle;
        }
        this.animated.push((time) => {
          compass.rotation.y = this.adventure && has(this.adventure, 'sentinel') ? 0 : time * 0.4;
        });
      } else if (a.id === 'chest') {
        this.box([1.1, 0.65, 0.75], [0, 0.35, 0], '#6b4537', group);
        const lid = new T.Group();
        lid.position.set(0, 0.7, -0.35);
        group.add(lid);
        this.chestLid = lid;
        this.box([1.14, 0.2, 0.8], [0, 0.04, 0.35], '#a57e49', lid);
        for (const x of [-0.4, 0.4]) this.box([0.07, 0.65, 0.78], [x, 0.35, 0], '#d4b777', group);
        this.box([0.16, 0.22, 0.08], [0, 0.59, 0.43], '#f0d48c', group);
      } else if (a.id === 'shrine') {
        this.cylinder(0.65, 0.3, [0, 0.15, 0], '#736769', group);
        this.cylinder(0.15, 1.5, [0, 1, 0], '#b59761', group);
        this.lantern(0, 1.8, 0, group, '#ffe8a8');
        group.add(this.beaconGlow);
        for (let i = 0; i < 8; i++) {
          const spark = this.mesh(new T.OctahedronGeometry(0.13), '#ffe9a8', this.beaconGlow, [0, 0, 0], 3);
          this.animated.push((t) => {
            const a = t + (i * Math.PI) / 4;
            spark.position.set(Math.cos(a) * 0.85, 1.7 + ((t * 0.4 + i * 0.3) % 2.6), Math.sin(a) * 0.85);
          });
        }
        this.beaconGlow.visible = false;
      }
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 128;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#122d38e6';
      ctx.beginPath();
      ctx.roundRect(18, 12, 220, 104, 24);
      ctx.fill();
      ctx.strokeStyle = '#e9d296';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.fillStyle = '#fff0c8';
      ctx.textAlign = 'center';
      ctx.font = 'bold 52px Georgia';
      ctx.fillText(
        discovery || a.id === 'chest'
          ? '◇'
          : a.id === 'waystone'
            ? '✥'
            : a.id === 'wisp'
              ? '⚡'
              : a.id === 'shrine'
                ? '✦'
                : '!',
        128,
        84,
      );
      const texture = new T.CanvasTexture(canvas);
      texture.colorSpace = T.SRGBColorSpace;
      this.textures.add(texture);
      const marker = new T.Sprite(
        new T.SpriteMaterial({ map: texture, depthTest: false, transparent: true }),
      );
      marker.position.y = 2.9;
      marker.scale.set(1.1, 0.55, 1);
      group.add(marker);
      this.questMarkers.set(a.id, marker);
    }
  }
  private disposeObject(root: T.Object3D) {
    disposeWorldObject(root);
  }
  private batchStatic(root: T.Object3D) {
    root.updateMatrixWorld(true);
    const inverse = root.matrixWorld.clone().invert();
    const batches = new Map<T.Material, T.Mesh[]>();
    root.traverse((obj) => {
      if (!(obj instanceof T.Mesh) || Array.isArray(obj.material)) return;
      let parent: T.Object3D | null = obj;
      while (parent && parent !== root) {
        if (parent.userData.animated || parent === this.skyline) return;
        parent = parent.parent;
      }
      const group = batches.get(obj.material) ?? [];
      group.push(obj);
      batches.set(obj.material, group);
    });
    for (const [material, meshes] of batches) {
      if (meshes.length < 2) continue;
      const parts = meshes.map((m) => {
        const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
        g.applyMatrix4(inverse.clone().multiply(m.matrixWorld));
        return g;
      });
      const geometry = mergeGeometries(parts);
      parts.forEach((g) => g.dispose());
      if (!geometry) continue;
      meshes.forEach((m) => {
        m.removeFromParent();
        m.geometry.dispose();
      });
      const combined = new T.Mesh(geometry, material);
      combined.castShadow = true;
      combined.receiveShadow = true;
      root.add(combined);
    }
  }
  private registerWorldCutaway(object: T.Object3D) {
    object.userData.animated = true;
    object.updateWorldMatrix(true, true);
    this.worldCutaways.push({ object, bounds: new T.Box3().setFromObject(object) });
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    window.removeEventListener('keydown', this.keyDown);
    window.removeEventListener('keyup', this.keyUp);
    window.removeEventListener('blur', this.clearKeys);
    this.controls.removeEventListener('start', this.handleOrbit);
    this.controls.dispose();
    this.renderer.domElement.removeEventListener('pointerdown', this.pointerDown);
    this.renderer.domElement.removeEventListener('pointerup', this.pointerUp);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.contextLost);
    this.mixers.forEach((m) => {
      m.stopAllAction();
      m.uncacheRoot(m.getRoot());
    });
    this.cityPeople.dispose();
    this.discoveryModels.dispose();
    this.travelLantern?.dispose();
    this.riverBoats.dispose();
    this.ferryPassengers.dispose();
    this.combatStage.environment.dispose();
    this.combatStage.spirits.dispose();
    if (this.backgroundTexture) this.textures.add(this.backgroundTexture);
    disposeWorldObject(this.scene, this.textures);
    this.textures.clear();
    this.cityScenery.dispose();
    this.renderer.dispose();
    // A new world creates a new renderer. Retire this context immediately rather
    // than relying on browser garbage collection during repeated camp visits.
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
