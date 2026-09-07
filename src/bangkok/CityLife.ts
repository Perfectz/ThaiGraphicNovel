import * as T from 'three';
import type { CityArea } from './city';
import { trainPosition, steamPoint } from './cityMotion';

/** Moving scenery is grouped apart from static district batches. No collision or quest state. */
export class CityLife {
  readonly train = new T.Group();
  readonly trainFallback = new T.Group();
  private market = new T.Group();
  private park = new T.Group();
  private lanterns: T.Group[] = [];
  private birds: { root: T.Group; wings: T.Group[] }[] = [];
  private steam: T.Points;
  private ripples: T.InstancedMesh;
  private transform = new T.Object3D();
  private materials = new Map<string, T.MeshStandardMaterial>();
  constructor(chunks: Map<CityArea | 'roads', T.Group>, batch: (root: T.Object3D) => void) {
    this.train.name = 'Sukhumvit passing train';
    this.market.name = 'Yaowarat evening life';
    this.park.name = 'Lumphini lake life';
    for (const g of [this.train, this.market, this.park]) g.userData.animated = true;
    chunks.get('sukhumvit')!.add(this.train);
    chunks.get('yaowarat')!.add(this.market);
    chunks.get('lumphini')!.add(this.park);
    for (const center of [-2.12, 2.12]) {
      this.box(this.train, [3.95, 1.16, 1.6], [center, 0.71, 0], '#d7ddd4');
      this.box(this.train, [4.05, 0.16, 1.66], [center, 0.28, 0], '#a74e4b');
      this.box(this.train, [3.6, 0.09, 1.52], [center, 1.34, 0], '#82999a');
      for (const side of [-1, 1]) {
        for (let window = 0; window < 4; window++)
          this.box(
            this.train,
            [0.64, 0.5, 0.035],
            [center - 1.37 + window * 0.91, 0.91, side * 0.816],
            '#224d65',
            0.15,
          );
        for (const axle of [-1.25, 1.25])
          this.box(this.train, [0.55, 0.2, 0.1], [center + axle, 0.08, side * 0.62], '#2a3540');
      }
      for (const end of [-1, 1]) {
        this.box(this.train, [0.04, 0.49, 1.08], [center + end * 1.98, 0.91, 0], '#274f60', 0.15);
        this.box(this.train, [0.05, 0.1, 0.2], [center + end * 2, 0.45, 0.51], '#ffe6ab', 0.8);
        this.box(this.train, [0.05, 0.1, 0.2], [center + end * 2, 0.45, -0.51], '#ffe6ab', 0.8);
      }
    }
    this.box(this.train, [0.32, 0.64, 1.35], [0, 0.62, 0], '#46535c');
    this.train.position.set(-43, 4.62, 9.3);
    batch(this.train);
    this.trainFallback.name = 'skytrain-fallback';
    this.trainFallback.userData.animated = true;
    for (const child of [...this.train.children]) this.trainFallback.add(child);
    this.train.add(this.trainFallback);
    for (let i = 0; i < 9; i++) {
      const x = 24 + i * 3,
        z = 12 + (x % 2) * 2;
      const pivot = new T.Group();
      pivot.userData.animated = true;
      pivot.position.set(x, 5.2, z);
      this.market.add(pivot);
      this.box(pivot, [0.02, 1.35, 0.02], [0, -0.675, 0], '#7b654b');
      const body = this.mesh(pivot, new T.SphereGeometry(0.31, 12, 8), [0, -1.48, 0], '#d9512e', 0.75);
      body.scale.y = 0.88;
      for (const y of [-1.75, -1.21])
        this.mesh(pivot, new T.CylinderGeometry(0.1, 0.1, 0.045, 10), [0, y, 0], '#deb867', 0.35);
      this.mesh(pivot, new T.CylinderGeometry(0.025, 0.01, 0.23, 5), [0, -1.89, 0], '#e9a84d', 0.2);
      for (let rib = 0; rib < 8; rib++) {
        const a = (rib * Math.PI) / 4;
        const arc = new T.CatmullRomCurve3([
          new T.Vector3(0, -1.22, 0),
          new T.Vector3(Math.cos(a) * 0.316, -1.48, Math.sin(a) * 0.316),
          new T.Vector3(0, -1.74, 0),
        ]);
        this.mesh(pivot, new T.TubeGeometry(arc, 8, 0.008, 3, false), [0, 0, 0], '#ecc27b', 0.25);
      }
      batch(pivot);
      this.lanterns.push(pivot);
    }
    const steamCanvas = document.createElement('canvas');
    steamCanvas.width = steamCanvas.height = 64;
    const ctx = steamCanvas.getContext('2d')!,
      gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
    gradient.addColorStop(0, 'rgba(242,233,209,.5)');
    gradient.addColorStop(0.45, 'rgba(242,233,209,.18)');
    gradient.addColorStop(1, 'rgba(242,233,209,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    const map = new T.CanvasTexture(steamCanvas);
    map.colorSpace = T.SRGBColorSpace;
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.BufferAttribute(new Float32Array(36), 3));
    this.steam = new T.Points(
      geometry,
      new T.PointsMaterial({
        map,
        size: 0.42,
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
        color: '#f1eadb',
      }),
    );
    this.steam.frustumCulled = false;
    this.market.add(this.steam);
    this.ripples = new T.InstancedMesh(
      new T.RingGeometry(0.94, 1, 24),
      new T.MeshBasicMaterial({
        color: '#abd0b8',
        transparent: true,
        opacity: 0.27,
        depthWrite: false,
        side: T.DoubleSide,
      }),
      6,
    );
    this.ripples.userData.animated = true;
    this.ripples.frustumCulled = false;
    this.park.add(this.ripples);
    for (let i = 0; i < 3; i++) {
      const root = new T.Group(),
        wings: T.Group[] = [];
      root.userData.animated = true;
      this.park.add(root);
      const body = this.mesh(root, new T.SphereGeometry(0.1, 6, 4), [0, 0, 0], '#ddd5bb');
      body.scale.set(0.6, 0.65, 1.6);
      for (const side of [-1, 1]) {
        const wing = new T.Group();
        root.add(wing);
        const geometry = new T.BufferGeometry();
        geometry.setAttribute(
          'position',
          new T.Float32BufferAttribute([0, 0, 0, side * 0.34, 0, -0.1, side * 0.15, 0, 0.16], 3),
        );
        geometry.computeVertexNormals();
        const material = new T.MeshStandardMaterial({ color: '#c7c7b1', roughness: 0.9, side: T.DoubleSide });
        wing.add(new T.Mesh(geometry, material));
        wings.push(wing);
      }
      this.birds.push({ root, wings });
    }
    this.update(0, false);
  }
  private mesh(g: T.Group, geometry: T.BufferGeometry, p: number[], color: string, glow = 0) {
    const key = color + glow;
    if (!this.materials.has(key))
      this.materials.set(
        key,
        new T.MeshStandardMaterial({
          color,
          roughness: 0.68,
          metalness: 0.15,
          emissive: color,
          emissiveIntensity: glow,
        }),
      );
    const mesh = new T.Mesh(geometry, this.materials.get(key));
    mesh.position.set(p[0], p[1], p[2]);
    mesh.castShadow = mesh.receiveShadow = true;
    g.add(mesh);
    return mesh;
  }
  private box(g: T.Group, size: number[], p: number[], color: string, glow = 0) {
    return this.mesh(g, new T.BoxGeometry(size[0], size[1], size[2]), p, color, glow);
  }
  update(time: number, reducedMotion: boolean) {
    const t = reducedMotion ? 0 : time;
    if (this.train.parent?.visible) this.train.position.x = trainPosition(t, reducedMotion);
    if (this.market.parent?.visible) {
      this.lanterns.forEach((g, i) => {
        g.rotation.z = Math.sin(t * 0.7 + i * 0.8) * 0.035;
        g.rotation.x = Math.cos(t * 0.55 + i) * 0.018;
      });
      this.steam.visible = !reducedMotion;
      if (!reducedMotion) {
        const p = this.steam.geometry.getAttribute('position') as T.BufferAttribute;
        for (let i = 0; i < 12; i++) {
          const s = steamPoint(t, i);
          p.setXYZ(i, s.x, s.y, s.z);
        }
        p.needsUpdate = true;
      }
    }
    if (this.park.parent?.visible) {
      for (let i = 0; i < 6; i++) {
        const phase = (t * 0.23 + i / 6) % 1;
        this.transform.position.set(-26 + (i % 3) * 2.8, 0.175, 30.4 + Math.floor(i / 3) * 2.1);
        this.transform.rotation.set(-Math.PI / 2, 0, 0);
        this.transform.scale.setScalar(0.16 + phase * 0.7);
        this.transform.updateMatrix();
        this.ripples.setMatrixAt(i, this.transform.matrix);
      }
      this.ripples.instanceMatrix.needsUpdate = true;
      this.birds.forEach(({ root, wings }, i) => {
        root.visible = !reducedMotion;
        const a = t * 0.16 + i * 2.1;
        root.position.set(-22 + Math.cos(a) * 5.2, 4.8 + i * 0.27, -0.3 + 27 + Math.sin(a) * 3.5);
        root.rotation.y = -a;
        wings.forEach((wing, j) => (wing.rotation.z = (j === 0 ? 1 : -1) * Math.sin(t * 6 + i) * 0.55));
      });
    }
  }
  clipCookingSteam(cookingVisible: boolean) {
    this.steam.visible = this.steam.visible && cookingVisible;
  }
  snapshot() {
    return {
      trainX: this.train.position.x,
      lanternAngle: this.lanterns[0].rotation.z,
      steamVisible: this.steam.visible,
      birdVisible: this.birds[0].root.visible,
      birdX: this.birds[0].root.position.x,
      steamY: this.steam.geometry.getAttribute('position').getY(0),
      steamX: this.steam.geometry.getAttribute('position').getX(0),
      steamZ: this.steam.geometry.getAttribute('position').getZ(0),
      rippleScale: this.ripples.instanceMatrix.array[0],
    };
  }
}
