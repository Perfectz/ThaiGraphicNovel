import * as T from 'three';
import plaster from '../assets/textures/mottled-plaster-wall.png';
import marble from '../assets/textures/veined-marble-floor.png';
import teak from '../assets/textures/weathered-teak-planks.png';
import asphalt from '../assets/textures/wet-night-market-asphalt.png';
import rattan from '../assets/textures/woven-bamboo-rattan-matting.png';

export type CitySurface = 'plaster' | 'marble' | 'teak' | 'asphalt' | 'rattan' | 'pavers' | 'grass';

export class CityMaterials {
  private textures = new Map<CitySurface, T.Texture>();
  private materials = new Map<string, T.MeshStandardMaterial>();
  private disposed = false;
  constructor() {
    const loader = new T.TextureLoader();
    for (const [name, url] of Object.entries({ plaster, marble, teak, asphalt, rattan })) {
      const texture = loader.load(url, (loaded) => {
        if (this.disposed) loaded.dispose();
      });
      this.prepare(texture);
      this.textures.set(name as CitySurface, texture);
    }
    for (const name of ['pavers', 'grass'] as const) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 256;
      const c = canvas.getContext('2d')!;
      let seed = 1423;
      const random = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
      };
      c.fillStyle = name === 'grass' ? '#829073' : '#6f736b';
      c.fillRect(0, 0, 256, 256);
      if (name === 'pavers') {
        for (let row = 0; row < 8; row++)
          for (let col = -1; col < 5; col++) {
            const shade = 145 + Math.floor(random() * 25);
            c.fillStyle = `rgb(${shade},${shade + 2},${shade - 6})`;
            c.fillRect(col * 64 + (row % 2) * 32 + 1, row * 32 + 1, 62, 30);
          }
      }
      for (let i = 0; i < 9000; i++) {
        c.fillStyle = random() > 0.5 ? '#ffffff0b' : '#15221813';
        c.fillRect(random() * 256, random() * 256, name === 'grass' ? 1 : 2, 3);
      }
      const texture = new T.CanvasTexture(canvas);
      this.prepare(texture);
      this.textures.set(name, texture);
    }
  }
  private prepare(texture: T.Texture) {
    texture.colorSpace = T.SRGBColorSpace;
    texture.wrapS = texture.wrapT = T.MirroredRepeatWrapping;
    texture.anisotropy = 4;
  }
  get(surface: CitySurface, color = '#ffffff') {
    const key = surface + color;
    if (!this.materials.has(key))
      this.materials.set(
        key,
        new T.MeshStandardMaterial({
          color,
          map: this.textures.get(surface),
          roughness: surface === 'marble' ? 0.32 : surface === 'asphalt' ? 0.5 : 0.88,
          metalness: surface === 'asphalt' ? 0.08 : 0,
        }),
      );
    return this.materials.get(key)!;
  }
  box(size: number[], surface: CitySurface) {
    const geometry = new T.BoxGeometry(size[0], size[1], size[2]);
    const uv = geometry.getAttribute('uv');
    const tile = surface === 'rattan' ? 1 : surface === 'marble' ? 3 : 2;
    for (let i = 0; i < uv.count; i++) {
      const face = Math.floor(i / 4);
      uv.setXY(
        i,
        (uv.getX(i) * (face < 2 ? size[2] : size[0])) / tile,
        (uv.getY(i) * (face === 2 || face === 3 ? size[2] : size[1])) / tile,
      );
    }
    return geometry;
  }
  dispose() {
    this.disposed = true;
    this.textures.forEach((t) => t.dispose());
    this.materials.forEach((m) => m.dispose());
  }
}
