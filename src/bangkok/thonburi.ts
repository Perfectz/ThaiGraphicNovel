import type { AdventureSave, Point } from './adventure.ts';
import type { StoryLine } from './adventureStory.ts';

export type RiverBank = 'thonburi' | 'riverside';
export const thonburiBounds = { x: -10, z: -75, w: 44, d: 36 };
export const westLanding = { x: 17, z: -42 };
export const eastLanding = { x: 1, z: -5.5 };
export const onWestBank = (p: Point) => p.z < -30;
export const acrossRiver = (a: Point, b: Point) => onWestBank(a) !== onWestBank(b);
export const ferryApproach = (p: Point) => (onWestBank(p) ? westLanding : eastLanding);
// Four quays and two bridges form a loop around open canal water. Houses have solid footprints.
export const thonburiFloors = [
  { x: 14, z: -54, w: 6, d: 15 },
  { x: -8, z: -59, w: 40, d: 5 },
  { x: -8, z: -70, w: 40, d: 4 },
  { x: -8, z: -66, w: 5, d: 7 },
  { x: 27, z: -66, w: 5, d: 7 },
  { x: -8, z: -54, w: 18, d: 7 },
  { x: 22, z: -54, w: 10, d: 7 },
  { x: -8, z: -75, w: 40, d: 5 },
];
export const canalHouses = [
  { id: 'red', x: -6, z: -53, w: 7, d: 5, shutters: '#aa5744' },
  { id: 'ochre', x: 23, z: -53, w: 7, d: 5, shutters: '#bda457' },
  { id: 'blue', x: -1, z: -74.5, w: 8, d: 4.5, shutters: '#548d9e' },
  { id: 'green', x: 19, z: -74.5, w: 9, d: 4.5, shutters: '#5e866e' },
];
export const thonburiSites = [
  { id: 'west-pier', name: 'Return ferry', ...westLanding, color: '#8fc9bd' },
  { id: 'canal-post', name: 'Landing notice', x: 17, z: -49, color: '#e1c891' },
  { id: 'canal-junction', name: 'Canal footbridge', x: -5.5, z: -57, color: '#a4c395' },
  { id: 'blue-house', name: 'Suda · blue-shutter house', x: 3, z: -68.5, color: '#91c8df' },
  { id: 'red-house', name: 'Red-shutter house', x: 2, z: -50.5, color: '#ed9b7e' },
] as const;
export type ThonburiActor = (typeof thonburiSites)[number]['id'];
export const thonburiSite = (id: string) => thonburiSites.find((a) => a.id === id);
export const thonburiFlags = ['canal-post', 'canal-junction', 'blue-house'] as const;
export function beginRiverCrossing(s: AdventureSave, destination: RiverBank): AdventureSave {
  const from = destination === 'thonburi' ? eastLanding : westLanding;
  if (
    !s.flags.includes('keeper') ||
    s.battle ||
    s.passage ||
    s.escort.stage === 'following' ||
    (s.journeys.active && !s.journeys.active.paused) ||
    Math.hypot(s.position.x - from.x, s.position.z - from.z) > 2.5
  )
    return s;
  return { ...s, passage: destination };
}
export function arriveAcrossRiver(s: AdventureSave): AdventureSave {
  if (!s.passage) return s;
  const destination = s.passage;
  return {
    ...s,
    passage: undefined,
    position: { ...(destination === 'thonburi' ? westLanding : eastLanding) },
    visited: [...new Set([...s.visited, destination])],
    flags: [...new Set([...s.flags, 'departed'])],
    trackedQuest: destination === 'thonburi' && !s.flags.includes('blue-house') ? 'thonburi' : s.trackedQuest,
  };
}
export function completeThonburi(s: AdventureSave, id: ThonburiActor): AdventureSave {
  const site = thonburiSite(id)!;
  if (
    s.battle ||
    !s.flags.includes('departed') ||
    s.flags.includes(id) ||
    Math.hypot(s.position.x - site.x, s.position.z - site.z) > 2.5
  )
    return s;
  if (id === 'canal-post') return { ...s, flags: [...s.flags, id], trackedQuest: 'thonburi' };
  if (id === 'canal-junction' && s.flags.includes('canal-post')) return { ...s, flags: [...s.flags, id] };
  if (id === 'blue-house' && s.flags.includes('canal-junction'))
    return { ...s, flags: [...s.flags, id], xp: s.xp + 80, coins: s.coins + 20, tea: s.tea + 1 };
  return s;
}
export const thonburiLines: Partial<Record<ThonburiActor, StoryLine[]>> = {
  'canal-post': [
    {
      speaker: 'Su',
      text: 'Niran gave us a sealed letter for Suda. The landing notice says she lives beyond the canal, at the blue-shutter house beside the tamarind tree. There are two footbridges. We should read the route before setting off.',
    },
    {
      speaker: 'Su',
      text: 'If directions come too quickly, you can ask to hear them again. Try that now, and I will read the notice once more.',
      phrase: 'say-again',
      response:
        'Follow the quay left from this landing. At the red-shutter house, take the narrow bridge across the canal. On the far quay, turn right. The blue shutters are beside a tree. Keep the letter sealed.',
    },
  ],
  'canal-junction': [
    {
      speaker: 'Su',
      text: 'This is the narrow bridge from the notice. Look across the water: the blue shutters are on the far quay. Cross here, then follow the timber walk right. The red house on this side belongs to someone else.',
      phrase: 'i-understand',
      response:
        'You confirm that you understand. Now find the house by its shutters and the tree; there is no need to knock at every door.',
    },
  ],
  'blue-house': [
    {
      speaker: 'Suda',
      text: 'A letter from Niran? You found the right house. Come to the veranda. Please greet me before you hand it over.',
      phrase: 'hello',
      response:
        'Suda accepts the sealed letter. She recognises the handwriting and smiles. “My sister says she will visit. It has been a long time.”',
    },
    {
      speaker: 'Suda',
      text: 'Thank you for finding me. Take this tea for your return journey. The other bridge makes a loop back to the landing, so you can see the rest of our canal walk.',
      phrase: 'thank-you',
      response:
        'The letter is delivered. The neighbours are planting a canal garden today. Ask at the garden boat on the near quay if you would like to help with the flower deliveries. The ferry remains available whenever you want to return.',
    },
  ],
  'red-house': [
    {
      speaker: 'Su',
      text: 'These shutters are red, and the letter is addressed to the blue-shutter house across the water. Keep it sealed. Look for the narrow footbridge along this quay.',
    },
  ],
};
