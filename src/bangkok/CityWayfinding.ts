import * as T from 'three';
import { foodStallOrigin, type CityArea } from './city.ts';

type Triple = [number, number, number];
export type SignSite = {
  id: string;
  area: CityArea | 'roads';
  text: string;
  width: number;
  position: Triple;
  mount: 'wall' | 'suspended' | 'post';
  anchor: Triple;
  color: string;
  feet?: Triple[];
};
export const wayfindingSites: SignSite[] = [
  {
    id: 'station',
    area: 'sukhumvit',
    text: 'BTS · SKYTRAIN',
    width: 4.5,
    position: [-40.5, 3.35, 10.85],
    mount: 'suspended',
    anchor: [-40.5, 4.28, 10.3],
    color: '#aee4ed',
  },
  {
    id: 'soi',
    area: 'sukhumvit',
    text: 'SOI 22',
    width: 1.8,
    position: [-55, 3.35, 10.85],
    mount: 'suspended',
    anchor: [-55, 4.28, 10.3],
    color: '#e7d998',
  },
  {
    id: 'coffee',
    area: 'sukhumvit',
    text: 'COFFEE · กาแฟ',
    width: 3.7,
    position: [-49.5, 2.85, 9.48],
    mount: 'wall',
    anchor: [-49.5, 2.85, 9],
    color: '#e8c691',
  },
  {
    id: 'park',
    area: 'lumphini',
    text: 'LUMPHINI PARK',
    width: 3.5,
    position: [-28.8, 2.9, 25.8],
    mount: 'post',
    anchor: [-31, 3.65, 25.8],
    feet: [[-31, 0.08, 25.8]],
    color: '#d3ddb0',
  },
  {
    id: 'canal-east',
    area: 'roads',
    text: 'CANAL WALK · OLD TOWN →',
    width: 3.7,
    position: [-18, 2.9, 36.5],
    mount: 'post',
    anchor: [-16, 3.65, 36.5],
    feet: [[-16, 0.08, 36.5]],
    color: '#d9d9b0',
  },
  {
    id: 'canal-west',
    area: 'roads',
    text: '← HOTEL · PARK ↑',
    width: 3.2,
    position: [-42.5, 2.9, 36.5],
    mount: 'post',
    anchor: [-40.5, 3.65, 36.5],
    feet: [[-40.5, 0.08, 36.5]],
    color: '#d9d9b0',
  },
  {
    id: 'noodles',
    area: 'yaowarat',
    text: 'LEK · NOODLES',
    width: 3.6,
    position: [foodStallOrigin.x, 3.1, foodStallOrigin.z - 0.1],
    mount: 'suspended',
    anchor: [foodStallOrigin.x, 3.7, foodStallOrigin.z],
    feet: [
      [foodStallOrigin.x - 1.35, 2.65, foodStallOrigin.z],
      [foodStallOrigin.x + 1.35, 2.65, foodStallOrigin.z],
    ],
    color: '#ffe3a1',
  },
  {
    id: 'chinatown',
    area: 'yaowarat',
    text: 'เยาวราช',
    width: 3.4,
    position: [39.5, 4.65, 9.35],
    mount: 'wall',
    anchor: [39.5, 4.65, 9],
    color: '#ffdf89',
  },
  {
    id: 'artisan',
    area: 'oldtown',
    text: 'ARUN · LANTERNS',
    width: 2.6,
    position: [29, 2.95, 30.55],
    mount: 'suspended',
    anchor: [29, 3.55, 30.55],
    feet: [
      [27.75, 0.91, 30.55],
      [30.25, 0.91, 30.55],
    ],
    color: '#edd1a1',
  },
  {
    id: 'oldtown',
    area: 'oldtown',
    text: 'PHRA NAKHON',
    width: 2.6,
    position: [37, 2.65, 40.38],
    mount: 'suspended',
    anchor: [37, 3.25, 40.2],
    color: '#efcf90',
  },
];

/** Every plate and its support share one removable scene group. */
export class CityWayfinding {
  readonly signs: { site: SignSite; group: T.Group; support?: T.Object3D }[] = [];
  private metal = new T.MeshStandardMaterial({ color: '#34504d', roughness: 0.65, metalness: 0.3 });
  private brass = new T.MeshStandardMaterial({ color: '#c5ad78', roughness: 0.55, metalness: 0.35 });
  build(root: T.Group, site: SignSite, makePlate: (root: T.Group) => T.Mesh) {
    const g = new T.Group();
    g.name = `mounted-sign-${site.id}`;
    root.add(g);
    const plate = makePlate(g);
    plate.name = 'lettered-plate';
    const [x, y, z] = site.position,
      w = site.width,
      h = w / 4;
    this.box(g, [w + 0.12, h + 0.12, 0.15], [x, y, z - 0.09], this.metal);
    for (const side of [-1, 1]) {
      this.box(g, [w + 0.16, 0.045, 0.18], [x, y + side * (h / 2 + 0.045), z - 0.075], this.brass);
      this.box(g, [0.045, h + 0.14, 0.18], [x + side * (w / 2 + 0.045), y, z - 0.075], this.brass);
    }
    const [ax, ay, az] = site.anchor;
    if (site.mount === 'wall') {
      for (const side of [-1, 1])
        this.bar(g, [x + side * w * 0.32, y, z - 0.15], [ax + side * w * 0.32, ay, az], 0.055);
    } else {
      this.bar(g, [Math.min(ax, x - w * 0.38), ay, az], [Math.max(ax, x + w * 0.38), ay, az], 0.065);
      for (const side of [-1, 1])
        this.bar(g, [x + side * w * 0.34, y + h / 2 + 0.06, z - 0.09], [x + side * w * 0.34, ay, az], 0.035);
      for (const foot of site.feet ?? []) {
        this.bar(g, foot, [foot[0], ay, foot[2]], site.mount === 'post' ? 0.08 : 0.045);
        this.bar(g, [foot[0], ay, foot[2]], [ax, ay, az], 0.06);
        if (foot[1] < 0.2) this.box(g, [0.3, 0.18, 0.3], [foot[0], 0.12, foot[2]], this.brass);
      }
    }
    this.signs.push({ site, group: g });
    return g;
  }
  private box(g: T.Group, size: Triple, position: Triple, material: T.Material) {
    const mesh = new T.Mesh(new T.BoxGeometry(...size), material);
    mesh.position.set(...position);
    mesh.castShadow = mesh.receiveShadow = true;
    g.add(mesh);
    return mesh;
  }
  private bar(g: T.Group, from: Triple, to: Triple, radius: number) {
    const a = new T.Vector3(...from),
      b = new T.Vector3(...to),
      delta = b.clone().sub(a);
    if (delta.length() < 0.001) return;
    const mesh = new T.Mesh(new T.CylinderGeometry(radius, radius, delta.length(), 6), this.metal);
    mesh.position.copy(a.add(b).multiplyScalar(0.5));
    mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize());
    mesh.castShadow = mesh.receiveShadow = true;
    g.add(mesh);
  }
  dispose() {
    this.metal.dispose();
    this.brass.dispose();
  }
}
