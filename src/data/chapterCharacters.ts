import { cafeFriendReactions } from './cafeFriendReactions';
import { charmShopVendorReactions } from './charmShopVendorReactions';
import { clinicPharmacistReactions } from './clinicPharmacistReactions';
import { formalArchivistReactions } from './formalArchivistReactions';
import { frontDeskClerkReactions } from './frontDeskClerkReactions';
import { lessonScenarios } from './lessonScenarios';
import { rescueGuideReactions } from './rescueGuideReactions';
import { riftGuardianReactions } from './riftGuardianReactions';
import { streetFoodVendorReactions } from './streetFoodVendorReactions';
import { suReactions } from './suReactions';
import { taxiDriverReactions } from './taxiDriverReactions';

export type ChapterCharacterReaction = 'smile' | 'explaining' | 'surprised' | 'worried' | 'determined' | 'playful';

export type ChapterCharacterSprite = {
  id: string;
  scenarioId: string;
  image: string;
  alt: string;
  className: string;
};

type ChapterCharacterDefinition = Omit<ChapterCharacterSprite, 'image'> & {
  reactions: Record<ChapterCharacterReaction, string>;
};

const chapterCharacters: ChapterCharacterDefinition[] = [
  {
    id: 'su-guide',
    scenarioId: 'hotel-lobby-basics',
    alt: 'Su',
    reactions: suReactions,
    className:
      'left-[-4rem] h-[min(53dvh,32rem)] sm:left-[4vw] sm:h-[min(59dvh,37rem)] lg:left-[9vw]',
  },
  {
    id: 'front-desk-clerk',
    scenarioId: 'front-desk-check-in',
    alt: 'Front desk clerk',
    reactions: frontDeskClerkReactions,
    className:
      'left-[-3.5rem] h-[min(53dvh,32rem)] sm:left-[4vw] sm:h-[min(59dvh,37rem)] lg:left-[9vw]',
  },
  {
    id: 'street-food-vendor',
    scenarioId: 'street-food-order',
    alt: 'Street food vendor',
    reactions: streetFoodVendorReactions,
    className:
      'left-[-4rem] h-[min(53dvh,32rem)] sm:left-[4vw] sm:h-[min(59dvh,37rem)] lg:left-[9vw]',
  },
  {
    id: 'taxi-driver',
    scenarioId: 'taxi-ride',
    alt: 'Taxi driver',
    reactions: taxiDriverReactions,
    className:
      'left-[-4rem] h-[min(53dvh,32rem)] sm:left-[4vw] sm:h-[min(59dvh,37rem)] lg:left-[9vw]',
  },
  {
    id: 'charm-shop-vendor',
    scenarioId: 'market-bargain',
    alt: 'Charm shop vendor',
    reactions: charmShopVendorReactions,
    className:
      'left-[-4rem] h-[min(53dvh,32rem)] sm:left-[4vw] sm:h-[min(59dvh,37rem)] lg:left-[9vw]',
  },
  {
    id: 'clinic-pharmacist',
    scenarioId: 'clinic-and-pharmacy',
    alt: 'Clinic pharmacist',
    reactions: clinicPharmacistReactions,
    className:
      'left-[-4rem] h-[min(53dvh,32rem)] sm:left-[4vw] sm:h-[min(59dvh,37rem)] lg:left-[9vw]',
  },
  {
    id: 'cafe-friend',
    scenarioId: 'friendship-plans',
    alt: 'Cafe friend',
    reactions: cafeFriendReactions,
    className:
      'left-[-4rem] h-[min(53dvh,32rem)] sm:left-[4vw] sm:h-[min(59dvh,37rem)] lg:left-[9vw]',
  },
  {
    id: 'rescue-guide',
    scenarioId: 'directions-and-emergency',
    alt: 'Rescue guide',
    reactions: rescueGuideReactions,
    className:
      'left-[-4rem] h-[min(53dvh,32rem)] sm:left-[4vw] sm:h-[min(59dvh,37rem)] lg:left-[9vw]',
  },
  {
    id: 'formal-archivist',
    scenarioId: 'formal-meeting',
    alt: 'Formal archivist',
    reactions: formalArchivistReactions,
    className:
      'left-[-4rem] h-[min(53dvh,32rem)] sm:left-[4vw] sm:h-[min(59dvh,37rem)] lg:left-[9vw]',
  },
  {
    id: 'rift-guardian',
    scenarioId: 'rift-negotiation',
    alt: 'Rift guardian',
    reactions: riftGuardianReactions,
    className:
      'left-[-4rem] h-[min(53dvh,32rem)] sm:left-[4vw] sm:h-[min(59dvh,37rem)] lg:left-[9vw]',
  },
];

export function getChapterCharacters(
  scenarioIndex: number,
  reaction: ChapterCharacterReaction = 'smile',
): ChapterCharacterSprite[] {
  const scenario = lessonScenarios[scenarioIndex] ?? lessonScenarios[0];
  return chapterCharacters
    .filter((character) => character.scenarioId === scenario.id)
    .map(({ reactions, ...character }) => ({ ...character, image: reactions[reaction] }));
}
