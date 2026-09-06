import { actors, type ActorId, type AdventureSave } from './adventure.ts';

export const eveningFlags = [
  'evening-food',
  'evening-park',
  'evening-mild',
  'evening-chilli',
  'evening-water',
  'evening-tea',
  'evening-complete',
] as const;
export type EveningStep = 'plan' | 'order' | 'finish';
export type EveningRoute = 'food' | 'park';
export const eveningRoute = (s: AdventureSave): EveningRoute | null =>
  s.flags.includes('evening-food') ? 'food' : s.flags.includes('evening-park') ? 'park' : null;
export function eveningOrder(s: AdventureSave) {
  const valid =
    eveningRoute(s) === 'food' ? ['evening-mild', 'evening-chilli'] : ['evening-water', 'evening-tea'];
  return valid.find((f) => s.flags.includes(f));
}
export function normalizeEveningFlags(flags: string[]) {
  const ordinary = flags.filter((f) => !eveningFlags.includes(f as (typeof eveningFlags)[number]));
  if (!flags.includes('innkeeper')) return ordinary;
  const route = flags.includes('evening-food') ? 'food' : flags.includes('evening-park') ? 'park' : null;
  if (!route) return ordinary;
  const order = (
    route === 'food' ? ['evening-mild', 'evening-chilli'] : ['evening-water', 'evening-tea']
  ).find((f) => flags.includes(f));
  const allowed = [
    ...ordinary,
    `evening-${route}`,
    ...(order ? [order, ...(flags.includes('evening-complete') ? ['evening-complete'] : [])] : []),
  ];
  return flags.filter((f) => allowed.includes(f));
}
export function eveningHost(s: AdventureSave): ActorId {
  return eveningRoute(s) === 'food' ? 'cook' : eveningRoute(s) === 'park' ? 'gardener' : 'innkeeper';
}
export function eveningStep(s: AdventureSave): EveningStep | null {
  if (!s.flags.includes('innkeeper') || s.flags.includes('evening-complete')) return null;
  return !eveningRoute(s) ? 'plan' : eveningOrder(s) ? 'finish' : 'order';
}
export function eveningChoices(s: AdventureSave): string[] {
  if (eveningStep(s) === 'plan') return ['like-thai-food', 'i-am-thirsty'];
  if (eveningStep(s) === 'order')
    return eveningRoute(s) === 'food' ? ['not-spicy', 'little-spicy'] : ['water-please', 'want-this'];
  if (eveningStep(s) === 'finish') return [eveningRoute(s) === 'food' ? 'delicious' : 'thank-you'];
  return [];
}
export function eveningReason(s: AdventureSave): string | null {
  if (!eveningStep(s)) return 'This outing is not available.';
  if (s.battle) return 'Finish the encounter first.';
  if (s.journeys.active && !s.journeys.active.paused) return 'Pause your travel mission in Journeys first.';
  const host = actors.find((a) => a.id === eveningHost(s))!;
  return Math.hypot(s.position.x - host.x, s.position.z - host.z) > 2.5
    ? 'Visit the person marked in your journal.'
    : null;
}
/** Only explicit confirmation changes the story. Expected step rejects duplicate/stale submissions. */
export function advanceEvening(s: AdventureSave, expected: EveningStep, reply: string): AdventureSave {
  if (eveningReason(s) || eveningStep(s) !== expected || !eveningChoices(s).includes(reply)) return s;
  const choice =
    expected === 'plan'
      ? reply === 'like-thai-food'
        ? 'evening-food'
        : 'evening-park'
      : expected === 'order'
        ? {
            'not-spicy': 'evening-mild',
            'little-spicy': 'evening-chilli',
            'water-please': 'evening-water',
            'want-this': 'evening-tea',
          }[reply]
        : 'evening-complete';
  if (!choice) return s;
  const finished = expected === 'finish';
  return {
    ...s,
    flags: [...s.flags, choice],
    trackedQuest: 'evening',
    xp: s.xp + (finished ? 60 : 0),
    rice: s.rice + (finished && eveningRoute(s) === 'food' ? 2 : 0),
    tea: s.tea + (finished && eveningRoute(s) === 'park' ? 2 : 0),
  };
}
export function eveningStatus(s: AdventureSave) {
  if (s.flags.includes('evening-complete')) return eveningMemory(s);
  if (!eveningRoute(s))
    return 'At the hotel, make a plan with Su. Your reply chooses where the evening takes you.';
  if (eveningOrder(s))
    return eveningRoute(s) === 'food'
      ? 'Your meal is ready. Share the evening with Su at Lek’s stall.'
      : 'Pim has your drinks ready. Take a moment with Su beside the lake.';
  return eveningRoute(s) === 'food'
    ? 'You chose Thai food. Walk with Su to Lek in Yaowarat and order it your way.'
    : 'You told Su you were thirsty. Visit Pim in Lumphini and choose your drink.';
}
export function eveningMemory(s: AdventureSave) {
  const order = eveningOrder(s);
  if (order === 'evening-mild')
    return 'You chose a mild meal in Yaowarat. Su remembers Lek setting the chilli aside and making room for two new regulars.';
  if (order === 'evening-chilli')
    return 'You chose a little chilli in Yaowarat. Su remembers the first taste, your surprised laugh, and Lek passing over the water.';
  if (order === 'evening-water')
    return 'You chose water beside the Lumphini lake. Su remembers a quiet conversation that had nothing to do with saving the city.';
  return 'You chose Pim’s tea beside the Lumphini lake. Su remembers the warm flask between you and the lights reflected in the water.';
}
export function eveningScene(s: AdventureSave) {
  const step = eveningStep(s),
    food = eveningRoute(s) === 'food';
  if (step === 'plan')
    return {
      speaker: 'Su · with Mali',
      title: 'An Evening of Our Own',
      text: '“We have spent the whole day doing what the city needs,” Su says. “What would you like?” Mali suggests Lek’s food stalls or a drink with Pim beside the lake. Tell Su what sounds good. Both replies are welcome.',
      consequence:
        'Thai food → Yaowarat with Lek · Thirsty → Lumphini with Pim. Choose your route; there is no wrong answer.',
    };
  if (step === 'order')
    return food
      ? {
          speaker: 'Uncle Lek',
          title: 'Make it yours.',
          text: '“Tonight you are eating here, not carrying supper for someone else!” Lek puts two bowls on the counter. He holds up the chilli jar and waits for your preference. Su lets you do the talking.',
          consequence:
            'Choose no chilli or a little chilli. Lek changes the meal to match your reply. Neither choice changes the reward.',
        }
      : {
          speaker: 'Pim',
          title: 'A little room to breathe.',
          text: 'Pim makes space beside the pavilion. “Water, or the tea in this flask?” She points to the flask so you can ask for “this one.” Su watches the reflections while you choose.',
          consequence:
            '“Water, please” brings water. “I will take this one” chooses the tea Pim is pointing to. Both are welcome.',
        };
  return food
    ? {
        speaker: 'Su · at Lek’s stall',
        title: 'Two new regulars.',
        text: `${eveningOrder(s) === 'evening-chilli' ? 'Lek adds just a little chilli. The first taste makes you both reach for the water, laughing.' : 'Lek sets the chilli aside. “There. You should taste the food, not just the fire.”'} Su leans across the counter. “When we first met, every word felt like a test. This one just bought us an evening.” Tell Lek you enjoyed it.`,
        consequence:
          'Finish the evening: 60 XP and two rice parcels from Lek for tomorrow. Your chosen meal becomes a journal memory.',
      }
    : {
        speaker: 'Su · beside the lake',
        title: 'For a moment, just Bangkok.',
        text: `${eveningOrder(s) === 'evening-water' ? 'Pim pours cool water into two cups.' : 'Pim opens the tea flask and pours for you both.'} Su watches the small ripples. “I kept thinking we had to hurry. I had forgotten we could choose to stop.” Thank Pim for making you welcome.`,
        consequence:
          'Finish the evening: 60 XP and two travel flasks of tea from Pim for tomorrow. Your chosen drink becomes a journal memory.',
      };
}
export function eveningResponse(s: AdventureSave, reply: string) {
  if (eveningStep(s) === 'plan')
    return reply === 'like-thai-food'
      ? '“Then Yaowarat it is,” Su says. “Let us find a meal we can sit down for.”'
      : '“Pim has a place beside the lake,” Su says. “A drink and a quieter path sound good.”';
  if (eveningStep(s) === 'order')
    return (
      {
        'not-spicy': 'Lek puts the chilli jar away. “Mild, for both of you.”',
        'little-spicy': 'Lek measures a small spoonful. “Just a little. Water is right here.”',
        'water-please': 'Pim reaches for the water jug. “Good after a long walk.”',
        'want-this': 'Pim lifts the tea flask you pointed to. “This one? Of course.”',
      }[reply] ?? ''
    );
  return eveningMemory(s);
}
