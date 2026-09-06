import type { BattleEncounterConfig, ConversationTurn } from '../phantasyBattleDemo';
import { stage3CharacterModelAssetUrl } from '../../components/three/stage3CharacterRig';
import { duelTurn, STORY_HERO } from './builders';

/**
 * Stage 3 social duel — ordering street food becomes a three-round duel vs
 * the vendor: choose a dish, customize it (spice + allergy), place the
 * order. Victory hands Patrick the plate of noodles (`givesItem` on the talk
 * command), then the cook line (water, bill, compliment) stays point-and-click.
 */

const vendorTurns: ConversationTurn[] = [
  duelTurn(
    0,
    {
      id: 'vendor-choose',
      topic: 'Choosing a Dish',
      enemyLine: '"Welcome, welcome! Everything fresh tonight. Which one catches your eye?"',
      simple: {
        name: 'I Want This One',
        thai: 'เอาอันนี้ครับ',
        rom: 'ao an nee khrap',
        en: 'I will take this one.',
        cry: 'Ao an nee khrap!',
      },
      superMove: {
        name: 'What Is This?',
        thai: 'อันนี้คืออะไรครับ',
        rom: 'an nee kheu arai khrap',
        en: 'What is this?',
        cry: 'Kheu arai khrap?',
      },
      counter: {
        thai: 'เอาอันนี้ครับ',
        rom: 'ao an nee khrap',
        en: 'I will take this one.',
        prompt: '"This one? Or this one?" — commit to your dish before the wok cools.',
      },
    },
    'lightning',
  ),
  duelTurn(
    1,
    {
      id: 'vendor-customize',
      topic: 'Spice & Allergies',
      enemyLine: 'He lifts the chili jar with a grin. "Thai spicy? Or tourist spicy?"',
      simple: {
        name: 'Not Spicy',
        thai: 'ไม่เผ็ดครับ',
        rom: 'mai phet khrap',
        en: 'Not spicy, please.',
        cry: 'Mai phet khrap!',
      },
      superMove: {
        name: 'Careful Order',
        thai: 'เผ็ดนิดหน่อยครับ ไม่เอาถั่วครับ',
        rom: 'phet nit noi khrap, mai ao thua khrap',
        en: 'A little spicy — and no peanuts, please.',
        cry: 'Mai ao thua!',
      },
      counter: {
        thai: 'ไม่เผ็ดครับ',
        rom: 'mai phet khrap',
        en: 'Not spicy, please.',
        prompt: 'The chili spoon hovers over your wok. Speak now or eat fire.',
      },
    },
    'fire',
  ),
  duelTurn(
    2,
    {
      id: 'vendor-order',
      topic: 'Placing the Order',
      enemyLine: '"Good choices! How many plates tonight, my friend?"',
      simple: {
        name: 'One Plate',
        thai: 'ขอหนึ่งจานครับ',
        rom: 'kho nueng jaan khrap',
        en: 'One plate, please.',
        cry: 'Nueng jaan khrap!',
      },
      superMove: {
        name: 'The Full Order',
        thai: 'ขอหนึ่งจานครับ ไม่เผ็ดครับ',
        rom: 'kho nueng jaan khrap, mai phet khrap',
        en: 'One plate please — not spicy.',
        cry: 'Kho nueng jaan!',
      },
      counter: {
        thai: 'ขอหนึ่งจานครับ',
        rom: 'kho nueng jaan khrap',
        en: 'One plate, please.',
        prompt: 'The wok flares. "One? Two?" — lock in the order.',
      },
    },
    'fire',
  ),
];

export const vendorOrderEncounter: BattleEncounterConfig = {
  id: 'vendor-order-duel',
  introLine: 'The vendor spins his spatula like a duelist. The night market crowd leans in.',
  fallbackOpener: '"Which dish, my friend?"',
  introHint:
    'Three rounds at the stall: pick a dish, set your spice (and allergies!), and order a plate. Win the vendor over and dinner is yours.',
  enemy: {
    id: 'vendor-duel',
    name: 'Street Food Vendor',
    subtitle: 'Night Market · Order Duel',
    hp: 170,
    maxHp: 170,
    attackName: 'Wok Flare',
    attackFlavor: 'A burst of flame, a faster question, a longer queue behind you.',
    attackPower: 21,
    attackElement: 'fire',
    // The wok heat (and the queue behind you) builds every round — the
    // steepest ramp of the three demo stages. Lock the order in fast and lean
    // on supers/streaks to finish before the flare peaks.
    pressureRamp: 6,
  },
  hero: STORY_HERO,
  persistVitals: true,
  ally: {
    id: 'su',
    name: 'Su',
    subtitle: 'Thai Coach',
  },
  turns: vendorTurns,
  opponentVisual: { modelUrl: stage3CharacterModelAssetUrl, height: 1.74 },
  victoryTitle: 'Order Up',
  victoryDescription:
    'The vendor slides a steaming plate of noodles across the counter — exactly how you asked for it. "Aroi maak, I promise!"',
  defeatDescription:
    'The queue mutters and the wok roars. Su nudges you: "Mai phet — short and falling. Take the round again."',
  softDefeat: true,
  exitLabel: 'Leave',
  bahtReward: 45,
  equipmentReward: 'spoon-saber',
};

// ---------------------------------------------------------------------------
// Bonus encounter — the Rift Echo. A flicker of the rift hangs at the edge of
// the night market and replays Stage 1's phrases back at Patrick: the demo's
// first taste of spaced repetition. Entirely optional, never gates the stage.
// ---------------------------------------------------------------------------

const riftEchoTurns: ConversationTurn[] = [
  duelTurn(
    0,
    {
      id: 'echo-greeting',
      topic: 'Echo · First Contact',
      enemyLine: 'The Echo crackles in Su’s borrowed voice: "Remember the lobby? Greet me."',
      simple: {
        name: 'Polite Hello',
        thai: 'สวัสดีครับ',
        rom: 'sawatdee khrap',
        en: 'Hello.',
        cry: 'Sawatdee khrap!',
      },
      superMove: {
        name: 'Warm Introduction',
        thai: 'สวัสดีครับ ผมชื่อแพทริกครับ',
        rom: 'sawatdee khrap, phom chue Patrick khrap',
        en: 'Hello, my name is Patrick.',
        cry: 'Phom chue Patrick!',
      },
      counter: {
        thai: 'ยินดีที่ได้รู้จักครับ',
        rom: 'yin dee tee dai roo jak khrap',
        en: 'Nice to meet you.',
        prompt: 'The Echo extends a shimmering hand. You know this one.',
      },
    },
    'shadow',
  ),
  duelTurn(
    1,
    {
      id: 'echo-politeness',
      topic: 'Echo · Polite Repair',
      enemyLine: '"Two days in Bangkok already. Has the politeness faded?" It hands you nothing — thank it anyway.',
      simple: {
        name: 'Gratitude',
        thai: 'ขอบคุณครับ',
        rom: 'khop khun khrap',
        en: 'Thank you.',
        cry: 'Khop khun khrap!',
      },
      superMove: {
        name: 'Graceful Apology',
        thai: 'ขอโทษครับ',
        rom: 'kho thot khrap',
        en: 'I am sorry.',
        cry: 'Kho thot khrap…',
      },
      counter: {
        thai: 'ขอบคุณครับ',
        rom: 'khop khun khrap',
        en: 'Thank you.',
        prompt: 'The Echo waits, head tilted, exactly like Su did. Thank it.',
      },
    },
    'shadow',
  ),
  duelTurn(
    2,
    {
      id: 'echo-needs',
      topic: 'Echo · First Needs',
      enemyLine: '"Last memory. The heat, the thirst, the price of water. Say them like day one."',
      simple: {
        name: 'Price Check',
        thai: 'เท่าไหร่ครับ',
        rom: 'thao rai khrap',
        en: 'How much?',
        cry: 'Thao rai khrap?',
      },
      superMove: {
        name: 'Find the Way',
        thai: 'ห้องน้ำอยู่ที่ไหนครับ',
        rom: 'hong nam yoo tee nai khrap',
        en: 'Where is the bathroom?',
        cry: 'Yoo tee nai?',
      },
      counter: {
        thai: 'ผมหิวน้ำครับ',
        rom: 'phom hiw nam khrap',
        en: 'I am thirsty.',
        prompt: 'The Echo mimics wiping sweat from its brow. State the need.',
      },
    },
    'shadow',
  ),
];

export const riftEchoEncounter: BattleEncounterConfig = {
  id: 'rift-echo-review',
  introLine: 'A shard of the rift flickers awake — it has been listening since the lobby.',
  fallbackOpener: '"Repeat the first lesson."',
  introHint:
    'A memory test, not a fight: the Echo replays Stage 1’s phrases. Optional — but every phrase you keep sharp stays yours. (Default Rift Guardian visual: this one really is a rift creature.)',
  enemy: {
    id: 'rift-echo',
    name: 'Rift Echo',
    subtitle: 'Residue of the Bangkok Gate',
    hp: 120,
    maxHp: 120,
    attackName: 'Fading Memory',
    attackFlavor: 'The Echo blurs a phrase you used to know.',
    attackPower: 18,
    attackElement: 'shadow',
    // A gentle review ramp — the Echo presses harder the longer a memory sits
    // unspoken, but it is optional and never gates the stage.
    pressureRamp: 3,
  },
  hero: STORY_HERO,
  persistVitals: true,
  ally: {
    id: 'su',
    name: 'Su',
    subtitle: 'Thai Coach',
  },
  turns: riftEchoTurns,
  victoryTitle: 'Memory Holds',
  victoryDescription:
    'The Echo dissolves into harmless sparks. Su grins: "Day one is still in there. That is how language sticks — you come back for it."',
  defeatDescription: 'The Echo blurs your words back at you. Su: "It is just rust. Shake it off and go again."',
  softDefeat: true,
  exitLabel: 'Leave',
};
