import * as T from 'three';
import type { discoveries } from './discoveries';
type Site = (typeof discoveries)[number];

export function buildDiscoveryObject(site: Site, parent: T.Group) {
  const materials = new Map<string, T.MeshStandardMaterial>();
  function box(size: [number, number, number], position: [number, number, number], color: string) {
    if (!materials.has(color))
      materials.set(
        color,
        new T.MeshStandardMaterial({ color, roughness: 0.72, metalness: color === '#b89757' ? 0.55 : 0 }),
      );
    const mesh = new T.Mesh(new T.BoxGeometry(...size), materials.get(color));
    mesh.position.set(...position);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  // Each find has a physical silhouette; the sparkle alone is not the object.
  box([1.05, 0.16, 0.8], [0, 0.08, 0], '#544837');
  if (site.kind === 'board') {
    for (const x of [-0.45, 0.45]) box([0.08, 1.65, 0.08], [x, 0.9, 0], '#755541');
    box([1.3, 0.85, 0.12], [0, 1.3, 0], '#755541');
    box([1.16, 0.7, 0.035], [0, 1.3, 0.08], '#e5d7b5');
    for (let i = 0; i < 4; i++)
      box([0.72 - i * 0.09, 0.028, 0.02], [-0.05, 1.5 - i * 0.13, 0.11], i === 0 ? '#a14d3f' : '#827451');
  } else if (site.kind === 'book') {
    box([0.6, 0.72, 0.5], [0, 0.46, 0], '#785841');
    box([0.85, 0.065, 0.58], [0, 0.86, 0], '#183e45');
    box([0.77, 0.09, 0.52], [0, 0.93, 0], '#efe1bb');
    const cover = box([0.85, 0.04, 0.58], [-0.25, 1.03, 0], '#21505a');
    cover.rotation.z = 0.45;
    box([0.025, 0.018, 0.42], [0.14, 1, 0], '#b89757');
  } else if (site.kind === 'basket') {
    box([0.8, 0.42, 0.6], [0, 0.37, 0], '#b69665');
    for (let i = 0; i < 5; i++) box([0.83, 0.023, 0.63], [0, 0.2 + i * 0.08, 0], '#735e3a');
    for (const x of [-0.25, 0.18]) {
      box([0.14, 0.48, 0.14], [x, 0.79, 0], '#819f8c');
      box([0.1, 0.04, 0.1], [x, 1.05, 0], '#ddcfa5');
    }
  } else if (site.kind === 'boat') {
    box([0.6, 0.65, 0.5], [0, 0.46, 0], '#8c8170');
    const hull = box([1.05, 0.18, 0.38], [0, 0.91, 0], '#845e37');
    hull.rotation.y = 0.3;
    const prow = box([0.12, 0.35, 0.15], [0.49, 1.05, -0.15], '#b89757');
    prow.rotation.z = -0.4;
    box([0.52, 0.08, 0.48], [-0.12, 1.15, 0], '#34625e');
  } else {
    for (const x of [-0.3, 0.3])
      for (const z of [-0.3, 0.3]) box([0.045, 1.15, 0.045], [x, 0.82, z], '#b89757');
    for (const y of [0.3, 1.35]) box([0.72, 0.07, 0.72], [0, y, 0], '#a98043');
    box([0.6, 0.65, 0.018], [0, 0.79, -0.3], '#e4c88c');
    box([0.018, 0.65, 0.6], [-0.3, 0.79, 0], '#e4c88c');
    box([0.12, 0.12, 0.12], [0, 1.48, 0], '#b89757');
  }
}
