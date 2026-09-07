import * as T from 'three';
import { buildThonburi } from './CityThonburi';
import { CityRailway } from './CityRailway';
import { CanalHouses } from './CanalHouses';
import { CityArchive } from './CityArchive';
import { archiveRooms, archiveFloors } from './archiveLayout';
import { groupHotelNorthWall } from './HotelCutaway';
import {
  cityAreas,
  cityRoads,
  cityWalkways,
  cityBackdropBlocks,
  cityObstacles,
  oldTownWalls,
  foodStallCounter,
  foodStallOrigin,
  type CityPoint,
  type CityArea,
} from './city';
import { blocksCityView } from './cityVisibility';
import { CityMaterials, type CitySurface } from './CityMaterials';
import { CityProps } from './CityProps';
import { CityLife } from './CityLife';
import { CityGarden } from './CityGarden';
import { CityGroundLight } from './CityGroundLight';
import { CityArchitecture, type FacadeStyle } from './CityArchitecture';
import { HotelInterior } from './HotelInterior';
import { CityBackdrop } from './CityBackdrop';
import { CityWayfinding, wayfindingSites } from './CityWayfinding';
import { CityLandmarks } from './CityLandmarks';
import { CityShophouses } from './CityShophouses';
import { CityEvening } from './CityEvening';
import { CityFoodStall } from './CityFoodStall';
import { HotelFurnishings } from './HotelFurnishings';

/** District-sized batches keep the larger city inexpensive to explore. */
export class CityScenery {
  readonly chunks = new Map<CityArea | 'roads', T.Group>();
  readonly cutaways: { object: T.Object3D; bounds: T.Box3 }[] = [];
  private materials = new Map<string, T.MeshStandardMaterial>();
  private textures: T.Texture[] = [];
  private surfaces = new CityMaterials();
  private garden = new CityGarden();
  readonly groundLight = new CityGroundLight();
  readonly architecture = new CityArchitecture();
  readonly wayfinding = new CityWayfinding();
  readonly backdrop: CityBackdrop;
  readonly props: CityProps;
  readonly life: CityLife;
  readonly railway: CityRailway;
  readonly canalHouses: CanalHouses;
  readonly landmarks: CityLandmarks;
  readonly archive: CityArchive;
  readonly shophouses = new CityShophouses();
  readonly evening: CityEvening;
  readonly foodStall: CityFoodStall;
  readonly hotelFurnishings: HotelFurnishings;
  private batch: (root: T.Object3D) => void;
  constructor(scene: T.Scene, batch: (root: T.Object3D) => void) {
    this.batch = batch;
    for (const area of cityAreas.filter((a) => a.id !== 'riverside')) {
      const g = new T.Group();
      g.name = area.name;
      scene.add(g);
      this.chunks.set(area.id, g);
      const { x, z, w, d } = area.bounds;
      if (area.id !== 'archive' && area.id !== 'thonburi')
        this.surface(
          g,
          [w, 0.16, area.id === 'sukhumvit' ? d - 1 : d],
          [x + w / 2, 0, z + d / 2 - (area.id === 'sukhumvit' ? 0.5 : 0)],
          area.id === 'lumphini'
            ? 'grass'
            : area.id === 'hotel'
              ? 'marble'
              : area.id === 'oldtown'
                ? 'pavers'
                : 'asphalt',
          area.id === 'lumphini' ? '#789674' : area.id === 'hotel' ? '#e6dac3' : '#bfc3bc',
        );
      // The hotel owns the overlapping western strip; avoid two floors at the same height.
      if (area.id === 'sukhumvit') this.surface(g, [12, 0.16, 1], [-38, 0, 23.5], 'asphalt', '#bfc3bc');
    }
    const roads = new T.Group();
    scene.add(roads);
    this.chunks.set('roads', roads);
    this.surface(roads, [210, 0.3, 67], [15, -0.25, 31.5], 'grass', '#526758');
    for (const r of cityRoads) {
      const walking = cityWalkways.includes(r);
      this.surface(
        roads,
        [r.w, walking ? 0.16 : 0.14, r.d],
        [r.x + r.w / 2, walking ? 0.01 : -0.01, r.z + r.d / 2],
        walking ? 'pavers' : 'asphalt',
        walking ? '#c8ba9c' : '#aeb5b6',
      );
      if (walking) continue;
      const horizontal = r.w > r.d,
        length = horizontal ? r.w : r.d;
      for (let i = 2; i < length; i += 3)
        this.box(
          roads,
          horizontal ? [1.5, 0.018, 0.06] : [0.06, 0.018, 1.5],
          [r.x + (horizontal ? i : r.w / 2), 0.08, r.z + (horizontal ? r.d / 2 : i)],
          '#c9b891',
        );
    }
    for (const x of [-28, -8, 12, 20]) {
      this.lamp(roads, x, 10.3);
      this.lamp(roads, x, 15.7);
      this.box(roads, [0.9, 0.6, 0.9], [x + 1, 0.3, 16.4], '#465b50');
      this.tree(roads, x + 1, 16.4, 0.75);
    }
    this.hotel();
    this.sukhumvit();
    this.park();
    this.yaowarat();
    this.oldtown();
    buildThonburi(this.chunks.get('thonburi')!,{
      surface:(g,size,p)=>this.surface(g,size,p,'teak','#b8a179'),
      sign:(g,text,p,color,width)=>{this.sign(g,text,p,color,width,false,1,0,false);},
      cutaway:g=>this.cutaway(g),tree:(g,x,z,s)=>this.tree(g,x,z,s),lamp:(g,x,z)=>this.lamp(g,x,z),
    });
    this.canalHouses = new CanalHouses(this.chunks.get('thonburi')!, batch, root => this.cutaway(root));
    const archive = this.chunks.get('archive')!;
    for (const r of archiveFloors)
      this.surface(archive, [r.w, 0.1, r.d], [r.x + r.w / 2, -0.01, r.z + r.d / 2], 'teak', '#b8a179');
    for (const r of archiveRooms) {
      const stand = new T.Group();
      archive.add(stand);
      for (const x of [r.x + r.w / 2 - 1.65, r.x + r.w / 2 + 1.65])
        this.box(stand, [0.08, 2.35, 0.08], [x, 1.23, r.z + 0.125], '#69503a');
      this.sign(
        stand,
        r.name.toUpperCase(),
        [r.x + r.w / 2, 1.85, r.z + 0.35],
        '#f0d6a4',
        3.5,
        false,
        1,
        0,
        false,
      );
      this.cutaway(stand);
    }
    const entry = new T.Group();
    archive.add(entry);
    for (const x of [48, 52]) this.box(entry, [0.12, 2.9, 0.12], [x, 1.5, 29.4], '#69503a');
    this.sign(entry, 'HOUSE OF RETURNING MAPS →', [50, 2.3, 29.4], '#e1c891', 4.5, false, 1, 0, false);
    this.cutaway(entry);
    for (const [x, z, scale] of [
      [62, 19, 0.8],
      [93, 29, 1.1],
      [77, 10, 0.85],
      [76, 23.2, 0.6],
    ])
      this.tree(archive, x, z, scale);
    this.archive = new CityArchive(archive, batch, (root) => this.cutaway(root));
    this.connections(roads);
    for (const site of wayfindingSites) {
      const frame = this.wayfinding.build(this.chunks.get(site.area)!, site, (root) =>
        this.sign(root, site.text, site.position, site.color, site.width, false, 1, 0, false),
      );
      const attachments = [site.anchor, ...(site.feet ?? [])].map((p) => new T.Vector3(...p));
      const needsExistingSupport =
        site.mount !== 'post' && (!site.feet || site.feet.every((p) => p[1] > 2.2));
      const support = this.cutaways
        .filter((c) => needsExistingSupport && attachments.some((p) => c.bounds.containsPoint(p)))
        .sort(
          (a, b) => a.bounds.getSize(new T.Vector3()).length() - b.bounds.getSize(new T.Vector3()).length(),
        )[0];
      this.wayfinding.signs.at(-1)!.support = support?.object;
      this.cutaway(frame);
    }
    this.backdrop = new CityBackdrop(roads, batch, (root) => this.cutaway(root));
    this.landmarks = new CityLandmarks(this.chunks, batch, (root) => this.cutaway(root));
    const market = this.chunks.get('yaowarat')!;
    this.foodStall = new CityFoodStall(
      market,
      market.getObjectByName('lek-food-stall-fallback') as T.Group,
      batch,
      (root) => this.cutaway(root),
      (canopy) => {
        const sign = this.wayfinding.signs.find((s) => s.site.id === 'noodles');
        if (sign) sign.support = canopy;
      },
    );
    const hotel = this.chunks.get('hotel')!;
    this.hotelFurnishings = new HotelFurnishings(
      hotel,
      hotel.getObjectByName('hotel-furnishings-fallback') as T.Group,
      batch,
    );
    this.props = new CityProps(this.chunks, batch);
    this.life = new CityLife(this.chunks, batch);
    const street = this.chunks.get('sukhumvit')!;
    this.railway = new CityRailway(
      street,
      street.getObjectByName('guideway-fallback') as T.Group,
      this.life.train,
      this.life.trainFallback,
      batch,
    );
    this.evening = new CityEvening(this.chunks, batch);
    this.groundLight.build();
  }
  private material(color: string, glow = 0) {
    const key = color + glow;
    if (!this.materials.has(key))
      this.materials.set(
        key,
        new T.MeshStandardMaterial({
          color,
          roughness: 0.75,
          metalness: 0.12,
          emissive: color,
          emissiveIntensity: glow,
        }),
      );
    return this.materials.get(key)!;
  }
  private mesh(g: T.Group, geometry: T.BufferGeometry, p: number[], color: string, glow = 0) {
    const m = new T.Mesh(geometry, this.material(color, glow));
    m.position.set(p[0], p[1], p[2]);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  }
  private box(g: T.Group, size: number[], p: number[], c: string, glow = 0) {
    return this.mesh(g, new T.BoxGeometry(size[0], size[1], size[2]), p, c, glow);
  }
  private surface(g: T.Group, size: number[], p: number[], surface: CitySurface, color = '#ffffff') {
    const m = new T.Mesh(this.surfaces.box(size, surface), this.surfaces.get(surface, color));
    m.position.set(p[0], p[1], p[2]);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    return m;
  }
  private cutaway(object: T.Object3D) {
    // Keep each removable structure in its own batch, independent of the district floor.
    object.userData.animated = true;
    object.updateWorldMatrix(true, true);
    this.cutaways.push({ object, bounds: new T.Box3().setFromObject(object) });
  }
  private sign(
    g: T.Group,
    text: string,
    p: number[],
    color: string,
    width = 4,
    vertical = false,
    facing = 1,
    rotation = facing < 0 ? Math.PI : 0,
    removable = true,
  ) {
    const c = document.createElement('canvas');
    c.width = vertical ? 256 : 1024;
    c.height = vertical ? 1024 : 256;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#102e36';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = color;
    ctx.lineWidth = 8;
    ctx.strokeRect(12, 12, c.width - 24, c.height - 24);
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${vertical ? 196 : 72}px Georgia, Tahoma`;
    if (vertical) {
      [...text].forEach((ch, i) => ctx.fillText(ch, 128, ((i + 0.5) * c.height) / [...text].length));
    } else ctx.fillText(text, 512, 128, 970);
    const texture = new T.CanvasTexture(c);
    texture.colorSpace = T.SRGBColorSpace;
    this.textures.push(texture);
    const m = new T.Mesh(
      new T.PlaneGeometry(width, width * (vertical ? 4 : 0.25)),
      new T.MeshBasicMaterial({ map: texture, side: T.DoubleSide }),
    );
    m.position.set(p[0], p[1], p[2]);
    m.rotation.y = rotation;
    g.add(m);
    if (removable) this.cutaway(m);
    return m;
  }
  private lamp(g: T.Group, x: number, z: number) {
    const canal = z > 41;
    this.groundLight.add(g, 'light', x, canal ? 39.2 : z, canal ? 4.8 : 5.5, canal ? 3.6 : 5.5);
    this.groundLight.add(g, 'shade', x, z, 0.7, 0.7);
    this.mesh(g, new T.CylinderGeometry(0.06, 0.11, 2.7, 8), [x, 1.4, z], '#344345');
    this.box(g, [0.45, 0.4, 0.45], [x, 2.9, z], '#f6d394', 1.2);
    this.mesh(g, new T.ConeGeometry(0.4, 0.3, 4), [x, 3.24, z], '#406260');
  }
  private tree(g: T.Group, x: number, z: number, scale = 1) {
    this.groundLight.add(g, 'shade', x, z, 4.2 * scale, 3.2 * scale);
    this.garden.tree(g, x, z, scale, (object) => this.cutaway(object));
  }
  private hotel() {
    const g = this.chunks.get('hotel')!;
    const furniture = new T.Group();
    furniture.name = 'hotel-furnishings-fallback';
    furniture.userData.animated = true;
    g.add(furniture);
    this.groundLight.add(g, 'shade', -58, 32.5, 5.6, 4.5);
    this.groundLight.add(g, 'shade', -50.5, 31.9, 4.2, 2.8);
    this.groundLight.add(g, 'shade', -49, 24.6, 7.5, 2.8);
    this.groundLight.add(g, 'light', -60.2, 31.5, 3.2, 3.5, 0.131, '#ffbe71');
    // A cutaway room and lobby: the south/east faces stay open to the camera.
    this.surface(g, [0.22, 3.6, 13], [-62, 1.8, 29.5], 'plaster', '#e1d2b6');
    this.surface(g, [16, 3.6, 0.22], [-54, 1.8, 23], 'plaster', '#d0c4ac');
    this.box(g, [2, 0.8, 0.22], [-45, 3.2, 23], '#b7ac96');
    this.box(g, [18, 0.12, 0.18], [-53, 3.6, 23], '#d7b77f');
    for (let x = -61; x < -46; x += 2) this.box(g, [0.055, 2.7, 0.055], [x, 1.6, 23.15], '#997c58');
    this.box(g, [4, 2.5, 0.04], [-57, 2, 23.15], '#1c455b', 0.1);
    for (let i = 0; i < 8; i++)
      this.box(g, [0.14, 0.8 + (i % 3) * 0.3, 0.02], [-58.7 + i * 0.45, 1.6, 23.2], '#b4c7c5', 0.25);
    const bed = new T.Group();
    bed.name = 'guest-bed-fallback';
    bed.userData.animated = true;
    furniture.add(bed);
    this.surface(bed, [4, 0.45, 3], [-58, 0.4, 32.5], 'teak', '#c3a588');
    this.box(bed, [3.8, 0.2, 2.8], [-58, 0.72, 32.5], '#f1e5c8');
    this.box(bed, [3.8, 0.08, 1.35], [-58, 0.87, 31.8], '#3d6b6b');
    for (const x of [-58.9, -57.1]) this.box(bed, [1.3, 0.18, 0.7], [x, 0.9, 33.3], '#fff0d5');
    this.surface(bed, [4.2, 1.4, 0.14], [-58, 0.9, 34], 'teak', '#b19572');
    const bedside = new T.Group();
    bedside.name = 'bedside-fallback';
    bedside.userData.animated = true;
    g.add(bedside);
    this.box(bedside, [0.65, 0.65, 0.65], [-60.5, 0.415, 32.8], '#806952');
    const bedsideLight = new T.PointLight('#ffe0ad', 2.5, 4, 2);
    bedsideLight.position.set(-60.5, 1.25, 32.8);
    g.add(bedsideLight);
    this.surface(furniture, [6, 1, 1.1], [-49, 0.6, 24.55], 'teak', '#899d87');
    this.surface(furniture, [6.2, 0.12, 1.25], [-49, 1.16, 24.55], 'marble', '#e0c89b');
    this.sign(g, 'MALI · RECEPTION', [-49, 1.7, 24.5], '#ffe0a1', 3.8);
    const sofa = new T.Group();
    sofa.name = 'lobby-sofa-fallback';
    sofa.userData.animated = true;
    furniture.add(sofa);
    this.box(sofa, [3, 0.6, 1.2], [-50.5, 0.5, 31.6], '#69817b');
    this.box(sofa, [3, 1.1, 0.3], [-50.5, 0.8, 32.5], '#496863');
    // Layered teak wall panels and folded curtains give the room depth.
    for (let x = -61; x < -46; x += 1.5) {
      this.surface(g, [1.38, 0.83, 0.055], [x, 0.57, 23.16], 'teak', '#af9473');
      this.box(g, [1.42, 0.045, 0.09], [x, 1.02, 23.2], '#d3b780');
    }
    for (const x of [-59.2, -54.8])
      for (let fold = 0; fold < 5; fold++) {
        const drape = this.mesh(
          g,
          new T.CylinderGeometry(0.11, 0.13, 2.7, 8),
          [x + (fold - 2) * 0.15, 2.05, 23.4],
          '#b8a380',
        );
        drape.scale.z = 0.7;
      }
    for (const x of [-59, -57, -55]) this.box(g, [0.055, 2.55, 0.075], [x, 2, 23.25], '#b39767');
    for (const y of [0.72, 3.28]) this.box(g, [4.2, 0.07, 0.12], [-57, y, 23.29], '#c4a773');
    this.sign(g, 'SUKHUMVIT · HOTEL', [-49, 2.9, 23.2], '#ffe2a5', 5.5);
    this.surface(g, [0.2, 2.7, 6], [-54, 1.4, 33], 'plaster', '#e1d2b6');
    this.sign(g, 'ROOM 203', [-61.71, 1.7, 29.4], '#e7c58a', 1.2, false, 1, Math.PI / 2);
    this.sign(g, 'SUKHUMVIT →', [-45, 3.2, 23.2], '#e3d2a5', 1.9);
    new HotelInterior(g, this.surfaces);
    this.cutaway(groupHotelNorthWall(g));
    this.tree(g, -45, 34, 0.65);
    const light = new T.PointLight('#ffe2ab', 15, 17, 2);
    light.position.set(-55, 3.4, 29);
    g.add(light);
  }
  private shop(
    g: T.Group,
    x: number,
    z: number,
    w: number,
    d: number,
    color: string,
    height = 6,
    orientation?: number,
    style?: FacadeStyle,
  ) {
    const facing = orientation ?? (z < 12 ? 1 : -1),
      front = z + (facing > 0 ? d : 0),
      middle = x + w / 2;
    this.groundLight.add(g, 'shade', middle, z + d / 2, w + 2, d + 2);
    this.groundLight.add(g, 'light', middle, front + facing * 0.9, w * 0.8, 2.3, 0.132, '#f0c087');
    // A foundation and low wall outline remain readable when the upper store is cut away.
    this.surface(g, [w, 0.16, d], [middle, 0.04, z + d / 2], 'pavers', '#b7afa0');
    for (const edge of [x + 0.08, x + w - 0.08])
      this.surface(g, [0.16, 0.4, d], [edge, 0.2, z + d / 2], 'plaster', color);
    this.surface(g, [w, 0.3, 0.14], [middle, 0.15, front - facing * d], 'plaster', color);
    for (let i = 0; i < 3; i++)
      this.surface(
        g,
        [0.65, 0.4 + i * 0.06, 0.55],
        [x + 0.8 + (i * (w - 1.6)) / 2, 0.28, front - facing * (d - 0.5)],
        'teak',
        ['#b79268', '#887d64', '#a48b68'][i],
      );
    this.surface(g, [w, 0.035, 0.8], [middle, 0.105, front + facing * 0.43], 'pavers', '#c4bbae');
    const upper = new T.Group();
    const importedStyle =
      g === this.chunks.get('sukhumvit')
        ? 'modern'
        : g === this.chunks.get('yaowarat')
          ? 'market'
          : undefined;
    g.add(upper);
    const fallback = new T.Group();
    fallback.userData.animated = !!importedStyle;
    upper.add(fallback);
    g = fallback;
    this.surface(g, [w, height, d], [x + w / 2, height / 2, z + d / 2], 'plaster', color);
    const trim = '#d3c4a5',
      iron = '#344d4b';
    this.box(g, [w + 0.24, 0.14, d + 0.2], [middle, height, z + d / 2], trim);
    for (const edge of [x + 0.12, x + w - 0.12])
      this.box(g, [0.24, height, 0.12], [edge, height / 2, front + facing * 0.065], trim);
    this.box(g, [w, 0.32, 0.18], [middle, height + 0.19, front], color);
    for (const edge of [x + 0.1, x + w - 0.1])
      this.box(g, [0.2, 0.32, d], [edge, height + 0.19, z + d / 2], color);
    if (style) {
      this.architecture.facade(g, style, middle, front, w, height, d, facing);
      this.architecture.rear(g, style, middle, front - facing * d, w, height, -facing);
    } else {
      // Recessed-looking glazing, timber mullions and outward-facing doors line the street.
      for (const side of [-1, 1]) {
        this.box(g, [1.22, 1.35, 0.08], [middle + side * 1.43, 1.2, front + facing * 0.06], '#294c50', 0.05);
        for (const edge of [-0.65, 0.65])
          this.box(g, [0.055, 1.46, 0.14], [middle + side * 1.43 + edge, 1.2, front + facing * 0.12], trim);
        for (const y of [0.48, 1.92])
          this.box(g, [1.35, 0.06, 0.14], [middle + side * 1.43, y, front + facing * 0.12], trim);
        this.box(g, [1.2, 0.035, 0.1], [middle + side * 1.43, 1.17, front + facing * 0.12], '#a4a792');
      }
      this.surface(g, [1.03, 1.92, 0.12], [middle, 1.02, front + facing * 0.09], 'teak', '#768475');
      this.box(g, [0.72, 1.25, 0.06], [middle, 1.2, front + facing * 0.18], '#24474c', 0.08);
      this.box(g, [0.04, 0.26, 0.07], [middle + 0.36, 0.97, front + facing * 0.23], '#d9b46b');
      const floors = Math.floor((height - 0.5) / 2.05);
      for (let floor = 1; floor < floors; floor++) {
        const y = 1.15 + floor * 2.05;
        this.box(g, [w, 0.085, 0.16], [middle, y - 0.78, front + facing * 0.07], trim);
        for (const col of [-1, 1]) {
          const wx = middle + col * w * 0.25;
          this.box(g, [1.12, 1.18, 0.08], [wx, y, front + facing * 0.06], '#42686b', 0.09);
          for (const edge of [-0.61, 0.61])
            this.box(g, [0.07, 1.32, 0.15], [wx + edge, y, front + facing * 0.12], trim);
          for (const wy of [y - 0.65, y + 0.65])
            this.box(g, [1.3, 0.07, 0.17], [wx, wy, front + facing * 0.13], trim);
          this.box(g, [0.045, 1.18, 0.12], [wx, y, front + facing * 0.14], '#c9b992');
          for (const side of [-1, 1]) {
            this.surface(
              g,
              [0.3, 1.25, 0.08],
              [wx + side * 0.84, y, front + facing * 0.06],
              'teak',
              '#58766b',
            );
            for (let slat = 0; slat < 7; slat++)
              this.box(
                g,
                [0.27, 0.033, 0.05],
                [wx + side * 0.84, y - 0.48 + slat * 0.16, front + facing * 0.13],
                '#a6b39a',
              );
          }
        }
        if (floor === 1) {
          this.box(g, [w - 0.5, 0.1, 0.66], [middle, y - 0.72, front + facing * 0.26], trim);
          this.box(g, [w - 0.5, 0.035, 0.035], [middle, y - 0.03, front + facing * 0.58], iron);
          for (let rail = 0; rail < 13; rail++)
            this.box(
              g,
              [0.026, 0.67, 0.026],
              [x + 0.25 + (rail * (w - 0.5)) / 12, y - 0.36, front + facing * 0.58],
              iron,
            );
          for (const side of [-1, 1]) {
            const px = middle + side * (w / 2 - 0.62);
            this.box(g, [0.62, 0.25, 0.27], [px, y - 0.54, front + facing * 0.35], '#996347');
            for (let leaf = 0; leaf < 3; leaf++)
              this.mesh(
                g,
                new T.IcosahedronGeometry(0.17, 0),
                [px - 0.18 + leaf * 0.18, y - 0.36, front + facing * 0.35],
                '#657e4d',
              );
          }
        }
      }
      // Thin awnings shelter the ground-floor shopfront without closing the sidewalk.
      this.box(
        g,
        [w + 0.12, 0.13, 0.85],
        [middle, 2.27, front + facing * 0.35],
        z < 12 ? '#807659' : '#815f4d',
      );
      for (let stripe = 0; stripe < 8; stripe++)
        this.box(
          g,
          [(w + 0.1) / 16, 0.015, 0.86],
          [x + (stripe * (w + 0.1)) / 8, 2.35, front + facing * 0.35],
          '#c8b990',
        );
      this.box(g, [w + 0.1, 0.16, 0.05], [middle, 2.2, front + facing * 0.78], '#b39774');
    }
    // Side-wall windows stop the neighbouring streets reading as blank building backs.
    for (const side of [-1, 1]) {
      const sideX = middle + side * (w / 2 + 0.045);
      for (let bay = 0; bay < Math.max(1, Math.floor(d / 2.8)); bay++) {
        const sideZ = z + 1.3 + bay * 2.8;
        for (let y = 1.3; y < height - 0.7; y += 2.05) {
          this.box(g, [0.08, 1.05, 0.85], [sideX, y, sideZ], '#35565b', 0.08);
          for (const edge of [-0.47, 0.47]) this.box(g, [0.12, 1.2, 0.055], [sideX, y, sideZ + edge], trim);
          for (const edge of [-0.59, 0.59]) this.box(g, [0.12, 0.055, 0.97], [sideX, y + edge, sideZ], trim);
        }
      }
    }
    if (importedStyle) this.batch(fallback);
    this.cutaway(upper);
    if (importedStyle)
      this.shophouses.add(upper, fallback, importedStyle, { x, z, w, d, height, facing }, () => {
        upper.updateWorldMatrix(true, true);
        this.cutaways.find((c) => c.object === upper)!.bounds.setFromObject(upper);
      });
    return upper;
  }
  private connections(g: T.Group) {
    cityBackdropBlocks.forEach((block, i) => {
      const upper = this.shop(
        g,
        block.x,
        block.z,
        block.w,
        block.d,
        ['#7c9389', '#b09a7b', '#8e7771', '#6c8389'][i % 4],
        block.height,
        block.z > 25 ? 1 : undefined,
        block.z >= 26 ? 'timber' : block.x < 0 ? 'modern' : 'market',
      );
      upper.name = 'Neighbourhood block';
      // Storage belongs on flat roofs; pitched roofs must not intersect it.
      if (block.z < 26) {
        this.mesh(
          upper,
          new T.CylinderGeometry(0.42, 0.42, 0.8, 12),
          [block.x + 1.3, block.height + 0.45, block.z + 1.1],
          '#a8b0a6',
        );
        this.box(
          upper,
          [1.3, 0.55, 0.85],
          [block.x + block.w - 1.6, block.height + 0.3, block.z + block.d - 1.2],
          '#65777a',
        );
      }
      // Recompute the cutaway bounds after the roof fittings are attached.
      upper.updateWorldMatrix(true, true);
      this.cutaways.find((c) => c.object === upper)!.bounds.setFromObject(upper);
    });
    for (const z of [10.5, 15.5]) this.surface(g, [54, 0.018, 1], [-5, 0.079, z], 'pavers', '#c0b393');
    this.surface(g, [85, 0.24, 0.45], [-3.5, 0.03, 41.22], 'plaster', '#bdaf91');
    this.box(g, [85, 0.07, 3.8], [-3.5, -0.015, 43.3], '#245c65', 0.07);
    this.surface(g, [85, 0.25, 0.5], [-3.5, 0.025, 45.4], 'plaster', '#8b9988');
    const rail = new T.Group();
    g.add(rail);
    for (let x = -45; x <= 39; x += 2) {
      this.box(rail, [0.06, 0.7, 0.06], [x, 0.48, 41.27], '#4b655f');
      this.box(rail, [1.98, 0.045, 0.055], [x - 1, 0.83, 41.27], '#c7b991');
      if ((x + 45) % 10 === 0) this.lamp(g, x, 41.5);
    }
    this.cutaway(rail);
    // An opposite-bank garden gives the path a visible edge and a quieter water view.
    for (const x of [-42, -32, -22, -12, -2, 8, 18, 28, 38]) this.tree(g, x, 47.3, 0.85);
  }
  private sukhumvit() {
    const g = this.chunks.get('sukhumvit')!;
    const buildings = cityObstacles.filter((r) => r.kind === 'building' && r.x < -30 && r.z < 24);
    buildings.forEach((r, i) =>
      this.shop(
        g,
        r.x,
        r.z,
        r.w,
        r.d,
        ['#8c9894', '#5a737a', '#b19a7d'][i % 3],
        7 + (i % 3) * 2,
        undefined,
        'modern',
      ),
    );
    const railway = new T.Group();
    railway.name = 'guideway-fallback';
    railway.userData.animated = true;
    g.add(railway);
    for (let x = -60; x <= -32; x += 7) this.box(railway, [0.5, 4.3, 0.8], [x, 2.1, 9.3], '#687a80');
    this.box(railway, [30, 0.35, 2.7], [-46, 4.3, 9.3], '#8c9c9d');
    this.box(railway, [30, 0.1, 0.12], [-46, 4.6, 8.6], '#364955');
    this.box(railway, [30, 0.1, 0.12], [-46, 4.6, 10], '#364955');
    this.batch(railway);
    for (const x of [-56, -47, -34]) {
      this.lamp(g, x, 15.9);
      this.tree(g, x, 18, 0.65);
    }
  }
  private park() {
    const g = this.chunks.get('lumphini')!;
    const pond = cityObstacles.find((o) => o.kind === 'pond')!;
    this.box(g, [pond.w, 0.1, pond.d], [pond.x + pond.w / 2, 0.11, pond.z + pond.d / 2], '#2d6971', 0.1);
    this.garden.lakeside(g);
    // Low paths follow the existing walkable lake edge and connect the sala to the road.
    this.surface(g, [12, 0.025, 1.5], [-23, 0.095, 28], 'pavers', '#c5bea3');
    this.surface(g, [1.5, 0.025, 8.2], [-17, 0.095, 30.85], 'pavers', '#c5bea3');
    this.surface(g, [1.5, 0.025, 6.5], [-20, 0.095, 24], 'pavers', '#c5bea3');
    for (const [x, z] of [
      [-29, 22],
      [-29, 35],
      [-16, 35],
      [-12, 23],
      [-12, 33],
      [-25, 35],
    ])
      this.tree(g, x, z, 1.2);
    const fallback = new T.Group();
    fallback.name = 'lumphini-pavilion-fallback';
    fallback.userData.animated = true;
    g.add(fallback);
    for (const x of [-26, -23])
      for (const z of [24, 26])
        this.mesh(fallback, new T.CylinderGeometry(0.09, 0.13, 2.4, 7), [x, 1.2, z], '#9a7e58');
    const roof = this.mesh(fallback, new T.ConeGeometry(2.5, 1.2, 4), [-24.5, 2.9, 25], '#506a5c');
    roof.rotation.y = Math.PI / 4;
    this.cutaway(roof);
    this.surface(fallback, [3, 0.16, 2.4], [-24.5, 0.18, 25], 'teak', '#c7b797');
    this.lamp(g, -18, 25);
    this.lamp(g, -13, 29);
  }
  private yaowarat() {
    const g = this.chunks.get('yaowarat')!;
    const blocks = cityObstacles.filter((r) => r.kind === 'building' && r.z <= 21 && r.x > 20);
    blocks.forEach((r, i) => {
      const shop = this.shop(
        g,
        r.x,
        r.z,
        r.w,
        r.d,
        ['#835447', '#596b62', '#987647', '#666077'][i % 4],
        5 + (i % 3),
        undefined,
        'market',
      );
      this.sign(
        shop,
        i % 2 ? 'ทอง' : '金行',
        [r.x + 2.5, 2.55, r.z < 12 ? r.z + r.d + 0.41 : r.z - 0.41],
        i % 2 ? '#ffe196' : '#f4a380',
        1.7,
        false,
        r.z < 12 ? 1 : -1,
      );
      const facing = r.z < 12 ? 1 : -1;
      const front = facing > 0 ? r.z + r.d : r.z;
      this.sign(
        shop,
        '金行',
        [r.x + r.w / 2 + facing * (r.w / 2 - 0.35), Math.min(4.2 + (i % 3), 4.5), front + facing * 0.99],
        '#ffe5a2',
        0.36,
        true,
        facing,
      );
    });
    const fallback = new T.Group();
    fallback.name = 'lek-food-stall-fallback';
    fallback.userData.animated = true;
    g.add(fallback);
    this.surface(
      fallback,
      [foodStallCounter.w - 0.1, 1, 0.94],
      [foodStallCounter.x + foodStallCounter.w / 2, 0.6, foodStallOrigin.z],
      'teak',
      '#b4a690',
    );
    this.cutaway(this.box(fallback, [4.1, 0.2, 1.3], [35, 2.6, foodStallOrigin.z - 0.22], '#a1493c'));
    for (const x of [32.95, 35.82])
      this.box(fallback, [0.06, 2.4, 0.06], [x, 1.2, foodStallOrigin.z], '#b39265');
    this.mesh(
      fallback,
      new T.CylinderGeometry(0.27, 0.25, 0.37, 16),
      [33.48, 1.3, foodStallOrigin.z - 0.09],
      '#a3b4ae',
    );
    for (const x of [23, 48]) this.lamp(g, x, 15.8);
  }
  private oldtown() {
    const g = this.chunks.get('oldtown')!;
    for (const wall of oldTownWalls) {
      const x = wall.x + wall.w / 2,
        z = wall.z + wall.d / 2;
      this.surface(g, [wall.w, 0.72, wall.d], [x, 0.44, z], 'plaster', '#e2d7bd');
      this.box(g, [wall.w, 0.09, wall.d], [x, 0.84, z], '#bfab80');
      const horizontal = wall.w > wall.d,
        length = horizontal ? wall.w : wall.d;
      for (let n = 0.3; n < length - 0.25; n += 2.5) {
        this.box(
          g,
          [0.45, 1.02, 0.45],
          [horizontal ? wall.x + n : x, 0.57, horizontal ? z : wall.z + n],
          '#e4d6b7',
        );
      }
    }
    // Gate posts stay inside the wall footprints; the five-metre opening remains clear.
    const gate = new T.Group();
    g.add(gate);
    for (const x of [34.25, 39.75]) {
      this.surface(gate, [0.48, 2.6, 0.48], [x, 1.38, 39.75], 'plaster', '#e6d7b6');
      this.box(gate, [0.48, 0.12, 0.48], [x, 2.68, 39.75], '#c0a167');
    }
    for (const side of [-1, 1]) {
      const run = 3.25,
        rise = 0.75;
      const roof = this.box(
        gate,
        [Math.hypot(run, rise), 0.13, 1.25],
        [37 + (side * run) / 2, 2.92, 39.75],
        '#496f5d',
      );
      roof.rotation.z = -side * Math.atan2(rise, run);
      for (const end of [-1, 1]) {
        const trim = this.box(
          gate,
          [Math.hypot(run, rise) + 0.08, 0.07, 0.06],
          [37 + (side * run) / 2, 3, 39.75 + end * 0.64],
          '#d3b572',
        );
        trim.rotation.z = roof.rotation.z;
      }
    }
    this.box(gate, [0.1, 0.14, 1.42], [37, 3.34, 39.75], '#dfc18a');
    this.cutaway(gate);
    this.surface(g, [4.5, 0.022, 3], [37, 0.1, 39.5], 'pavers', '#d6c39d');
    for (const x of [35.2, 38.8]) this.box(g, [0.035, 0.012, 2.9], [x, 0.117, 39.5], '#d0b479');
    // Rounded planted beds soften the outside edge without covering a walking route or the canal.
    for (const [x, z, scale] of [
      [51.8, 27, 0.8],
      [51.8, 34, 1],
      [51.8, 41, 0.8],
      [43, 43.3, 0.9],
      [47.5, 45, 0.75],
    ]) {
      const bed = this.mesh(g, new T.CircleGeometry(1, 32), [x, 0.095, z], '#596e50');
      bed.rotation.x = -Math.PI / 2;
      bed.scale.set(2.7, 2.1, 1);
      this.tree(g, x, z, scale);
      for (let i = 0; i < 9; i++) {
        const a = i * 2.4;
        const px = x + Math.cos(a) * (1.4 + (i % 2) * 0.4),
          pz = z + Math.sin(a) * 1.2;
        this.mesh(
          g,
          new T.IcosahedronGeometry(0.28 + (i % 3) * 0.06, 1),
          [px, 0.28, pz],
          i % 2 ? '#7f9259' : '#476d52',
        );
        if (i % 3 === 0) this.mesh(g, new T.SphereGeometry(0.1, 7, 5), [px, 0.58, pz], '#e6c490');
      }
    }
    const fallback = new T.Group();
    fallback.name = 'oldtown-hall-fallback';
    fallback.userData.animated = true;
    g.add(fallback);
    this.cutaway(this.box(fallback, [8, 2.8, 5], [43, 1.5, 35.5], '#d7c5a1'));
    this.cutaway(this.architecture.pavilionRoof(fallback, 43, 2.8, 35.5));
    this.mesh(fallback, new T.ConeGeometry(0.22, 2, 6), [43, 5.3, 35.5], '#e2bc64', 0.3);
    for (const x of [25.5, 31, 36.5]) {
      this.lamp(g, x, 37);
    }
    this.surface(g, [2.8, 0.85, 1.2], [29, 0.5, 30.3], 'teak', '#b4a690');
  }
  update(p: CityPoint, visible: boolean) {
    for (const [id, g] of this.chunks) {
      const area = cityAreas.find((a) => a.id === id);
      g.visible =
        visible && (id === 'roads' || (!!area && Math.hypot(p.x - area.center.x, p.z - area.center.z) < 42));
    }
  }
  revealParty(camera: T.Vector3, focalPoints: { x: number; y: number; z: number }[]) {
    for (const { object, bounds } of this.cutaways)
      object.visible = !focalPoints.some((point) => blocksCityView(bounds, camera, point));
    for (const { group, support } of this.wayfinding.signs)
      if (support && !support.visible) group.visible = false;
    this.landmarks.syncVisibility();
    this.archive.reveal(focalPoints);
    this.life.clipCookingSteam(this.foodStall.cookingVisible);
  }
  dispose() {
    this.canalHouses.dispose();
    this.railway.dispose();
    this.hotelFurnishings.dispose();
    this.foodStall.dispose();
    this.evening.dispose();
    this.shophouses.dispose();
    this.landmarks.dispose();
    this.archive.dispose();
    this.wayfinding.dispose();
    this.groundLight.dispose();
    this.surfaces.dispose();
    this.props.dispose();
    this.textures.forEach((t) => t.dispose());
  }
}
