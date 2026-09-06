import * as T from 'three';

export type FacadeStyle = 'modern' | 'market' | 'timber';

/** Original district silhouettes; decoration stays attached to each building's cutaway. */
export class CityArchitecture {
  private materials = new Map<string, T.MeshStandardMaterial>();
  readonly counts: Record<FacadeStyle, number> = { modern: 0, market: 0, timber: 0 };
  rearFacades = 0;
  rear(root: T.Group, style: FacadeStyle, x: number, z: number, w: number, h: number, facing: number) {
    const g = new T.Group();
    g.name = `${style}-rear`;
    g.position.set(x, 0, z);
    g.rotation.y = facing < 0 ? Math.PI : 0;
    root.add(g);
    this.rearFacades++;
    const trim = style === 'modern' ? '#91a9a7' : '#c3ad83';
    for (let y = 3; y < h - 0.45; y += 2.05) {
      this.box(g, w - 0.15, 0.09, 0.16, trim, 0, y - 0.67, 0.09);
      for (const side of [-1, 1]) {
        const wx = side * w * 0.24,
          ww = Math.min(1.25, w * 0.27);
        this.box(g, ww + 0.14, 1.2, 0.12, trim, wx, y, 0.08);
        this.box(g, ww, 1.06, 0.13, style === 'timber' ? '#426051' : '#344f5b', wx, y, 0.16);
        if (style === 'modern') {
          this.box(g, 0.035, 1.08, 0.05, '#a7bbb7', wx, y, 0.25);
          this.box(g, ww, 0.035, 0.05, '#a7bbb7', wx, y + 0.1, 0.25);
        } else
          for (let slat = 0; slat < 6; slat++)
            this.box(g, ww - 0.08, 0.07, 0.055, '#899378', wx, y - 0.43 + slat * 0.17, 0.25);
      }
    }
    // Utilities sit high against the wall, outside the pedestrian head space.
    const ventX = w * 0.24,
      ventY = Math.min(3.6, h - 0.45);
    this.box(g, 0.68, 0.42, 0.32, '#a5aa9a', ventX, ventY, 0.2);
    for (let slat = 0; slat < 5; slat++)
      this.box(g, 0.5, 0.025, 0.015, '#536b69', ventX, ventY - 0.13 + slat * 0.065, 0.37);
    for (const side of [-1, 1]) {
      this.box(g, 0.07, h - 0.2, 0.07, '#777e6c', side * (w / 2 - 0.15), h / 2, 0.02);
      for (let y = 1; y < h; y += 1.6) this.box(g, 0.12, 0.045, 0.09, trim, side * (w / 2 - 0.15), y, 0.02);
    }
    return g;
  }
  pavilionRoof(root: T.Group, x: number, y: number, z: number) {
    const g = new T.Group();
    g.name = 'oldtown-layered-gables';
    g.position.set(x, y, z);
    root.add(g);
    for (let tier = 0; tier < 3; tier++) {
      const run = 4.65 - tier * 1.15,
        rise = 1.18,
        depth = 6 - tier * 0.9,
        base = tier * 0.72;
      for (const side of [-1, 1]) {
        const slope = -side * Math.atan2(rise, run);
        const roof = this.box(
          g,
          Math.hypot(run, rise),
          0.13,
          depth,
          tier % 2 ? '#527b65' : '#9c4d38',
          (side * run) / 2,
          base + rise / 2,
          0,
        );
        roof.rotation.z = slope;
        for (const end of [-1, 1]) {
          const trim = this.box(
            g,
            Math.hypot(run, rise) + 0.15,
            0.11,
            0.11,
            '#e2c383',
            (side * run) / 2,
            base + rise / 2,
            (end * depth) / 2,
          );
          trim.rotation.z = slope;
          const hook = [
            new T.Vector3(side * run, base, (end * depth) / 2),
            new T.Vector3(side * (run + 0.14), base + 0.16, (end * depth) / 2),
            new T.Vector3(side * (run + 0.2), base + 0.43, (end * depth) / 2),
          ];
          this.mesh(
            g,
            new T.TubeGeometry(new T.CatmullRomCurve3(hook), 8, 0.055, 6, false),
            '#e2c383',
            0,
            0,
            0,
          );
        }
        for (let tile = -depth / 2 + 0.15; tile < depth / 2; tile += 0.24) {
          const rib = this.box(
            g,
            Math.hypot(run, rise),
            0.024,
            0.024,
            tier % 2 ? '#739274' : '#bf7a50',
            (side * run) / 2,
            base + rise / 2 + 0.078,
            tile,
          );
          rib.rotation.z = slope;
        }
      }
      this.box(g, 0.13, 0.14, depth + 0.2, '#edcc83', 0, base + rise + 0.08, 0);
      for (const end of [-1, 1]) {
        const shape = new T.Shape();
        shape.moveTo(-run + 0.18, base + 0.05);
        shape.lineTo(0, base + rise - 0.08);
        shape.lineTo(run - 0.18, base + 0.05);
        shape.closePath();
        const face = this.mesh(g, new T.ShapeGeometry(shape), '#aa7543', 0, 0, end * (depth / 2 - 0.08));
        if (end < 0) face.rotation.y = Math.PI;
        this.mesh(g, new T.OctahedronGeometry(0.19), '#efcf87', 0, base + 0.47, end * (depth / 2 + 0.02));
      }
    }
    return g;
  }
  private material(color: string, glow = 0) {
    const key = color + glow;
    if (!this.materials.has(key))
      this.materials.set(
        key,
        new T.MeshStandardMaterial({ color, roughness: 0.72, emissive: color, emissiveIntensity: glow }),
      );
    return this.materials.get(key)!;
  }
  private mesh(
    root: T.Group,
    geometry: T.BufferGeometry,
    color: string,
    x: number,
    y: number,
    z: number,
    glow = 0,
  ) {
    const mesh = new T.Mesh(geometry, this.material(color, glow));
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  }
  private box(
    root: T.Group,
    w: number,
    h: number,
    d: number,
    color: string,
    x: number,
    y: number,
    z: number,
    glow = 0,
  ) {
    return this.mesh(root, new T.BoxGeometry(w, h, d), color, x, y, z, glow);
  }
  facade(
    root: T.Group,
    style: FacadeStyle,
    x: number,
    z: number,
    width: number,
    height: number,
    depth: number,
    facing: number,
  ) {
    const g = new T.Group();
    g.name = `${style}-facade`;
    g.position.set(x, 0, z);
    g.rotation.y = facing < 0 ? Math.PI : 0;
    root.add(g);
    this.counts[style]++;
    if (style === 'modern') this.modern(g, width, height);
    else if (style === 'market') this.market(g, width, height);
    else this.timber(g, width, height, depth);
    return g;
  }
  private modern(g: T.Group, w: number, h: number) {
    this.box(g, w - 0.16, h - 0.15, 0.1, '#273d49', 0, h / 2, 0.09);
    const columns = 3,
      bay = (w - 0.6) / columns;
    for (let floor = 0; floor < Math.floor(h / 2.3); floor++) {
      const y = 1.2 + floor * 2.3;
      for (let column = 0; column < columns; column++) {
        const x = (column - 1) * bay;
        this.box(g, bay - 0.1, 1.8, 0.08, floor % 2 ? '#386572' : '#527986', x, y, 0.17, 0.06);
        this.box(g, 0.045, 1.82, 0.13, '#a1b5b4', x - bay / 2 + 0.05, y, 0.23);
        this.box(g, bay - 0.1, 0.035, 0.13, '#a1b5b4', x, y + 0.34, 0.23);
      }
      this.box(g, w, 0.2, 0.22, '#7c9294', 0, y + 1.03, 0.2);
    }
    for (const side of [-1, 1])
      for (let fin = 0; fin < 3; fin++)
        this.box(g, 0.055, h, 0.4, '#b9bdb0', side * (w / 2 - 0.12 - fin * 0.11), h / 2, 0.27);
    this.box(g, w + 0.18, 0.12, 1.05, '#344f59', 0, 2.4, 0.48);
    this.box(g, w - 0.2, 0.055, 0.05, '#a2d5d6', 0, 2.4, 1.02, 0.65);
    this.box(g, 1.05, 1.95, 0.1, '#314749', 0, 1.04, 0.28);
    this.box(g, 0.035, 0.4, 0.07, '#d4b57d', 0.36, 1.1, 0.36);
    this.box(g, w - 0.6, 0.18, 0.28, '#adc4c0', 0, h + 0.08, 0.2);
  }
  private market(g: T.Group, w: number, h: number) {
    const gold = '#d9b572',
      red = '#8d3936';
    for (const side of [-1, 1]) {
      this.box(g, 0.22, h, 0.2, gold, side * (w / 2 - 0.13), h / 2, 0.13);
      this.box(g, w * 0.3, 1.58, 0.12, '#6b4931', side * w * 0.26, 1.12, 0.1, 0.15);
      for (let rail = 0; rail < 5; rail++)
        this.box(g, w * 0.29, 0.035, 0.06, gold, side * w * 0.26, 0.52 + rail * 0.3, 0.21);
    }
    this.box(g, 0.9, 1.94, 0.17, '#395750', 0, 1.07, 0.13);
    this.box(g, w + 0.16, 0.45, 0.3, red, 0, 2.55, 0.2);
    for (const y of [2.29, 2.81]) this.box(g, w + 0.22, 0.07, 0.34, gold, 0, y, 0.23);
    for (let y = 3.72; y < h - 0.4; y += 2.1)
      for (const side of [-1, 1]) {
        const x = side * w * 0.25,
          radius = Math.min(0.68, w * 0.13);
        this.box(g, radius * 2, 1.08, 0.09, '#3c6455', x, y - 0.1, 0.13);
        const arch: T.Vector3[] = [];
        for (let i = 0; i <= 16; i++) {
          const a = Math.PI - (i * Math.PI) / 16;
          arch.push(new T.Vector3(x + Math.cos(a) * radius, y + 0.38 + Math.sin(a) * radius * 0.62, 0.23));
        }
        this.mesh(g, new T.TubeGeometry(new T.CatmullRomCurve3(arch), 16, 0.055, 6, false), gold, 0, 0, 0);
        for (const edge of [-radius, radius]) this.box(g, 0.085, 1.1, 0.17, gold, x + edge, y - 0.13, 0.2);
        for (let slat = 0; slat < 6; slat++)
          this.box(g, radius * 1.75, 0.06, 0.1, '#93a68c', x, y - 0.53 + slat * 0.17, 0.24);
        this.box(g, radius * 2.25, 0.1, 0.32, gold, x, y - 0.7, 0.23);
      }
    this.box(g, w + 0.3, 0.18, 0.85, red, 0, h + 0.08, 0.25);
    for (let tile = 0; tile < Math.ceil(w * 5); tile++)
      this.mesh(
        g,
        new T.CylinderGeometry(0.055, 0.055, 0.84, 6).rotateX(Math.PI / 2),
        '#bb7654',
        -w / 2 + tile * 0.2,
        h + 0.19,
        0.25,
      );
    // A projecting illuminated sign casing catches the street view from either direction.
    this.box(g, 0.38, 2.6, 0.56, red, w / 2 - 0.35, Math.min(h - 0.8, 4.5), 0.67, 0.1);
    for (const side of [-1, 1])
      this.box(g, 0.035, 2.66, 0.6, gold, w / 2 - 0.35 + side * 0.2, Math.min(h - 0.8, 4.5), 0.67, 0.25);
  }
  private timber(g: T.Group, w: number, h: number, d: number) {
    for (let y = 0.2; y < h; y += 0.24)
      this.box(g, w, 0.2, 0.12, Math.round(y * 10) % 3 ? '#886748' : '#a07c54', 0, y, 0.1);
    for (const x of [-w / 2 + 0.12, 0, w / 2 - 0.12]) this.box(g, 0.2, h, 0.22, '#4f4936', x, h / 2, 0.2);
    for (let y = 1.25; y < h - 0.3; y += 2.2)
      for (const side of [-1, 1]) {
        const x = side * w * 0.25,
          ww = Math.min(1.55, w * 0.3);
        this.box(g, ww, 1.45, 0.14, '#c7bb91', x, y, 0.23);
        this.box(g, ww - 0.18, 1.26, 0.13, '#304d45', x, y, 0.33);
        for (let slat = 0; slat < 7; slat++)
          this.box(g, ww - 0.23, 0.055, 0.08, '#8c9b75', x, y - 0.5 + slat * 0.165, 0.42);
        this.box(g, ww + 0.16, 0.12, 0.34, '#d8c49a', x, y - 0.78, 0.31);
      }
    this.box(g, 1.05, 1.95, 0.15, '#4c4936', 0, 1.06, 0.36);
    this.box(g, 0.7, 0.75, 0.06, '#87977b', 0, 1.45, 0.46);
    this.box(g, 0.045, 0.24, 0.07, '#dfc391', 0.32, 0.95, 0.48);
    const rise = 1.2,
      run = w / 2 + 0.3,
      slope = Math.atan2(rise, run);
    for (const side of [-1, 1]) {
      const roof = this.box(
        g,
        Math.hypot(run, rise),
        0.13,
        d + 0.6,
        '#784b38',
        (side * run) / 2,
        h + rise / 2,
        -d / 2,
      );
      roof.rotation.z = -side * slope;
      const bar = this.box(
        g,
        Math.hypot(run, rise) + 0.12,
        0.13,
        0.15,
        '#ddc496',
        (side * run) / 2,
        h + rise / 2,
        0.34,
      );
      bar.rotation.z = -side * slope;
    }
    this.box(g, 0.15, 0.18, d + 0.7, '#d4ab68', 0, h + rise, -d / 2);
    this.box(g, w + 0.25, 0.13, 0.8, '#644f39', 0, 2.2, 0.42);
    for (let x = -w / 2 + 0.2; x < w / 2; x += 0.22) this.box(g, 0.08, 0.26, 0.07, '#c7b68a', x, 2.03, 0.81);
  }
}
