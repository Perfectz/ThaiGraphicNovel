import type { AdventureSave } from './adventure';
import { archiveSites, type ArchiveActor } from './archiveLayout.ts';
export const archiveClues = [
  {
    id: 'archive-cargo',
    title: 'Cargo record',
    text: 'The parcel contained folded paper shades and bamboo frames. The sender wrote: “Keep them dry. These are for the lamps along the water.”',
  },
  {
    id: 'archive-river',
    title: 'River photograph',
    text: 'A narrow boat waits beside the old pier. The caption says the delivery left after the food stalls closed. No road or railway carried it.',
  },
  {
    id: 'archive-lantern',
    title: 'Lantern rubbing',
    text: 'A rubbing of the maker’s seal matches the mark on the cargo record. Under it: “The ferryman carried our neighbourhood’s first lanterns.”',
  },
] as const;
export const archiveFlags = [
  'archive-accepted',
  ...archiveClues.map((c) => c.id),
  'archive-found',
  'archive-document',
  'archive-complete',
];
export function normalizeArchiveFlags(flags: string[]) {
  const ordinary = flags.filter((f) => !archiveFlags.includes(f));
  if (!flags.includes('innkeeper') || !flags.includes('archive-accepted')) return ordinary;
  const clues = archiveClues.filter((c) => flags.includes(c.id)).map((c) => c.id);
  const found = clues.length === 3 && flags.includes('archive-found');
  const document = found && flags.includes('archive-document');
  const valid = [
    ...ordinary,
    'archive-accepted',
    ...clues,
    ...(found ? ['archive-found'] : []),
    ...(document ? ['archive-document'] : []),
    ...(document && flags.includes('archive-complete') ? ['archive-complete'] : []),
  ];
  return flags.filter((f) => valid.includes(f));
}
export function archiveStatus(s: AdventureSave) {
  if (s.flags.includes('archive-complete'))
    return 'You recovered the ferry ledger. Kanya’s archive now remembers Patrick and Su beside the people who first lit the river path.';
  if (s.flags.includes('archive-document'))
    return 'Kanya has shared the ledger. Thank her for her time to finish your visit.';
  if (s.flags.includes('archive-found'))
    return 'You identified the ferry ledger. Return to Kanya and ask permission to see the original.';
  if (!s.flags.includes('archive-accepted'))
    return 'Beyond Old Town’s east gate, meet Kanya and ask to explore her community archive.';
  const count = archiveClues.filter((c) => s.flags.includes(c.id)).length;
  return count === 3
    ? 'Compare your three clues at the map cabinet. Which collection records the lantern delivery?'
    : `Explore the reading room and both galleries. ${count} of 3 clues recorded; the rooms connect around a shaded courtyard.`;
}
export function archiveDestinations(s: AdventureSave): ArchiveActor[] {
  if (s.flags.includes('archive-complete')) return [];
  if (!s.flags.includes('archive-accepted') || s.flags.includes('archive-found')) return ['archivist'];
  // First arrival is marked; the room clues are discovered by exploring, not map teleportation.
  return ['archive-cabinet'];
}
export type ArchiveScene = {
  speaker: string;
  title: string;
  text: string;
  phrase?: string;
  action?: string;
  puzzle?: boolean;
};
export function archiveScene(s: AdventureSave, actor: ArchiveActor): ArchiveScene {
  if (!s.flags.includes('innkeeper'))
    return {
      speaker: 'Su',
      title: 'A place full of stories',
      text: 'Let us check in at the hotel first. Then we can ask the archivist about exploring these rooms.',
    };
  if (actor === 'archivist') {
    if (!s.flags.includes('archive-accepted'))
      return {
        speaker: 'Kanya',
        title: 'The House of Returning Maps',
        text: '“Welcome. These rooms hold the stories our neighbours gave us.” Kanya sets down her pencil. “You are welcome to look around. Ask me before entering the galleries, and I will tell you what we are trying to find.”',
        phrase: 'may-enter',
        action: 'archive-accepted',
      };
    if (s.flags.includes('archive-complete'))
      return {
        speaker: 'Kanya',
        title: 'Your names belong here too',
        text: 'Kanya has added your names beside the ferry ledger. “You followed the small details. That is how a city remembers.” You can wander the galleries whenever you return.',
      };
    if (s.flags.includes('archive-document'))
      return {
        speaker: 'Kanya',
        title: 'The first lights on the water',
        text: 'Kanya opens the ledger. “My grandfather carried paper lanterns on the last ferry. People left them burning for neighbours walking home.” She gives you a copy of the route and tea for your journey. Thank her for her time.',
        phrase: 'thank-for-time',
        action: 'archive-complete',
      };
    if (s.flags.includes('archive-found'))
      return {
        speaker: 'Kanya',
        title: 'A careful request',
        text: '“The ferry deliveries. Of course.” Kanya finds the key to the original collection. The archive belongs to everyone, but these old pages are fragile. Ask to see the document before she opens it.',
        phrase: 'may-see-document',
        action: 'archive-document',
      };
    return {
      speaker: 'Kanya',
      title: 'Follow the details',
      text: '“We have lost the catalogue entry for our first lantern delivery. Look at the cargo record in the reading room, the photograph in the river gallery, and the rubbing in the lantern gallery. Compare them at the map cabinet. The galleries join around the courtyard; either direction will take you through.”',
    };
  }
  if (!s.flags.includes('archive-accepted'))
    return {
      speaker: 'Su',
      title: 'Ask before exploring',
      text: 'The collection belongs to the neighbourhood. Kanya is at reception. Let us ask her permission before handling the records.',
    };
  if (actor === 'archive-cabinet') {
    if (s.flags.includes('archive-found'))
      return {
        speaker: 'Su',
        title: 'The ferry ledger',
        text: 'We have identified the collection. Kanya keeps the key to the originals. Let us return to reception and ask her to show us the ledger.',
      };
    if (archiveClues.some((c) => !s.flags.includes(c.id)))
      return {
        speaker: 'Su',
        title: 'Three collections, one delivery',
        text: 'The labels name three collections: road surveys, lantern patterns, and ferry deliveries. We need the cargo record, river photograph and maker’s rubbing before deciding. There is a room on each side of the courtyard.',
      };
    return {
      speaker: 'Su',
      title: 'Which collection tells the whole story?',
      text: 'Paper shades and bamboo frames. A boat after the stalls closed. The maker’s seal and a ferryman. Use all three clues to choose the collection that records the journey, then ask Kanya for the original.',
      puzzle: true,
      action: 'archive-found',
    };
  }
  const clue = archiveClues.find((c) => c.id === actor)!;
  return {
    speaker: 'Su',
    title: clue.title,
    text: clue.text,
    ...(!s.flags.includes(actor) ? { action: actor } : {}),
  };
}
export function advanceArchive(
  s: AdventureSave,
  actor: ArchiveActor,
  action: string,
  answer?: string,
): AdventureSave {
  const site = archiveSites.find((a) => a.id === actor)!;
  if (
    s.battle ||
    (s.journeys.active && !s.journeys.active.paused) ||
    Math.hypot(s.position.x - site.x, s.position.z - site.z) > 2.5
  )
    return s;
  const scene = archiveScene(s, actor);
  if (
    scene.action !== action ||
    s.flags.includes(action) ||
    (scene.phrase && answer !== scene.phrase) ||
    (scene.puzzle && answer !== 'ferry')
  )
    return s;
  const complete = action === 'archive-complete';
  return {
    ...s,
    flags: [...s.flags, action],
    trackedQuest: 'archive',
    xp: s.xp + (complete ? 100 : 0),
    coins: s.coins + (complete ? 25 : 0),
    tea: s.tea + (complete ? 2 : 0),
  };
}
