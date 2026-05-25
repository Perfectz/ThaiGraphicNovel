import * as THREE from 'three';

/**
 * Normalized pointer state owned by the engine. Components and subclasses read
 * from this — never write to it directly.
 *
 * - `x` / `y` — smoothed values in the range [-1, 1].
 * - `targetX` / `targetY` — raw values pre-smoothing; useful if a subclass needs
 *   the instantaneous pointer (e.g. for snap-back logic) without easing.
 */
export type PointerState = {
  readonly x: number;
  readonly y: number;
  readonly targetX: number;
  readonly targetY: number;
};

/**
 * Per-frame context passed to every {@link Scene3DEngine.updateScene} call.
 * Subclasses should treat these values as read-only.
 */
export type SceneFrame = {
  /** Seconds since RAF started (monotonic high-precision clock). */
  readonly seconds: number;
  /** Clamped delta in seconds (max 0.05 to avoid huge steps after tab-switch). */
  readonly delta: number;
  /** Smoothed pointer state. */
  readonly pointer: PointerState;
};

export type Scene3DEngineConfig = {
  /** Hex color used as both background and (if `fog` is omitted) the default fog. */
  backgroundColor?: number;
  /** Optional linear fog. */
  fog?: { color: number; near: number; far: number };
  /** Camera field of view in degrees. Defaults to 50. */
  fov?: number;
  /** Pointer smoothing factor (0-1). Higher = more responsive. Defaults to 0.055. */
  pointerSmoothing?: number;
  /**
   * CSS selectors that block pointer updates when an event originates inside one
   * of them. Stops the camera from drifting while the user is interacting with
   * UI overlays. Defaults to interactive form elements + role=button.
   */
  pointerBlockedSelectors?: string;
  /** Optional className applied to the renderer canvas. */
  canvasClassName?: string;
};

/**
 * Abstract base class for any Three.js scene that mounts as a React background
 * canvas. Owns the renderer, animation loop, resize observation, pointer
 * normalization, and disposal — subclasses configure the scene tree and
 * respond to per-frame ticks.
 *
 * Implements the APIE encapsulation pillar: every three.js concern lives behind
 * a small, well-defined surface ({@link attach}, {@link detach}, {@link dispose})
 * and React components become thin adapters that just create the engine and
 * hand it a mount element.
 *
 * Subclasses must implement:
 *   - {@link buildScene} — called once on attach, after the renderer is ready.
 *   - {@link updateScene} — called every animation frame.
 *
 * Subclasses may override:
 *   - {@link onResize} — called when the mount element is resized.
 */
export abstract class Scene3DEngine {
  protected readonly scene: THREE.Scene;
  protected readonly camera: THREE.PerspectiveCamera;
  protected readonly renderer: THREE.WebGLRenderer;

  /** Mutable pointer state owned by the engine. Subclasses read but should not write. */
  protected readonly pointer: { x: number; y: number; targetX: number; targetY: number } = {
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
  };

  private mountElement: HTMLElement | null = null;
  private animationFrame = 0;
  private lastTime = 0;
  private disposed = false;
  private paused = false;
  private resizeObserver: ResizeObserver | null = null;
  private readonly pointerSmoothing: number;
  private readonly pointerBlockedSelectors: string;

  constructor(config: Scene3DEngineConfig = {}) {
    this.pointerSmoothing = config.pointerSmoothing ?? 0.055;
    this.pointerBlockedSelectors =
      config.pointerBlockedSelectors ?? 'a, button, input, select, textarea, [role="button"]';

    this.scene = new THREE.Scene();
    if (config.backgroundColor !== undefined) {
      this.scene.background = new THREE.Color(config.backgroundColor);
    }
    if (config.fog) {
      this.scene.fog = new THREE.Fog(config.fog.color, config.fog.near, config.fog.far);
    }

    this.camera = new THREE.PerspectiveCamera(config.fov ?? 50, 1, 0.01, 100);

    // Constructor may throw on systems without WebGL — caller should catch and
    // render a 2D fallback. We don't try to recover here; that's a UI decision.
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.3));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    if (config.canvasClassName) {
      this.renderer.domElement.className = config.canvasClassName;
    }
  }

  /**
   * Probe whether WebGL is available on this device. Use before instantiating
   * a Scene3DEngine subclass so you can render a 2D fallback gracefully.
   */
  static isWebGLAvailable(): boolean {
    try {
      const canvas = document.createElement('canvas');
      return Boolean(
        window.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl')),
      );
    } catch {
      return false;
    }
  }

  /** Build scene contents. Called once on first {@link attach}. May be async. */
  protected abstract buildScene(): void | Promise<void>;

  /** Per-frame update. Called every RAF tick before the render. */
  protected abstract updateScene(frame: SceneFrame): void;

  /**
   * Called whenever the mount element resizes (initial mount + ResizeObserver
   * callbacks). The renderer + camera aspect have already been updated by the
   * time this fires — override to adjust camera framing, scale models, etc.
   */
  protected onResize(_width: number, _height: number): void {
    // Default no-op.
  }

  /** Mount the engine into a DOM element and start the animation loop. */
  attach(mount: HTMLElement): void {
    if (this.disposed) {
      throw new Error('[Scene3DEngine] cannot attach a disposed engine');
    }
    if (this.mountElement) {
      throw new Error('[Scene3DEngine] engine already attached');
    }

    this.mountElement = mount;
    mount.appendChild(this.renderer.domElement);

    // buildScene may be async (e.g. loading GLTFs). Fire and forget — the engine
    // begins rendering immediately so the background paints, and async-loaded
    // assets pop in when ready.
    void Promise.resolve(this.buildScene()).catch((error) => {
      console.error('[Scene3DEngine] buildScene failed', error);
    });

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(mount);
    this.handleResize();

    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerleave', this.handlePointerLeave);
    // Pause the RAF loop while the tab is backgrounded. The browser already
    // throttles RAF in hidden tabs, but stopping outright is friendlier on
    // battery + lets the GPU sleep.
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    this.lastTime = performance.now();
    this.animationFrame = window.requestAnimationFrame(this.tick);
  }

  /** Stop rendering and detach DOM listeners. Safe to call multiple times. */
  detach(): void {
    if (this.animationFrame) {
      window.cancelAnimationFrame(this.animationFrame);
      this.animationFrame = 0;
    }
    if (this.mountElement && this.renderer.domElement.parentElement === this.mountElement) {
      this.renderer.domElement.remove();
    }
    this.mountElement = null;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerleave', this.handlePointerLeave);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }

  /** Tear down everything — renderer, GPU resources, scene graph. Irreversible. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.detach();
    this.disposeSceneGraph();
    this.renderer.dispose();
  }

  private disposeSceneGraph(): void {
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((material) => material?.dispose());
    });
  }

  private handleResize(): void {
    if (!this.mountElement) return;
    const width = Math.max(1, this.mountElement.clientWidth);
    const height = Math.max(1, this.mountElement.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.onResize(width, height);
  }

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (this.isPointerBlocked(event.target)) return;
    this.pointer.targetX = THREE.MathUtils.clamp(
      (event.clientX / Math.max(1, window.innerWidth) - 0.5) * 2,
      -1,
      1,
    );
    this.pointer.targetY = THREE.MathUtils.clamp(
      (event.clientY / Math.max(1, window.innerHeight) - 0.5) * 2,
      -1,
      1,
    );
  };

  private readonly handlePointerLeave = (): void => {
    this.pointer.targetX = 0;
    this.pointer.targetY = 0;
  };

  private readonly handleVisibilityChange = (): void => {
    if (document.hidden) {
      this.paused = true;
      if (this.animationFrame) {
        window.cancelAnimationFrame(this.animationFrame);
        this.animationFrame = 0;
      }
    } else if (this.paused && !this.disposed) {
      this.paused = false;
      this.lastTime = performance.now();
      this.animationFrame = window.requestAnimationFrame(this.tick);
    }
  };

  private isPointerBlocked(target: EventTarget | null): boolean {
    return target instanceof Element && Boolean(target.closest(this.pointerBlockedSelectors));
  }

  private readonly tick = (time: number): void => {
    if (this.disposed) return;
    const delta = Math.min(0.05, (time - this.lastTime) / 1000);
    this.lastTime = time;
    const seconds = time / 1000;

    this.pointer.x += (this.pointer.targetX - this.pointer.x) * this.pointerSmoothing;
    this.pointer.y += (this.pointer.targetY - this.pointer.y) * this.pointerSmoothing;

    this.updateScene({ seconds, delta, pointer: this.pointer });
    this.renderer.render(this.scene, this.camera);
    this.animationFrame = window.requestAnimationFrame(this.tick);
  };
}
