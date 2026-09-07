import * as T from 'three';
import { canalHouses, thonburiFloors } from './thonburi';

/** Walkable quays follow the navigation layout; open water remains visible between them. */
export function buildThonburi(
  root: T.Group,
  helpers: {
    surface: (root: T.Group, size: number[], p: number[]) => void;
    sign: (root: T.Group, text: string, p: number[], color: string, width: number) => void;
    cutaway: (root: T.Object3D) => void;
    tree: (root: T.Group, x: number, z: number, scale: number) => void;
    lamp: (root: T.Group, x: number, z: number) => void;
  },
) {
  const mats = new Map<string, T.MeshStandardMaterial>();
  function box(g: T.Group, size: number[], p: number[], color: string) {
    if (!mats.has(color)) mats.set(color, new T.MeshStandardMaterial({ color, roughness: 0.84 }));
    const m = new T.Mesh(new T.BoxGeometry(...(size as [number, number, number])), mats.get(color));
    m.position.set(...(p as [number, number, number]));
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    return m;
  }
  for (const f of thonburiFloors) {
    helpers.surface(root, [f.w, 0.18, f.d], [f.x + f.w / 2, 0, f.z + f.d / 2]);
    for (let x = f.x + 0.3; x < f.x + f.w; x += 3)
      for (const z of [f.z + 0.3, f.z + f.d - 0.3]) box(root, [0.22, 1.5, 0.22], [x, -0.65, z], '#685744');
  }
  // The water garden is deliberately open: its bridges are the only two crossings.
  for (const [x, z, w, d] of [
    [11.5, -58.9, 30, 0.1],
    [11.5, -66.1, 30, 0.1],
    [-7.9, -62.5, 0.1, 7],
    [31.9, -62.5, 0.1, 7],
  ]) {
    const rail = new T.Group();
    root.add(rail);
    box(rail, [w, 0.08, d], [x, 0.94, z], '#c8ad75');
    box(rail, [w, 0.06, d], [x, 0.52, z], '#8b7454');
    const n = Math.ceil(Math.max(w, d) / 1.5);
    for (let i = 0; i <= n; i++)
      box(
        rail,
        [0.1, 1, 0.1],
        [x + (w > 0.2 ? (i / n - 0.5) * w : 0), 0.5, z + (d > 0.2 ? (i / n - 0.5) * d : 0)],
        '#775f46',
      );
    helpers.cutaway(rail);
  }
  for (const h of canalHouses) {
    const x = h.x + h.w / 2,
      z = h.z + h.d / 2;
    const fallback = new T.Group();
    fallback.name = `thonburi-${h.id}-fallback`;
    fallback.userData.animated = true;
    root.add(fallback);
    box(fallback, [h.w, 0.25, h.d], [x, 0.13, z], '#755338');
    const house = new T.Group();
    house.name = `thonburi-${h.id}-house`;
    fallback.add(house);
    box(house, [h.w, 2.75, h.d], [x, 1.6, z], '#96734f');
    for (let y = 0.45; y < 2.85; y += 0.23)
      for (const side of [-1, 1])
        box(house, [h.w + 0.03, 0.032, 0.06], [x, y, z + (side * h.d) / 2], '#b49061');
    for (const wx of [x - h.w * 0.28, x + h.w * 0.28])
      for (const side of [-1, 1]) {
        box(house, [1.35, 1.35, 0.12], [wx, 1.6, z + side * (h.d / 2 + 0.04)], '#d0b27a');
        box(house, [1.2, 1.18, 0.16], [wx, 1.6, z + side * (h.d / 2 + 0.09)], h.shutters);
        for (let slat = 0; slat < 7; slat++)
          box(house, [1.12, 0.055, 0.035], [wx, 1.12 + slat * 0.16, z + side * (h.d / 2 + 0.19)], '#c2b78c');
      }
    box(house, [1.05, 2, 0.12], [x, 1.17, z + h.d / 2 + 0.08], h.shutters);
    const run = h.w / 2 + 0.4,
      rise = 1.5;
    for (const side of [-1, 1]) {
      const roof = box(
        house,
        [Math.hypot(run, rise), 0.14, h.d + 1],
        [x + (side * run) / 2, 3 + rise / 2, z],
        h.id === 'blue' ? '#456f65' : '#8b5140',
      );
      roof.rotation.z = -side * Math.atan2(rise, run);
      for (const end of [-1, 1]) {
        const trim = box(
          house,
          [Math.hypot(run, rise), 0.07, 0.08],
          [x + (side * run) / 2, 3.08 + rise / 2, z + end * (h.d / 2 + 0.51)],
          '#c9ab75',
        );
        trim.rotation.z = roof.rotation.z;
      }
    }
    box(house, [0.14, 0.13, h.d + 1.1], [x, 4.53, z], '#d5bc85');
    helpers.cutaway(house);
  }
  helpers.tree(root, 11.5, -72, 0.9);
  helpers.tree(root, 31, -73, 0.7);
  helpers.tree(root, 8.2, -51, 0.7);
  for (const [x, z] of [
    [19.7, -42],
    [19.7, -50],
    [-7.7, -57],
    [-7.7, -68],
    [26.7, -68],
    [31.7, -57],
  ])
    helpers.lamp(root, x, z);
  for (const [x, z, label] of [
    [17, -45, 'THONBURI · ธนบุรี'],
    [-5.5, -60, 'FOOTBRIDGE ↑'],
    [17, -40, 'FERRY · ท่าเรือ'],
  ] as const) {
    const sign = new T.Group();
    root.add(sign);
    box(sign, [0.12, 2.1, 0.12], [x - 1.6, 1, z], '#73573d');
    box(sign, [0.12, 2.1, 0.12], [x + 1.6, 1, z], '#73573d');
    helpers.sign(sign, label, [x, 1.8, z], '#edcf93', 3.5);
    helpers.cutaway(sign);
  }
}
