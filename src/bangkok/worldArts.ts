import type { Move } from './expeditionCombat.ts';

/** Abilities earned by resolving neighbourhood stories, not by a pronunciation score. */
export const worldArts: (Move & { unlock: string; quest: 'canal' | 'archive'; source: string })[] = [
  {
    id: 'shelter',
    name: 'Lantern Shelter',
    owner: 'su',
    phrase: 'thank-you',
    cost: 2,
    target: 'ally',
    effect: 'Guard an ally · grant 1 AP',
    detail:
      'Carry your neighbours’ kindness into battle. Reduce an ally’s incoming damage by 70% until their next turn, and give them 1 AP. Use Su’s turn to protect Patrick before a heavy attack.',
    unlock: 'canal-restored',
    quest: 'canal',
    source: 'A Light for Late Walkers',
  },
  {
    id: 'open-book',
    name: 'An Open Book',
    owner: 'patrick',
    phrase: 'may-see-document',
    cost: 3,
    target: 'foe',
    effect: '12 damage · 10 break · expose and weaken',
    detail:
      'Ask to examine what was hidden. Expose a foe for the next damaging word and halve its next attack. Set up Su’s reply while preparing for the enemy turn.',
    unlock: 'archive-complete',
    quest: 'archive',
    source: 'The House of Returning Maps',
  },
];
export const earnedWorldArts = (flags: readonly string[]) =>
  worldArts.filter((a) => flags.includes(a.unlock)).map((a) => a.id);
export const normalizeWorldArts = (ids: readonly string[]) =>
  worldArts.filter((a) => ids.includes(a.id)).map((a) => a.id);
