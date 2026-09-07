import type { AdventureSave } from './adventure.ts';
import type { ThaiPhrase } from '../data/thaiPhrases.ts';

export const canalBoatContact = {
  id: 'canal-boat' as const,
  name: 'Canal garden boat',
  x: 18,
  z: -57,
  color: '#f1c268',
};
export const gardenStops = [
  { id: 'red', name: 'Red-shutter quay', col: 0, row: 0, color: '#d97d61', planter: { x: -0.7, z: -57.7 } },
  { id: 'blue', name: 'Blue-shutter quay', col: 0, row: 1, color: '#7cbfd2', planter: { x: 0.1, z: -66.7 } },
  { id: 'green', name: 'Green-shutter quay', col: 4, row: 1, color: '#8dc58d', planter: { x: 24, z: -66.7 } },
] as const;
export type GardenStop = (typeof gardenStops)[number]['id'];
export type CanalBoatSave = {
  col: number;
  row: number;
  heading: number;
  moves: number;
  delivered: GardenStop[];
};
export const boatStart = (): CanalBoatSave => ({ col: 3, row: 0, heading: 2, moves: 0, delivered: [] });
export const boatPoint = (p: Pick<CanalBoatSave, 'col' | 'row'>) => ({
  x: p.col * 6,
  z: -60.6 - p.row * 3.8,
});
export const boatHeadingNames = ['east →', 'south ↓', 'west ←', 'north ↑'];
export const boatCellOpen = (col: number, row: number) =>
  Number.isInteger(col) &&
  Number.isInteger(row) &&
  col >= 0 &&
  col <= 4 &&
  row >= 0 &&
  row <= 1 &&
  !(col === 2 && row === 0);
export const navigationPhrases: ThaiPhrase[] = [
  {
    id: 'turn-left',
    targetPhrase: 'เลี้ยวซ้ายครับ',
    romanization: 'liao saai khrap',
    translation: 'Turn left, please',
    context: 'Give the driver a left turn instruction.',
    lesson: 'Canal directions',
    example: 'Ask for a left turn at a junction.',
  },
  {
    id: 'turn-right',
    targetPhrase: 'เลี้ยวขวาครับ',
    romanization: 'liao khwaa khrap',
    translation: 'Turn right, please',
    context: 'Give the driver a right turn instruction.',
    lesson: 'Canal directions',
    example: 'Ask for a right turn at a junction.',
  },
  {
    id: 'go-straight',
    targetPhrase: 'ตรงไปครับ',
    romanization: 'trong pai khrap',
    translation: 'Go straight, please',
    context: 'Ask the driver to continue straight ahead.',
    lesson: 'Canal directions',
    example: 'Continue along the channel before the next turn.',
  },
];
export const boatCommands = ['turn-left', 'go-straight', 'turn-right', 'stop-here'] as const;
export const boatCursor = (b: CanalBoatSave) =>
  `${b.moves}:${b.col}:${b.row}:${b.heading}:${b.delivered.join(',')}`;
export const boatLocked = {
  speaker: 'Su',
  text: 'Deliver Niran’s letter to Suda first. Then help the neighbours with their canal garden.',
};
export const boatBusy = {
  speaker: 'Su',
  text: 'Finish or pause your current activity before guiding the garden boat.',
};
export const boatDistant = {
  speaker: 'Su',
  text: 'Meet the boat tender at the loading steps on the near quay.',
};
export function normalizeCanalBoat(value: unknown): CanalBoatSave | undefined {
  if (!value || typeof value !== 'object') return;
  const b = value as CanalBoatSave;
  const result = boatStart();
  if (boatCellOpen(b.col, b.row)) {
    result.col = b.col;
    result.row = b.row;
  }
  if (Number.isInteger(b.heading) && b.heading >= 0 && b.heading < 4) result.heading = b.heading;
  if (Number.isInteger(b.moves) && b.moves >= 0) result.moves = Math.min(b.moves, 100000);
  if (Array.isArray(b.delivered))
    result.delivered = [...new Set(b.delivered.filter((id) => gardenStops.some((stop) => stop.id === id)))];
  return result;
}
export function canalBoatReason(s: AdventureSave): string | null {
  if (!s.flags.includes('blue-house')) return boatLocked.text;
  if (
    s.battle ||
    s.passage ||
    s.escort.stage === 'following' ||
    (s.journeys.active && !s.journeys.active.paused)
  )
    return boatBusy.text;
  if (Math.hypot(s.position.x - canalBoatContact.x, s.position.z - canalBoatContact.z) > 2.5)
    return boatDistant.text;
  return null;
}
export function beginCanalBoat(s: AdventureSave): AdventureSave {
  return canalBoatReason(s) || s.canalBoat
    ? s
    : { ...s, canalBoat: boatStart(), trackedQuest: 'canal-garden' };
}
export const gardenIntro = {
  speaker: 'Su',
  text: 'Suda’s neighbours have shared three trays of marigolds. Help the boat tender take them to the red, blue and green quays in any order. Face the direction you want, then go straight to the next channel marker. Floating planters block the middle of the near lane. Ask to stop beside a coloured quay to unload. Nobody is in a hurry.',
};
export const gardenComplete = {
  speaker: 'Su',
  text: 'All three quays are planted. You used directions to bring the neighbours together, and the flowers will be here when we return. Take these supplies for our next adventure.',
};
export const gardenReady = { speaker: 'Su', text: 'The tender is ready. Turn the bow, then go straight to the next marker. Ask to stop at a coloured quay. You can open the channel chart whenever you need it.' };
export const boatReplies = {
  left: { speaker: 'Su', text: 'The bow turns left. Check where it points before asking to go straight.' },
  right: {
    speaker: 'Su',
    text: 'The bow turns right. The next straight instruction follows this new heading.',
  },
  straight: {
    speaker: 'Su',
    text: 'The tender rows to the next channel marker and waits for your next instruction.',
  },
  blocked: {
    speaker: 'Su',
    text: 'That way reaches a quay or the floating planters. The tender stays here. Turn the bow toward an open channel, then go straight.',
  },
  stopped: {
    speaker: 'Su',
    text: 'The boat stops, but this is not a delivery quay. Look for the red, blue or green pennant.',
  },
  delivered: {
    speaker: 'Su',
    text: 'The tray is unloaded and the neighbours plant their flowers. Choose another coloured quay for the remaining trays.',
  },
  visited: {
    speaker: 'Su',
    text: 'This quay already has its flowers. The tender waits for your next direction.',
  },
};
export type BoatReply = keyof typeof boatReplies;
export function commandCanalBoat(
  s: AdventureSave,
  cursor: string,
  command: string,
): { save: AdventureSave; reply?: BoatReply } {
  const b = s.canalBoat;
  if (
    canalBoatReason(s) ||
    !b ||
    cursor !== boatCursor(b) ||
    !boatCommands.includes(command as (typeof boatCommands)[number])
  )
    return { save: s };
  const next = { ...b, moves: b.moves + 1, delivered: [...b.delivered] };
  let reply: BoatReply;
  if (command === 'turn-left' || command === 'turn-right') {
    next.heading = (b.heading + (command === 'turn-left' ? 3 : 1)) % 4;
    reply = command === 'turn-left' ? 'left' : 'right';
  } else if (command === 'go-straight') {
    const [dc, dr] = [
      [1, 0],
      [0, -1],
      [-1, 0],
      [0, 1],
    ][b.heading];
    if (boatCellOpen(b.col + dc, b.row + dr)) {
      next.col += dc;
      next.row += dr;
      reply = 'straight';
    } else reply = 'blocked';
  } else {
    const stop = gardenStops.find((stop) => stop.col === b.col && stop.row === b.row);
    reply = !stop ? 'stopped' : b.delivered.includes(stop.id) ? 'visited' : 'delivered';
    if (stop && reply === 'delivered') next.delivered.push(stop.id);
  }
  const finished = next.delivered.length === gardenStops.length && !s.flags.includes('canal-garden');
  return {
    reply,
    save: {
      ...s,
      canalBoat: next,
      flags: finished ? [...s.flags, 'canal-garden'] : s.flags,
      xp: s.xp + (finished ? 100 : 0),
      coins: s.coins + (finished ? 30 : 0),
      tea: s.tea + (finished ? 2 : 0),
    },
  };
}
export function recallCanalBoat(s: AdventureSave): AdventureSave {
  if (canalBoatReason(s) || !s.canalBoat) return s;
  return {
    ...s,
    canalBoat: { ...boatStart(), delivered: s.canalBoat.delivered, moves: s.canalBoat.moves + 1 },
  };
}
