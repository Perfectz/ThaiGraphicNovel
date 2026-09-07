import {archiveStatus,archiveDestinations} from './archiveQuest.ts';
import { actors, storyObjective, type ActorId, type AdventureSave, type Point } from './adventure.ts';
import { canalApproach, canalStatus } from './canalErrand.ts';
import { escortStatus } from './stationEscort.ts';
import { eveningHost, eveningStatus } from './eveningOuting.ts';
import { lanternName, lanternPrices } from './lanternTrade.ts';
import { reunionDestinations, reunionStatus } from './reunion.ts';
import { onWestBank } from './thonburi.ts';
import { gardenStops } from './canalNavigation.ts';

export const questIds = [
  'canal-garden',
  'thonburi',
  'archive',
  'ferry',
  'reunion',
  'routes',
  'canal',
  'escort',
  'park',
  'artisan',
  'waywarden',
  'evening',
  'travel-lantern',
] as const;
export type QuestId = (typeof questIds)[number];
export type QuestDestination = { actor: ActorId; label: string; point: Point };
export type QuestEntry = {
  id: QuestId;
  title: string;
  kind: string;
  complete: boolean;
  text: string;
  purpose: string;
  reward: string;
  destinations: QuestDestination[];
};
function destination(actor: ActorId, label?: string): QuestDestination {
  const person = actors.find((a) => a.id === actor)!;
  return {
    actor,
    label: label ?? person.name.split(' · ')[0],
    point: actor === 'gardener' ? canalApproach(actor) : { x: person.x, z: person.z },
  };
}

// Entries derive from story state; selecting a quest never grants progress or reveals future steps.
export function questJournal(s: AdventureSave): QuestEntry[] {
  const has = (id: string) => s.flags.includes(id);
  const main = storyObjective(s);
  const entries: QuestEntry[] = [
    {
      id: 'ferry',
      title: 'The Last Ferry',
      kind: 'Main story',
      complete: has('departed'),
      text: main.text,
      purpose: 'Meet people, order a meal and ask for help as you restore the river passage.',
      reward: 'Open the river passage with Su.',
      destinations: has('departed') ? [] : [destination(main.actor)],
    },
  ];
  if (has('departed')) entries.push({
    id:'thonburi',title:'The House Across the Water',kind:'Exploration story · Thonburi',complete:has('blue-house'),
    text:has('blue-house')?'Suda received Niran’s letter. Explore the other footbridge or take the ferry home.':!onWestBank(s.position)?'Niran has a letter for the other bank. Take the ferry to Thonburi.':!has('canal-post')?'Read the landing notice with Su. Find the address on Niran’s sealed letter.':'Follow the quay left, cross the narrow bridge, then turn right. Find blue shutters beside the tamarind tree on the far quay.',
    purpose:'Ask for repeated directions, understand a route and find a house by observing its surroundings.',reward:'80 XP · 20 coins · Tea · A welcome on the other bank',
    destinations:has('blue-house')?[]:[destination(!onWestBank(s.position)?'ferry':!has('canal-post')?'canal-post':'canal-junction')],
  });
  if (has('departed'))
    entries.push({
      id: 'reunion',
      title: 'A Promise Kept',
      kind: 'Chapter II · Main story',
      complete: has('reunion-complete'),
      text: reunionStatus(s),
      purpose:
        'Choose a time, invite your neighbours and agree on a meeting place. Your plan brings people from four districts together.',
      reward: '120 XP · Two rice parcels · Two teas · A reunion shaped by your plan',
      destinations: reunionDestinations(s).map((id) => destination(id)),
    });
  if (!has('innkeeper')) return entries;
  if (has('blue-house')) entries.push({
    id: 'canal-garden', title: 'A Garden Between the Quays', kind: 'World activity · Thonburi', complete: has('canal-garden'),
    text: has('canal-garden') ? 'Three quays bloom with the flowers you delivered. The garden boat remains at the canal.' : `Help the boat tender deliver flowers to the coloured quays in any order. ${s.canalBoat?.delivered.length ?? 0} of ${gardenStops.length} trays delivered.`,
    purpose: 'Use left, right, straight and stop instructions to navigate a real canal course.', reward: '100 XP · 30 coins · Two teas · Flowers along three quays',
    destinations: has('canal-garden') ? [] : [destination(onWestBank(s.position) ? 'canal-boat' : 'ferry')],
  });
  entries.push({id:'archive',title:'The House of Returning Maps',kind:'Exploration story',complete:has('archive-complete'),text:archiveStatus(s),purpose:'Explore connected galleries, assemble a forgotten river story and make polite requests in Thai.',reward:'An Open Book word art · 100 XP · 25 coins · Two teas · The ferry ledger',destinations:archiveDestinations(s).map(id=>destination(id))});
  entries.push(
    {
      id: 'travel-lantern',
      title: 'A Light of Your Own',
      kind: 'Side story · Old Town workshop',
      complete: !!s.lantern.owned,
      text: s.lantern.owned
        ? `${lanternName(s.lantern)} bought for ${s.lantern.paid} game coins. Su carries it along the side paths.`
        : s.lantern.offer === 'new'
          ? 'Meet Arun, then browse his travel lanterns. Ask the price before deciding.'
          : `Arun’s current offer is ${lanternPrices[s.lantern.offer]} game coins. Return to buy, discuss a simpler lantern, or walk away.`,
      purpose: 'Ask a price, negotiate politely, and decide what fits your budget.',
      reward: '40 XP · A carried lantern that reveals city memories from farther away',
      destinations: s.lantern.owned ? [] : [destination('artisan')],
    },
    {
      id: 'evening',
      title: 'An Evening of Our Own',
      kind: 'Companion story · Your choice',
      complete: has('evening-complete'),
      text: eveningStatus(s),
      purpose: 'Tell Su what you want, order to your taste, and share a moment in the city.',
      reward: '60 XP · Two rice parcels or two flasks of tea · A memory shaped by your choices',
      destinations: has('evening-complete') ? [] : [destination(eveningHost(s))],
    },
    {
      id: 'routes',
      title: 'A City of Possibilities',
      kind: 'Local story · Sukhumvit',
      complete: has('station'),
      text: has('station')
        ? 'Dao showed you how to ask for help. Your city pass can return you to places you have visited.'
        : 'Meet Dao beneath the elevated train and learn how to find your way.',
      purpose: 'Get someone’s attention, ask them to repeat, and thank them.',
      reward: 'Unlock return journeys to visited districts.',
      destinations: has('station') ? [] : [destination('station')],
    },
    {
      id: 'escort',
      title: 'A Way Back Together',
      kind: 'Side story · Park to Sukhumvit',
      complete: s.escort.stage === 'complete',
      text: escortStatus(s),
      purpose: 'Invite someone to go together, ask where the station is, and say thank you.',
      reward: '70 XP · 20 coins · tea',
      destinations:
        s.escort.stage === 'complete'
          ? []
          : s.escort.stage === 'waiting'
            ? [{ actor: 'traveler', label: 'Nok', point: s.escort.position }]
            : [{ actor: 'station', label: 'Dao with Nok', point: { x: -39.6, z: 16.8 } }],
    },
    {
      id: 'canal',
      title: 'A Light for Late Walkers',
      kind: 'Side story · Southern canal',
      complete: has('canal-restored'),
      text: canalStatus(s),
      purpose: 'Ask for slower speech, choose a material and thank your neighbours.',
      reward: 'Lantern Shelter word art · 80 XP · 25 coins · rice · tea',
      destinations: has('canal-restored')
        ? []
        : !has('canal-accepted') || (has('canal-paper') && has('canal-frame'))
          ? [destination('canal-lantern')]
          : [
              !has('canal-paper') ? destination('gardener') : null,
              !has('canal-frame') ? destination('artisan') : null,
            ].filter((d): d is QuestDestination => d !== null),
    },
    {
      id: 'park',
      title: 'A Moment in the Shade',
      kind: 'Local story · Lumphini',
      complete: has('gardener'),
      text: has('gardener')
        ? 'Pim welcomed you to the park. You can return to her for tea.'
        : 'Find Pim beside the pavilion and take a break from the busy streets.',
      purpose: 'Say you are thirsty, ask for water, and thank your host.',
      reward: 'Meet Pim and open her tea service.',
      destinations: has('gardener') ? [] : [destination('gardener')],
    },
    {
      id: 'artisan',
      title: 'Under the Lantern Roofs',
      kind: 'Local story · Old Town',
      complete: has('artisan'),
      text: has('artisan')
        ? 'Arun shared his workshop with you. His lanterns give Old Town its warm glow.'
        : 'Visit Arun’s workshop in Old Town and ask about his wares.',
      purpose: 'Choose an item, ask its price, and say thank you.',
      reward: 'Meet the lantern maker.',
      destinations: has('artisan') ? [] : [destination('artisan')],
    },
  );
  if (has('station'))
    entries.push({
      id: 'waywarden',
      title: 'The Crossroads Waywarden',
      kind: 'Optional battle · Crossroads',
      complete: has('sentinel'),
      text: has('sentinel')
        ? 'The crossroads are free. Your Wayfinder Seal strengthens future battles.'
        : 'Follow Dao’s lead to the old waystone. Prepare supplies before challenging its guardian.',
      purpose: 'Practise asking where the station is before choosing whether to fight.',
      reward: '75 XP · 25 coins · Wayfinder Seal',
      destinations: has('sentinel') ? [] : [destination('waystone')],
    });
  return entries;
}
export function trackedQuest(s: AdventureSave): QuestEntry {
  const entries = questJournal(s);
  return (
    entries.find((q) => q.id === s.trackedQuest && !q.complete) ??
    entries.find((q) => onWestBank(s.position) && q.id === 'thonburi' && !q.complete) ??
    entries.find((q) => q.id === 'reunion' && !q.complete) ??
    entries[0]
  );
}
export function trackQuest(s: AdventureSave, id: QuestId): AdventureSave {
  if (s.battle || (s.journeys.active && !s.journeys.active.paused)) return s;
  return questJournal(s).some((q) => q.id === id && !q.complete) ? { ...s, trackedQuest: id } : s;
}
