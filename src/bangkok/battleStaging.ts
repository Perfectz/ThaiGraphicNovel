import type { Battle } from './expeditionCombat.ts';

export type BattlePoint = { x: number; y: number; z: number };
export type BattleSite = {
  id: 'lumphini' | 'oldtown' | 'crossroads' | 'practice';
  name: string;
  origin: BattlePoint;
  yaw: number;
};

// Story formations stand on the same district ground that the player explores.
// Their origins are presentation only: entering combat never moves the saved traveller.
const sites: Record<Battle['id'] | 'practice', BattleSite> = {
  murmur: {
    id: 'lumphini',
    name: 'Lumphini · Lakeside path',
    origin: { x: -15.5, y: 0.12, z: 27.5 },
    yaw: Math.PI / 2,
  },
  keeper: {
    id: 'oldtown',
    name: 'Old Town · Lantern court',
    origin: { x: 35.4, y: 0.12, z: 30.3 },
    yaw: -Math.PI / 2,
  },
  sentinel: { id: 'crossroads', name: 'Crossroads · Waystone', origin: { x: 16, y: 0.12, z: 12.4 }, yaw: 0 },
  practice: { id: 'practice', name: 'Practice · River arena', origin: { x: 0, y: 0.1, z: 29 }, yaw: 0 },
};
export function battleSite(battle: Pick<Battle, 'id' | 'practice'>): BattleSite {
  return sites[battle.practice ? 'practice' : battle.id];
}
export function battleMark(battle: Pick<Battle, 'id' | 'practice'>, id: string): BattlePoint {
  return id === 'patrick'
    ? { x: -3.5, y: 1.3, z: 1.8 }
    : id === 'su'
      ? { x: -3, y: 1.3, z: -1.6 }
      : id === 'echo'
        ? { x: 0.1, y: 1.8, z: !battle.practice && battle.id === 'sentinel' ? -2.1 : -3.1 }
        : { x: 2.6, y: 2, z: 0.6 };
}
export function battleWorldPoint(site: BattleSite, point: BattlePoint): BattlePoint {
  const c = Math.cos(site.yaw),
    s = Math.sin(site.yaw);
  return {
    x: site.origin.x + point.x * c + point.z * s,
    y: site.origin.y + point.y,
    z: site.origin.z - point.x * s + point.z * c,
  };
}
export function battleCamera(site: BattleSite, narrow: boolean) {
  return {
    position: battleWorldPoint(site, { x: narrow ? -10 : -8, y: narrow ? 8 : 5.4, z: narrow ? 20 : 13.8 }),
    look: battleWorldPoint(site, { x: narrow ? -0.4 : 0.8, y: 1, z: -0.3 }),
  };
}
