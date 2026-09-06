import type { ConversationTurn, DemoTechnique } from './phantasyBattleDemo';

export type SupportSkillId = 'listen' | 'coach';
export type InventoryItemId = 'phrase-card' | 'confidence-drink' | 'focus-tea' | 'lucky-amulet';
export type BattleMenuPane = 'root' | 'attack' | 'magic' | 'skills' | 'items';
export type BattleInventory = Record<InventoryItemId, number>;

export type InventoryItemDefinition = {
  id: InventoryItemId;
  label: string;
  hint: string;
  detail: string;
};

export const INITIAL_BATTLE_INVENTORY: BattleInventory = {
  'phrase-card': 2,
  'confidence-drink': 1,
  'focus-tea': 1,
  'lucky-amulet': 1,
};

export const BATTLE_ITEMS: InventoryItemDefinition[] = [
  {
    id: 'phrase-card',
    label: 'Phrase Card',
    hint: 'Reveal phrase',
    detail: 'Shows one useful Thai phrase.',
  },
  {
    id: 'confidence-drink',
    label: 'Confidence Drink',
    hint: 'Restore Confidence',
    detail: 'Recovers from social pressure.',
  },
  {
    id: 'focus-tea',
    label: 'Focus Tea',
    hint: 'Restore Focus',
    detail: 'Refreshes spell and speech energy.',
  },
  {
    id: 'lucky-amulet',
    label: 'Lucky Amulet',
    hint: 'Prevent one mistake',
    detail: 'Blocks the next awkward hit.',
  },
];

/**
 * The command menu surfaces the round's *authored* techniques directly, so the
 * player practices the real lesson phrases (greet, ask price, say "not spicy")
 * instead of generic off-lesson filler. Each ConversationTurn already ships
 * five hand-written moves; the panes simply route them:
 *
 *   Attack  → simple (the round's core phrase) + a safe repeat of the forced
 *             reply. No Focus cost, builds the combo streak, restores a little
 *             Focus so the basic loop is always sustainable.
 *   Magic   → super (the longer/stronger authored line), heal (slow repetition
 *             to recover Confidence) and defend (a polite stance that guards).
 *   Skills  → Su support (Listen / Coach) — unchanged.
 */

export function getAttackOptions(turn: ConversationTurn): DemoTechnique[] {
  return [
    // The headline phrase for this round — the thing the NPC is actually
    // waiting to hear. Tagged 'attack' so it restores a little Focus.
    { ...turn.simple, menuRole: 'attack' },
    // A safe repeat of the forced reply: reliable progress when the player
    // wants the lowest-risk option. Same lesson phrase, framed defensively.
    {
      ...turn.counter,
      id: `${turn.counter.id}-safe`,
      name: 'Safe Repeat',
      description: 'Repeat the answer the NPC is listening for. Reliable, low risk.',
      element: turn.simple.element,
      kind: 'standard',
      menuRole: 'attack',
    },
  ];
}

export function getMagicOptions(turn: ConversationTurn): DemoTechnique[] {
  // Surface the authored strong/support trio. Their `kind` (super/heal/defend)
  // is what the battle reducer branches on, so each behaves correctly: the
  // super deals big damage and builds charge, the heal restores Confidence,
  // the defend raises Guard.
  return [turn.super, turn.heal, turn.defend];
}

export function rapportGainFor(technique: DemoTechnique, score: number) {
  switch (technique.menuRole) {
    case 'attack':
      return 5 + Math.round(score / 25);
    case 'ask':
      return 10 + Math.round(score / 20);
    case 'compliment':
      return 16 + Math.round(score / 12);
    case 'tease':
      return 20 + Math.round(score / 10);
    default:
      return technique.kind === 'super' ? 10 : 6;
  }
}

export function focusRestoreFor(technique: DemoTechnique) {
  return technique.menuRole === 'attack' ? 5 : 0;
}

export function hasConversationObjectivesComplete(turnIndex: number, totalTurns: number) {
  return turnIndex >= totalTurns - 1;
}
