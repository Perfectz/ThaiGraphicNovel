import type { ActorId } from './adventure.ts';
import { recordAttempt, localDate, type TrainingSave } from './learning.ts';

export type JourneyActor = Extract<
  ActorId,
  'innkeeper' | 'station' | 'cook' | 'gardener' | 'artisan' | 'ferry'
>;
export const journeyHosts: Record<JourneyActor, { name: string; scene: string; pool: string[] }> = {
  innkeeper: {
    name: 'Mali',
    scene: 'Prepare for a day away from your Sukhumvit room.',
    pool: [
      'hello',
      'my-name-is-patrick',
      'reservation-have',
      'under-name',
      'check-in-please',
      'key-where',
      'which-floor',
      'elevator-where',
      'speak-slowly',
      'say-again',
      'thank-you',
      'bathroom-where',
    ],
  },
  station: {
    name: 'Dao',
    scene: 'Work out your next journey with the station guide.',
    pool: [
      'sorry',
      'where-is-station',
      'near-here',
      'go-how',
      'turn-left-right',
      'i-am-lost',
      'please-help',
      'speak-slowly',
      'say-again',
      'thank-you',
    ],
  },
  cook: {
    name: 'Uncle Lek',
    scene: 'Put together a meal and make your preferences clear.',
    pool: [
      'hello',
      'want-this',
      'one-plate',
      'not-spicy',
      'little-spicy',
      'water-please',
      'bill-please',
      'delicious',
      'like-thai-food',
      'not-like-spicy',
      'thank-you',
      'how-much',
    ],
  },
  gardener: {
    name: 'Pim',
    scene: 'Take a park break and ask for the help you need.',
    pool: [
      'hello',
      'i-am-thirsty',
      'water-please',
      'bathroom-where',
      'near-here',
      'please-help',
      'sorry',
      'say-again',
      'thank-you',
      'nice-to-meet-you',
    ],
  },
  artisan: {
    name: 'Arun',
    scene: 'Explore the workshop and discuss a purchase before deciding.',
    pool: [
      'hello',
      'what-is-this',
      'what-material',
      'how-much',
      'too-expensive',
      'little-cheaper',
      'think-first',
      'not-today',
      'i-will-buy',
      'thank-you',
      'has-color',
      'buy-two',
    ],
  },
  ferry: {
    name: 'Niran',
    scene: 'Arrange a river meeting and make sure you understand the plan.',
    pool: [
      'hello',
      'speak-slowly',
      'say-again',
      'how-long',
      'how-much-to-go',
      'meet-where',
      'tomorrow-ok',
      'go-together',
      'see-you',
      'thank-you',
    ],
  },
};
const routes: { actors: JourneyActor[]; titles: string[]; story: string; stamp: string }[] = [
  {
    actors: ['innkeeper', 'station', 'cook'],
    titles: [
      'First light on Sukhumvit',
      'A room, a route, a meal',
      'Out before the city wakes',
      'A traveller finds their rhythm',
      'Your own Bangkok morning',
    ],
    story: 'Mali suggests a simple challenge: get ready, find your route, and order your own breakfast.',
    stamp: 'Morning traveller',
  },
  {
    actors: ['cook', 'gardener', 'station'],
    titles: [
      'A picnic in Lumphini',
      'A little shade and conversation',
      'The long way through the park',
      'An afternoon without a script',
      'A familiar face by the lake',
    ],
    story: 'Take a food stop, a quiet park break, and a conversation about the way back.',
    stamp: 'Park companion',
  },
  {
    actors: ['artisan', 'cook', 'ferry'],
    titles: [
      'Lanterns for the river',
      'Three stops before sunset',
      'A gift and a shared table',
      'Words beneath the red lanterns',
      'An evening you arranged yourself',
    ],
    story: 'Visit the workshop, stop for supper, and arrange a meeting by the river.',
    stamp: 'Lantern bearer',
  },
  {
    actors: ['ferry', 'station', 'innkeeper'],
    titles: [
      'Find your way home',
      'The route you remember',
      'Ask again, then carry on',
      'A confident journey back',
      'Home is a conversation',
    ],
    story: 'Work out a river departure, ask your way through Sukhumvit, and return to your hotel.',
    stamp: 'Wayfinder',
  },
  {
    actors: ['artisan', 'cook', 'gardener'],
    titles: [
      'A day of small choices',
      'Look before you buy',
      'Your taste, your pace',
      'The polite art of deciding',
      'A city day on your terms',
    ],
    story: 'Ask before buying, choose a meal that suits you, then unwind with Pim in the park.',
    stamp: 'Thoughtful guest',
  },
  {
    actors: ['gardener', 'artisan', 'ferry'],
    titles: [
      'People make a city',
      'Names along the lantern trail',
      'Kindness travels with you',
      'Plans for another day',
      'Thirty outings, a new beginning',
    ],
    story: 'Revisit the people who helped you. Ask, clarify, and make plans for the next time you meet.',
    stamp: 'Friend of the river',
  },
];
export const cityJourneys = Array.from({ length: 30 }, (_, i) => {
  const route = routes[i % 6],
    variant = Math.floor(i / 6);
  return {
    id: i + 1,
    title: route.titles[variant],
    story: route.story,
    stamp: route.stamp,
    actors: route.actors,
    variant,
  };
});
export type JourneyResult = { spoken: boolean; recalled?: boolean; hinted?: boolean };
export type JourneyCompletion = { id: number; date: string; spoken: number; recalled: number };
export type JourneyChallenge = { firstRecall: boolean[][]; order: number[][] };
export type ActiveJourney = {
  id: number;
  date: string;
  stop: number;
  step: number;
  queues: string[][];
  spoken: number;
  recalled: number;
  paused: boolean;
  replay: boolean;
  challenge?: JourneyChallenge;
  meaningHelp?: string[];
};
export type JourneySave = { completed: JourneyCompletion[]; active: ActiveJourney | null };
export const freshJourneys = (): JourneySave => ({ completed: [], active: null });
export const journeyCursor = (a: ActiveJourney) => `${a.id}:${a.stop}:${a.step}`;
export const journeyPhrase = (a: ActiveJourney) =>
  a.queues[a.stop][a.step < 3 ? a.step : (a.challenge?.order[a.stop][a.step - 3] ?? a.step % 3)];
export const journeyIsRecall = (a: ActiveJourney) =>
  a.step >= 3 || !!a.challenge?.firstRecall[a.stop][a.step];
/** Keep the same three intentions across reloads without placing the answer first. */
export function journeyIntentChoices(a: ActiveJourney): string[] {
  const queue = a.queues[a.stop];
  const offset = (a.id + a.stop + a.step) % queue.length;
  return queue.map((_, i) => queue[(i + offset) % queue.length]);
}
export const journeyUsedMeaningHelp = (a: ActiveJourney) => !!a.meaningHelp?.includes(journeyCursor(a));
export function markJourneyMeaningHelp(s: JourneySave, cursor: string): JourneySave {
  const active = s.active;
  if (
    !active ||
    active.paused ||
    active.step < 3 ||
    journeyCursor(active) !== cursor ||
    journeyUsedMeaningHelp(active)
  )
    return s;
  return { ...s, active: { ...active, meaningHelp: [...(active.meaningHelp ?? []), cursor] } };
}
export function recordJourneyPractice(
  training: TrainingSave,
  active: ActiveJourney,
  result: JourneyResult,
  date = localDate(),
) {
  const id = journeyPhrase(active);
  if (!journeyIsRecall(active))
    return recordAttempt(training, id, result.spoken ? 'spoken' : 'choice', true, date);
  const next = recordAttempt(
    training,
    id,
    'recall',
    !!result.recalled && !result.hinted && !journeyUsedMeaningHelp(active),
    date,
  );
  return result.spoken ? recordAttempt(next, id, 'spoken', true, date) : next;
}
export function journeyChallenge(
  queues: string[][],
  training: TrainingSave,
  date: string,
  id: number,
): JourneyChallenge {
  const orders = [
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0],
    [0, 2, 1],
  ];
  return {
    firstRecall: queues.map((q) =>
      q.map((phrase) => {
        const r = training.records[phrase];
        return (
          !!r &&
          r.recalled >= 2 &&
          r.interval > 0 &&
          typeof r.lastRecall === 'string' &&
          /^\d{4}-\d{2}-\d{2}$/.test(r.lastRecall) &&
          r.lastRecall < date
        );
      }),
    ),
    order: queues.map((_, stop) => [...orders[(id + stop + Number(date.slice(-2))) % orders.length]]),
  };
}
export function beginJourney(
  s: JourneySave,
  training: TrainingSave,
  date: string,
  replayId?: number,
): JourneySave {
  if (s.active) return s;
  const id = replayId ?? cityJourneys.find((j) => !s.completed.some((c) => c.id === j.id))?.id;
  const definition = cityJourneys.find((j) => j.id === id);
  if (!definition) return s;
  const queues = definition.actors.map((actor, stop) => {
    const pool = journeyHosts[actor].pool,
      offset = definition.variant * 2 + stop;
    const due = pool
      .filter((id) => training.records[id]?.due <= date)
      .sort((a, b) => training.records[a].due.localeCompare(training.records[b].due))[0];
    return [
      ...new Set([
        ...(due ? [due] : []),
        ...Array.from({ length: 4 }, (_, i) => pool[(offset + i) % pool.length]),
      ]),
    ].slice(0, 3);
  });
  return {
    ...s,
    active: {
      id: definition.id,
      date,
      stop: 0,
      step: 0,
      queues,
      spoken: 0,
      recalled: 0,
      paused: false,
      replay: s.completed.some((c) => c.id === id),
      challenge: journeyChallenge(queues, training, date, definition.id),
    },
  };
}
export function advanceJourney(s: JourneySave, cursor: string, result: JourneyResult): JourneySave {
  const old = s.active;
  if (!old || old.paused || journeyCursor(old) !== cursor) return s;
  const active = {
    ...old,
    spoken: old.spoken + Number(result.spoken),
    recalled:
      old.recalled +
      Number(
        journeyIsRecall(old) && result.recalled === true && !result.hinted && !journeyUsedMeaningHelp(old),
      ),
    step: old.step + 1,
  };
  if (active.step === 6) {
    active.stop++;
    active.step = 0;
  }
  if (active.stop < 3) return { ...s, active };
  return {
    active: null,
    completed:
      old.replay || s.completed.some((c) => c.id === old.id)
        ? s.completed
        : [...s.completed, { id: old.id, date: old.date, spoken: active.spoken, recalled: active.recalled }],
  };
}
export function normalizeJourneys(value: unknown): JourneySave {
  const s = value as Partial<JourneySave> | null,
    next = freshJourneys();
  if (!s || typeof s !== 'object') return next;
  if (Array.isArray(s.completed))
    for (const c of s.completed) {
      if (
        c &&
        Number.isInteger(c.id) &&
        c.id >= 1 &&
        c.id <= 30 &&
        /^\d{4}-\d{2}-\d{2}$/.test(c.date) &&
        !next.completed.some((x) => x.id === c.id)
      )
        next.completed.push({
          id: c.id,
          date: c.date,
          spoken: Math.min(18, Math.max(0, Number(c.spoken) || 0)),
          recalled: Math.min(18, Math.max(0, Number(c.recalled) || 0)),
        });
    }
  const a = s.active,
    j = cityJourneys.find((j) => j.id === a?.id);
  if (
    a &&
    j &&
    Number.isInteger(a.stop) &&
    a.stop >= 0 &&
    a.stop < 3 &&
    Number.isInteger(a.step) &&
    a.step >= 0 &&
    a.step < 6 &&
    /^\d{4}-\d{2}-\d{2}$/.test(a.date) &&
    Array.isArray(a.queues) &&
    a.queues.length === 3 &&
    a.queues.every(
      (q, i) =>
        Array.isArray(q) &&
        q.length === 3 &&
        new Set(q).size === 3 &&
        q.every((id) => journeyHosts[j.actors[i]].pool.includes(id)),
    )
  ) {
    next.active = {
      id: a.id,
      date: a.date,
      stop: a.stop,
      step: a.step,
      queues: a.queues.map((q) => [...q]),
      spoken: Math.min(18, Math.max(0, Number(a.spoken) || 0)),
      recalled: Math.min(18, Math.max(0, Number(a.recalled) || 0)),
      paused: !!a.paused,
      replay: !!a.replay || next.completed.some((c) => c.id === a.id),
    };
    if (Array.isArray(a.meaningHelp)) {
      const valid = new Set(
        Array.from({ length: 9 }, (_, i) => `${a.id}:${Math.floor(i / 3)}:${3 + (i % 3)}`),
      );
      const helped = [
        ...new Set(a.meaningHelp.filter((cursor) => typeof cursor === 'string' && valid.has(cursor))),
      ];
      if (helped.length) next.active.meaningHelp = helped;
    }
    const challenge = a.challenge;
    if (
      challenge &&
      Array.isArray(challenge.firstRecall) &&
      challenge.firstRecall.length === 3 &&
      challenge.firstRecall.every(
        (q) => Array.isArray(q) && q.length === 3 && q.every((v) => typeof v === 'boolean'),
      ) &&
      Array.isArray(challenge.order) &&
      challenge.order.length === 3 &&
      challenge.order.every(
        (q) =>
          Array.isArray(q) &&
          q.length === 3 &&
          new Set(q).size === 3 &&
          q.every((v) => Number.isInteger(v) && v >= 0 && v < 3),
      )
    ) {
      next.active.challenge = {
        firstRecall: challenge.firstRecall.map((q) => [...q]),
        order: challenge.order.map((q) => [...q]),
      };
    }
  }
  return next;
}
