import * as THREE from 'three';

/**
 * Procedural, tileable canvas textures for the stages. The game is otherwise
 * built from flat-coloured MeshStandardMaterials; these add believable surface
 * detail (veined marble, mottled plaster, brushed brass) without shipping any
 * binary image assets. Everything is generated once on the CPU at scene build
 * and cached, so the cost is paid a single time per page load.
 *
 * Tiling: all noise is periodic over the [0,1) UV square (see `periodicNoise`),
 * so the textures repeat seamlessly when `texture.repeat` is raised.
 *
 * Colour space: albedo canvases are tagged SRGB; roughness/normal canvases stay
 * linear (three.js default), which is what MeshStandardMaterial expects.
 */

const TEXTURE_SIZE = 512;
const FLOOR_ANISOTROPY = 8;

// Deterministic PRNG so a given texture looks identical across reloads.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function smoothstep(t: number) {
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/**
 * Value noise on a `period × period` lattice that wraps at the tile edge, so
 * the result is seamless when sampled over [0,1). Returns a sampler in UV space.
 */
function periodicNoise(period: number, seed: number) {
  const rng = mulberry32(seed);
  const grid = new Float32Array(period * period);
  for (let i = 0; i < grid.length; i += 1) grid[i] = rng();
  return (u: number, v: number) => {
    const fx = u * period;
    const fy = v * period;
    const x0 = ((Math.floor(fx) % period) + period) % period;
    const y0 = ((Math.floor(fy) % period) + period) % period;
    const x1 = (x0 + 1) % period;
    const y1 = (y0 + 1) % period;
    const sx = smoothstep(fx - Math.floor(fx));
    const sy = smoothstep(fy - Math.floor(fy));
    const v00 = grid[y0 * period + x0];
    const v10 = grid[y0 * period + x1];
    const v01 = grid[y1 * period + x0];
    const v11 = grid[y1 * period + x1];
    return lerp(lerp(v00, v10, sx), lerp(v01, v11, sx), sy);
  };
}

/** Fractal sum of periodic noise — still seamless because each octave tiles. */
function periodicFbm(seed: number, periods = [4, 8, 16, 32]) {
  const octaves = periods.map((p, i) => periodicNoise(p, seed + i * 911));
  const maxAmp = octaves.reduce((sum, _, i) => sum + 0.5 ** i, 0);
  return (u: number, v: number) => {
    let total = 0;
    for (let i = 0; i < octaves.length; i += 1) total += octaves[i](u, v) * 0.5 ** i;
    return total / maxAmp;
  };
}

function makeCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  return { canvas, ctx };
}

/** Sobel a grayscale height canvas into a tangent-space normal canvas. */
function heightToNormalCanvas(height: Float32Array, strength: number): HTMLCanvasElement | null {
  const made = makeCanvas();
  if (!made) return null;
  const { canvas, ctx } = made;
  const out = ctx.createImageData(TEXTURE_SIZE, TEXTURE_SIZE);
  const at = (x: number, y: number) => {
    const xx = ((x % TEXTURE_SIZE) + TEXTURE_SIZE) % TEXTURE_SIZE;
    const yy = ((y % TEXTURE_SIZE) + TEXTURE_SIZE) % TEXTURE_SIZE;
    return height[yy * TEXTURE_SIZE + xx];
  };
  for (let y = 0; y < TEXTURE_SIZE; y += 1) {
    for (let x = 0; x < TEXTURE_SIZE; x += 1) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const idx = (y * TEXTURE_SIZE + x) * 4;
      out.data[idx] = ((-dx / len) * 0.5 + 0.5) * 255;
      out.data[idx + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      out.data[idx + 2] = (1 / len) * 0.5 * 255 + 127;
      out.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  return canvas;
}

function toColorTexture(canvas: HTMLCanvasElement, repeatX: number, repeatY: number) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = FLOOR_ANISOTROPY;
  return tex;
}

function toDataTexture(canvas: HTMLCanvasElement, repeatX: number, repeatY: number) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = FLOOR_ANISOTROPY;
  return tex;
}

type SurfaceCanvases = {
  color: HTMLCanvasElement;
  roughness: HTMLCanvasElement;
  normal: HTMLCanvasElement | null;
};

const canvasCache = new Map<string, SurfaceCanvases | null>();

function buildMarbleCanvases(): SurfaceCanvases | null {
  const colorMade = makeCanvas();
  const roughMade = makeCanvas();
  if (!colorMade || !roughMade) return null;
  const fbm = periodicFbm(1337);
  const fleck = periodicFbm(7777, [16, 32, 64]);
  const colorData = colorMade.ctx.createImageData(TEXTURE_SIZE, TEXTURE_SIZE);
  const roughData = roughMade.ctx.createImageData(TEXTURE_SIZE, TEXTURE_SIZE);
  const height = new Float32Array(TEXTURE_SIZE * TEXTURE_SIZE);

  for (let y = 0; y < TEXTURE_SIZE; y += 1) {
    for (let x = 0; x < TEXTURE_SIZE; x += 1) {
      const u = x / TEXTURE_SIZE;
      const v = y / TEXTURE_SIZE;
      const turb = fbm(u, v);
      // Classic marble: warp a periodic sine wave with turbulence. The integer
      // frequency on u keeps the wave seamless across the tile edge.
      const vein = Math.abs(Math.sin((u * 3 + v * 1 + turb * 2.6) * Math.PI * 2));
      const veinSharp = Math.pow(vein, 0.55);
      const dark = 1 - veinSharp;

      // Warm off-white base drifting toward cool grey inside the veins.
      let r = lerp(222, 150, dark * 0.7);
      let g = lerp(220, 156, dark * 0.7);
      let b = lerp(214, 162, dark * 0.7);
      // Sparse warm gold flecks tying the floor to the lobby's brass palette.
      const goldMask = Math.max(0, fleck(u, v) - 0.72) * 3.2;
      r = lerp(r, 198, goldMask);
      g = lerp(g, 168, goldMask);
      b = lerp(b, 104, goldMask);

      const idx = (y * TEXTURE_SIZE + x) * 4;
      colorData.data[idx] = r;
      colorData.data[idx + 1] = g;
      colorData.data[idx + 2] = b;
      colorData.data[idx + 3] = 255;

      // Polished: low roughness overall, veins read a touch rougher.
      const rough = 0.14 + dark * 0.22;
      const rv = Math.round(rough * 255);
      roughData.data[idx] = rv;
      roughData.data[idx + 1] = rv;
      roughData.data[idx + 2] = rv;
      roughData.data[idx + 3] = 255;

      height[y * TEXTURE_SIZE + x] = dark;
    }
  }
  colorMade.ctx.putImageData(colorData, 0, 0);
  roughMade.ctx.putImageData(roughData, 0, 0);
  return {
    color: colorMade.canvas,
    roughness: roughMade.canvas,
    normal: heightToNormalCanvas(height, 0.6),
  };
}

function buildPlasterCanvases(tint: { r: number; g: number; b: number }): SurfaceCanvases | null {
  const colorMade = makeCanvas();
  const roughMade = makeCanvas();
  if (!colorMade || !roughMade) return null;
  const fbm = periodicFbm(909);
  const grain = periodicFbm(424242, [32, 64, 128]);
  const colorData = colorMade.ctx.createImageData(TEXTURE_SIZE, TEXTURE_SIZE);
  const roughData = roughMade.ctx.createImageData(TEXTURE_SIZE, TEXTURE_SIZE);
  const height = new Float32Array(TEXTURE_SIZE * TEXTURE_SIZE);

  for (let y = 0; y < TEXTURE_SIZE; y += 1) {
    for (let x = 0; x < TEXTURE_SIZE; x += 1) {
      const u = x / TEXTURE_SIZE;
      const v = y / TEXTURE_SIZE;
      const mottle = fbm(u, v) * 0.6 + grain(u, v) * 0.4;
      // ±18% brightness mottling around the tint so the wall stops reading flat.
      const shade = 0.82 + mottle * 0.36;
      const idx = (y * TEXTURE_SIZE + x) * 4;
      colorData.data[idx] = Math.min(255, tint.r * shade);
      colorData.data[idx + 1] = Math.min(255, tint.g * shade);
      colorData.data[idx + 2] = Math.min(255, tint.b * shade);
      colorData.data[idx + 3] = 255;

      const rough = 0.7 + mottle * 0.25;
      const rv = Math.round(Math.min(1, rough) * 255);
      roughData.data[idx] = rv;
      roughData.data[idx + 1] = rv;
      roughData.data[idx + 2] = rv;
      roughData.data[idx + 3] = 255;

      height[y * TEXTURE_SIZE + x] = mottle;
    }
  }
  colorMade.ctx.putImageData(colorData, 0, 0);
  roughMade.ctx.putImageData(roughData, 0, 0);
  return {
    color: colorMade.canvas,
    roughness: roughMade.canvas,
    normal: heightToNormalCanvas(height, 1.4),
  };
}

function getCached(key: string, build: () => SurfaceCanvases | null): SurfaceCanvases | null {
  if (canvasCache.has(key)) return canvasCache.get(key) ?? null;
  const built = build();
  canvasCache.set(key, built);
  return built;
}

/**
 * Polished veined-marble floor material. `repeatX/Y` set how many slabs span
 * the surface (an 18×12 floor at 3×2 gives ~6m slabs). Falls back to a plain
 * colour if canvas isn't available (SSR / no 2D context).
 */
export function makeMarbleFloorMaterial(repeatX = 3, repeatY = 2): THREE.MeshStandardMaterial {
  const c = getCached('marble', buildMarbleCanvases);
  if (!c) return new THREE.MeshStandardMaterial({ color: 0x8a9aa6, roughness: 0.3, metalness: 0.05 });
  const material = new THREE.MeshStandardMaterial({
    map: toColorTexture(c.color, repeatX, repeatY),
    roughnessMap: toDataTexture(c.roughness, repeatX, repeatY),
    roughness: 1,
    metalness: 0.08,
  });
  if (c.normal) {
    material.normalMap = toDataTexture(c.normal, repeatX, repeatY);
    material.normalScale.set(0.3, 0.3);
  }
  return material;
}

/**
 * Mottled plaster wall material tinted to `color` (a hex int). Adds a subtle
 * normal + roughness break-up so large flat walls stop looking like card stock.
 */
export function makePlasterWallMaterial(color: number, repeatX = 4, repeatY = 1.5): THREE.MeshStandardMaterial {
  const tint = new THREE.Color(color);
  const key = `plaster-${color}`;
  const c = getCached(key, () =>
    buildPlasterCanvases({ r: tint.r * 255, g: tint.g * 255, b: tint.b * 255 }),
  );
  if (!c) return new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.02 });
  const material = new THREE.MeshStandardMaterial({
    map: toColorTexture(c.color, repeatX, repeatY),
    roughnessMap: toDataTexture(c.roughness, repeatX, repeatY),
    roughness: 1,
    metalness: 0.02,
  });
  if (c.normal) {
    material.normalMap = toDataTexture(c.normal, repeatX, repeatY);
    material.normalScale.set(0.5, 0.5);
  }
  return material;
}

// Deterministic per-cell hash in [0,1) so each plank / tile / brick can be
// jittered independently without an allocation. Distinct from the lattice noise
// above, which is continuous; this is a discrete per-index salt.
function hash01(n: number) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Warm wood planking. Long boards run along U; each board gets its own base
 * tone, grain phase and a darker seam between neighbours so the floor reads as
 * laid lumber rather than a wood-coloured sheet.
 */
function buildWoodCanvases(): SurfaceCanvases | null {
  const colorMade = makeCanvas();
  const roughMade = makeCanvas();
  if (!colorMade || !roughMade) return null;
  const grain = periodicFbm(5150, [8, 16, 32, 64]);
  const fibre = periodicNoise(128, 24680);
  const colorData = colorMade.ctx.createImageData(TEXTURE_SIZE, TEXTURE_SIZE);
  const roughData = roughMade.ctx.createImageData(TEXTURE_SIZE, TEXTURE_SIZE);
  const height = new Float32Array(TEXTURE_SIZE * TEXTURE_SIZE);
  const planks = 6;

  for (let y = 0; y < TEXTURE_SIZE; y += 1) {
    for (let x = 0; x < TEXTURE_SIZE; x += 1) {
      const u = x / TEXTURE_SIZE;
      const v = y / TEXTURE_SIZE;
      const plankF = v * planks;
      const plank = Math.floor(plankF);
      const inPlank = plankF - plank;
      const tone = hash01(plank * 3.3);

      // Grain runs lengthwise; stretch the noise along U so streaks are long.
      const g = grain(u * 0.35, v * 3 + tone) * 0.7 + fibre(u, v) * 0.3;
      const streak = Math.abs(Math.sin((v * planks * 6 + g * 5 + tone * 10) * Math.PI));

      // Seam between planks (and a thin highlight on the chamfer).
      const seam = Math.min(inPlank, 1 - inPlank);
      const seamDark = smoothstep(Math.min(1, seam / 0.04));

      let r = lerp(120, 92, tone) + streak * 26;
      let gg = lerp(82, 60, tone) + streak * 18;
      let b = lerp(50, 36, tone) + streak * 10;
      r *= 0.55 + seamDark * 0.45;
      gg *= 0.55 + seamDark * 0.45;
      b *= 0.55 + seamDark * 0.45;

      const idx = (y * TEXTURE_SIZE + x) * 4;
      colorData.data[idx] = Math.min(255, r);
      colorData.data[idx + 1] = Math.min(255, gg);
      colorData.data[idx + 2] = Math.min(255, b);
      colorData.data[idx + 3] = 255;

      const rough = 0.6 + (1 - streak) * 0.2 + (1 - seamDark) * 0.1;
      const rv = Math.round(Math.min(1, rough) * 255);
      roughData.data[idx] = rv;
      roughData.data[idx + 1] = rv;
      roughData.data[idx + 2] = rv;
      roughData.data[idx + 3] = 255;

      height[y * TEXTURE_SIZE + x] = streak * 0.5 + seamDark * 0.5;
    }
  }
  colorMade.ctx.putImageData(colorData, 0, 0);
  roughMade.ctx.putImageData(roughData, 0, 0);
  return {
    color: colorMade.canvas,
    roughness: roughMade.canvas,
    normal: heightToNormalCanvas(height, 1.1),
  };
}

/**
 * Glossy ceramic floor tile on a square grid with darker grout lines. Each tile
 * gets a faint independent tint so the grid doesn't look printed.
 */
function buildTileCanvases(tint: { r: number; g: number; b: number }): SurfaceCanvases | null {
  const colorMade = makeCanvas();
  const roughMade = makeCanvas();
  if (!colorMade || !roughMade) return null;
  const mottle = periodicFbm(31415, [16, 32, 64]);
  const colorData = colorMade.ctx.createImageData(TEXTURE_SIZE, TEXTURE_SIZE);
  const roughData = roughMade.ctx.createImageData(TEXTURE_SIZE, TEXTURE_SIZE);
  const height = new Float32Array(TEXTURE_SIZE * TEXTURE_SIZE);
  const tiles = 4;
  const groutW = 0.045;

  for (let y = 0; y < TEXTURE_SIZE; y += 1) {
    for (let x = 0; x < TEXTURE_SIZE; x += 1) {
      const u = x / TEXTURE_SIZE;
      const v = y / TEXTURE_SIZE;
      const cx = Math.floor(u * tiles);
      const cy = Math.floor(v * tiles);
      const fx = u * tiles - cx;
      const fy = v * tiles - cy;
      const edge = Math.min(fx, 1 - fx, fy, 1 - fy);
      const grout = 1 - smoothstep(Math.min(1, edge / groutW));

      const cellTint = (hash01(cx * 7.1 + cy * 13.7) - 0.5) * 0.12;
      const surface = mottle(u, v) * 0.06;
      const shade = 1 + cellTint + surface;

      // Grout is a darker, desaturated grey.
      const gr = lerp(tint.r * shade, 96, grout);
      const gg = lerp(tint.g * shade, 96, grout);
      const gb = lerp(tint.b * shade, 92, grout);

      const idx = (y * TEXTURE_SIZE + x) * 4;
      colorData.data[idx] = Math.min(255, gr);
      colorData.data[idx + 1] = Math.min(255, gg);
      colorData.data[idx + 2] = Math.min(255, gb);
      colorData.data[idx + 3] = 255;

      // Tile face glossy, grout matte.
      const rough = lerp(0.18, 0.85, grout);
      const rv = Math.round(rough * 255);
      roughData.data[idx] = rv;
      roughData.data[idx + 1] = rv;
      roughData.data[idx + 2] = rv;
      roughData.data[idx + 3] = 255;

      height[y * TEXTURE_SIZE + x] = 1 - grout;
    }
  }
  colorMade.ctx.putImageData(colorData, 0, 0);
  roughMade.ctx.putImageData(roughData, 0, 0);
  return {
    color: colorMade.canvas,
    roughness: roughMade.canvas,
    normal: heightToNormalCanvas(height, 1.6),
  };
}

/**
 * Running-bond brick wall: offset rows of bricks with recessed mortar. Each
 * brick is tinted independently around the base colour for a weathered look.
 */
function buildBrickCanvases(tint: { r: number; g: number; b: number }): SurfaceCanvases | null {
  const colorMade = makeCanvas();
  const roughMade = makeCanvas();
  if (!colorMade || !roughMade) return null;
  const grime = periodicFbm(60606, [8, 16, 32, 64]);
  const colorData = colorMade.ctx.createImageData(TEXTURE_SIZE, TEXTURE_SIZE);
  const roughData = roughMade.ctx.createImageData(TEXTURE_SIZE, TEXTURE_SIZE);
  const height = new Float32Array(TEXTURE_SIZE * TEXTURE_SIZE);
  const rows = 8;
  const cols = 4;
  const mortar = 0.06;

  for (let y = 0; y < TEXTURE_SIZE; y += 1) {
    for (let x = 0; x < TEXTURE_SIZE; x += 1) {
      const u = x / TEXTURE_SIZE;
      const v = y / TEXTURE_SIZE;
      const rowF = v * rows;
      const row = Math.floor(rowF);
      const fy = rowF - row;
      // Offset every other row by half a brick (running bond).
      const shift = row % 2 === 0 ? 0 : 0.5;
      const colF = u * cols + shift;
      const col = Math.floor(colF);
      const fx = colF - col;

      const edgeX = Math.min(fx, 1 - fx);
      const edgeY = Math.min(fy, 1 - fy);
      const inMortar = Math.max(
        1 - smoothstep(Math.min(1, edgeX / mortar)),
        1 - smoothstep(Math.min(1, edgeY / mortar)),
      );

      const brickTone = (hash01(col * 5.7 + row * 9.3) - 0.5) * 0.3;
      const dirt = grime(u, v) * 0.25;
      const shade = 1 + brickTone - dirt;

      // Brick body warm red-brown; mortar a pale grey.
      const br = Math.min(255, tint.r * shade);
      const bg = Math.min(255, tint.g * shade);
      const bb = Math.min(255, tint.b * shade);
      const r = lerp(br, 168, inMortar);
      const g = lerp(bg, 164, inMortar);
      const b = lerp(bb, 156, inMortar);

      const idx = (y * TEXTURE_SIZE + x) * 4;
      colorData.data[idx] = r;
      colorData.data[idx + 1] = g;
      colorData.data[idx + 2] = b;
      colorData.data[idx + 3] = 255;

      const rough = lerp(0.78, 0.92, inMortar);
      const rv = Math.round(rough * 255);
      roughData.data[idx] = rv;
      roughData.data[idx + 1] = rv;
      roughData.data[idx + 2] = rv;
      roughData.data[idx + 3] = 255;

      // Bricks proud, mortar recessed.
      height[y * TEXTURE_SIZE + x] = 1 - inMortar;
    }
  }
  colorMade.ctx.putImageData(colorData, 0, 0);
  roughMade.ctx.putImageData(roughData, 0, 0);
  return {
    color: colorMade.canvas,
    roughness: roughMade.canvas,
    normal: heightToNormalCanvas(height, 2.2),
  };
}

/**
 * Rough concrete / asphalt. Broad tonal patches plus fine aggregate speckle and
 * occasional darker stains. `tint` lets the same generator make pale sidewalk
 * concrete or near-black asphalt.
 */
function buildConcreteCanvases(tint: { r: number; g: number; b: number }): SurfaceCanvases | null {
  const colorMade = makeCanvas();
  const roughMade = makeCanvas();
  if (!colorMade || !roughMade) return null;
  const patches = periodicFbm(80808, [4, 8, 16]);
  const speckle = periodicNoise(256, 99001);
  const stain = periodicFbm(13131, [3, 6, 12]);
  const colorData = colorMade.ctx.createImageData(TEXTURE_SIZE, TEXTURE_SIZE);
  const roughData = roughMade.ctx.createImageData(TEXTURE_SIZE, TEXTURE_SIZE);
  const height = new Float32Array(TEXTURE_SIZE * TEXTURE_SIZE);

  for (let y = 0; y < TEXTURE_SIZE; y += 1) {
    for (let x = 0; x < TEXTURE_SIZE; x += 1) {
      const u = x / TEXTURE_SIZE;
      const v = y / TEXTURE_SIZE;
      const base = patches(u, v);
      const grit = speckle(u, v);
      const aggregate = grit > 0.82 ? (grit - 0.82) * 2.4 : 0;
      const stainMask = Math.max(0, stain(u, v) - 0.6) * 0.6;

      const shade = 0.82 + base * 0.3 - stainMask + aggregate * 0.4;
      const idx = (y * TEXTURE_SIZE + x) * 4;
      colorData.data[idx] = Math.min(255, tint.r * shade);
      colorData.data[idx + 1] = Math.min(255, tint.g * shade);
      colorData.data[idx + 2] = Math.min(255, tint.b * shade);
      colorData.data[idx + 3] = 255;

      const rough = 0.82 + base * 0.14 - aggregate * 0.3;
      const rv = Math.round(Math.max(0, Math.min(1, rough)) * 255);
      roughData.data[idx] = rv;
      roughData.data[idx + 1] = rv;
      roughData.data[idx + 2] = rv;
      roughData.data[idx + 3] = 255;

      height[y * TEXTURE_SIZE + x] = base * 0.5 + aggregate;
    }
  }
  colorMade.ctx.putImageData(colorData, 0, 0);
  roughMade.ctx.putImageData(roughData, 0, 0);
  return {
    color: colorMade.canvas,
    roughness: roughMade.canvas,
    normal: heightToNormalCanvas(height, 1.3),
  };
}

/** Warm wood-plank floor (docks, café). */
export function makeWoodFloorMaterial(repeatX = 3, repeatY = 4): THREE.MeshStandardMaterial {
  const c = getCached('wood', buildWoodCanvases);
  if (!c) return new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.7, metalness: 0.02 });
  const material = new THREE.MeshStandardMaterial({
    map: toColorTexture(c.color, repeatX, repeatY),
    roughnessMap: toDataTexture(c.roughness, repeatX, repeatY),
    roughness: 1,
    metalness: 0.02,
  });
  if (c.normal) {
    material.normalMap = toDataTexture(c.normal, repeatX, repeatY);
    material.normalScale.set(0.6, 0.6);
  }
  return material;
}

/** Glossy ceramic floor tile tinted to `color` (clinic, bathrooms). */
export function makeTileFloorMaterial(color = 0xe8eef0, repeatX = 4, repeatY = 3): THREE.MeshStandardMaterial {
  const tint = new THREE.Color(color);
  const key = `tile-${color}`;
  const c = getCached(key, () =>
    buildTileCanvases({ r: tint.r * 255, g: tint.g * 255, b: tint.b * 255 }),
  );
  if (!c) return new THREE.MeshStandardMaterial({ color, roughness: 0.25, metalness: 0.04 });
  const material = new THREE.MeshStandardMaterial({
    map: toColorTexture(c.color, repeatX, repeatY),
    roughnessMap: toDataTexture(c.roughness, repeatX, repeatY),
    roughness: 1,
    metalness: 0.04,
  });
  if (c.normal) {
    material.normalMap = toDataTexture(c.normal, repeatX, repeatY);
    material.normalScale.set(0.5, 0.5);
  }
  return material;
}

/** Running-bond brick wall tinted to `color` (alleys, café, market). */
export function makeBrickWallMaterial(color = 0x9c5a44, repeatX = 3, repeatY = 2): THREE.MeshStandardMaterial {
  const tint = new THREE.Color(color);
  const key = `brick-${color}`;
  const c = getCached(key, () =>
    buildBrickCanvases({ r: tint.r * 255, g: tint.g * 255, b: tint.b * 255 }),
  );
  if (!c) return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.02 });
  const material = new THREE.MeshStandardMaterial({
    map: toColorTexture(c.color, repeatX, repeatY),
    roughnessMap: toDataTexture(c.roughness, repeatX, repeatY),
    roughness: 1,
    metalness: 0.02,
  });
  if (c.normal) {
    material.normalMap = toDataTexture(c.normal, repeatX, repeatY);
    material.normalScale.set(0.8, 0.8);
  }
  return material;
}

/**
 * Rough concrete/asphalt material tinted to `color`. Use a pale grey for
 * sidewalks/plazas, a dark near-black for road asphalt. Works as floor or wall.
 */
export function makeConcreteMaterial(color = 0x8c8a86, repeatX = 4, repeatY = 4): THREE.MeshStandardMaterial {
  const tint = new THREE.Color(color);
  const key = `concrete-${color}`;
  const c = getCached(key, () =>
    buildConcreteCanvases({ r: tint.r * 255, g: tint.g * 255, b: tint.b * 255 }),
  );
  if (!c) return new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.02 });
  const material = new THREE.MeshStandardMaterial({
    map: toColorTexture(c.color, repeatX, repeatY),
    roughnessMap: toDataTexture(c.roughness, repeatX, repeatY),
    roughness: 1,
    metalness: 0.02,
  });
  if (c.normal) {
    material.normalMap = toDataTexture(c.normal, repeatX, repeatY);
    material.normalScale.set(0.7, 0.7);
  }
  return material;
}
