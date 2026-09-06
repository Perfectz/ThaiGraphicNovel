import { actors, type ActorId, type AdventureSave } from './adventure.ts';

export const reunionFlags = [
  'reunion-evening',
  'reunion-tomorrow',
  'reunion-mali',
  'reunion-arun',
  'reunion-welcome',
  'reunion-complete',
] as const;
export type ReunionStep = 'plan' | 'mali' | 'arun' | 'welcome' | 'finish';
export const reunionRoute = (s: AdventureSave) =>
  s.flags.includes('reunion-evening') ? 'evening' : s.flags.includes('reunion-tomorrow') ? 'tomorrow' : null;
export const reunionVenue = (s: AdventureSave): ActorId =>
  reunionRoute(s) === 'evening' ? 'cook' : 'gardener';
export const reunionInvited = (s: AdventureSave) =>
  s.flags.includes('reunion-mali') && s.flags.includes('reunion-arun');

export function normalizeReunionFlags(flags: string[]) {
  const ordinary = flags.filter((f) => !reunionFlags.includes(f as (typeof reunionFlags)[number]));
  if (!flags.includes('departed')) return ordinary;
  const route = flags.includes('reunion-evening')
    ? 'reunion-evening'
    : flags.includes('reunion-tomorrow')
      ? 'reunion-tomorrow'
      : null;
  if (!route) return ordinary;
  const allowed = [route, ...['reunion-mali', 'reunion-arun'].filter((f) => flags.includes(f))];
  if (allowed.length === 3 && flags.includes('reunion-welcome')) {
    allowed.push('reunion-welcome');
    if (flags.includes('reunion-complete')) allowed.push('reunion-complete');
  }
  return flags.filter((f) => ordinary.includes(f) || allowed.includes(f));
}

export function reunionDestinations(s: AdventureSave): ActorId[] {
  if (!s.flags.includes('departed') || s.flags.includes('reunion-complete')) return [];
  if (!reunionRoute(s)) return ['ferry'];
  if (reunionInvited(s)) return [reunionVenue(s)];
  return [
    !s.flags.includes('reunion-mali') ? 'innkeeper' : null,
    !s.flags.includes('reunion-arun') ? 'artisan' : null,
  ].filter((id): id is ActorId => id !== null);
}
export function reunionStep(s: AdventureSave, actor: ActorId): ReunionStep | null {
  if (!reunionDestinations(s).includes(actor)) return null;
  if (!reunionRoute(s)) return 'plan';
  if (actor === 'innkeeper') return 'mali';
  if (actor === 'artisan') return 'arun';
  return s.flags.includes('reunion-welcome') ? 'finish' : 'welcome';
}
export function reunionChoices(step: ReunionStep): string[] {
  return {
    plan: ['free-evening', 'tomorrow-ok'],
    mali: ['go-together'],
    arun: ['meet-where'],
    welcome: ['water-please'],
    finish: ['see-you'],
  }[step];
}
export function reunionReason(s: AdventureSave, actor: ActorId): string | null {
  if (!reunionStep(s, actor)) return 'This chapter conversation is not available here yet.';
  if (s.battle) return 'Finish the encounter first.';
  if (s.journeys.active && !s.journeys.active.paused) return 'Pause your travel mission in Journeys first.';
  const host = actors.find((a) => a.id === actor)!;
  return Math.hypot(s.position.x - host.x, s.position.z - host.z) > 2.5
    ? 'Walk over to your friend first.'
    : null;
}
/** Preview is free; only a current, nearby, explicitly confirmed reply changes the chapter. */
export function advanceReunion(
  s: AdventureSave,
  actor: ActorId,
  expected: ReunionStep,
  reply: string,
): AdventureSave {
  if (
    reunionReason(s, actor) ||
    reunionStep(s, actor) !== expected ||
    !reunionChoices(expected).includes(reply)
  )
    return s;
  const flag =
    expected === 'plan'
      ? reply === 'free-evening'
        ? 'reunion-evening'
        : 'reunion-tomorrow'
      : `reunion-${expected === 'finish' ? 'complete' : expected}`;
  const finished = expected === 'finish';
  return {
    ...s,
    flags: [...s.flags, flag],
    trackedQuest: 'reunion',
    xp: s.xp + (finished ? 120 : 0),
    rice: s.rice + (finished ? 2 : 0),
    tea: s.tea + (finished ? 2 : 0),
  };
}
export function reunionStatus(s: AdventureSave) {
  if (s.flags.includes('reunion-complete'))
    return reunionRoute(s) === 'evening'
      ? 'You brought Mali, Arun and Niran together for an evening meal in Yaowarat. Mali and Arun now have plans for a lantern at the hotel. You made a place for yourself at their table.'
      : 'You brought Mali, Arun and Niran together beside the Lumphini pavilion the next morning. Niran promised to take Mali on the ferry on her day off. Your words made a new plan possible.';
  if (!reunionRoute(s))
    return 'The ferry brought you home. Return to Niran at the pier: he has a promise he has never quite managed to keep.';
  if (!reunionInvited(s))
    return `${reunionRoute(s) === 'evening' ? 'An evening meal in Yaowarat' : 'Tomorrow at the Lumphini pavilion'} is your plan. Invite ${!s.flags.includes('reunion-mali') && !s.flags.includes('reunion-arun') ? 'Mali at the hotel and Arun in Old Town, in either order' : !s.flags.includes('reunion-mali') ? 'Mali at the Sukhumvit hotel' : 'Arun at his Old Town workshop'}.`;
  return reunionRoute(s) === 'evening'
    ? 'Everyone has agreed. Meet your friends at Lek’s stall in Yaowarat.'
    : 'Everyone has agreed. Meet your friends at Pim’s pavilion in Lumphini. The story moves to the next morning when you arrive; there is no real-time wait.';
}
export function reunionScene(s: AdventureSave, step: ReunionStep) {
  const evening = reunionRoute(s) === 'evening';
  if (step === 'plan')
    return {
      speaker: 'Niran',
      title: 'A Promise Kept',
      text: '“Mali brings supper to this pier. Arun repairs my lamps. I keep saying we should sit down together, but somehow there is always another crossing.” Niran coils the mooring rope. “You got us across the river. Could you help me keep one small promise?” He can finish early tonight, or take tomorrow morning off. Tell him when you are free.',
      consequence:
        'This evening → a meal with Lek in Yaowarat. Tomorrow → a morning with Pim in Lumphini. Both plans work. You will invite Mali and Arun yourself.',
    };
  if (step === 'mali')
    return evening
      ? {
          speaker: 'Mali',
          title: 'An empty chair at reception',
          text: 'Mali looks from the guest book to you. “Niran actually picked a time? That is a first.” You explain the evening meal at Lek’s stall. She hesitates over the desk bell, then turns the guest book toward her colleague. “Ask me properly. I have been waiting for an excuse to leave this chair.” Invite her to go together.',
          consequence:
            'Mali joins the evening meal. Your other invitation can happen before or after this one.',
        }
      : {
          speaker: 'Mali',
          title: 'A morning that belongs to her',
          text: '“Tomorrow morning? I finish the night shift at seven.” Mali closes the guest book. “Usually I go straight home. I cannot remember the last time I sat beside the lake.” You tell her Niran is making time too. Invite her to go together; she can meet you at Pim’s pavilion after her shift.',
          consequence:
            'Mali joins the morning meeting. Your other invitation can happen before or after this one.',
        };
  if (step === 'arun')
    return evening
      ? {
          speaker: 'Arun',
          title: 'Put down the lantern',
          text: 'Arun is fitting a new handle to an old lantern. “A meal with Niran and Mali? Yes. But Yaowarat has a lot of stalls.” He knows Lek’s corner and offers to explain the exact meeting point. Ask where you should meet.',
          consequence:
            'Arun confirms Lek’s stall, beside the red awning. He will bring the repaired lantern and meet you there.',
        }
      : {
          speaker: 'Arun',
          title: 'A place in the shade',
          text: 'Arun sets his tools aside. “Lumphini tomorrow? Gladly. I owe Pim a visit.” He draws a little pavilion on a scrap of wrapping paper. Ask where you should meet so everyone goes to the same place.',
          consequence:
            'Arun confirms Pim’s pavilion beside the lake. He will bring the paper cups and meet you there.',
        };
  if (step === 'welcome')
    return evening
      ? {
          speaker: 'Uncle Lek',
          title: 'One table, four neighbourhoods',
          text: 'Mali reaches the stall without her desk bell. Arun puts the repaired lantern between the bowls. Niran arrives last, still carrying his ferry cap. “You did it,” Lek says. “Usually I feed these three separately.” He points to the empty cups. Ask for water while he brings the food.',
          consequence:
            'The whole group is here because you made a plan and followed it through. Ask for water for the table, then stay for the conversation.',
        }
      : {
          speaker: 'Pim',
          title: 'The next morning',
          text: 'The story moves to the next morning. Mali arrives after her shift; Arun has remembered the cups. Niran sits down with the strange expression of someone who is not due anywhere. Pim opens her basket. “For once, nobody is in a hurry.” Ask for water while everyone settles beside the pavilion.',
          consequence:
            'The whole group is here because you made a plan and followed it through. Ask for water for the group, then stay for the conversation.',
        };
  return evening
    ? {
        speaker: 'Su',
        title: 'Next time, you have a table',
        text: 'Mali asks Arun whether a lantern like this could hang above the hotel desk. He sketches one on a napkin. Niran stops checking the river. Su nudges your shoulder. “You did not need perfect sentences. You needed a time, a place, and the courage to ask.” When the bowls are empty, say “See you again.” This time it feels like a promise you can keep.',
        consequence:
          '120 XP · Two rice parcels and two teas for your next walk. The evening and Mali’s new lantern plan become a permanent journal memory.',
      }
    : {
        speaker: 'Su',
        title: 'A city with familiar faces',
        text: 'Mali admits she has never ridden Niran’s ferry just for the view. “Your next day off,” he says, “the first seat is yours.” Arun laughs: “I am a witness.” Su watches the three of them. “Yesterday you were finding your way through this city. Today you helped them find each other.” Say “See you again” before you leave the pavilion.',
        consequence:
          '120 XP · Two rice parcels and two teas for your next walk. The morning and Mali’s promised ferry ride become a permanent journal memory.',
      };
}
