import { findPath, followPath, type Point, type ActorId } from './adventure.ts';
import type { CityArea } from './city.ts';

export type ResidentRoute = {
  id: string;
  area: CityArea;
  appearance: ActorId;
  speed: number;
  stops: Point[];
};
export const residentRoutes: ResidentRoute[] = [
  {
    id: 'morning-commuter',
    area: 'sukhumvit',
    appearance: 'station',
    speed: 1.05,
    stops: [
      { x: -53, z: 14.5 },
      { x: -45, z: 14.5 },
      { x: -45, z: 11 },
      { x: -53, z: 11 },
    ],
  },
  {
    id: 'soi-shopper',
    area: 'sukhumvit',
    appearance: 'innkeeper',
    speed: 0.78,
    stops: [
      { x: -34, z: 11 },
      { x: -34, z: 17 },
      { x: -37, z: 17 },
      { x: -37, z: 11 },
    ],
  },
  {
    id: 'gold-shop-visitor',
    area: 'yaowarat',
    appearance: 'innkeeper',
    speed: 0.72,
    stops: [
      { x: 25, z: 11 },
      { x: 31, z: 11 },
      { x: 31, z: 14 },
      { x: 25, z: 14 },
    ],
  },
  {
    id: 'evening-shopper',
    area: 'yaowarat',
    appearance: 'artisan',
    speed: 0.85,
    stops: [
      { x: 41, z: 11 },
      { x: 47, z: 11 },
      { x: 47, z: 16 },
      { x: 41, z: 16 },
    ],
  },
  {
    id: 'lakeside-walker',
    area: 'lumphini',
    appearance: 'gardener',
    speed: 0.7,
    stops: [
      { x: -15, z: 23 },
      { x: -13.5, z: 23 },
      { x: -13.5, z: 30 },
      { x: -16, z: 30 },
    ],
  },
  {
    id: 'court-visitor',
    area: 'oldtown',
    appearance: 'station',
    speed: 0.74,
    stops: [
      { x: 32, z: 27 },
      { x: 37, z: 27 },
      { x: 37, z: 31 },
      { x: 32, z: 31 },
    ],
  },
];

/** Scenic residents have no save or quest authority. They yield; they never block the party. */
export class ResidentWalk {
  position: Point;
  facing = 0;
  moving = false;
  private next = 1;
  private path: Point[] = [];
  private rest = 1;
  private route: ResidentRoute;
  constructor(route: ResidentRoute) {
    this.route = route;
    this.position = { ...route.stops[0] };
  }
  update(seconds: number, paused: boolean, party: Point[]) {
    this.moving = false;
    if (paused) return;
    const dt = Number.isFinite(seconds) ? Math.max(0, Math.min(0.1, seconds)) : 0;
    if (this.rest > 0) {
      this.rest = Math.max(0, this.rest - dt);
      return;
    }
    if (!this.path.length) this.path = findPath(this.position, this.route.stops[this.next]);
    if (!this.path.length) return;
    const candidatePath = [...this.path];
    const next = followPath(this.position, candidatePath, this.route.speed * dt);
    if (party.some((p) => Math.hypot(p.x - next.x, p.z - next.z) < 1.25)) return;
    const dx = next.x - this.position.x,
      dz = next.z - this.position.z;
    this.moving = Math.hypot(dx, dz) > 0.00001;
    if (this.moving) this.facing = Math.atan2(dx, dz);
    this.position = next;
    this.path = candidatePath;
    if (!this.path.length) {
      this.next = (this.next + 1) % this.route.stops.length;
      this.rest = 2.5;
    }
  }
}
