import * as T from 'three';
import { RiverArena } from './RiverArena';
import { RiverSpirits } from './RiverSpirits';
import { actor, enemyIntent, type Battle } from './expeditionCombat';

/** Original river-guardian arena; presentation follows the combat model, never the reverse. */
export class RiverBattleStage {
  readonly root = new T.Group();
  readonly environmentFallback = new T.Group();
  readonly environment: RiverArena;
  readonly spirits: RiverSpirits;
  private enemies = new Map<string, T.Group>();
  private rings: T.Mesh[] = [];
  private marker: T.Mesh;
  private bolt: T.Mesh;
  private aura: T.Mesh;
  private motes: T.Points;
  private battle: Battle | null = null;
  private selected: string | null = null;
  private eventTime = -10;
  private elapsed = 0;
  private charge: number | null = null;
  private serial = -1;
  private materials = new Map<string, T.MeshStandardMaterial>();
  constructor(scene: T.Scene) {
    this.root.position.z = 29;
    this.root.visible = false;
    scene.add(this.root);
    this.environmentFallback.name = 'river-arena-fallback';
    this.environmentFallback.userData.animated = true;
    this.root.add(this.environmentFallback);
    this.mesh(new T.CylinderGeometry(7.8, 8.1, 0.4, 80), '#182e38', this.environmentFallback, [0, -0.25, 0]);
    this.mesh(
      new T.CylinderGeometry(7.4, 7.4, 0.055, 80),
      '#2a3f48',
      this.environmentFallback,
      [0, -0.02, 0],
    );
    for (const radius of [2.6, 5.2, 7.2, 7.7]) {
      const ring = this.mesh(
        new T.TorusGeometry(radius, 0.017, 6, 100),
        '#c3a56d',
        this.environmentFallback,
        [0, 0.022, 0],
        0.75,
      );
      ring.rotation.x = Math.PI / 2;
    }
    // Radial stone inlay and floating lotus petals over a dark river.
    for (let i = 0; i < 32; i++) {
      const angle = (i / 32) * Math.PI * 2;
      const seam = this.mesh(new T.BoxGeometry(0.018, 0.016, 4.6), '#718185', this.environmentFallback, [
        Math.sin(angle) * 4.8,
        0.018,
        Math.cos(angle) * 4.8,
      ]);
      seam.rotation.y = angle;
      if (i % 2 === 0) {
        const petal = this.mesh(
          new T.OctahedronGeometry(0.28, 0),
          '#b69a68',
          this.environmentFallback,
          [Math.sin(angle) * 6.9, 0.09, Math.cos(angle) * 6.9],
          0.3,
        );
        petal.scale.set(0.5, 0.12, 1.8);
        petal.rotation.y = angle;
      }
    }
    const water = new T.Mesh(
      new T.PlaneGeometry(120, 80),
      new T.MeshStandardMaterial({ color: '#102536', metalness: 0.7, roughness: 0.28 }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.5;
    this.root.add(water);
    for (let i = 0; i < 7; i++) {
      const x = (i - 3) * 3.4,
        z = -6 - Math.abs(i - 3) * 0.35;
      this.mesh(new T.CylinderGeometry(0.25, 0.48, 2.5, 8), '#283e46', this.environmentFallback, [x, 1, z]);
      this.mesh(new T.BoxGeometry(0.8, 0.17, 0.8), '#977c51', this.environmentFallback, [x, 2.35, z]);
      this.mesh(new T.ConeGeometry(0.64, 0.65, 4), '#3f5557', this.environmentFallback, [x, 3.12, z]);
      this.mesh(new T.BoxGeometry(0.45, 0.5, 0.45), '#f1c981', this.environmentFallback, [x, 2.67, z], 2);
      this.mesh(new T.SphereGeometry(0.07, 8, 6), '#eecf92', this.environmentFallback, [x, 3.55, z], 2);
    }
    this.environment = new RiverArena(this.root, this.environmentFallback);
    const warm = new T.PointLight('#ffcf87', 18, 18, 2);
    warm.position.set(4, 5, 0);
    this.root.add(warm);
    const cool = new T.PointLight('#73d8e1', 15, 18, 2);
    cool.position.set(-3, 4, 3);
    this.root.add(cool);
    this.enemies.set('main', this.guardian(false));
    this.enemies.set('echo', this.guardian(true));
    this.enemies.set('sentinel', this.waywarden());
    this.spirits = new RiverSpirits(this.enemies);
    for (const [x, z, r] of [
      [-3.5, 1.8, 0.45],
      [-3.7, -0.2, 0.42],
      [2.6, 0.6, 0.8],
      [0.1, -3.1, 0.5],
    ]) {
      const shadow = new T.Mesh(
        new T.CircleGeometry(r, 32),
        new T.MeshBasicMaterial({ color: '#020d17', transparent: true, opacity: 0.4, depthWrite: false }),
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.set(x, 0.03, z);
      shadow.scale.y = 0.7;
      this.root.add(shadow);
    }
    this.marker = this.mesh(new T.TorusGeometry(0.85, 0.025, 8, 64), '#ffe2a3', this.root, [0, 0.05, 0], 2);
    this.marker.rotation.x = Math.PI / 2;
    this.bolt = this.mesh(new T.SphereGeometry(0.16, 10, 8), '#ffe3ab', this.root, [0, 1, 0], 3);
    this.bolt.visible = false;
    this.aura = this.mesh(new T.TorusGeometry(0.8, 0.025, 8, 64), '#e0bf81', this.root, [0, 1, 0], 2);
    this.aura.visible = false;
    for (const moving of [this.marker, this.bolt, this.aura]) moving.userData.animated = true;
    const positions = new Float32Array(150 * 3);
    for (let i = 0; i < 150; i++) {
      positions[i * 3] = Math.sin(i * 17.8) * 10;
      positions[i * 3 + 1] = 0.5 + (i % 31) * 0.16;
      positions[i * 3 + 2] = Math.cos(i * 31.7) * 9;
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.BufferAttribute(positions, 3));
    this.motes = new T.Points(
      geometry,
      new T.PointsMaterial({
        color: '#dfc49a',
        size: 0.025,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
        blending: T.AdditiveBlending,
      }),
    );
    this.root.add(this.motes);
  }
  private mesh(geometry: T.BufferGeometry, color: string, parent: T.Object3D, position: number[], glow = 0) {
    const key = color + glow;
    let material = this.materials.get(key);
    if (!material) {
      material = new T.MeshStandardMaterial({
        color,
        roughness: 0.72,
        metalness: 0.25,
        emissive: color,
        emissiveIntensity: glow,
      });
      this.materials.set(key, material);
    }
    const mesh = new T.Mesh(geometry, material);
    mesh.position.set(position[0], position[1], position[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  private guardian(echo: boolean) {
    const g = new T.Group();
    g.userData.animated = true;
    this.root.add(g);
    const body = new T.Group();
    g.add(body);
    g.userData.body = body;
    if (echo) {
      this.mesh(new T.CylinderGeometry(0.55, 0.42, 0.85, 6), '#527d7f', body, [0, 1.5, 0]);
      this.mesh(new T.SphereGeometry(0.26, 12, 10), '#b7e8d9', body, [0, 1.55, 0], 2);
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        const rib = this.mesh(new T.BoxGeometry(0.055, 1.2, 0.055), '#c1a779', body, [
          Math.sin(a) * 0.5,
          1.5,
          Math.cos(a) * 0.5,
        ]);
        rib.rotation.y = a;
        const petal = this.mesh(new T.OctahedronGeometry(0.4, 0), '#91b3ad', body, [
          Math.sin(a) * 0.8,
          1.8,
          Math.cos(a) * 0.8,
        ]);
        petal.scale.set(0.35, 1.2, 0.6);
        petal.rotation.z = Math.sin(a) * 0.8;
      }
      this.mesh(new T.ConeGeometry(0.67, 0.5, 6), '#b79960', body, [0, 2.2, 0]);
      this.mesh(new T.ConeGeometry(0.4, 0.6, 6), '#c3ab79', body, [0, 0.75, 0]);
      const halo = this.mesh(new T.TorusGeometry(1.05, 0.018, 6, 64), '#c3d7b8', body, [0, 1.5, 0], 1);
      halo.rotation.x = Math.PI / 2;
      this.rings.push(halo);
      g.position.set(0.1, 0.12, -3.1);
      return g;
    }
    // A faceted ceremonial mask, segmented robes, floating arms and a lotus crown.
    const color = echo ? '#467d83' : '#526573',
      gold = echo ? '#bba976' : '#c49b60';
    this.mesh(new T.ConeGeometry(0.72, 1.8, 8, 1, true), color, body, [0, 1.45, 0]);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const shard = this.mesh(new T.ConeGeometry(0.22, 1.45, 3), gold, body, [
        Math.sin(a) * 0.51,
        1.3,
        Math.cos(a) * 0.51,
      ]);
      shard.rotation.z = Math.cos(a) * 0.13;
      shard.rotation.x = Math.sin(a) * 0.13;
    }
    const head = this.mesh(new T.IcosahedronGeometry(0.46, 1), '#acb4af', body, [0, 2.68, 0]);
    head.scale.set(0.82, 1.2, 0.7);
    // Face toward the party at negative X.
    for (const z of [-0.14, 0.14]) {
      const eye = this.mesh(new T.BoxGeometry(0.025, 0.055, 0.12), '#d7f8e6', body, [-0.35, 2.72, z], 3);
      eye.rotation.x = z * 1.8;
    }
    this.mesh(new T.ConeGeometry(0.13, 1.1, 5), gold, body, [0, 3.47, 0]);
    for (const side of [-1, 1]) {
      const arm = this.mesh(new T.CylinderGeometry(0.13, 0.19, 0.85, 6), color, body, [0, 2.2, side * 0.87]);
      arm.rotation.x = side * 0.75;
      this.mesh(new T.IcosahedronGeometry(0.2, 0), gold, body, [-0.15, 1.82, side * 1.14]);
      const horn = this.mesh(new T.ConeGeometry(0.16, 0.7, 5), gold, body, [0, 3.08, side * 0.35]);
      horn.rotation.x = side * 0.4;
    }
    const halo = this.mesh(new T.TorusGeometry(1.45, 0.027, 8, 90), gold, body, [0.12, 2.1, 0], 1.4);
    halo.rotation.y = Math.PI / 2;
    this.rings.push(halo);
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      const rune = this.mesh(
        new T.OctahedronGeometry(0.09, 0),
        gold,
        body,
        [0.12, 2.1 + Math.sin(a) * 1.45, Math.cos(a) * 1.45],
        1,
      );
      rune.rotation.x = a;
    }
    if (echo) {
      g.scale.setScalar(0.65);
      g.position.set(0.1, 0.12, -3.1);
    } else g.position.set(2.6, 0.1, 0.6);
    return g;
  }
  private waywarden() {
    const group = new T.Group(),
      body = new T.Group();
    group.userData.animated = true;
    group.userData.body = body;
    group.position.set(2.6, 0.1, 0.6);
    group.add(body);
    this.root.add(group);
    this.mesh(new T.IcosahedronGeometry(0.46, 1), '#b0eadc', body, [0, 1.95, 0], 1.4);
    const hoop = this.mesh(new T.TorusGeometry(1.15, 0.075, 10, 64), '#bd9757', body, [0, 1.95, 0], 0.6);
    hoop.rotation.y = Math.PI / 2;
    const plates: T.Mesh[] = [];
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      const plate = this.mesh(new T.BoxGeometry(0.18, 0.42, 0.65), '#8e7047', body, [
        -0.28,
        1.95 + Math.sin(angle) * 0.72,
        Math.cos(angle) * 0.72,
      ]);
      plate.rotation.x = Math.PI / 2 - angle;
      plates.push(plate);
      const arrow = this.mesh(
        new T.ConeGeometry(0.17, 0.62, 4),
        '#d8b76c',
        body,
        [0, 1.95 + Math.sin(angle) * 1.4, Math.cos(angle) * 1.4],
        0.4,
      );
      arrow.rotation.x = Math.PI / 2 - angle;
    }
    group.userData.plates = plates;
    for (const z of [-0.8, 0.8]) {
      const foot = this.mesh(new T.ConeGeometry(0.24, 0.85, 5), '#3d6664', body, [0, 0.7, z]);
      foot.rotation.x = z * 0.3;
    }
    return group;
  }
  set(battle: Battle | null, target: string | null) {
    this.battle = battle;
    this.selected = target;
    this.root.visible = !!battle;
    if (battle && battle.event.seq !== this.serial) {
      this.serial = battle.event.seq;
      this.eventTime = this.elapsed;
    }
    if (!battle) {
      this.serial = -1;
      this.charge = null;
    }
  }
  defense(progress: number | null) {
    this.charge = progress;
  }
  private local(id: string): T.Vector3 {
    return id === 'patrick'
      ? new T.Vector3(-3.5, 1.3, 1.8)
      : id === 'su'
        ? new T.Vector3(-3.7, 1.3, -0.2)
        : id === 'echo'
          ? new T.Vector3(0.1, 1.8, -3.1)
          : new T.Vector3(2.6, 2, 0.6);
  }
  update(
    time: number,
    party: T.Group,
    camera: T.Vector3,
    look: T.Vector3,
    narrow: boolean,
    reduced: boolean,
  ) {
    this.elapsed = time;
    const b = this.battle;
    if (!b) return;
    party.position.set(0, 0.1, 29);
    party.rotation.set(0, 0, 0);
    const since = time - this.eventTime,
      action = since < 0.95 && b.event.seq > 0;
    this.spirits.update(
      time,
      reduced,
      action ? (b.event.source === b.foes[0].id ? 'main' : b.event.source) : null,
      action ? Math.sin((Math.max(0, since) / 0.95) * Math.PI) : 0,
    );
    this.enemies.forEach((g, key) => {
      const f = key === 'echo' ? b.foes[1] : b.foes[0];
      const variant = key === 'echo' || (key === 'sentinel' ? b.id === 'sentinel' : b.id !== 'sentinel');
      g.visible = variant && (f.hp > 0 || (action && b.event.target === f.id));
      if (!g.visible) return;
      const body = g.userData.body as T.Group;
      body.position.y = reduced ? 0 : Math.sin(time * 1.5 + (key === 'echo' ? 1 : 0)) * 0.12;
      body.rotation.z =
        !reduced && action && b.event.target === f.id && ['strike', 'parry', 'duet'].includes(b.event.kind)
          ? Math.sin(since * 35) * 0.12 * (1 - since)
          : 0;
      const scale = key === 'echo' ? 0.65 : b.id === 'keeper' ? 1.25 : 1;
      g.scale.setScalar(scale * (f.hp === 0 ? Math.max(0.001, 1 - since) : 1));
      if (key === 'sentinel')
        (g.userData.plates as T.Mesh[]).forEach((plate, i) => {
          const angle = (i * Math.PI) / 4,
            radius = f.exposed ? 1.1 : 0.72;
          plate.position.set(
            f.exposed ? 0.08 : -0.28,
            1.95 + Math.sin(angle) * radius,
            Math.cos(angle) * radius,
          );
          plate.scale.setScalar(f.exposed ? 0.5 : 1);
        });
    });
    party.children.forEach((h) => {
      const id = h.userData.player ? 'patrick' : 'su',
        hero = b.heroes.find((x) => x.id === id)!;
      const base = h.userData.basePosition as T.Vector3;
      if (!base) return;
      const spot = this.local(id);
      h.position.set(spot.x + (base.x - (id === 'patrick' ? -1.05 : 1.1)), base.y, spot.z + base.z);
      h.rotation.set(0, Math.PI / 2, hero.hp ? 0 : -1.15);
      if (!reduced && action && b.event.source === id)
        h.position.x += Math.sin(Math.min(1, since / 0.95) * Math.PI) * 0.9;
      if (!reduced && action && b.event.target === id && b.event.kind === 'dodge')
        h.position.z += Math.sin((since / 0.95) * Math.PI) * 1.4;
    });
    this.marker.visible = b.phase === 'command';
    const spot = this.local(this.selected ?? actor(b));
    this.marker.position.set(spot.x, 0.05, spot.z);
    if (!reduced) {
      this.rings.forEach((r, i) => (r.rotation.x = time * 0.12 * (i ? 1 : -1)));
      this.motes.rotation.y = time * 0.012;
    }
    this.bolt.visible = !reduced && action && ['strike', 'parry', 'duet'].includes(b.event.kind);
    if (this.bolt.visible) {
      const source = this.local(b.event.source),
        target = this.local(b.event.target);
      this.bolt.position.copy(source.lerp(target, Math.min(1, since * 2.5)));
      this.bolt.scale.setScalar(b.event.kind === 'duet' ? 3 : 1);
    }
    this.aura.visible =
      !reduced && (this.charge !== null || (action && ['heal', 'guard', 'duet'].includes(b.event.kind)));
    if (this.charge !== null) {
      const intent = enemyIntent(b);
      this.aura.position.copy(this.local(intent.foe.id));
      this.aura.scale.setScalar(2.3 - this.charge * 1.4);
      this.aura.rotation.set(0, Math.PI / 2, 0);
    } else if (this.aura.visible) {
      this.aura.position.copy(this.local(b.event.target));
      this.aura.scale.setScalar(0.5 + since * 2);
      this.aura.rotation.set(Math.PI / 2, 0, 0);
    }
    camera.set(narrow ? -15 : -8, narrow ? 9 : 5.4, narrow ? 57 : 42.8);
    look.set(narrow ? -0.4 : 0.8, !narrow && this.selected?.includes('echo') ? 0.6 : 1, 28.7);
    if (!reduced && action && ['strike', 'duet', 'parry'].includes(b.event.kind)) {
      camera.x += Math.sin(since * Math.PI) * 1.5;
      camera.z -= Math.sin(since * Math.PI) * 1.7;
      look.y += 0.3;
    }
  }
}
