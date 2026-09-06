import type { BattleEncounterConfig, ConversationTurn } from '../phantasyBattleDemo';
import { hotelLobbyGirlModelAssetUrl } from '../../components/three/hotelLobbyGirlRig';
import { duelTurn, STORY_HERO } from './builders';

/**
 * Stage 2 social duel — the front-desk check-in becomes a four-round
 * conversation battle vs the hostess. Victory marks the existing
 * 'frontDeskCheckIn' conversation complete, which is what gates the
 * reservation paper and keycard pickups, so the stage flow is unchanged.
 */

const clerkTurns: ConversationTurn[] = [
  duelTurn(
    0,
    {
      id: 'clerk-booking',
      topic: 'The Booking',
      enemyLine: '"Sawatdee kha! Do you have a reservation with us tonight?"',
      simple: {
        name: 'I Booked Ahead',
        thai: 'จองไว้ครับ',
        rom: 'jong wai khrap',
        en: 'I have a reservation.',
        cry: 'Jong wai khrap!',
      },
      superMove: {
        name: 'Booking + Name',
        thai: 'จองไว้ครับ ชื่อแพทริกครับ',
        rom: 'jong wai khrap, chue Patrick khrap',
        en: 'I have a reservation — the name is Patrick.',
        cry: 'Chue Patrick khrap!',
      },
      counter: {
        thai: 'ชื่อแพทริกครับ',
        rom: 'chue Patrick khrap',
        en: 'The name is Patrick.',
        prompt: '"Under what name, kha?" — give your name before she scrolls past it.',
      },
    },
    'wind',
  ),
  duelTurn(
    1,
    {
      id: 'clerk-check-in',
      topic: 'The Check-In',
      enemyLine: '"Found you! Shall we begin?" Her fingers hover over the keyboard.',
      simple: {
        name: 'Check In, Please',
        thai: 'ขอเช็กอินครับ',
        rom: 'kho check in khrap',
        en: 'I would like to check in.',
        cry: 'Kho check in khrap!',
      },
      superMove: {
        name: 'Which Floor?',
        thai: 'ห้องผมอยู่ชั้นไหนครับ',
        rom: 'hong phom yoo chan nai khrap',
        en: 'Which floor is my room on?',
        cry: 'Chan nai khrap?',
      },
      counter: {
        thai: 'เข้าใจแล้วครับ',
        rom: 'khao jai laeo khrap',
        en: 'I understand now.',
        prompt: 'She explains the breakfast hours. Show her it landed.',
      },
    },
    'wind',
  ),
  duelTurn(
    2,
    {
      id: 'clerk-find-way',
      topic: 'Finding the Way',
      enemyLine: '"Room 1106. Now — can you find it from here?" A tiny test in her smile.',
      simple: {
        name: 'Key Question',
        thai: 'กุญแจอยู่ที่ไหนครับ',
        rom: 'gun jae yoo tee nai khrap',
        en: 'Where is the key?',
        cry: 'Yoo tee nai khrap?',
      },
      superMove: {
        name: 'Elevator Question',
        thai: 'ลิฟต์อยู่ที่ไหนครับ',
        rom: 'lift yoo tee nai khrap',
        en: 'Where is the elevator?',
        cry: 'Lift yoo tee nai?',
      },
      counter: {
        thai: 'เข้าใจแล้วครับ',
        rom: 'khao jai laeo khrap',
        en: 'I understand now.',
        prompt: '"Past the columns, then left, kha." Confirm you followed.',
      },
    },
    'fire',
  ),
  duelTurn(
    3,
    {
      id: 'clerk-too-fast',
      topic: 'When Thai Gets Fast',
      enemyLine: 'She rattles off the spa hours in rapid Thai — far too fast. A real Bangkok moment.',
      simple: {
        name: 'Slow Down, Please',
        thai: 'ช่วยพูดช้าลงหน่อยครับ',
        rom: 'chuai phuut chaa long noi khrap',
        en: 'Please speak more slowly.',
        cry: 'Chaa long noi khrap…',
      },
      superMove: {
        name: 'Once More, Please',
        thai: 'พูดอีกครั้งได้ไหมครับ',
        rom: 'phuut eek khrang dai mai khrap',
        en: 'Can you say that again?',
        cry: 'Eek khrang dai mai?',
      },
      counter: {
        thai: 'เข้าใจแล้วครับ',
        rom: 'khao jai laeo khrap',
        en: 'I understand now.',
        prompt: 'She repeats it slowly, syllable by syllable. Close the loop.',
      },
    },
    'fire',
  ),
];

export const clerkCheckInEncounter: BattleEncounterConfig = {
  id: 'clerk-check-in-duel',
  introLine: 'The hostess straightens her name pin. Check-in is a conversation — win it.',
  fallbackOpener: '"Do you have a reservation, kha?"',
  introHint:
    'Four rounds of real hotel Thai: the booking, the check-in, finding your way, and surviving fast Thai. Win her over and the paperwork is yours.',
  enemy: {
    id: 'clerk-duel',
    name: 'Front Desk Hostess',
    subtitle: 'Chao Phraya Star · Check-In',
    hp: 190,
    maxHp: 190,
    attackName: 'Rapid Thai',
    attackFlavor: 'A perfectly polite stream of Thai, twice the speed you wanted.',
    attackPower: 20,
    attackElement: 'wind',
    // Signature mechanic: the clerk speaks faster every round. Late rounds hit
    // hard unless the player buys time — "Polite Stance" (guard) or the
    // round-4 "speak slowly" repair phrase is the intended answer to the ramp.
    pressureRamp: 5,
  },
  hero: STORY_HERO,
  persistVitals: true,
  ally: {
    id: 'su',
    name: 'Su',
    subtitle: 'Thai Coach',
  },
  turns: clerkTurns,
  opponentVisual: { modelUrl: hotelLobbyGirlModelAssetUrl, height: 1.66 },
  victoryTitle: 'Check-In Complete',
  victoryDescription:
    'The hostess beams and taps the desk twice. "Reservation paper and keycard, ready for you." Take them from the counter.',
  defeatDescription:
    'The Thai blurs together. Su leans in: "Breathe. Ask her to slow down — that phrase is your shield here."',
  softDefeat: true,
  exitLabel: 'Leave',
  bahtReward: 40,
  equipmentReward: 'keycard-buckler',
};
