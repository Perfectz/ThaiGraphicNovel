import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { disposeWorldObject } from './worldResources.ts';

export const hotelFurnishingOrigin = { x: -54, z: 29.5 };
/** One original Blender collection, retaining the existing room's navigation footprint. */
export class HotelFurnishings {
  state: 'loading' | 'ready' | 'fallback' = 'loading';
  private disposed = false;
  private parts: T.Object3D[] = [];
  private hotel: T.Group;
  private fallback: T.Group;
  constructor(hotel: T.Group, fallback: T.Group, batch: (root: T.Object3D) => void) {
    this.hotel = hotel;
    this.fallback = fallback;
    const wallFallback = hotel.getObjectByName('hotel-wall-art-fallback');
    if (wallFallback) batch(wallFallback);
    void new GLTFLoader()
      .loadAsync('/bangkok/models/hotel-furnishings.glb')
      .then(({ scene }) => {
        if (this.disposed) {
          disposeWorldObject(scene);
          return;
        }
        const parts = ['GuestBed', 'LobbySofa', 'Reception', 'ReceptionObjects', 'BedroomWallCraft'].map(
          (name) => scene.getObjectByName(name),
        );
        if (parts.some((part) => !part)) {
          disposeWorldObject(scene);
          this.state = 'fallback';
          return;
        }
        scene.position.set(hotelFurnishingOrigin.x, 0, hotelFurnishingOrigin.z);
        scene.userData.animated = true;
        scene.traverse((o) => {
          if (o instanceof T.Mesh) o.castShadow = o.receiveShadow = true;
        });
        for (const part of parts) batch(part!);
        this.hotel.add(scene);
        this.parts = parts as T.Object3D[];
        this.fallback.visible = false;
        const wallFallback = this.hotel.getObjectByName('hotel-wall-art-fallback');
        if (wallFallback) wallFallback.visible = false;
        this.state = 'ready';
      })
      .catch(() => {
        if (!this.disposed) this.state = 'fallback';
      });
  }
  snapshot() {
    const wallFallback = this.hotel.getObjectByName('hotel-wall-art-fallback');
    let wallFallbackMeshes = 0;
    wallFallback?.traverse((o) => {
      if (o instanceof T.Mesh) wallFallbackMeshes++;
    });
    return {
      state: this.state,
      fallback: this.fallback.visible,
      wallFallback: wallFallback?.visible ?? false,
      wallFallbackMeshes,
      visible: this.hotel.visible,
      parts: this.parts.map((part) => {
        const bounds = new T.Box3().setFromObject(part);
        return { name: part.name, min: bounds.min, max: bounds.max };
      }),
    };
  }
  // Attached resources belong to world teardown; late downloads release themselves.
  dispose() {
    this.disposed = true;
  }
}
