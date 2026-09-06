import * as T from 'three';

export const cityBackdropZones = [
  { id: 'west-residences', centers: [-1, 0, 1].map((n) => ({ x: -72, z: 24 + n * 12 })), tall: true },
  { id: 'sukhumvit-skyline', centers: [-60, -49, -38, -24].map((x) => ({ x, z: -6 })), tall: true },
  { id: 'east-skyline', centers: [26, 37, 48, 59].map((x) => ({ x, z: -6 })), tall: true },
  { id: 'east-neighbourhood', centers: [12, 25, 38].map((z) => ({ x: 62, z })), tall: false },
  { id: 'canal-neighbourhood', centers: [-38, -22, -6, 10, 26, 42].map((x) => ({ x, z: 54 })), tall: false },
] as const;

/** Scenery beyond the walking districts; five independent batches preserve camera cutaways. */
export class CityBackdrop {
  readonly zones: T.Group[] = [];
  readonly buildings: T.Box3[] = [];
  private materials = new Map<string, T.Material>();
  constructor(parent: T.Group, batch: (root: T.Group) => void, cutaway: (root: T.Group) => void) {
    for (const [zoneIndex, zone] of cityBackdropZones.entries()) {
      const root = new T.Group();
      root.name = zone.id;
      parent.add(root);
      this.zones.push(root);
      if (zone.id === 'sukhumvit-skyline' || zone.id === 'east-skyline') {
        const first = zone.centers[0].x, last = zone.centers.at(-1)!.x;
        this.box(root, [last - first + 9, 0.9, 15], [(first + last) / 2, -0.6, -4], '#526758');
      }
      zone.centers.forEach(({ x, z }, i) => {
        const w = zone.tall ? 6.4 : 8.2,
          d = 5.5;
        const h = zone.tall ? 8.5 + ((i * 3 + zoneIndex) % 4) * 2.1 : 4.1 + (i % 3) * 0.8;
        const building = new T.Group();
        root.add(building);
        this.box(building, [w + 1.4, 0.3, d + 1.4], [x, -0.02, z], '#606e68');
        this.box(building, [w, h, d], [x, h / 2, z], i % 2 ? '#8b9187' : '#707f83');
        this.box(building, [w + 0.25, 0.16, d + 0.25], [x, h + 0.02, z], '#b4b09b');
        const floors = Math.floor(h / 1.65);
        for (let floor = 0; floor < floors; floor++) {
          const y = 0.9 + floor * 1.65;
          for (const side of [-1, 1]) {
            for (let bay = 0; bay < 4; bay++) {
              const color = (bay + floor * 3 + i) % 5 < 2 ? '#d9b781' : '#3a5965';
              this.box(
                building,
                [0.7, 0.8, 0.055],
                [x - w / 2 + 0.9 + (bay * (w - 1.8)) / 3, y, z + side * (d / 2 + 0.04)],
                color,
                color === '#d9b781',
              );
            }
            for (let bay = 0; bay < 3; bay++) {
              const color = (bay + floor + i) % 4 === 0 ? '#d9b781' : '#3a5965';
              this.box(
                building,
                [0.055, 0.8, 0.7],
                [x + side * (w / 2 + 0.04), y, z - 1.8 + bay * 1.8],
                color,
                color === '#d9b781',
              );
            }
            this.box(building, [w + 0.12, 0.055, 0.16], [x, y + 0.55, z + side * (d / 2 + 0.06)], '#a5a995');
          }
        }
        if (zone.tall) {
          // Setback crowns and vertical fins break up the apartment silhouettes.
          const crown = 1.4 + (i % 3) * 0.65;
          this.box(building, [w * 0.64, crown, d * 0.66], [x + 0.35, h + crown / 2, z], '#697c7d');
          this.box(building, [w * 0.67, 0.13, d * 0.69], [x + 0.35, h + crown, z], '#b4b09b');
          for (const side of [-1, 1]) {
            for (const offset of [-w / 2 + 0.25, w / 2 - 0.25])
              this.box(
                building,
                [0.12, h + 0.4, 0.28],
                [x + offset, h / 2 + 0.1, z + (side * d) / 2],
                '#a5a995',
              );
          }
        } else {
          // Low pitched roofs keep the canal and Old Town edges below the modern skyline.
          const rise = 1.15,
            run = w / 2 + 0.28;
          for (const side of [-1, 1]) {
            const roof = this.box(
              building,
              [Math.hypot(run, rise), 0.16, d + 0.6],
              [x + (side * run) / 2, h + rise / 2, z],
              i % 2 ? '#77584a' : '#486c62',
            );
            roof.rotation.z = -side * Math.atan2(rise, run);
            for (const end of [-1, 1]) {
              const edge = this.box(
                building,
                [Math.hypot(run, rise), 0.08, 0.06],
                [x + (side * run) / 2, h + rise / 2 + 0.08, z + end * (d / 2 + 0.3)],
                '#c0ad83',
              );
              edge.rotation.z = roof.rotation.z;
            }
          }
          this.box(building, [0.13, 0.15, d + 0.7], [x, h + rise, z], '#c0ad83');
        }
        building.updateWorldMatrix(true, true);
        this.buildings.push(new T.Box3().setFromObject(building));
      });
      batch(root);
      cutaway(root);
    }
  }
  private box(root: T.Group, size: number[], p: number[], color: string, lit = false) {
    const key = color + lit;
    if (!this.materials.has(key))
      this.materials.set(
        key,
        lit ? new T.MeshBasicMaterial({ color }) : new T.MeshStandardMaterial({ color, roughness: 0.84 }),
      );
    const mesh = new T.Mesh(new T.BoxGeometry(size[0], size[1], size[2]), this.materials.get(key));
    mesh.position.set(p[0], p[1], p[2]);
    root.add(mesh);
    return mesh;
  }
}
