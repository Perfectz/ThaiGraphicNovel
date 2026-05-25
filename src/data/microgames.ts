/**
 * WarioWare-style Thai microgame configs for Stages 1-3.
 *
 * Each config is a tiny, self-contained Thai-language challenge that resolves in
 * 3-8 seconds. The MicrogameRunner picks them up by id, looks up the matching
 * mechanic component, and renders the in-game UI. Configs MUST stay declarative
 * — no React, no DOM logic — so the data file can be tested and extended
 * without pulling in render-time concerns.
 *
 * Phrase data is intentionally hand-mirrored from src/data/lessonScenarios.ts
 * so the microgames teach the *same* vocabulary the campaign teaches. When the
 * lesson data changes, update the matching microgame entry below — the two
 * sources are loosely coupled on purpose so a stage rewrite doesn't cascade
 * into broken microgames.
 */

export type Stage = 1 | 2 | 3;

/**
 * Discriminant for the renderer. Every microgame references one mechanic, and
 * the runner has a 1:1 mapping from this string to a React component in
 * src/components/microgames/mechanics. Adding a mechanic = add a string here
 * + add a component + wire it up in MicrogameRunner's MECHANIC_MAP.
 */
export type MicrogameMechanic =
  | 'choice' // Multiple-choice phrase picker. Most flexible / most reusable.
  | 'addPolite' // Tap "khrap" (or distractors) to politeify a phrase.
  | 'tapBeat' // Tap each syllable as its marker lights up.
  | 'stackOrder' // Tap chunks in the right left-to-right conversational order.
  | 'spiceStop' // Stop a moving meter inside a labeled zone.
  | 'peanutSwipe' // Swipe peanuts away from a dish before they hit.
  | 'pointOrder'; // Tap the dish, then pick the order phrase.

/**
 * A single multiple-choice option. `correct: true` marks the right answer. The
 * mechanic component is responsible for shuffling these — never trust array
 * order to pick the answer at runtime.
 */
export type ChoiceOption = {
  /** Romanized Thai (the player reads / hears this). */
  roman: string;
  /** Thai script when it renders cleanly. Optional — not every choice needs it. */
  thai?: string;
  /** Short English meaning. Shown small below the roman or as a tooltip. */
  meaning?: string;
  correct?: boolean;
};

/**
 * Shared shape for every microgame. The `mechanic`-specific extras live in
 * `payload` so the data type stays narrow at the top level. Each mechanic
 * component knows the shape of its own payload.
 */
export type MicrogameConfig = {
  id: string;
  stage: Stage;
  /** Short title shown on the start card. */
  title: string;
  /** The one big command displayed on screen, WarioWare-style. */
  command: string;
  /** One sentence telling the player what skill this teaches. */
  skill: string;
  /** Total play time in ms. Excludes the brief intro card. */
  durationMs: number;
  mechanic: MicrogameMechanic;
  /** Mechanic-specific data — see per-mechanic typedefs below. */
  payload: MicrogamePayload;
};

export type ChoicePayload = {
  /** Prompt phrase / situation shown above the choices. */
  prompt: string;
  /** Optional subtitle giving English context. */
  promptHint?: string;
  /** Optional Thai script of the prompt phrase. */
  promptThai?: string;
  options: ChoiceOption[];
};

export type AddPolitePayload = {
  /** Phrase missing its polite ending — shown with a blank slot at the end. */
  phraseStem: string;
  /** English meaning of the full politeified phrase. */
  meaning: string;
  /** Thai script of the full politeified phrase (no blanks). */
  fullThai?: string;
  /** Token options. Exactly one must have correct=true. */
  options: ChoiceOption[];
};

export type TapBeatPayload = {
  /** Romanized syllables, in order. e.g. ["sa","wat","dee","khrap"]. */
  syllables: string[];
  /** Full Thai script (shown above for context). */
  thai?: string;
  /** Meaning shown small. */
  meaning: string;
  /**
   * Hit window in ms around each beat. Defaults to 380ms. Smaller = harder.
   * Don't go below 280ms — feels unfair on touch.
   */
  hitWindowMs?: number;
  /** Time between syllable beats, in ms. Defaults to 700ms. */
  beatGapMs?: number;
};

export type StackOrderPayload = {
  /** Chunks in correct order. Mechanic shuffles before showing. */
  chunks: Array<{ roman: string; meaning: string; thai?: string }>;
};

export type SpiceStopPayload = {
  prompt: string;
  /** Bands the cursor sweeps across, left → right. One band is the target. */
  bands: Array<{
    roman: string;
    label: string; // e.g. "MILD", "FIRE"
    correct?: boolean;
  }>;
  /** ms for the cursor to sweep across the full meter once. */
  sweepMs?: number;
};

export type PeanutSwipePayload = {
  /** Phrase the player would say to refuse peanuts (shown after success). */
  roman: string;
  thai?: string;
  meaning: string;
  /** Number of peanuts that fall and must be swiped. */
  peanutCount?: number;
  /** Phrase choice shown as an alternative finisher (text button). */
  textFinisher?: ChoiceOption;
};

export type PointOrderPayload = {
  /** The dish to point at. */
  dishLabel: string;
  /** Dish emoji or symbol — kept lightweight so we don't add image assets. */
  dishGlyph: string;
  /** Phrase choices. Player taps dish first, then picks the order phrase. */
  options: ChoiceOption[];
};

export type MicrogamePayload =
  | ChoicePayload
  | AddPolitePayload
  | TapBeatPayload
  | StackOrderPayload
  | SpiceStopPayload
  | PeanutSwipePayload
  | PointOrderPayload;

// ─────────────────────────────────────────────────────────────────────────────
//   STAGE 1 — Hotel Lobby Basics
// ─────────────────────────────────────────────────────────────────────────────

const stageOneMicrogames: MicrogameConfig[] = [
  {
    id: 's1-add-khrap',
    stage: 1,
    title: 'Add Khrap!',
    command: 'Make it polite!',
    skill: 'Polite male ending "khrap" attaches to the end of almost any phrase.',
    durationMs: 5500,
    mechanic: 'addPolite',
    payload: {
      phraseStem: 'sawatdee ___',
      meaning: 'Hello (polite)',
      fullThai: 'สวัสดีครับ',
      options: [
        { roman: 'khrap', thai: 'ครับ', correct: true },
        { roman: 'khap', thai: 'คับ' },
        { roman: 'kha', thai: 'ค่ะ' },
        { roman: 'mai', thai: 'ไม่' },
      ],
    } satisfies AddPolitePayload,
  },
  {
    id: 's1-tap-the-beat',
    stage: 1,
    title: 'Tap The Beat!',
    command: 'Tap the syllables!',
    skill: 'Thai phrases have a steady syllable beat. Hit each one on time.',
    durationMs: 5800,
    mechanic: 'tapBeat',
    payload: {
      syllables: ['sa', 'wat', 'dee', 'khrap'],
      thai: 'สวัสดีครับ',
      meaning: 'Hello',
      beatGapMs: 650,
      hitWindowMs: 420,
    } satisfies TapBeatPayload,
  },
  {
    id: 's1-match-meaning',
    stage: 1,
    title: 'Match Meaning!',
    command: 'Pick the meaning!',
    skill: 'Recognize an apology / repair phrase by ear.',
    durationMs: 5000,
    mechanic: 'choice',
    payload: {
      prompt: 'kho thot khrap',
      promptThai: 'ขอโทษครับ',
      promptHint: 'Tap the English meaning.',
      options: [
        { roman: 'Sorry / excuse me', correct: true },
        { roman: 'Thank you' },
        { roman: 'Hello' },
        { roman: 'How much?' },
      ],
    } satisfies ChoicePayload,
  },
  {
    id: 's1-yes-or-no',
    stage: 1,
    title: 'Yes Or No!',
    command: 'Answer fast!',
    skill: 'Polite confirmation "chai khrap" vs negation "mai chai khrap".',
    durationMs: 4000,
    mechanic: 'choice',
    payload: {
      prompt: '"Is your name Patrick?"',
      promptHint: 'Yes, your name IS Patrick. Pick the polite confirm.',
      options: [
        { roman: 'chai khrap', thai: 'ใช่ครับ', meaning: 'Yes', correct: true },
        { roman: 'mai chai khrap', thai: 'ไม่ใช่ครับ', meaning: 'No / not correct' },
      ],
    } satisfies ChoicePayload,
  },
  {
    id: 's1-rescue-phrase',
    stage: 1,
    title: 'Rescue Phrase!',
    command: 'Say what you need!',
    skill: 'Pick the right survival phrase for the situation.',
    durationMs: 5500,
    mechanic: 'choice',
    payload: {
      prompt: 'Patrick is thirsty in the hotel lobby.',
      promptHint: 'Which phrase fits?',
      options: [
        { roman: 'phom hiw naam khrap', thai: 'ผมหิวน้ำครับ', meaning: 'I am thirsty', correct: true },
        {
          roman: 'hong nam yoo tee nai khrap',
          thai: 'ห้องน้ำอยู่ที่ไหนครับ',
          meaning: 'Where is the bathroom?',
        },
        { roman: 'raa khaa tao rai khrap', thai: 'ราคาเท่าไหร่ครับ', meaning: 'How much is it?' },
        { roman: 'sawatdee khrap', thai: 'สวัสดีครับ', meaning: 'Hello' },
      ],
    } satisfies ChoicePayload,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
//   STAGE 2 — Front Desk Check-In
// ─────────────────────────────────────────────────────────────────────────────

const stageTwoMicrogames: MicrogameConfig[] = [
  {
    id: 's2-stack-check-in',
    stage: 2,
    title: 'Stack Check-In!',
    command: 'Build the line!',
    skill: 'Order three check-in chunks: greeting → request → name.',
    durationMs: 7000,
    mechanic: 'stackOrder',
    payload: {
      chunks: [
        { roman: 'sawatdee khrap', thai: 'สวัสดีครับ', meaning: 'Hello' },
        { roman: 'kho check in khrap', thai: 'ขอเช็กอินครับ', meaning: "I'd like to check in" },
        { roman: 'phom chue Patrick khrap', thai: 'ผมชื่อแพทริกครับ', meaning: 'My name is Patrick' },
      ],
    } satisfies StackOrderPayload,
  },
  {
    id: 's2-grab-the-key',
    stage: 2,
    title: 'Grab The Key!',
    command: 'Ask for it!',
    skill: 'Hotel object question — "Where is the key?"',
    durationMs: 5000,
    mechanic: 'choice',
    payload: {
      prompt: '🔑  The room key is gone. Ask the clerk.',
      promptHint: 'Pick the right question.',
      options: [
        {
          roman: 'gun jae yoo tee nai khrap',
          thai: 'กุญแจอยู่ที่ไหนครับ',
          meaning: 'Where is the key?',
          correct: true,
        },
        { roman: 'lift yoo tee nai khrap', thai: 'ลิฟต์อยู่ที่ไหนครับ', meaning: 'Where is the elevator?' },
        {
          roman: 'hong nam yoo tee nai khrap',
          thai: 'ห้องน้ำอยู่ที่ไหนครับ',
          meaning: 'Where is the bathroom?',
        },
      ],
    } satisfies ChoicePayload,
  },
  {
    id: 's2-floor-panic',
    stage: 2,
    title: 'Floor Panic!',
    command: 'Which floor?',
    skill: 'Ask which floor your room is on before the elevator doors close.',
    durationMs: 4500,
    mechanic: 'choice',
    payload: {
      prompt: '🛗  Doors closing — which floor?',
      promptHint: 'Pick the phrase asking about YOUR floor.',
      options: [
        {
          roman: 'hong phom yoo chan nai khrap',
          thai: 'ห้องผมอยู่ชั้นไหนครับ',
          meaning: 'Which floor is my room on?',
          correct: true,
        },
        { roman: 'lift yoo tee nai khrap', thai: 'ลิฟต์อยู่ที่ไหนครับ', meaning: 'Where is the elevator?' },
        { roman: 'gun jae yoo tee nai khrap', thai: 'กุญแจอยู่ที่ไหนครับ', meaning: 'Where is the key?' },
      ],
    } satisfies ChoicePayload,
  },
  {
    id: 's2-slow-down',
    stage: 2,
    title: 'Slow Down!',
    command: 'Too fast!',
    skill: 'Repair strategy — ask the clerk to slow down.',
    durationMs: 5000,
    mechanic: 'choice',
    payload: {
      prompt: '💬💬💬 Clerk is talking too fast!',
      promptHint: 'Pick the phrase that asks them to slow down.',
      options: [
        {
          roman: 'chuai phuut chaa long noi khrap',
          thai: 'ช่วยพูดช้าลงหน่อยครับ',
          meaning: 'Please speak more slowly',
          correct: true,
        },
        {
          roman: 'phuut eek khrang dai mai khrap',
          thai: 'พูดอีกครั้งได้ไหมครับ',
          meaning: 'Can you say that again?',
        },
        { roman: 'khao jai laeo khrap', thai: 'เข้าใจแล้วครับ', meaning: 'I understand now' },
      ],
    } satisfies ChoicePayload,
  },
  {
    id: 's2-say-it-again',
    stage: 2,
    title: 'Say It Again!',
    command: 'Ask repeat!',
    skill: 'Clarification — ask the speaker to repeat.',
    durationMs: 5000,
    mechanic: 'choice',
    payload: {
      prompt: '🌀 ?#@!?# — you missed that.',
      promptHint: 'Pick the phrase that asks for a repeat.',
      options: [
        {
          roman: 'phuut eek khrang dai mai khrap',
          thai: 'พูดอีกครั้งได้ไหมครับ',
          meaning: 'Can you say that again?',
          correct: true,
        },
        {
          roman: 'chuai phuut chaa long noi khrap',
          thai: 'ช่วยพูดช้าลงหน่อยครับ',
          meaning: 'Please speak more slowly',
        },
        { roman: 'khao jai laeo khrap', thai: 'เข้าใจแล้วครับ', meaning: 'I understand now' },
      ],
    } satisfies ChoicePayload,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
//   STAGE 3 — Street Food Order
// ─────────────────────────────────────────────────────────────────────────────

const stageThreeMicrogames: MicrogameConfig[] = [
  {
    id: 's3-point-and-order',
    stage: 3,
    title: 'Point And Order!',
    command: 'Order this!',
    skill: 'Point at a dish, then say "I\'ll take this one".',
    durationMs: 6500,
    mechanic: 'pointOrder',
    payload: {
      dishLabel: 'Pad Thai',
      dishGlyph: '🍜',
      options: [
        { roman: 'ao an nee khrap', thai: 'เอาอันนี้ครับ', meaning: "I'll take this one", correct: true },
        { roman: 'an nee kheu arai khrap', thai: 'อันนี้คืออะไรครับ', meaning: 'What is this?' },
        { roman: 'kho naam plao khrap', thai: 'ขอน้ำเปล่าครับ', meaning: 'Water, please' },
      ],
    } satisfies PointOrderPayload,
  },
  {
    id: 's3-spice-stop',
    stage: 3,
    title: 'Spice Stop!',
    command: 'Not too spicy!',
    skill: 'Pick the right spice level. Stop the meter on "mai phet khrap".',
    durationMs: 6500,
    mechanic: 'spiceStop',
    payload: {
      prompt: "Patrick can't handle heat. Stop on NOT SPICY.",
      bands: [
        { roman: 'mai phet khrap', label: 'NOT SPICY', correct: true },
        { roman: 'phet nit noi khrap', label: 'A LITTLE' },
        { roman: 'phet khrap', label: 'SPICY' },
        { roman: 'phet maak khrap', label: 'FIRE' },
      ],
      sweepMs: 1700,
    } satisfies SpiceStopPayload,
  },
  {
    id: 's3-peanut-alert',
    stage: 3,
    title: 'Peanut Alert!',
    command: 'No peanuts!',
    skill: 'Food restriction — refuse peanuts before they hit the plate.',
    durationMs: 6500,
    mechanic: 'peanutSwipe',
    payload: {
      roman: 'mai ao thua khrap',
      thai: 'ไม่เอาถั่วครับ',
      meaning: 'No peanuts, please',
      peanutCount: 5,
      textFinisher: {
        roman: 'mai ao thua khrap',
        thai: 'ไม่เอาถั่วครับ',
        meaning: 'No peanuts, please',
        correct: true,
      },
    } satisfies PeanutSwipePayload,
  },
  {
    id: 's3-one-plate',
    stage: 3,
    title: 'One Plate!',
    command: 'Order one!',
    skill: 'Quantity — order exactly one plate.',
    durationMs: 4500,
    mechanic: 'choice',
    payload: {
      prompt: '🍽️  One serving for Patrick.',
      promptHint: 'Pick the phrase asking for ONE plate.',
      options: [
        {
          roman: 'kho nueng jaan khrap',
          thai: 'ขอหนึ่งจานครับ',
          meaning: 'One plate, please',
          correct: true,
        },
        { roman: 'kho song jaan khrap', thai: 'ขอสองจานครับ', meaning: 'Two plates, please' },
        { roman: 'kho saam jaan khrap', thai: 'ขอสามจานครับ', meaning: 'Three plates, please' },
      ],
    } satisfies ChoicePayload,
  },
  {
    id: 's3-compliment-combo',
    stage: 3,
    title: 'Compliment Combo!',
    command: 'Be nice!',
    skill: 'Social closing — compliment the food after paying.',
    durationMs: 4500,
    mechanic: 'choice',
    payload: {
      prompt: '😊  Vendor smiles after Patrick pays.',
      promptHint: 'Pick the friendly compliment.',
      options: [
        { roman: 'a roi maak khrap', thai: 'อร่อยมากครับ', meaning: 'Very delicious', correct: true },
        { roman: 'khit ngoen duai khrap', thai: 'คิดเงินด้วยครับ', meaning: 'Bill, please' },
        { roman: 'mai phet khrap', thai: 'ไม่เผ็ดครับ', meaning: 'Not spicy' },
      ],
    } satisfies ChoicePayload,
  },
];

// ─────────────────────────────────────────────────────────────────────────────

export const microgamesByStage: Record<Stage, MicrogameConfig[]> = {
  1: stageOneMicrogames,
  2: stageTwoMicrogames,
  3: stageThreeMicrogames,
};

export const allMicrogames: MicrogameConfig[] = [
  ...stageOneMicrogames,
  ...stageTwoMicrogames,
  ...stageThreeMicrogames,
];

export const stageTitles: Record<Stage, string> = {
  1: 'Hotel Lobby Basics',
  2: 'Front Desk Check-In',
  3: 'Street Food Order',
};

export function getMicrogamesForStage(stage: Stage): MicrogameConfig[] {
  return microgamesByStage[stage];
}
