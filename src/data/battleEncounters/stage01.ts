import type { BattleEncounterConfig, ConversationTurn } from '../phantasyBattleDemo';
import { suModelAssetUrl } from '../../components/three/suRig';
import { hotelLobbyGirlModelAssetUrl } from '../../components/three/hotelLobbyGirlRig';
import { bellboyModelAssetUrl } from '../../components/three/bellboyRig';
import { duelTurn, STORY_HERO } from './builders';

/**
 * Stage 1 social-duel encounters — SNES-style turn-based conversations where
 * the NPC themself is the "opponent" and correct Thai wins them over.
 *
 *   su-lobby-sparring   — Su's coaching trial: 5 rounds covering all 10
 *                         Stage 1 phrases. Replaces the scrolling drill.
 *   hostess-check-in    — the apply-it duel vs the front desk hostess.
 *                         Victory completes the stage.
 *
 * Mechanical mapping per round:
 *   simple  = short phrase, modest damage (the "Attack" slot)
 *   super   = longer/combined phrase, big damage + charge (the "Super" slot)
 *   counter = the forced reply when the NPC presses Patrick between rounds
 *   heal    = re-saying the round's phrase slowly restores Confidence —
 *             re-practice IS the healing, which keeps the pedagogy honest
 *   defend  = a clean polite "khrap" braces for the next press
 */

// ---------------------------------------------------------------------------
// Encounter 1 — Su's sparring trial (replaces the 10-phrase scrolling drill)
// ---------------------------------------------------------------------------

const suTrialTurns: ConversationTurn[] = [
  duelTurn(
    0,
    {
      id: 'su-greeting',
      topic: 'First Contact',
      enemyLine: '"Round one, Patrick. Greet me like Bangkok is listening."',
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
        prompt: 'Su offers her hand. Answer with "nice to meet you" to hold your ground.',
      },
    },
    'lightning',
  ),
  duelTurn(
    1,
    {
      id: 'su-polite-repair',
      topic: 'Polite Repair',
      enemyLine: '"I just handed you tea. And — oops — you bumped my bag. Fix both, politely."',
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
        prompt: 'Su hands you the notebook back. Thank her before she lets go.',
      },
    },
    'lightning',
  ),
  duelTurn(
    2,
    {
      id: 'su-yes-no',
      topic: 'Yes & No',
      enemyLine: '"Quick fire: is your name Anand? Answer truthfully — then confirm you are ready."',
      simple: {
        name: 'Clear No',
        thai: 'ไม่ใช่ครับ',
        rom: 'mai chai khrap',
        en: 'No, that is not right.',
        cry: 'Mai chai!',
      },
      superMove: {
        name: 'Confident Yes',
        thai: 'ใช่ครับ ผมชื่อแพทริกครับ',
        rom: 'chai khrap, phom chue Patrick khrap',
        en: 'Yes — my name is Patrick.',
        cry: 'Chai khrap!',
      },
      counter: {
        thai: 'ใช่ครับ',
        rom: 'chai khrap',
        en: 'Yes.',
        prompt: 'Su asks if you are ready to continue. Say yes, politely.',
      },
    },
    'lightning',
  ),
  duelTurn(
    3,
    {
      id: 'su-first-needs',
      topic: 'First Needs',
      enemyLine: '"You are a tourist now. The water costs something and you are lost. Ask."',
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
        thai: 'เท่าไหร่ครับ',
        rom: 'thao rai khrap',
        en: 'How much?',
        prompt: 'Su holds up the water bottle and waits. Ask the price.',
      },
    },
    'fire',
  ),
  duelTurn(
    4,
    {
      id: 'su-thirst-finale',
      topic: 'Final Round',
      enemyLine: '"Last round. The Bangkok heat is real — tell me what you need, then close politely."',
      simple: {
        name: 'State the Need',
        thai: 'ผมหิวน้ำครับ',
        rom: 'phom hiw nam khrap',
        en: 'I am thirsty.',
        cry: 'Phom hiw nam!',
      },
      superMove: {
        name: 'Polite Finisher',
        thai: 'ขอบคุณมากครับ สวัสดีครับ',
        rom: 'khop khun maak khrap, sawatdee khrap',
        en: 'Thank you very much — goodbye.',
        cry: 'Khop khun maak!',
      },
      counter: {
        thai: 'ผมหิวน้ำครับ',
        rom: 'phom hiw nam khrap',
        en: 'I am thirsty.',
        prompt: 'Su raises an eyebrow: "Need something?" Say it before the round ends.',
      },
    },
    'fire',
  ),
];

export const suLobbySparringEncounter: BattleEncounterConfig = {
  id: 'su-lobby-sparring',
  introLine: 'Su squares up in the lobby. "Ten phrases. Five rounds. Impress me."',
  fallbackOpener: '"Greet me properly, Patrick."',
  introHint:
    "A five-round sparring lesson. Each clear phrase chips Su's Composure; longer lines hit harder. If Doubt stacks up, repeat a phrase slowly to recover — Su never lets you truly fall.",
  enemy: {
    id: 'su-sparring',
    name: 'Su',
    subtitle: 'Neon Circuit Princess · Sparring Trial',
    hp: 230,
    maxHp: 230,
    attackName: 'Coach’s Press',
    attackFlavor: 'Su fires a rapid question and waits, arms crossed.',
    attackPower: 22,
    attackElement: 'lightning',
    // Tutorial pace — Su never escalates. She is here to build the habit, not
    // break it, so the very first duel rewards experimenting with the streak.
    pressureRamp: 0,
  },
  hero: STORY_HERO,
  persistVitals: true,
  ally: {
    id: 'notebook',
    name: 'Traveler’s Notebook',
    subtitle: 'Phrase Companion',
  },
  turns: suTrialTurns,
  // Su herself stands at the opponent anchor — and the ally rig hides so she
  // doesn't appear on both sides of the field.
  opponentVisual: { modelUrl: suModelAssetUrl, height: 1.7 },
  hideAllyRig: true,
  victoryTitle: 'Trial Passed',
  victoryDescription:
    'Su drops her sparring stance and bows. "All ten phrases. The hostess at the desk is waiting — go use them for real."',
  defeatDescription: 'Doubt crowds in. Su softens: "Breathe. We pick up exactly where you wavered."',
  softDefeat: true,
  exitLabel: 'Leave',
  bahtReward: 30,
  equipmentReward: 'traveler-notebook',
};

// ---------------------------------------------------------------------------
// Encounter 2 — Front desk hostess: the apply-it duel. Completes the stage.
// ---------------------------------------------------------------------------

const hostessTurns: ConversationTurn[] = [
  duelTurn(
    0,
    {
      id: 'hostess-greeting',
      topic: 'The Greeting',
      enemyLine: '"Sawatdee kha! Welcome to the Chao Phraya Star." She waits, pen poised.',
      simple: {
        name: 'Polite Hello',
        thai: 'สวัสดีครับ',
        rom: 'sawatdee khrap',
        en: 'Hello.',
        cry: 'Sawatdee khrap!',
      },
      superMove: {
        name: 'Full Introduction',
        thai: 'สวัสดีครับ ผมชื่อแพทริกครับ',
        rom: 'sawatdee khrap, phom chue Patrick khrap',
        en: 'Hello, my name is Patrick.',
        cry: 'Phom chue Patrick!',
      },
      counter: {
        thai: 'ยินดีที่ได้รู้จักครับ',
        rom: 'yin dee tee dai roo jak khrap',
        en: 'Nice to meet you.',
        prompt: '"And you are…?" — answer with a polite nice-to-meet-you.',
      },
    },
    'wind',
  ),
  duelTurn(
    1,
    {
      id: 'hostess-water',
      topic: 'The Water Bottle',
      enemyLine: '"You look parched from the rift. Bottled water is on the counter — ask me about it."',
      simple: {
        name: 'Price Check',
        thai: 'เท่าไหร่ครับ',
        rom: 'thao rai khrap',
        en: 'How much?',
        cry: 'Thao rai khrap?',
      },
      superMove: {
        name: 'Thirst + Price',
        thai: 'ผมหิวน้ำครับ เท่าไหร่ครับ',
        rom: 'phom hiw nam khrap, thao rai khrap',
        en: 'I am thirsty — how much is it?',
        cry: 'Phom hiw nam!',
      },
      counter: {
        thai: 'ใช่ครับ',
        rom: 'chai khrap',
        en: 'Yes.',
        prompt: '"The cold one, yes?" — confirm politely.',
      },
    },
    'wind',
  ),
  duelTurn(
    2,
    {
      id: 'hostess-closing',
      topic: 'The Promise',
      enemyLine:
        '"Here is your water — and your room is held for tomorrow." She slides a reservation slip halfway across.',
      simple: {
        name: 'Gratitude',
        thai: 'ขอบคุณครับ',
        rom: 'khop khun khrap',
        en: 'Thank you.',
        cry: 'Khop khun khrap!',
      },
      superMove: {
        name: 'Gracious Close',
        thai: 'ขอบคุณมากครับ สวัสดีครับ',
        rom: 'khop khun maak khrap, sawatdee khrap',
        en: 'Thank you very much — goodbye.',
        cry: 'Khop khun maak!',
      },
      counter: {
        thai: 'ขอบคุณครับ',
        rom: 'khop khun khrap',
        en: 'Thank you.',
        prompt: 'She holds the slip one beat longer. Thank her to receive it.',
      },
    },
    'holy',
  ),
];

export const hostessCheckInEncounter: BattleEncounterConfig = {
  id: 'hostess-check-in',
  introLine: 'The hostess straightens behind the marble counter. The real test begins.',
  fallbackOpener: '"Sawatdee kha. Your greeting, please."',
  introHint:
    'Three rounds, no coach. Use what Su taught you: greet, ask, and thank — clearly enough to win the hostess over and claim your keycard.',
  enemy: {
    id: 'hostess-duel',
    name: 'Front Desk Hostess',
    subtitle: 'Azure Vanguard · Check-In Duel',
    hp: 140,
    maxHp: 140,
    attackName: 'Polite Press',
    attackFlavor: 'A perfectly courteous question that demands a real answer.',
    attackPower: 18,
    attackElement: 'wind',
    // The apply-it test nudges the pace up gently — enough that the player
    // feels real-counter pressure, not enough to punish a first graduate.
    pressureRamp: 3,
  },
  hero: STORY_HERO,
  persistVitals: true,
  ally: {
    id: 'su',
    name: 'Su',
    subtitle: 'Thai Coach',
  },
  turns: hostessTurns,
  opponentVisual: { modelUrl: hotelLobbyGirlModelAssetUrl, height: 1.66 },
  victoryTitle: 'Room Reserved',
  victoryDescription:
    'The hostess wais gracefully and slides the slip the rest of the way. "Your room is held, khun Patrick. Registration finishes in the morning — bring your wallet and passport to the front desk." Beyond the glass, Bangkok glitters.',
  defeatDescription:
    'The words tangle. Su appears at your shoulder: "Slow down. Take the round again — she is rooting for you."',
  softDefeat: true,
  exitLabel: 'Leave',
  bahtReward: 40,
  equipmentReward: 'wai-of-clarity',
};

// ---------------------------------------------------------------------------
// Side quest — the lost-phrasebook tourist. One friendly round: teach him the
// hello Su just taught you. Optional; rewards the Lucky Charm + pocket money.
// ---------------------------------------------------------------------------

const touristTurns: ConversationTurn[] = [
  duelTurn(
    0,
    {
      id: 'tourist-hello-lesson',
      topic: 'Pay It Forward',
      enemyLine: '"You found it! Oh thank goodness. Wait — you LEARNED some Thai? Teach me the hello!"',
      simple: {
        name: 'Polite Hello',
        thai: 'สวัสดีครับ',
        rom: 'sawatdee khrap',
        en: 'Hello.',
        cry: 'Sawatdee khrap!',
      },
      superMove: {
        name: 'Hello + Introduction',
        thai: 'สวัสดีครับ ผมชื่อแพทริกครับ',
        rom: 'sawatdee khrap, phom chue Patrick khrap',
        en: 'Hello, my name is Patrick.',
        cry: 'Phom chue Patrick!',
      },
      counter: {
        thai: 'ยินดีที่ได้รู้จักครับ',
        rom: 'yin dee tee dai roo jak khrap',
        en: 'Nice to meet you.',
        prompt: 'He tries a wobbly "sawatdee" back and sticks his hand out. Finish the exchange.',
      },
    },
    'holy',
  ),
];

export const touristFriendlyDuel: BattleEncounterConfig = {
  id: 'tourist-friendly-duel',
  introLine: 'The grateful tourist clutches his phrasebook and squares up — to learn, not to fight.',
  fallbackOpener: '"Teach me the hello!"',
  introHint:
    'A friendly single round: say the greeting clearly enough that he can copy it. Teaching a phrase is the best way to keep it.',
  enemy: {
    id: 'lost-tourist',
    name: 'Lost Tourist',
    subtitle: 'First Day in Bangkok',
    hp: 60,
    maxHp: 60,
    attackName: 'Panicked English',
    attackFlavor: 'A burst of very fast, very lost English.',
    attackPower: 10,
    attackElement: 'wind',
  },
  hero: STORY_HERO,
  persistVitals: true,
  ally: {
    id: 'su',
    name: 'Su',
    subtitle: 'Thai Coach',
  },
  turns: touristTurns,
  opponentVisual: { modelUrl: bellboyModelAssetUrl, height: 1.76 },
  victoryTitle: 'Quest Complete',
  victoryDescription:
    'The tourist repeats "sawatdee khrap" — shaky, but real. He presses a small charm into your hand. "For luck. You are good at this!"',
  defeatDescription: 'He panics harder. Su chuckles: "Slower. Teachers breathe first."',
  softDefeat: true,
  exitLabel: 'Leave',
  bahtReward: 25,
  equipmentReward: 'lucky-charm',
};
