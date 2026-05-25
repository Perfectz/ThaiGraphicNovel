/**
 * Data for the standalone Phantasy Star 4-style battle demo.
 *
 * Each Thai phrase is reframed as an RPG "Technique" with a named element,
 * MP cost, and base power. Conversation prompts fire between turns so the
 * fight stays narrative — every encounter alternates command → VFX → reply.
 */

export type BattleElement = 'slash' | 'fire' | 'ice' | 'lightning' | 'holy' | 'wind' | 'shadow';

export type DemoTechnique = {
  id: string;
  /** Phantasy Star 4-style short technique name (Foi, Tsu, Nasar, etc.). */
  name: string;
  /** Thai phrase rendered in Thai script. */
  thai: string;
  romanization: string;
  translation: string;
  element: BattleElement;
  /** Base damage before variance. Healing techniques use this as restore amount. */
  power: number;
  mpCost: number;
  description: string;
  /** Flavor line the hero shouts when the technique fires. */
  battleCry: string;
  isHeal?: boolean;
  /** Optional secondary effect: stuns enemy / boosts hero next turn. */
  effect?: 'stun' | 'guard' | 'charge';
};

export const demoTechniques: DemoTechnique[] = [
  {
    id: 'sawatdee-spark',
    name: 'Sawàt-dī Spark',
    thai: 'สวัสดี',
    romanization: 'sa-wàt-dee',
    translation: 'Hello / a polite greeting',
    element: 'lightning',
    power: 38,
    mpCost: 6,
    description: 'Disarms the foe with formal courtesy. A crackling courtesy bolt.',
    battleCry: 'Sawàt-dī!',
  },
  {
    id: 'khopkhun-blade',
    name: 'Khàwp Khun Blade',
    thai: 'ขอบคุณ',
    romanization: 'khàwp kun',
    translation: 'Thank you',
    element: 'slash',
    power: 46,
    mpCost: 8,
    description: 'Gratitude cuts cleanly through resentment in one shining arc.',
    battleCry: 'Khàwp khun khráp!',
  },
  {
    id: 'phom-pyre',
    name: 'Phǒm Pyre',
    thai: 'ผม',
    romanization: 'phǒm',
    translation: '"I / me" (male speaker)',
    element: 'fire',
    power: 54,
    mpCost: 12,
    description: 'Claim your name. The room ignites.',
    battleCry: 'Phǒm chêu…!',
  },
  {
    id: 'mai-pen-rai-veil',
    name: 'Mâi Pen Rai Veil',
    thai: 'ไม่เป็นไร',
    romanization: 'mâi pen rai',
    translation: "It's nothing / never mind",
    element: 'wind',
    power: 22,
    mpCost: 4,
    description: 'A calm wind blunts the next enemy attack. Stuns briefly.',
    battleCry: 'Mâi pen rai!',
    effect: 'stun',
  },
  {
    id: 'aroi-inferno',
    name: 'Aròi Inferno',
    thai: 'อร่อย',
    romanization: 'a-ròi',
    translation: 'Delicious!',
    element: 'fire',
    power: 78,
    mpCost: 20,
    description: 'Pure delight detonates. Signature high-damage Technique.',
    battleCry: 'Aròi mâak!',
  },
  {
    id: 'sabai-aura',
    name: 'Sabai Sabai Aura',
    thai: 'สบาย สบาย',
    romanization: 'sa-baai sa-baai',
    translation: 'Easygoing / chill',
    element: 'holy',
    power: 70,
    mpCost: 14,
    description: 'Restores 70 HP — the famed Thai calm washes over you.',
    battleCry: 'Sabai sabai…',
    isHeal: true,
  },
  {
    id: 'chai-strike',
    name: 'Châi Strike',
    thai: 'ใช่',
    romanization: 'châi',
    translation: 'Yes / that is right',
    element: 'shadow',
    power: 42,
    mpCost: 7,
    description: 'Affirmation cracks the doubt-armor of the Wraith.',
    battleCry: 'Châi!',
  },
  {
    id: 'nam-cha-frost',
    name: 'Nám-chaa Frost',
    thai: 'น้ำชา',
    romanization: 'náam chaa',
    translation: 'Tea (literally "tea-water")',
    element: 'ice',
    power: 48,
    mpCost: 10,
    description: "A frigid teapot spirit. Cools the air and the enemy's tempo.",
    battleCry: 'Náam-chaa!',
    effect: 'guard',
  },
];

export type ConversationChoice = {
  id: string;
  label: string;
  /** Short outcome line shown after the player picks this choice. */
  outcome: string;
  /** Mechanical effect of the choice. */
  effect:
    | { kind: 'damage'; amount: number }
    | { kind: 'heal'; amount: number }
    | { kind: 'buff'; nextAttackMultiplier: number }
    | { kind: 'mp'; amount: number }
    | { kind: 'stun' };
  tone: 'accent' | 'jade' | 'ember';
};

export type ConversationPrompt = {
  id: string;
  /** Set up by the enemy in PS4-style "the enemy speaks" beat. */
  enemyLine: string;
  /** What the hero is being asked to do. */
  promptLabel: string;
  choices: ConversationChoice[];
};

export const demoConversationPrompts: ConversationPrompt[] = [
  {
    id: 'open-greeting',
    enemyLine: '"Foreign tongue! You cannot even greet me properly."',
    promptLabel: 'Su urges you to respond:',
    choices: [
      {
        id: 'polite',
        label: 'Bow and say "Sawàt-dī khráp" politely.',
        outcome: 'The Guardian flinches at the proper tone. It loses footing.',
        effect: { kind: 'damage', amount: 18 },
        tone: 'jade',
      },
      {
        id: 'silent',
        label: 'Stay silent. Read its rhythm.',
        outcome: 'You map its tempo. Your next Technique strikes 50% harder.',
        effect: { kind: 'buff', nextAttackMultiplier: 1.5 },
        tone: 'accent',
      },
      {
        id: 'taunt',
        label: 'Snap back in English — "Whatever, ghost."',
        outcome: 'It cackles. You lose composure. -16 HP.',
        effect: { kind: 'heal', amount: -16 },
        tone: 'ember',
      },
    ],
  },
  {
    id: 'mid-battle-bargain',
    enemyLine: '"Tell me your name, traveler — perhaps I will spare you."',
    promptLabel: 'Su nods: declare yourself.',
    choices: [
      {
        id: 'name-correctly',
        label: 'Answer: "Phǒm chêu… traveler from the Rift."',
        outcome: 'Claiming your name fortifies you. +12 MP.',
        effect: { kind: 'mp', amount: 12 },
        tone: 'accent',
      },
      {
        id: 'mai-pen-rai',
        label: 'Wave it off — "Mâi pen rai."',
        outcome: 'A breeze of indifference stuns the Guardian for a turn.',
        effect: { kind: 'stun' },
        tone: 'jade',
      },
      {
        id: 'shout',
        label: 'Shout your name in English at the top of your lungs.',
        outcome: 'Bad form. The Guardian counters. -22 HP.',
        effect: { kind: 'heal', amount: -22 },
        tone: 'ember',
      },
    ],
  },
  {
    id: 'almost-defeated',
    enemyLine: '"My form weakens… but yours fades faster, traveler!"',
    promptLabel: 'Choose your finishing posture:',
    choices: [
      {
        id: 'gratitude',
        label: 'Thank Su: "Khàwp khun khráp."',
        outcome: 'Su channels her courage to you. +28 HP, +8 MP.',
        effect: { kind: 'heal', amount: 28 },
        tone: 'jade',
      },
      {
        id: 'taste',
        label: 'Lick your lips: "Aròi…"',
        outcome: 'Hunger for victory burns. Next Technique strikes twice as hard.',
        effect: { kind: 'buff', nextAttackMultiplier: 2 },
        tone: 'accent',
      },
      {
        id: 'doubt',
        label: 'Doubt yourself silently.',
        outcome: "Doubt is the Guardian's domain. -18 HP.",
        effect: { kind: 'heal', amount: -18 },
        tone: 'ember',
      },
    ],
  },
];

export type DemoEnemy = {
  id: string;
  name: string;
  subtitle: string;
  hp: number;
  maxHp: number;
  attackName: string;
  attackFlavor: string;
  attackPower: number;
  /** Element of the enemy's signature attack — used for VFX color. */
  attackElement: BattleElement;
};

export const demoEnemy: DemoEnemy = {
  id: 'rift-guardian',
  name: 'Rift Guardian',
  subtitle: 'Warden of the Bangkok Gate',
  hp: 320,
  maxHp: 320,
  attackName: 'Rift Pulse',
  attackFlavor: 'A wave of fractured language slams into you.',
  attackPower: 26,
  attackElement: 'shadow',
};

export const demoHero = {
  id: 'patrick',
  name: 'Patrick',
  subtitle: 'Rift Traveler',
  hp: 180,
  maxHp: 180,
  mp: 60,
  maxMp: 60,
};

export const demoAlly = {
  id: 'su',
  name: 'Su',
  subtitle: 'Bangkok Guide',
};
