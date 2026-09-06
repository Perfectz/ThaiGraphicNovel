import { archiveFloors, archiveWalls, archiveFurniture } from './archiveLayout.ts';
export type CityArea = 'hotel' | 'sukhumvit' | 'lumphini' | 'yaowarat' | 'riverside' | 'oldtown' | 'archive';
export type CityPoint = { x: number; z: number };
export type Rect = { x: number; z: number; w: number; d: number };
export const hotelStart = { x: -57, z: 29 };
export const cityMapBounds = { x: -65, z: -8, w: 163, d: 50 };
// Inset from the timber deck edges; the river itself is never walkable.
export const riverPier: Rect = { x: -0.3, z: -11.45, w: 2.6, d: 5.45 };
export const cityAreas: {
  id: CityArea;
  name: string;
  thai: string;
  theme: string;
  center: CityPoint;
  bounds: Rect;
  color: string;
  hint: string;
}[] = [
  {
    id: 'hotel',
    name: 'Sukhumvit Hotel',
    thai: 'โรงแรม',
    theme: 'Your room · reception · a place to return to',
    center: { x: -54, z: 28 },
    bounds: { x: -62, z: 23, w: 18, d: 13 },
    color: '#d8bd81',
    hint: 'Check in with Mali. Explore the room and the old luggage chest.',
  },
  {
    id: 'sukhumvit',
    name: 'Sukhumvit',
    thai: 'สุขุมวิท',
    theme: 'Skytrain viaducts · busy sois · modern shopfronts',
    center: { x: -40, z: 14 },
    bounds: { x: -60, z: 6, w: 28, d: 18 },
    color: '#91c8df',
    hint: 'Find Dao by the elevated train. Learn to ask for directions and unlock return journeys.',
  },
  {
    id: 'lumphini',
    name: 'Lumphini Park',
    thai: 'สวนลุมพินี',
    theme: 'Lakeside paths · shade trees · a quiet sala',
    center: { x: -21, z: 27 },
    bounds: { x: -30, z: 20, w: 20, d: 16 },
    color: '#a4c395',
    hint: 'Meet Pim near the pavilion. The missing lantern spark drifts beside the lake.',
  },
  {
    id: 'yaowarat',
    name: 'Yaowarat',
    thai: 'เยาวราช',
    theme: 'Red lanterns · gold shops · street-food stalls',
    center: { x: 35, z: 14 },
    bounds: { x: 22, z: 5, w: 28, d: 16 },
    color: '#ed9b7e',
    hint: 'Find Uncle Lek under the red lanterns and put together the ferryman’s supper.',
  },
  {
    id: 'riverside',
    name: 'Chao Phraya Riverside',
    thai: 'แม่น้ำเจ้าพระยา',
    theme: 'Timber pier · riverboats · distant temple silhouettes',
    center: { x: 1, z: 4 },
    bounds: { x: -11, z: -6.5, w: 22, d: 12.5 },
    color: '#8fc9bd',
    hint: 'Niran waits at the pier. Bring supper, then help restore the ferry’s lantern.',
  },
  {
    id: 'oldtown',
    name: 'Old Town Lantern Court',
    thai: 'พระนคร',
    theme: 'Temple roofs · white walls · artisans’ courtyards',
    center: { x: 37, z: 30 },
    bounds: { x: 24, z: 24, w: 25, d: 16 },
    color: '#ccb7df',
    hint: 'Meet Arun at his workshop. The lost river lantern waits in the ceremonial court.',
  },
  {
    id: 'archive',
    name: 'Old Town Archive',
    thai: 'พระนคร',
    theme: 'Teak galleries · family histories · a lost river route',
    center: { x: 56, z: 32 },
    bounds: { x: 49, z: 13, w: 41, d: 24 },
    color: '#bdc9b2',
    hint: 'Beyond the east gate, Kanya keeps the neighbourhood’s stories. Explore the galleries to recover a forgotten ferry ledger.',
  },
];
export const cityWalkways: Rect[] = [
  { x: -46, z: 37, w: 85, d: 4 },
  { x: -46, z: 34, w: 4, d: 7 },
  { x: -22, z: 34, w: 4, d: 6 },
  { x: -11, z: 14, w: 4, d: 26 },
];
export const canalWalk = { x: -9, z: 39 };
// These lots occupy the inaccessible gaps, leaving all district and route footprints clear.
export const cityBackdropBlocks = [
  { x: -42, z: 26, w: 10, d: 8, height: 6 },
  { x: -29, z: 3, w: 7, d: 6, height: 5 },
  { x: -20, z: 3, w: 7, d: 6, height: 7 },
  { x: 12, z: 3, w: 8, d: 6, height: 6 },
  { x: -6, z: 19, w: 7, d: 12, height: 7 },
  { x: 3, z: 19, w: 7, d: 12, height: 5 },
  { x: 12, z: 19, w: 9, d: 12, height: 8 },
  { x: -6, z: 32, w: 7, d: 4, height: 4 },
  { x: 3, z: 32, w: 7, d: 4, height: 6 },
  { x: 12, z: 32, w: 9, d: 4, height: 4 },
];
export const cityRoads: Rect[] = [
  { x: -51, z: 10, w: 98, d: 6 },
  { x: -23, z: 14, w: 6, d: 9 },
  { x: 33, z: 18, w: 6, d: 9 },
  { x: -4, z: 5, w: 8, d: 8 },
  ...cityWalkways,
];
// Two entrances join the canal: the open southwest corner and the southern lantern gate.
export const oldTownWalls: Rect[] = [
  { x: 24, z: 24.5, w: 0.5, d: 11 },
  { x: 24, z: 39.5, w: 10.5, d: 0.5 },
  { x: 39.5, z: 39.5, w: 9.5, d: 0.5 },
  { x: 48.5, z: 24.5, w: 0.5, d: 5.5 },
  { x: 48.5, z: 34, w: 0.5, d: 5.5 },
];
// Geometry and navigation share footprints. Buildings cannot be walked through.
export const parkServingTable: Rect = { x: -24.6, z: 23.9, w: 1.2, d: 0.5 };
export const foodStallOrigin = { x: 35, z: 17.45 };
export const foodStallCounter: Rect = {
  x: foodStallOrigin.x - 2.3,
  z: foodStallOrigin.z - 0.5,
  w: 3.3,
  d: 1,
};
export const cityObstacles: (Rect & { kind: 'building' | 'wall' | 'bed' | 'desk' | 'pond' | 'seat' })[] = [
  { ...parkServingTable, kind: 'desk' },
  { ...foodStallCounter, kind: 'desk' },
  { x: -60, z: 31, w: 4, d: 3, kind: 'bed' },
  { x: -60.85, z: 32.45, w: 0.7, d: 0.7, kind: 'desk' },
  { x: -52, z: 24, w: 6, d: 1.1, kind: 'desk' },
  { x: -54.1, z: 30, w: 0.2, d: 6, kind: 'wall' },
  { x: -62, z: 22.9, w: 16, d: 0.2, kind: 'wall' },
  { x: -52, z: 31, w: 3, d: 2, kind: 'seat' },
  ...[-59, -52, -43, -36].map((x) => ({ x, z: 6, w: 5, d: 3, kind: 'building' as const })),
  ...[-59, -39].map((x) => ({ x, z: 20, w: 6, d: 3, kind: 'building' as const })),
  ...[23, 30, 37, 44].flatMap((x) => [
    { x, z: 5, w: 5, d: 4, kind: 'building' as const },
    { x, z: 18, w: 5, d: 3, kind: 'building' as const },
  ]),
  { x: -28, z: 29, w: 10, d: 5, kind: 'pond' },
  { x: 39, z: 33, w: 8, d: 5, kind: 'building' },
  { x: 27.6, z: 29.7, w: 2.8, d: 1.2, kind: 'desk' },
  ...oldTownWalls.map((r) => ({ ...r, kind: 'wall' as const })),
  ...archiveWalls.map((r) => ({ ...r, kind: 'wall' as const })),
  ...archiveFurniture.map((r) => ({ ...r, kind: 'desk' as const })),
];
export function inside(p: CityPoint, r: Rect) {
  return p.x >= r.x && p.x <= r.x + r.w && p.z >= r.z && p.z <= r.z + r.d;
}
export function cityAreaAt(p: CityPoint): CityArea | null {
  if (inside(p, riverPier)) return 'riverside';
  return cityAreas.find((a) => inside(p, a.bounds))?.id ?? null;
}
export function cityWalkable(p: CityPoint): boolean {
  if (inside(p, riverPier)) return true;
  return (
    [
      ...cityAreas.filter((a) => a.id !== 'riverside' && a.id !== 'archive').map((a) => a.bounds),
      ...cityRoads,
      ...archiveFloors,
    ].some((r) => inside(p, r)) && !cityObstacles.some((r) => inside(p, r))
  );
}

/** Keep older saves local when newly solid architecture or furniture occupies their position. */
export function recoverCityPosition(p: CityPoint): CityPoint | null {
  if (
    ![p.x, p.z].every(Number.isFinite) ||
    ![...oldTownWalls, parkServingTable, foodStallCounter].some((r) => inside(p, r))
  )
    return null;
  const candidates: CityPoint[] = [];
  const x = Math.round(p.x * 2) / 2,
    z = Math.round(p.z * 2) / 2;
  for (let dx = -2; dx <= 2; dx += 0.5)
    for (let dz = -2; dz <= 2; dz += 0.5) {
      const candidate = { x: x + dx, z: z + dz };
      if (cityWalkable(candidate)) candidates.push(candidate);
    }
  return (
    candidates.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0] ?? null
  );
}
export const recoverOldTownPosition = recoverCityPosition;
