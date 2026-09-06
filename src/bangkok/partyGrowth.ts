export const levelThresholds = [0, 100, 250, 450, 750, 1100] as const;
export const partyLevel = (xp: number) =>
  levelThresholds.filter((n) => n <= Math.max(0, Number.isFinite(xp) ? xp : 0)).length;
export const talents = [
  {
    id: 'ready',
    name: 'First to Speak',
    owner: 'Patrick',
    level: 2,
    cost: 1,
    description: 'Patrick begins each battle with 4 AP instead of 3.',
  },
  {
    id: 'guiding',
    name: 'A Guiding Voice',
    owner: 'Su',
    level: 2,
    cost: 1,
    description: 'Su begins each battle with 4 AP instead of 3.',
  },
  {
    id: 'unhurried',
    name: 'Take Your Time',
    owner: 'Patrick',
    level: 3,
    cost: 1,
    description: 'Still the River builds 80 break instead of 65.',
  },
  {
    id: 'kindness',
    name: 'Care in Every Word',
    owner: 'Su',
    level: 3,
    cost: 1,
    description: 'Make Amends restores 48 HP, or revives an ally with 34 HP.',
  },
  {
    id: 'harmony',
    name: 'A Shared Tomorrow',
    owner: 'Together',
    level: 4,
    cost: 2,
    description: 'River Duet restores 25 HP to each ally instead of 15.',
  },
  {
    id: 'patience',
    name: 'Listen Before Replying',
    owner: 'Together',
    level: 5,
    cost: 2,
    description: 'The Guard command also builds 10 resonance. Combine patient defense with a River Duet.',
  },
] as const;
export type TalentId = (typeof talents)[number]['id'];
export type PartyGrowth = { level: number; talents: TalentId[] };
export const talentCost = (ids: readonly string[]) =>
  talents.filter((t) => ids.includes(t.id)).reduce((n, t) => n + t.cost, 0);
export function normalizeTalents(value: unknown, level: number): TalentId[] {
  if (!Array.isArray(value)) return [];
  const result: TalentId[] = [];
  for (const id of value) {
    const t = talents.find((t) => t.id === id);
    if (t && t.level <= level && !result.includes(t.id) && talentCost(result) + t.cost <= level - 1)
      result.push(t.id);
  }
  return result;
}
export const partyGrowth = (xp: number, value: unknown): PartyGrowth => {
  const level = partyLevel(xp);
  return { level, talents: normalizeTalents(value, level) };
};
export function talentReason(g: PartyGrowth, id: TalentId): string | null {
  const t = talents.find((t) => t.id === id)!;
  if (!t) return 'Unknown talent';
  if (g.talents.includes(id)) return null;
  if (g.level < t.level) return `Unlocks at party level ${t.level}`;
  if (talentCost(g.talents) + t.cost > g.level - 1)
    return `Needs ${t.cost} free talent point${t.cost === 1 ? '' : 's'}`;
  return null;
}
