import { frontDeskClerkReactions } from './frontDeskClerkReactions';
import { lessonScenarios } from './lessonScenarios';
import { streetFoodVendorReactions } from './streetFoodVendorReactions';
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
