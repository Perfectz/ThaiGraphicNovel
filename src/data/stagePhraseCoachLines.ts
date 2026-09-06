/**
 * Su's per-phrase prompt + coaching lines for the Stage 2 and Stage 3 command
 * cues — the same teach-then-tip cadence stageOneConversationDeck gives
 * Stage 1, extended to the rest of the tech demo so the demo doesn't go
 * silent after the lobby.
 *
 * Naming follows the audio pipeline convention the coverage script expects:
 *   stage-NN-<phraseId>-su     → Su reads the prompt (with inline Thai vocab)
 *   stage-NN-<phraseId>-coach  → Su's short pronunciation tip
 *
 * These lines feed scripts/generate-stage-one-su-audio.mjs --stage=all via
 * suVoiceLines.ts, which emits src/assets/audio/su/all/<audioId>.wav and the
 * generated suAudioManifest. Stage3DAdventure plays them when a command cue
 * becomes active (see the active-command VO effect).
 */

export type StagePhraseCoachLine = {
  id: string;
  text: string;
  category: 'phrase-coach';
  note: string;
  voice: 'sage';
  model: 'gpt-realtime-2';
};

type CoachEntry = {
  /** lessonScenarios phrase id */
  phraseId: string;
  /** Su's prompt — English with inline Thai, ends by cueing the phrase. */
  su: string;
  /** Su's pronunciation tip, one short sentence. */
  coach: string;
};

const STAGE_TWO: CoachEntry[] = [
  {
    phraseId: 'reservation-have',
    su: 'Tell her you booked ahead — จองไว้ (jong wai) means it is already reserved. Say: jong wai khrap.',
    coach: 'Two even beats — jong, wai — then a soft khrap to keep it polite.',
  },
  {
    phraseId: 'under-name',
    su: 'Give her the booking name — ชื่อ (chue) means name. Say: chue Patrick khrap.',
    coach: 'Chue rhymes with “sue” but starts breathy — ch-uue, then your name.',
  },
  {
    phraseId: 'check-in-please',
    su: 'Ask to check in — ขอ (kho) turns anything into a polite request. Say: kho check in khrap.',
    coach: 'Kho falls gently, like a small bow in sound form.',
  },
  {
    phraseId: 'key-where',
    su: 'กุญแจ (gun jae) is the key. Ask where it is: gun jae yoo tee nai khrap.',
    coach: 'Yoo tee nai — “is where” — keep those three words light and quick.',
  },
  {
    phraseId: 'which-floor',
    su: 'ชั้น (chan) means floor. Ask which floor your room is on: hong phom yoo chan nai khrap.',
    coach: 'Hong phom is “my room” — lean on hong, then let the rest roll.',
  },
  {
    phraseId: 'elevator-where',
    su: 'Thai borrows the English word “lift” for the elevator. Ask: lift yoo tee nai khrap.',
    coach: 'Same melody as the key question — swap the first word, keep the music.',
  },
  {
    phraseId: 'speak-slowly',
    su: 'When the Thai comes too fast, ask for slow: chuai phuut chaa long noi khrap.',
    coach: 'Chaa means slow — stretch it long, like the speed you are asking for.',
  },
  {
    phraseId: 'say-again',
    su: 'Missed it? Ask for one more time: phuut eek khrang dai mai khrap.',
    coach: 'Dai mai — “can you?” — rises at the end like any good question.',
  },
  {
    phraseId: 'i-understand',
    su: 'Show her it finally landed — เข้าใจ (khao jai) means understand. Say: khao jai laeo khrap.',
    coach: 'Laeo means “already” — it tells her the confusion is over.',
  },
];

const STAGE_THREE: CoachEntry[] = [
  {
    phraseId: 'want-this',
    su: 'Point at the dish and claim it — เอา (ao) means take. Say: ao an nee khrap.',
    coach: 'Ao like “ow”, an nee like “ahn-nee” — point while you say it.',
  },
  {
    phraseId: 'what-is-this',
    su: 'Curious about a dish? อะไร (arai) means what. Ask: an nee kheu arai khrap.',
    coach: 'Arai closes the question — let it rise and the vendor will explain.',
  },
  {
    phraseId: 'one-plate',
    su: 'Order one plate — หนึ่งจาน (nueng jaan). Say: kho nueng jaan khrap.',
    coach: 'Nueng is “one”, clipped and quick; jaan is the plate, long and round.',
  },
  {
    phraseId: 'not-spicy',
    su: 'Protect your tongue — ไม่เผ็ด (mai phet) means not spicy. Say: mai phet khrap.',
    coach: 'Mai falls, phet snaps short — the vendor will respect it.',
  },
  {
    phraseId: 'little-spicy',
    su: 'Brave but not reckless? Ask for a little heat: phet nit noi khrap.',
    coach: 'Nit noi — “a little bit” — say it twice as softly as phet.',
  },
  {
    phraseId: 'no-peanuts',
    su: 'Allergies matter — ถั่ว (thua) is peanut. Say: mai ao thua khrap.',
    coach: 'Mai ao — “don’t take” — then thua with a low, round vowel.',
  },
  {
    phraseId: 'water-please',
    su: 'Cool the fire down — น้ำเปล่า (naam plao) is plain water. Say: kho naam plao khrap.',
    coach: 'Naam is long like a drink; plao stays flat and plain.',
  },
  {
    phraseId: 'bill-please',
    su: 'Time to pay — คิดเงิน (khit ngoen) means tally it up. Say: khit ngoen duai khrap.',
    coach: 'Khit ngoen duai — three small beats, then khrap to close it kindly.',
  },
  {
    phraseId: 'delicious',
    su: 'Reward the chef — อร่อย (a-roi) means delicious. Say: a roi maak khrap.',
    coach: 'A-roi with a smile in it; maak means “very” — let it sing.',
  },
];

function toLines(stageNumber: 2 | 3, entries: CoachEntry[]): StagePhraseCoachLine[] {
  const slug = `stage-0${stageNumber}`;
  return entries.flatMap((entry) => [
    {
      id: `${slug}-${entry.phraseId}-su`,
      text: entry.su,
      category: 'phrase-coach' as const,
      note: `Stage ${stageNumber} Su prompt for phrase ${entry.phraseId}`,
      voice: 'sage' as const,
      model: 'gpt-realtime-2' as const,
    },
    {
      id: `${slug}-${entry.phraseId}-coach`,
      text: entry.coach,
      category: 'phrase-coach' as const,
      note: `Stage ${stageNumber} Su coaching tip for phrase ${entry.phraseId}`,
      voice: 'sage' as const,
      model: 'gpt-realtime-2' as const,
    },
  ]);
}

export const stagePhraseCoachLines: StagePhraseCoachLine[] = [
  ...toLines(2, STAGE_TWO),
  ...toLines(3, STAGE_THREE),
];

/** audioId → spoken text, for the caption strip during playback. */
export const stagePhraseCoachTextById: Record<string, string> = Object.fromEntries(
  stagePhraseCoachLines.map((line) => [line.id, line.text]),
);
