import * as T from 'three';
import { residentRoutes, ResidentWalk } from './cityResidentRoutes';
import type { CityPeople } from './CityPeople';
import type { Point } from './adventure';

export class CityResidents {
  private residents: { group: T.Group; walk: ResidentWalk }[] = [];
  constructor(scene: T.Scene, people: CityPeople) {
    for (const [index, route] of residentRoutes.entries()) {
      const group = new T.Group();
      group.name = route.id;
      group.userData.ambientResident = true;
      group.visible = false;
      const walk = new ResidentWalk(route);
      group.position.set(walk.position.x, 0.15, walk.position.z);
      const fallback = new T.Group();
      group.add(fallback);
      scene.add(group);
      void people.load(route.appearance, group, fallback, {
        ambient: true,
        height: 1.57 + (index % 3) * 0.09,
      });
      this.residents.push({ group, walk });
    }
  }
  update(
    dt: number,
    player: Point,
    party: Point[],
    active: boolean,
    paused: boolean,
    reducedMotion: boolean,
  ) {
    for (const { group, walk } of this.residents) {
      group.visible =
        active &&
        !!group.userData.appearanceReady &&
        Math.hypot(player.x - walk.position.x, player.z - walk.position.z) < 21;
      walk.update(dt, !group.visible || paused || reducedMotion, party);
      group.position.set(walk.position.x, 0.15, walk.position.z);
      group.userData.walking = walk.moving;
      group.userData.walkFacing = walk.facing;
    }
  }
  snapshot() {
    return this.residents.map(({ group, walk }) => ({
      id: group.name,
      ready: !!group.userData.appearanceReady,
      visible: group.visible,
      x: walk.position.x,
      z: walk.position.z,
      moving: walk.moving,
      animationTime: group.userData.walkAnimationTime ?? 0,
    }));
  }
}
