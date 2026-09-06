import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { LanternTrade } from './lanternTrade';
import { disposeWorldObject } from './worldResources.ts';

export class TravelLantern {
  private stock = new T.Group();
  private carried = new T.Group();
  private light = new T.PointLight('#ffd08a', 1.8, 4, 2);
  private variants = new Map<string, { stock: T.Group; carried: T.Group; fallback: T.Group[] }>();
  private disposed = false;
  private owned: LanternTrade['owned'] = null;
  private handPosition = new T.Vector3();
  state: 'loading' | 'ready' | 'fallback' = 'loading';
  constructor(scene: T.Scene, workshop: T.Group, batch: (root: T.Object3D) => void) {
    workshop.add(this.stock);
    scene.add(this.carried);
    this.carried.visible = false;
    this.carried.scale.setScalar(0.6);
    this.light.position.y = 0.25;
    this.carried.add(this.light);
    for (const [name, x] of [
      ['Carved', 28.4],
      ['Paper', 29.6],
    ] as const) {
      const stock = new T.Group(),
        carried = new T.Group();
      stock.position.set(x, 0.94, 30.3);
      this.stock.add(stock);
      this.carried.add(carried);
      const fallback = [stock, carried].map((parent) => {
        const g = new T.Group();
        parent.add(g);
        const glow = new T.Mesh(
          new T.BoxGeometry(0.26, 0.4, 0.26),
          new T.MeshStandardMaterial({ color: '#ffd38c', emissive: '#ffab44', emissiveIntensity: 0.6 }),
        );
        glow.position.y = 0.25;
        g.add(glow);
        const mat = new T.MeshStandardMaterial({ color: name === 'Carved' ? '#70482b' : '#ba965e' });
        for (const y of [0.035, 0.47]) {
          const cap = new T.Mesh(new T.BoxGeometry(0.34, 0.055, 0.34), mat);
          cap.position.y = y;
          g.add(cap);
        }
        const ring = new T.Mesh(new T.TorusGeometry(0.12, 0.012, 6, 16, Math.PI), mat);
        ring.position.y = 0.6;
        g.add(ring);
        batch(g);
        return g;
      });
      this.variants.set(name, { stock, carried, fallback });
    }
    void new GLTFLoader()
      .loadAsync('/bangkok/models/travel-lanterns.glb')
      .then(({ scene: model }) => {
        if (this.disposed) {
          disposeWorldObject(model);
          return;
        }
        const parts = ['Carved', 'Paper'].map((name) => model.getObjectByName(name));
        if (parts.some((p) => !p)) {
          disposeWorldObject(model);
          this.state = 'fallback';
          return;
        }
        parts.forEach((part, i) => {
          part!.traverse((o) => {
            if (o instanceof T.Mesh) o.castShadow = o.receiveShadow = true;
          });
          batch(part!);
          const slot = this.variants.get(i === 0 ? 'Carved' : 'Paper')!;
          slot.stock.add(part!.clone(true));
          slot.carried.add(part!);
          slot.fallback.forEach((f) => {
            f.visible = false;
          });
        });
        this.state = 'ready';
      })
      .catch(() => {
        if (!this.disposed) this.state = 'fallback';
      });
  }
  update(trade: LanternTrade, companion: T.Object3D | undefined, visible: boolean) {
    this.owned = trade.owned;
    this.carried.visible = !!trade.owned && !!companion && visible;
    for (const [name, slot] of this.variants) {
      const selected = (trade.owned === 'paper' ? 'Paper' : 'Carved') === name;
      slot.carried.visible = selected;
      slot.stock.visible = !trade.owned || !selected;
    }
    if (!this.carried.visible || !companion) return;
    const hand = companion.getObjectByName('RightHand') ?? companion;
    hand.getWorldPosition(this.handPosition);
    this.carried.position.copy(this.handPosition);
    this.carried.position.y = Math.max(0.14, this.carried.position.y - 0.73 * 0.6);
    this.carried.rotation.y = companion.rotation.y;
  }
  snapshot() {
    return {
      state: this.state,
      owned: this.owned,
      visible: this.carried.visible,
      position: this.carried.position.toArray(),
      hand: this.handPosition.toArray(),
      stock: [...this.variants].filter(([, slot]) => slot.stock.visible).map(([name]) => name),
    };
  }
  dispose() {
    this.disposed = true;
  }
}
