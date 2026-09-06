# Generated image assets — drop-in folders

These four folders are wired into the 3D engine via
[`src/components/three/imageTextures.ts`](../components/three/imageTextures.ts). **Drop a
PNG/JPG/WebP into the matching folder and it is auto-discovered by filename** (`import.meta.glob`,
resolved at build time) — no code edit needed to make the file *available*. You then reference it
by its bare filename (no extension) from a stage or from the ambiance config.

Prompts for generating these assets live in
[`../../CHATGPT_IMAGE_ASSETS.md`](../../CHATGPT_IMAGE_ASSETS.md).

| Folder | Section | What goes here | Specs |
|--------|---------|----------------|-------|
| `skies/` | §1 | 2:1 panoramic backdrops | 2048×1024, JPG/PNG |
| `textures/` | §2 | Tileable albedo surfaces | 1024×1024, seamless, sRGB |
| `signage/` | §3 | Transparent emissive signs/menus | PNG, transparent bg |
| `decals/` | §4 | Transparent posters / grime | PNG, transparent bg |

> Albedo only — keep textures shadow-free; the engine supplies lighting/bloom.

---

## How to use each category

### Skies (`skies/`) — zero extra code

Set `skyTexture` on a stage's `ambiance` to the bare filename. The engine uses an image-backed dome
when the asset exists and silently falls back to the procedural gradient dome otherwise.

```ts
// src/data/adventures/stage03-night-market.ts
ambiance: {
  // ...existing fields...
  skyTexture: 'sky-night-market', // file: src/assets/skies/sky-night-market.jpg
}
```

Suggested filenames (from §1): `sky-night-market`, `sky-warm-dusk`, `sky-cool-overcast`,
`sky-rift-gate`.

### Textures (`textures/`) — swap a floor/wall material

Use the drop-in factory, passing the existing procedural factory as the fallback so the stage keeps
working before the art lands:

```ts
import { makeImageSurfaceMaterial } from '../../components/three/imageTextures';
import { makeMarbleFloorMaterial } from '../../components/three/proceduralTextures';

addRoomShell(group, palette, {
  floorMaterial: makeImageSurfaceMaterial(
    'marble-floor', 3, 2,
    () => makeMarbleFloorMaterial(3, 2),     // fallback if asset missing
  ),
});
```

Suggested filenames (from §2): `marble-floor`, `plaster-wall`, `asphalt-wet`, `teak-planks`,
`bamboo-mat`.

### Signage (`signage/`) — glowing planes (the bloom showpiece)

```ts
import { makeEmissiveSignMaterial } from '../../components/three/imageTextures';

const signMat = makeEmissiveSignMaterial('neon-shop-sign', { intensity: 1.6 });
if (signMat) {
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), signMat);
  sign.position.set(-3, 2.6, -5.85);
  group.add(sign);
}
```

`makeEmissiveSignMaterial` / `makeDecalMaterial` return `null` when the asset is absent — guard the
mesh creation as above so nothing renders until the art exists.

Suggested filenames (from §3): `neon-shop-sign`, `menu-board`, `lantern-face`, `shop-banners`.

### Decals (`decals/`) — posters & grime

```ts
import { makeDecalMaterial } from '../../components/three/imageTextures';

const posterMat = makeDecalMaterial('poster-set');
if (posterMat) {
  const poster = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.2), posterMat);
  poster.position.set(4, 2.2, -5.88); // just in front of the back wall
  group.add(poster);
}
```

Suggested filenames (from §4): `poster-set`, `grime-overlay`.

---

## Notes

- **Caching & disposal:** loaded textures are cached by URL and marked reusable, so they survive
  stage teardown (`disposeObjectTree`). The dome/plane meshes themselves are disposed normally.
- **Color space:** the factories tag albedo/emissive maps as sRGB automatically.
- **Tiling:** verify §2 textures actually tile (offset-check) before shipping; patch seams in an
  editor if needed.
