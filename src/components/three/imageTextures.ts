import * as THREE from 'three';
import { markReusableTexture } from './sceneHelpers';

/**
 * Loader + drop-in material factories for the ChatGPT-generated image assets
 * catalogued in `CHATGPT_IMAGE_ASSETS.md`.
 *
 * Design goals:
 *  - **Zero-config drop-in.** Drop a PNG/JPG into the matching folder under
 *    `src/assets/` and it is discovered by filename — no code edit needed. The
 *    folders are scanned at build time with `import.meta.glob`.
 *  - **Graceful fallback.** If an expected asset is missing, the material
 *    factories return the existing procedural material instead, so stages keep
 *    working before any art lands. Nothing breaks if the folders are empty.
 *  - **Shared + cached.** Textures are cached by URL and marked reusable, so a
 *    texture reused across stages survives `disposeObjectTree` (which only
 *    disposes non-reusable textures).
 *
 * Expected folders (filenames are the keys you pass in, with or without ext):
 *   src/assets/textures/   tileable albedo surfaces  (§2)  e.g. 'marble-floor'
 *   src/assets/skies/      2:1 panoramic backdrops    (§1)  e.g. 'sky-night-market'
 *   src/assets/signage/    transparent emissive signs (§3)  e.g. 'neon-shop-sign'
 *   src/assets/decals/     transparent posters/grime  (§4)  e.g. 'poster-set'
 */

// --- Asset discovery --------------------------------------------------------

// `eager: true` + `query: '?url'` gives a synchronous { path: url } map. The
// glob literal must be statically analysable, so each folder is listed once.
const MODULES: Record<string, Record<string, string>> = {
  textures: import.meta.glob('../../assets/textures/*.{png,jpg,jpeg,webp}', {
    eager: true,
    query: '?url',
    import: 'default',
  }) as Record<string, string>,
  skies: import.meta.glob('../../assets/skies/*.{png,jpg,jpeg,webp}', {
    eager: true,
    query: '?url',
    import: 'default',
  }) as Record<string, string>,
  signage: import.meta.glob('../../assets/signage/*.{png,jpg,jpeg,webp}', {
    eager: true,
    query: '?url',
    import: 'default',
  }) as Record<string, string>,
  decals: import.meta.glob('../../assets/decals/*.{png,jpg,jpeg,webp}', {
    eager: true,
    query: '?url',
    import: 'default',
  }) as Record<string, string>,
};

type AssetCategory = keyof typeof MODULES;

/** Resolve a bare filename (with or without extension) within a category to its
 *  bundled URL, or null if no such asset has been dropped in yet. */
export function resolveAssetUrl(category: AssetCategory, name: string): string | null {
  const stem = name.replace(/\.[^/.]+$/, '');
  const entries = MODULES[category];
  for (const path in entries) {
    const file = path.slice(path.lastIndexOf('/') + 1);
    const fileStem = file.replace(/\.[^/.]+$/, '');
    if (fileStem === stem) return entries[path];
  }
  return null;
}

/** True if an asset with this name exists in the category — handy for guards. */
export function hasAsset(category: AssetCategory, name: string): boolean {
  return resolveAssetUrl(category, name) !== null;
}

// --- Texture loading --------------------------------------------------------

const loader = new THREE.TextureLoader();
const textureCache = new Map<string, THREE.Texture>();
const DEFAULT_ANISOTROPY = 8;

type LoadOptions = {
  /** sRGB for albedo/colour maps (default true); set false for data maps. */
  srgb?: boolean;
  repeatX?: number;
  repeatY?: number;
  anisotropy?: number;
  /** RepeatWrapping (default) vs ClampToEdgeWrapping for non-tiling art. */
  wrap?: THREE.Wrapping;
};

/**
 * Load (and cache) an image texture by URL. Returned textures are marked
 * reusable so they outlive a single stage. Repeat/wrap are applied per call by
 * cloning the cached texture's image into a fresh wrapper only when the repeat
 * differs — but to keep it simple and cheap we configure the cached texture and
 * return it; callers that need different repeats on the same image should pass
 * distinct repeat values (the last one wins, which is fine for our usage where
 * each surface uses its own asset).
 */
export function loadImageTexture(url: string, opts: LoadOptions = {}): THREE.Texture {
  const { srgb = true, repeatX = 1, repeatY = 1, anisotropy = DEFAULT_ANISOTROPY, wrap } = opts;
  let tex = textureCache.get(url);
  if (!tex) {
    tex = loader.load(url);
    tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    markReusableTexture(tex);
    textureCache.set(url, tex);
  }
  const wrapping = wrap ?? THREE.RepeatWrapping;
  tex.wrapS = wrapping;
  tex.wrapT = wrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

// --- Drop-in material factories (mirror proceduralTextures signatures) -------

/**
 * Floor/ground material from a tileable albedo asset (§2). If the asset is
 * absent, calls `fallback()` (typically a procedural material factory) so the
 * stage keeps rendering. Example:
 *   makeImageFloorMaterial('marble-floor', 3, 2, () => makeMarbleFloorMaterial(3, 2))
 */
export function makeImageSurfaceMaterial(
  name: string,
  repeatX: number,
  repeatY: number,
  fallback: () => THREE.Material,
  matOpts: { roughness?: number; metalness?: number; color?: number } = {},
): THREE.Material {
  const url = resolveAssetUrl('textures', name);
  if (!url) return fallback();
  const { roughness = 0.85, metalness = 0.04, color } = matOpts;
  return new THREE.MeshStandardMaterial({
    map: loadImageTexture(url, { srgb: true, repeatX, repeatY }),
    // `color` multiplies the albedo map — use a slight off-white to settle an
    // over-bright texture or warm/cool it without re-generating the asset.
    ...(color !== undefined ? { color } : {}),
    roughness,
    metalness,
  });
}

/**
 * Transparent emissive plane material for neon signage / menu boards (§3). Map
 * onto a flat plane so the `UnrealBloomPass` makes lit pixels glow. The image's
 * alpha cuts the plane; the colour also drives emissive so it blooms in the
 * dark. Returns null if the asset is missing (so callers can skip the plane).
 */
export function makeEmissiveSignMaterial(
  name: string,
  opts: { intensity?: number; doubleSided?: boolean } = {},
): THREE.MeshStandardMaterial | null {
  const url = resolveAssetUrl('signage', name);
  if (!url) return null;
  const { intensity = 1.4, doubleSided = false } = opts;
  const map = loadImageTexture(url, { srgb: true, wrap: THREE.ClampToEdgeWrapping });
  return new THREE.MeshStandardMaterial({
    map,
    emissive: 0xffffff,
    emissiveMap: map,
    emissiveIntensity: intensity,
    transparent: true,
    alphaTest: 0.04,
    side: doubleSided ? THREE.DoubleSide : THREE.FrontSide,
    depthWrite: false,
  });
}

/**
 * Transparent decal material for posters / grime overlays (§4). Lit (so it
 * picks up scene lighting), alpha-cut, non-bloom. Returns null if missing.
 */
export function makeDecalMaterial(name: string): THREE.MeshStandardMaterial | null {
  const url = resolveAssetUrl('decals', name);
  if (!url) return null;
  return new THREE.MeshStandardMaterial({
    map: loadImageTexture(url, { srgb: true, wrap: THREE.ClampToEdgeWrapping }),
    transparent: true,
    alphaTest: 0.04,
    roughness: 0.9,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
}

/**
 * Place a transparent emissive signage plane (§3) into a group. Combines
 * `makeEmissiveSignMaterial` with a plane mesh sized to `size` ([w, h]). No-ops
 * (returns null) if the asset is missing, so callers can leave the procedural
 * placeholder in place until the art lands. Faces +Z by default; pass
 * `rotationY` to turn it. `depthWrite` is off (set on the material) so it layers
 * cleanly just in front of a wall.
 */
export function addSignPlane(
  group: THREE.Object3D,
  name: string,
  position: [number, number, number],
  size: [number, number],
  opts: { intensity?: number; rotationY?: number; doubleSided?: boolean } = {},
): THREE.Mesh | null {
  const material = makeEmissiveSignMaterial(name, {
    intensity: opts.intensity,
    doubleSided: opts.doubleSided,
  });
  if (!material) return null;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), material);
  mesh.position.set(position[0], position[1], position[2]);
  if (opts.rotationY) mesh.rotation.y = opts.rotationY;
  mesh.renderOrder = 2;
  group.add(mesh);
  return mesh;
}

/**
 * Place a transparent decal plane (§4 posters / grime) into a group. Lit,
 * alpha-cut, non-bloom. Returns null if the asset is missing.
 */
export function addDecalPlane(
  group: THREE.Object3D,
  name: string,
  position: [number, number, number],
  size: [number, number],
  opts: { rotationY?: number } = {},
): THREE.Mesh | null {
  const material = makeDecalMaterial(name);
  if (!material) return null;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), material);
  mesh.position.set(position[0], position[1], position[2]);
  if (opts.rotationY) mesh.rotation.y = opts.rotationY;
  mesh.renderOrder = 1;
  group.add(mesh);
  return mesh;
}

/**
 * Load a panoramic sky backdrop (§1) configured for an equirectangular dome or
 * `scene.background`. Returns null if the asset is missing, so the caller can
 * fall back to the procedural gradient `addSkyDome`. Pass the result to
 * `addSkyDomeFromTexture(scene, texture)`.
 */
export function loadSkyTexture(name: string): THREE.Texture | null {
  const url = resolveAssetUrl('skies', name);
  if (!url) return null;
  const tex = loadImageTexture(url, {
    srgb: true,
    wrap: THREE.ClampToEdgeWrapping,
    anisotropy: 4,
  });
  tex.mapping = THREE.EquirectangularReflectionMapping;
  return tex;
}
