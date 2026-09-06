import {
  cityAreas,
  cityAreaAt,
  cityWalkable,
  cityObstacles,
  inside,
  hotelStart,
  recoverCityPosition,
  type CityArea,
} from './city.ts';
import { battleSpoils, createBattle, restoreBattle, type Battle } from './expeditionCombat.ts';
import { partyGrowth, talentReason, type TalentId } from './partyGrowth.ts';
import { discoveries, discoveryFor, hasRiverCharm, type DiscoveryId } from './discoveries.ts';
import { canalFlags } from './canalErrand.ts';
import { eveningFlags, normalizeEveningFlags } from './eveningOuting.ts';
import { reunionFlags, normalizeReunionFlags } from './reunion.ts';
import { freshLanternTrade, normalizeLanternTrade, type LanternTrade } from './lanternTrade.ts';
import { freshEscort, normalizeEscort, type EscortSave } from './stationEscort.ts';
import { questIds, trackedQuest, type QuestId } from './questJournal.ts';
import {
  freshJourneys,
  normalizeJourneys,
  cityJourneys,
  journeyHosts,
  journeyPhrase,
  advanceJourney,
  type JourneyResult,
  type JourneySave,
} from './cityJourneys.ts';
export type { Battle } from './expeditionCombat.ts';
export type Point = { x: number; z: number };
export type ActorId =
  | DiscoveryId
  | 'su'
  | 'innkeeper'
  | 'cook'
  | 'chest'
  | 'ferry'
  | 'wisp'
  | 'shrine'
  | 'station'
  | 'gardener'
  | 'artisan'
  | 'waystone'
  | 'canal-lantern'
  | 'traveler';
export const actors: { id: ActorId; name: string; x: number; z: number; color: string }[] = [
  { id: 'su', name: 'Su · your companion', x: -55, z: 28.5, color: '#8fddd0' },
  { id: 'innkeeper', name: 'Mali · innkeeper', x: -49, z: 26.5, color: '#f4d18c' },
  { id: 'cook', name: 'Uncle Lek · noodle seller', x: 35, z: 16.5, color: '#f3a48c' },
  { id: 'chest', name: 'Old travel chest', x: -60, z: 27.5, color: '#edcf82' },
  { id: 'ferry', name: 'Niran · ferryman', x: 1, z: -5.5, color: '#b0c9f0' },
  { id: 'wisp', name: 'Murmur wisp', x: -16, z: 30, color: '#bca6ef' },
  { id: 'shrine', name: 'The river lantern', x: 37, z: 31, color: '#f5d48e' },
  { id: 'waystone', name: 'Crossroads waystone', x: 16, z: 15, color: '#e2b66f' },
  { id: 'canal-lantern', name: 'Canal lantern', x: -4, z: 39, color: '#f2cb88' },
  { id: 'traveler', name: 'Nok · fellow traveller', x: -20, z: 18, color: '#ecb17a' },
];
actors.push(
  { id: 'station', name: 'Dao · station guide', x: -40, z: 17.5, color: '#91c8df' },
  { id: 'gardener', name: 'Pim · park volunteer', x: -25, z: 25, color: '#a4c395' },
  { id: 'artisan', name: 'Arun · lantern maker', x: 29, z: 29, color: '#ccb7df' },
);
actors.push(...discoveries.map((d) => ({ id: d.id, name: d.name, x: d.x, z: d.z, color: d.color })));
export const RPG_KEY = 'bangkok-rift-adventure-v1';
export type AdventureSave = {
  talents: TalentId[];
  version: 1;
  worldVersion: 2;
  visited: CityArea[];
  position: Point;
  flags: string[];
  hp: number;
  rice: number;
  tea: number;
  coins: number;
  xp: number;
  learned: string[];
  battle: Battle | null;
  journeys: JourneySave;
  escort: EscortSave;
  lantern: LanternTrade;
  trackedQuest?: QuestId;
};
export const freshAdventure = (): AdventureSave => ({
  talents: [],
  version: 1,
  worldVersion: 2,
  visited: ['hotel'],
  position: { ...hotelStart },
  flags: [],
  hp: 100,
  rice: 1,
  tea: 1,
  coins: 20,
  xp: 0,
  learned: [],
  battle: null,
  journeys: freshJourneys(),
  escort: freshEscort(),
  lantern: freshLanternTrade(),
});
export const has = (s: AdventureSave, flag: string) => s.flags.includes(flag);
export function toggleTalent(s: AdventureSave, id: TalentId): AdventureSave {
  if (s.battle) return s;
  const growth = partyGrowth(s.xp, s.talents);
  if (talentReason(growth, id)) return s;
  return {
    ...s,
    talents: growth.talents.includes(id) ? growth.talents.filter((t) => t !== id) : [...growth.talents, id],
  };
}
export function completeJourneyStep(s: AdventureSave, cursor: string, result: JourneyResult): AdventureSave {
  const active = s.journeys.active;
  const journeys = advanceJourney(s.journeys, cursor, result);
  if (!active || journeys === s.journeys) return s;
  const reward = journeys.completed.length > s.journeys.completed.length;
  return {
    ...s,
    journeys,
    xp: s.xp + (reward ? 60 : 0),
    coins: s.coins + (reward ? 20 : 0),
    rice: s.rice + (reward ? 1 : 0),
    learned: [...new Set([...s.learned, journeyPhrase(active)])],
  };
}
export function normalizeAdventure(value: unknown): AdventureSave {
  const fresh = freshAdventure();
  if (!value || typeof value !== 'object') return fresh;
  const s = value as AdventureSave;
  if (s.version !== 1) return fresh;
  fresh.journeys = normalizeJourneys(s.journeys);
  fresh.escort = normalizeEscort(s.escort);
  fresh.lantern = normalizeLanternTrade(s.lantern);
  if (questIds.includes(s.trackedQuest as QuestId)) fresh.trackedQuest = s.trackedQuest;
  const flags = [
    ...eveningFlags,
    ...reunionFlags,
    ...canalFlags,
    ...discoveries.map((d) => d.id),
    'intro',
    'innkeeper',
    'cook',
    'chest',
    'ferry',
    'murmur',
    'keeper',
    'departed',
    'station',
    'gardener',
    'artisan',
    'sentinel',
  ];
  for (const k of ['hp', 'rice', 'tea', 'coins', 'xp'] as const)
    if (Number.isFinite(s[k])) fresh[k] = Math.max(0, Math.min(k === 'hp' ? 100 : 99999, Math.floor(s[k])));
  fresh.talents = partyGrowth(fresh.xp, s.talents).talents;
  fresh.flags = Array.isArray(s.flags) ? [...new Set(s.flags.filter((f) => flags.includes(f)))] : [];
  fresh.flags = normalizeEveningFlags(fresh.flags);
  fresh.flags = normalizeReunionFlags(fresh.flags);
  if (!fresh.flags.includes('canal-accepted'))
    fresh.flags = fresh.flags.filter((f) => !canalFlags.includes(f as (typeof canalFlags)[number]));
  else if (!fresh.flags.includes('canal-paper') || !fresh.flags.includes('canal-frame'))
    fresh.flags = fresh.flags.filter((f) => f !== 'canal-restored');
  fresh.learned = Array.isArray(s.learned)
    ? [...new Set(s.learned.filter((f) => typeof f === 'string'))]
    : [];
  if (s.position && walkable(s.position)) fresh.position = { x: s.position.x, z: s.position.z };
  else if (s.position) fresh.position = recoverCityPosition(s.position) ?? fresh.position;
  fresh.visited = Array.isArray(s.visited)
    ? [...new Set(s.visited.filter((id) => cityAreas.some((a) => a.id === id)))]
    : ['riverside'];
  const currentArea = cityAreaAt(fresh.position);
  if (currentArea && !fresh.visited.includes(currentArea)) fresh.visited.push(currentArea);
  const b = s.battle;
  if (b && ['murmur', 'keeper', 'sentinel'].includes(b.id) && (!has(fresh, b.id) || b.practice === true))
    fresh.battle = restoreBattle(
      b,
      createBattle(
        b.id,
        fresh.hp,
        fresh.rice,
        fresh.tea,
        has(fresh, 'chest'),
        b.practice === true,
        partyGrowth(fresh.xp, fresh.talents),
        has(fresh, 'sentinel'),
      ),
    );
  return fresh;
}
export function readAdventure(): AdventureSave {
  try {
    return normalizeAdventure(JSON.parse(localStorage.getItem(RPG_KEY) || 'null'));
  } catch {
    return freshAdventure();
  }
}
export function writeAdventure(s: AdventureSave): boolean {
  try {
    localStorage.setItem(RPG_KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}
export function flag(s: AdventureSave, id: string): AdventureSave {
  return has(s, id) ? s : { ...s, flags: [...s.flags, id] };
}
export function completeConversation(s: AdventureSave, id: ActorId): AdventureSave {
  if (has(s, id)) return s;
  const find = discoveryFor(id);
  if (find)
    return Math.hypot(s.position.x - find.x, s.position.z - find.z) <= 2.5
      ? {
          ...flag(s, id),
          xp: s.xp + 25,
          coins: s.coins + find.coins,
          rice: s.rice + find.rice,
          tea: s.tea + find.tea,
        }
      : s;
  if (id === 'station') return { ...flag(s, id), xp: s.xp + 25 };
  if (id === 'gardener') return { ...flag(s, id), tea: s.tea + 1, xp: s.xp + 25 };
  if (id === 'artisan') return { ...flag(s, id), coins: s.coins + 15, xp: s.xp + 25 };
  if (id === 'innkeeper') return { ...flag(s, id), hp: 100, xp: s.xp + 30 };
  if (id === 'cook') return { ...flag(s, id), rice: s.rice + 2, xp: s.xp + 30 };
  if (id === 'ferry') return has(s, 'cook') ? { ...flag(s, id), xp: s.xp + 30 } : s;
  return s;
}
export function openChest(s: AdventureSave): AdventureSave {
  return has(s, 'innkeeper') && !has(s, 'chest')
    ? { ...flag(s, 'chest'), coins: s.coins + 25, tea: s.tea + 1 }
    : s;
}
export function canBattle(s: AdventureSave, id: Battle['id']): boolean {
  if (s.battle) return false;
  if (id === 'sentinel') {
    const stone = actors.find((a) => a.id === 'waystone')!;
    return (
      !has(s, id) &&
      has(s, 'innkeeper') &&
      has(s, 'station') &&
      Math.hypot(s.position.x - stone.x, s.position.z - stone.z) <= 2.5
    );
  }
  return (
    !has(s, id) &&
    (id === 'murmur' ? has(s, 'innkeeper') : ['murmur', 'cook', 'ferry'].every((f) => has(s, f)))
  );
}
export function startBattle(s: AdventureSave, id: Battle['id']): AdventureSave {
  if (!canBattle(s, id)) return s;
  return {
    ...s,
    battle: createBattle(
      id,
      s.hp,
      s.rice,
      s.tea,
      has(s, 'chest'),
      false,
      partyGrowth(s.xp, s.talents),
      has(s, 'sentinel'),
    ),
  };
}
export function startPracticeBattle(s: AdventureSave): AdventureSave {
  if (s.battle) return s;
  return {
    ...s,
    battle: createBattle(
      has(s, 'murmur') ? 'keeper' : 'murmur',
      100,
      3,
      1,
      has(s, 'chest'),
      true,
      partyGrowth(s.xp, s.talents),
      has(s, 'sentinel'),
    ),
  };
}
export function updateBattle(s: AdventureSave, battle: Battle): AdventureSave {
  if (battle.practice) return { ...s, battle };
  return { ...s, battle, hp: battle.heroes[0].hp, rice: battle.rice, tea: battle.tea };
}
export function leaveBattle(s: AdventureSave): AdventureSave {
  if (!s.battle) return s;
  const b = s.battle;
  if (b.practice) return { ...s, battle: null };
  if (b.phase === 'victory')
    return {
      ...flag(s, b.id),
      battle: null,
      hp: Math.min(100, Math.max(1, s.hp) + (hasRiverCharm(s.flags) ? 15 : 0)),
      xp: s.xp + battleSpoils(b.id).xp,
      coins: s.coins + battleSpoils(b.id).coins,
    };
  if (b.phase === 'defeat') return { ...s, battle: null, hp: 35, position: { ...hotelStart } };
  return { ...s, battle: null, hp: Math.max(1, s.hp) };
}
export function moveAdventure(s: AdventureSave, position: Point): AdventureSave {
  if (!walkable(position)) return s;
  const area = cityAreaAt(position);
  return { ...s, position, visited: area && !s.visited.includes(area) ? [...s.visited, area] : s.visited };
}
export function transitTo(s: AdventureSave, id: CityArea): AdventureSave {
  if (!has(s, 'station') || !s.visited.includes(id) || s.battle || s.escort.stage === 'following') return s;
  const destination = cityAreas.find((a) => a.id === id);
  return destination ? moveAdventure(s, destination.center) : s;
}
export function objective(s: AdventureSave): { actor: ActorId; text: string } {
  const journey = s.journeys.active;
  if (journey && !journey.paused) {
    const actor = cityJourneys[journey.id - 1].actors[journey.stop];
    return { actor, text: `Meet ${journeyHosts[actor].name}. ${journeyHosts[actor].scene}` };
  }
  const tracked = trackedQuest(s);
  if (tracked.id !== 'ferry' && tracked.destinations.length)
    return { actor: tracked.destinations[0].actor, text: tracked.text };
  return storyObjective(s);
}
export function storyObjective(s: AdventureSave): { actor: ActorId; text: string } {
  if (!has(s, 'intro')) return { actor: 'su', text: 'Talk to Su. Find out where the rift brought you.' };
  if (!has(s, 'innkeeper'))
    return { actor: 'innkeeper', text: 'Check in with Mali at your Sukhumvit hotel.' };
  if (!has(s, 'cook'))
    return { actor: 'cook', text: 'Walk to Yaowarat. Find Uncle Lek and order supper for Niran.' };
  if (!has(s, 'ferry')) return { actor: 'ferry', text: 'Take the supper to Niran at the Chao Phraya pier.' };
  if (!has(s, 'murmur'))
    return { actor: 'wisp', text: 'Explore Lumphini Park. Recover the missing lantern spark.' };
  if (!has(s, 'keeper'))
    return { actor: 'shrine', text: 'Take the spark to the Old Town lantern court. Face the Keeper.' };
  return {
    actor: 'ferry',
    text: has(s, 'departed')
      ? 'Chapter complete. Explore, rest, or train for tomorrow.'
      : 'The river is clear. Return to Niran and catch the last ferry.',
  };
}
// Walkable courtyard plus the narrow pier. Benches are solid; corners slide.
export function walkable(p: Point): boolean {
  if (![p.x, p.z].every(Number.isFinite)) return false;
  if (cityObstacles.some((r) => inside(p, r))) return false;
  if (cityWalkable(p)) return true;
  if (
    !(p.x >= -11 && p.x <= 11 && p.z >= -0.55 && p.z <= 6) &&
    !(p.x >= 0.1 && p.x <= 1.9 && p.z >= -6.5 && p.z <= 6)
  )
    return false;
  return ![
    [-8.95, -7.05, 1.35, 3.05],
    [-0.95, 0.95, 1.35, 3.05],
  ].some(([x1, x2, z1, z2]) => p.x > x1 && p.x < x2 && p.z > z1 && p.z < z2);
}
export function stepPlayer(p: Point, dx: number, dz: number): Point {
  const next = { ...p };
  if (walkable({ x: next.x + dx, z: next.z })) next.x += dx;
  if (walkable({ x: next.x, z: next.z + dz })) next.z += dz;
  return next;
}
/** Reach each corner exactly before turning; early turns can strand a route outside its floor. */
export function followPath(p: Point, path: Point[], distance: number): Point {
  let next = p;
  while (path.length && distance > 0) {
    const target = path[0];
    const length = Math.hypot(target.x - next.x, target.z - next.z);
    if (length < 1e-7) {
      next = { ...target };
      path.shift();
      continue;
    }
    const step = Math.min(distance, length);
    const moved = stepPlayer(
      next,
      ((target.x - next.x) / length) * step,
      ((target.z - next.z) / length) * step,
    );
    if (Math.hypot(moved.x - target.x, moved.z - target.z) < 1e-7) {
      next = { ...target };
      path.shift();
    } else {
      next = moved;
      break;
    }
    distance -= step;
  }
  return next;
}
export function findPath(start: Point, target: Point): Point[] {
  const snap = (n: number) => Math.round(n * 2) / 2;
  const from = { x: snap(start.x), z: snap(start.z) },
    end = { x: snap(target.x), z: snap(target.z) };
  if (!walkable(end)) return [];
  const key = (p: Point) => `${p.x},${p.z}`;
  const queue = [from],
    parent = new Map<string, Point | null>([[key(from), null]]);
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    if (key(p) === key(end)) {
      const path: Point[] = [];
      let c: Point | null = p;
      while (c && parent.get(key(c))) {
        path.unshift(c);
        c = parent.get(key(c))!;
      }
      return path;
    }
    for (const [dx, dz] of [
      [0.5, 0],
      [-0.5, 0],
      [0, 0.5],
      [0, -0.5],
    ]) {
      const n = { x: p.x + dx, z: p.z + dz };
      if (walkable(n) && !parent.has(key(n))) {
        parent.set(key(n), p);
        queue.push(n);
      }
    }
  }
  return [];
}
