import * as T from 'three';
import type { CitySurface } from './CityMaterials';

type Surfaces = {
  box: (size: number[], surface: CitySurface) => T.BufferGeometry;
  get: (surface: CitySurface, color?: string) => T.Material;
};

/** Low-profile floor inlays and wall-mounted reliefs leave the room's paths unchanged. */
export class HotelInterior {
  readonly root = new T.Group();
  private materials = new Map<string, T.MeshStandardMaterial>();
  constructor(parent: T.Group, surfaces: Surfaces) {
    const root = this.root;
    root.name = 'sukhumvit-hotel-interior';
    parent.add(root);
    const floor = new T.Mesh(surfaces.box([7.65, 0.014, 12.55], 'teak'), surfaces.get('teak', '#b8a08c'));
    floor.position.set(-58, 0.089, 29.575);
    floor.receiveShadow = true;
    floor.name = 'bedroom-timber-floor';
    root.add(floor);
    // A brass threshold separates the quiet bedroom from the marble reception lobby.
    for (const x of [-61.68, -54.32]) this.box(root, [0.025, 0.008, 12.2], [x, 0.101, 29.575], '#c2a773');
    for (const z of [23.5, 35.65]) this.box(root, [7.36, 0.008, 0.025], [-58, 0.101, z], '#c2a773');
    this.rug(root, -56.15, 28.8, 3.55, 3.05);
    this.rug(root, -49.7, 29.55, 5.1, 1.55);

    const west = new T.Group();
    west.name = 'bedroom-feature-wall';
    root.add(west);
    for (let z = 23.5; z < 35.7; z += 0.38) {
      const slat = new T.Mesh(surfaces.box([0.045, 0.92, 0.31], 'teak'), surfaces.get('teak', '#987c5a'));
      slat.position.set(-61.86, 0.56, z);
      slat.castShadow = slat.receiveShadow = true;
      west.add(slat);
    }
    this.box(west, [0.11, 0.055, 12.7], [-61.83, 1.065, 29.5], '#c4a575');
    this.box(west, [0.11, 0.09, 12.7], [-61.83, 0.16, 29.5], '#564b3b');
    this.box(west, [0.13, 0.1, 12.7], [-61.82, 3.47, 29.5], '#b6986d');
    const wallArt = new T.Group();
    wallArt.name = 'hotel-wall-art-fallback';
    // Keep this replaceable collection out of the room-wide static batches.
    wallArt.userData.animated = true;
    west.add(wallArt);
    for (let i = 0; i < 3; i++) this.botanical(wallArt, 31.15 + i * 1.3, i);
    for (const z of [27.2, 34.9]) this.sconce(wallArt, z);

    const reception = new T.Group();
    reception.name = 'reception-craftwork';
    root.add(reception);
    const deskTrim = new T.Group();
    (parent.getObjectByName('hotel-furnishings-fallback') ?? root).add(deskTrim);
    for (let x = -51.75; x < -46.1; x += 0.18) {
      this.box(deskTrim, [0.06, 0.85, 0.055], [x, 0.64, 25.13], '#b5a074');
    }
    this.box(deskTrim, [5.85, 0.045, 0.07], [-49, 0.2, 25.15], '#d2b879');
    this.box(deskTrim, [5.85, 0.025, 0.07], [-49, 1.06, 25.15], '#d2b879');
    this.box(reception, [1.55, 1.3, 0.045], [-49, 2.04, 23.23], '#3e6259');
    for (const x of [-49.8, -48.2]) this.box(reception, [0.03, 1.37, 0.075], [x, 2.04, 23.28], '#d2b879');
    for (const y of [1.35, 2.73]) this.box(reception, [1.63, 0.03, 0.075], [-49, y, 23.28], '#d2b879');
    // An original botanical medallion echoes the carved panels in the guest room.
    for (let i = -2; i <= 2; i++) {
      const petal = this.leaf(reception, '#d4bd85');
      petal.position.set(-49, 1.7, 23.3);
      petal.rotation.z = i * 0.42;
      petal.scale.set(0.55, 1.05, 1);
    }
    this.box(reception, [0.75, 0.025, 0.045], [-49, 1.64, 23.32], '#d4bd85');
  }
  private material(color: string, glow = 0) {
    const key = color + glow;
    if (!this.materials.has(key))
      this.materials.set(
        key,
        new T.MeshStandardMaterial({
          color,
          roughness: glow ? 0.65 : 0.8,
          metalness: color === '#d2b879' ? 0.25 : 0,
          emissive: color,
          emissiveIntensity: glow,
          side: T.DoubleSide,
        }),
      );
    return this.materials.get(key)!;
  }
  private box(root: T.Group, size: number[], position: number[], color: string, glow = 0) {
    const mesh = new T.Mesh(new T.BoxGeometry(size[0], size[1], size[2]), this.material(color, glow));
    mesh.position.set(position[0], position[1], position[2]);
    mesh.castShadow = position[1] > 0.15;
    mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  }
  private leaf(root: T.Group, color: string) {
    const shape = new T.Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(-0.25, 0.2, -0.16, 0.47, 0, 0.7);
    shape.bezierCurveTo(0.16, 0.47, 0.25, 0.2, 0, 0);
    const mesh = new T.Mesh(new T.ShapeGeometry(shape, 12), this.material(color));
    root.add(mesh);
    return mesh;
  }
  private botanical(root: T.Group, z: number, variant: number) {
    const g = new T.Group();
    g.name = `botanical-relief-${variant + 1}`;
    g.position.set(-61.73, 2.22, z);
    g.rotation.y = Math.PI / 2;
    root.add(g);
    this.box(g, [1.08, 1.62, 0.07], [0, 0, 0], '#5d6350');
    this.box(g, [0.94, 1.48, 0.025], [0, 0, 0.05], '#e5d6b3');
    for (const x of [-0.52, 0.52]) this.box(g, [0.035, 1.62, 0.05], [x, 0, 0.06], '#d2b879');
    for (const y of [-0.79, 0.79]) this.box(g, [1.08, 0.035, 0.05], [0, y, 0.06], '#d2b879');
    const bend = (variant - 1) * 0.12;
    const stem = new T.CubicBezierCurve3(
      new T.Vector3(0, -0.6, 0.08),
      new T.Vector3(-bend, -0.15, 0.08),
      new T.Vector3(bend, 0.2, 0.08),
      new T.Vector3(bend, 0.52, 0.08),
    );
    g.add(new T.Mesh(new T.TubeGeometry(stem, 16, 0.009, 5, false), this.material('#87754c')));
    for (let i = 0; i < 6; i++) {
      const side = i % 2 ? 1 : -1;
      const leaf = this.leaf(g, i % 3 ? '#8c9b79' : '#b9a271');
      leaf.position.set(bend * Math.max(0, i / 5), -0.47 + i * 0.17, 0.087 + i * 0.002);
      leaf.rotation.z = side * (0.82 + variant * 0.14);
      leaf.scale.set(0.45, 0.58 - i * 0.035, 1);
    }
  }
  private sconce(root: T.Group, z: number) {
    const g = new T.Group();
    g.name = 'bedroom-wall-sconce';
    root.add(g);
    this.box(g, [0.08, 0.58, 0.3], [-61.78, 2.05, z], '#6b5a3d');
    this.box(g, [0.19, 0.4, 0.24], [-61.65, 2.06, z], '#f4d7a1', 0.55);
    for (const y of [1.82, 2.3]) this.box(g, [0.25, 0.04, 0.32], [-61.65, y, z], '#c2a773');
  }
  private rug(root: T.Group, x: number, z: number, w: number, d: number) {
    const rug = new T.Group();
    rug.name = 'woven-geometric-rug';
    root.add(rug);
    this.box(rug, [w, 0.014, d], [x, 0.11, z], '#405c55');
    for (const inset of [0.09, 0.17]) {
      for (const side of [-1, 1]) {
        this.box(rug, [w - inset * 2, 0.003, 0.018], [x, 0.119, z + side * (d / 2 - inset)], '#c1ad7d');
        this.box(rug, [0.018, 0.003, d - inset * 2], [x + side * (w / 2 - inset), 0.119, z], '#c1ad7d');
      }
    }
    for (let dx = -w / 2 + 0.5; dx < w / 2 - 0.3; dx += 0.45)
      for (let dz = -d / 2 + 0.5; dz < d / 2 - 0.3; dz += 0.45) {
        const motif = this.box(rug, [0.08, 0.003, 0.08], [x + dx, 0.119, z + dz], '#9baf91');
        motif.rotation.y = Math.PI / 4;
      }
  }
}
