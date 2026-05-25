import { patrickReactions } from '../patrickReactions';
import { suReactions } from '../suReactions';
import type { CharacterDebugIntroLine } from '../../components/CharacterDebugIntroDialogue';

/**
 * Per-stage intro dialogue — short Patrick-then-Su exchanges that walk the
 * player through what the stage is, what they should do, and what the Thai
 * goal is. Mirrors `stageOneIntroLines` (which lives inside CharacterDebugPage
 * because that page wraps a special pre-roll movie) so the speech-bubble UI
 * stays identical across the whole game.
 *
 * Keyed by `AdventureSceneConfig.scenarioId`. Each stage gets the same
 * 4-beat structure:
 *
 *   1. Patrick reacts to the new location (sets mood)
 *   2. Su welcomes / orients (where you are, why you're here)
 *   3. Su gives the gameplay how-to (which verbs to use)
 *   4. Su names the Thai goal (the phrase/skill you're practising)
 *
 * Audio is intentionally omitted for now — stages 3-10 don't yet have
 * recorded Su voice lines. Add `audioId` later and the existing voice-line
 * pipeline picks it up.
 */
export const stageIntros: Record<string, readonly CharacterDebugIntroLine[]> = {
  // STAGE 1 — Hotel lobby basics. Restored from the deleted CharacterDebugPage
  // intro flow so the player still gets the rift-arrival + Su-greets-Patrick
  // VN exchange that the original Stage 1 had. The full original sequence
  // was Patrick (worried) → Su line 02 (welcomes, names the location) →
  // Su line 03 (mai pen rai, sets up the magic-of-polite-Thai pitch) →
  // Su line 04 (wan nee, lists the ten phrases) → Su line 05 (movement
  // tutorial — updated from "Go To Su button" to the data-driven engine's
  // click-floor / click-ring affordances) → Su line 06 (mic controls).
  // Six beats total. Audio IDs map to dialogue-hotel-lobby-basics-02..06
  // which are already recorded in stage-01 voiceover.
  'hotel-lobby-basics': [
    {
      id: 'patrick-arrival',
      speaker: 'Patrick',
      text: 'Where am I? This is not the street outside my apartment.',
      side: 'left',
      portraitUrl: patrickReactions.worried,
      tone: 'Confused',
    },
    {
      id: 'su-hello',
      speaker: 'Su',
      text: 'Hello, Patrick! Sawatdee. You are awake. Do not panic. You fell through the Bangkok rift and landed in the lobby of the Chao Phraya Star Hotel.',
      side: 'right',
      portraitUrl: suReactions.smile,
      tone: 'Calling across the room',
      audioId: 'dialogue-hotel-lobby-basics-02',
    },
    {
      id: 'su-reassure',
      speaker: 'Su',
      text: 'ไม่เป็นไร (it is okay — mai pen rai). Before you step outside, you need your first kind of magic: polite Thai. We will start with: สวัสดีครับ. Hello.',
      side: 'right',
      portraitUrl: suReactions.smile,
      tone: 'Reassuring',
      audioId: 'dialogue-hotel-lobby-basics-03',
    },
    {
      id: 'su-curriculum',
      speaker: 'Su',
      text: 'วันนี้ (today — wan nee), I will teach you ten Thai basics you can use right now: hello, your name, nice to meet you, thank you, sorry, yes, no, price, bathroom, and I am thirsty.',
      side: 'right',
      portraitUrl: suReactions.explaining,
      tone: 'Setting expectations',
      audioId: 'dialogue-hotel-lobby-basics-04',
    },
    {
      id: 'su-approach',
      speaker: 'Su',
      text: 'I am across the lobby. Click anywhere on the floor to walk Patrick over, or click the glowing ring at my feet to come straight to me.',
      side: 'right',
      portraitUrl: suReactions.explaining,
      tone: 'Tutorial',
      audioId: 'dialogue-hotel-lobby-basics-05',
    },
    {
      id: 'su-training',
      speaker: 'Su',
      text: 'Hold the mic button to say each phrase, release to let the AI judge. Tap Skip if your mic gives you trouble — or flip Settings to No-mic mode and just tap Confirm. Ten phrases. We start with sawatdee.',
      side: 'right',
      portraitUrl: suReactions.determined,
      tone: 'Coach',
      audioId: 'dialogue-hotel-lobby-basics-06',
    },
  ],

  // STAGE 2 — Front desk check-in. Lifted from the recorded
  // stageTwoSuBriefing lines (8 of them) and condensed into the same
  // 4-beat shape Stages 3-10 use, picking the four briefing audio takes
  // that best match the arrival/welcome/how-to/goal beats. The remaining
  // briefing files (stage-02-briefing-04/06/07/08) stay available in
  // stageTwoSuBriefing for future in-stage coaching cues.
  'front-desk-check-in': [
    {
      id: 'patrick-arrival',
      speaker: 'Patrick',
      text: 'Marble floor, polished counter, a hostess waiting. This is the check-in, right?',
      side: 'left',
      portraitUrl: patrickReactions.determined,
      tone: 'Steeled',
    },
    {
      id: 'su-welcome',
      speaker: 'Su',
      text: 'Level 2 is hotel check-in. Fang na — listen. This room has people, objects, and a few steps before Patrick can leave.',
      side: 'right',
      portraitUrl: suReactions.smile,
      tone: 'Briefing',
      audioId: 'stage-02-briefing-01',
    },
    {
      id: 'su-howto',
      speaker: 'Su',
      text: 'Click the floor to move. Click a glowing ring to inspect. Then pick Look, Take, Use, or Talk — mai tong reep, no need to rush.',
      side: 'right',
      portraitUrl: suReactions.determined,
      tone: 'Tutorial',
      audioId: 'stage-02-briefing-03',
    },
    {
      id: 'su-goal',
      speaker: 'Su',
      text: 'The front desk is the important part. Pai gan thoe — let us go. Collect your wallet, passport, and phone, then talk to the hostess.',
      side: 'right',
      portraitUrl: suReactions.playful,
      tone: 'Goal',
      audioId: 'stage-02-briefing-05',
    },
  ],

  // STAGE 3 — Night market street food
  'street-food-order': [
    {
      id: 'p-arrival',
      speaker: 'Patrick',
      text: 'Whoa — neon lanterns, woks, sky-train overhead. This is the night market?',
      side: 'left',
      portraitUrl: patrickReactions.surprised,
      tone: 'Wide-eyed',
    },
    {
      id: 'su-welcome',
      speaker: 'Su',
      text: 'Ratchada night stalls. You need food before the rift starts pulling on your magic again. Three stalls in front of you.',
      side: 'right',
      portraitUrl: suReactions.smile,
      tone: 'Orienting',
    },
    {
      id: 'su-howto',
      speaker: 'Su',
      text: 'Walk up to a stall and TALK to the cook. Choose a dish first, then handle spice, then pay and ask for water.',
      side: 'right',
      portraitUrl: suReactions.explaining,
      tone: 'Tutorial',
    },
    {
      id: 'su-goal',
      speaker: 'Su',
      text: 'The phrase that matters tonight: mai phet — not spicy. Get it crisp or your night ends early.',
      side: 'right',
      portraitUrl: suReactions.determined,
      tone: 'Goal',
    },
  ],

  // STAGE 4 — Taxi ride across Bangkok
  'taxi-ride': [
    {
      id: 'p-arrival',
      speaker: 'Patrick',
      text: 'A hot-pink taxi. Of course it is a hot-pink taxi.',
      side: 'left',
      portraitUrl: patrickReactions.playful,
      tone: 'Amused',
    },
    {
      id: 'su-welcome',
      speaker: 'Su',
      text: 'Quickest way across the city — and the driver only speaks Thai. You handle the negotiation, I will judge.',
      side: 'right',
      portraitUrl: suReactions.smile,
      tone: 'Setup',
    },
    {
      id: 'su-howto',
      speaker: 'Su',
      text: 'Walk to the curb. TALK to the driver. He will ask pai nai — where to. Name the destination, agree the fare, then get in.',
      side: 'right',
      portraitUrl: suReactions.explaining,
      tone: 'Tutorial',
    },
    {
      id: 'su-goal',
      speaker: 'Su',
      text: 'Always confirm the fare in Thai before the doors close. Tao rai — how much. Say it loud.',
      side: 'right',
      portraitUrl: suReactions.determined,
      tone: 'Goal',
    },
  ],

  // STAGE 5 — Floating market bargain
  'market-bargain': [
    {
      id: 'p-arrival',
      speaker: 'Patrick',
      text: 'Boats selling mangoes. Boats selling charms. I am here for both.',
      side: 'left',
      portraitUrl: patrickReactions.playful,
      tone: 'Delighted',
    },
    {
      id: 'su-welcome',
      speaker: 'Su',
      text: 'Floating market — prices float too. Vendors expect you to bargain. Walking away is a normal move.',
      side: 'right',
      portraitUrl: suReactions.smile,
      tone: 'Orienting',
    },
    {
      id: 'su-howto',
      speaker: 'Su',
      text: 'LOOK at an item first so you know what you want. Then TALK to the vendor and counter-offer in Thai.',
      side: 'right',
      portraitUrl: suReactions.explaining,
      tone: 'Tutorial',
    },
    {
      id: 'su-goal',
      speaker: 'Su',
      text: 'Soft tone, half-smile. Lod noi dai mai — can you lower it a little. That is the spell here.',
      side: 'right',
      portraitUrl: suReactions.determined,
      tone: 'Goal',
    },
  ],

  // STAGE 6 — Clinic and pharmacy
  'clinic-and-pharmacy': [
    {
      id: 'p-arrival',
      speaker: 'Patrick',
      text: 'My throat feels like I gargled sandpaper. The rift is taxing me.',
      side: 'left',
      portraitUrl: patrickReactions.worried,
      tone: 'Hurting',
    },
    {
      id: 'su-welcome',
      speaker: 'Su',
      text: 'Clinic time. The pharmacist will help if you can describe the symptom, ask for medicine, and confirm the timing.',
      side: 'right',
      portraitUrl: suReactions.explaining,
      tone: 'Reassuring',
    },
    {
      id: 'su-howto',
      speaker: 'Su',
      text: 'TALK to the pharmacist first — symptoms. Then USE the shelf to choose medicine. Then ask the timing.',
      side: 'right',
      portraitUrl: suReactions.explaining,
      tone: 'Tutorial',
    },
    {
      id: 'su-goal',
      speaker: 'Su',
      text: 'Key word: jep — it hurts. If you stall, ask phuut chaa chaa noi — please speak slowly.',
      side: 'right',
      portraitUrl: suReactions.determined,
      tone: 'Goal',
    },
  ],

  // STAGE 7 — Friendship plans (cafe)
  'friendship-plans': [
    {
      id: 'p-arrival',
      speaker: 'Patrick',
      text: 'Iced coffee, soft jazz, working aircon. This is more my speed.',
      side: 'left',
      portraitUrl: patrickReactions.smile,
      tone: 'Relieved',
    },
    {
      id: 'su-welcome',
      speaker: 'Su',
      text: 'Cafe corner. A friend of mine — Nok — comes here on Saturdays. She speaks slowly with strangers.',
      side: 'right',
      portraitUrl: suReactions.smile,
      tone: 'Warm',
    },
    {
      id: 'su-howto',
      speaker: 'Su',
      text: 'TALK to Nok. Ask what she likes, pick a time you are both free, then propose hanging out.',
      side: 'right',
      portraitUrl: suReactions.explaining,
      tone: 'Tutorial',
    },
    {
      id: 'su-goal',
      speaker: 'Su',
      text: 'Friendships open routes the rift cannot show you. Pai duay-gan mai — want to go together?',
      side: 'right',
      portraitUrl: suReactions.playful,
      tone: 'Goal',
    },
  ],

  // STAGE 8 — Alley directions / emergency
  'directions-and-emergency': [
    {
      id: 'p-arrival',
      speaker: 'Patrick',
      text: 'These alleys all look the same. Did the main road just… move?',
      side: 'left',
      portraitUrl: patrickReactions.worried,
      tone: 'Disoriented',
    },
    {
      id: 'su-welcome',
      speaker: 'Su',
      text: 'You are lost — that is the whole lesson. Ask for directions before the rift drifts further.',
      side: 'right',
      portraitUrl: suReactions.determined,
      tone: 'Urgent',
    },
    {
      id: 'su-howto',
      speaker: 'Su',
      text: 'Find a friendly local. TALK. Ask pai… yang ngai — how do I get to. Listen carefully to the verbs of motion.',
      side: 'right',
      portraitUrl: suReactions.explaining,
      tone: 'Tutorial',
    },
    {
      id: 'su-goal',
      speaker: 'Su',
      text: 'If you hear long — that means you have gone too far. Stop, breathe, ask again. No shame in long.',
      side: 'right',
      portraitUrl: suReactions.determined,
      tone: 'Goal',
    },
  ],

  // STAGE 9 — Embassy formal meeting
  'formal-meeting': [
    {
      id: 'p-arrival',
      speaker: 'Patrick',
      text: 'Embassy. Marble floors. Formal Thai. Do not mess this up, Patrick.',
      side: 'left',
      portraitUrl: patrickReactions.determined,
      tone: 'Focused',
    },
    {
      id: 'su-welcome',
      speaker: 'Su',
      text: 'The receptionist judges tone as much as words. Every sentence ends with khrap. Soft volume, slow pace.',
      side: 'right',
      portraitUrl: suReactions.explaining,
      tone: 'Coaching',
    },
    {
      id: 'su-howto',
      speaker: 'Su',
      text: 'Wai before you speak — hands together, slight bow, eyes lowered. Then TALK. State your purpose, hand over the document, confirm the date.',
      side: 'right',
      portraitUrl: suReactions.determined,
      tone: 'Tutorial',
    },
    {
      id: 'su-goal',
      speaker: 'Su',
      text: 'Slow and polite beats fast and clever here. Khor anuyat khrap — may I have permission.',
      side: 'right',
      portraitUrl: suReactions.smile,
      tone: 'Goal',
    },
  ],

  // STAGE 10 — Rift gate negotiation finale
  'rift-negotiation': [
    {
      id: 'p-arrival',
      speaker: 'Patrick',
      text: 'The rift is open. The air is pulling. I can feel every Thai word I have learned.',
      side: 'left',
      portraitUrl: patrickReactions.worried,
      tone: 'Steeled',
    },
    {
      id: 'su-welcome',
      speaker: 'Su',
      text: 'Last test. The gate listens to clean Thai. Every phrase you have practised counts toward closing it.',
      side: 'right',
      portraitUrl: suReactions.determined,
      tone: 'Solemn',
    },
    {
      id: 'su-howto',
      speaker: 'Su',
      text: 'LOOK at the runes first. TAKE what the gate offers. USE what you have. Then TALK — slow, polite, perfect.',
      side: 'right',
      portraitUrl: suReactions.explaining,
      tone: 'Tutorial',
    },
    {
      id: 'su-goal',
      speaker: 'Su',
      text: 'When you are ready, speak the closing phrase. I will be right here. Sawatdee — and then goodbye.',
      side: 'right',
      portraitUrl: suReactions.smile,
      tone: 'Goal',
    },
  ],
} as const;

const stageIntroAudioPrefixes: Record<string, string> = {
  'street-food-order': 'stage-03',
  'taxi-ride': 'stage-04',
  'market-bargain': 'stage-05',
  'clinic-and-pharmacy': 'stage-06',
  'friendship-plans': 'stage-07',
  'directions-and-emergency': 'stage-08',
  'formal-meeting': 'stage-09',
  'rift-negotiation': 'stage-10',
};

export function getStageIntroAudioId(scenarioId: string, lineId: string): string | undefined {
  const prefix = stageIntroAudioPrefixes[scenarioId];
  return prefix ? `${prefix}-intro-${lineId}` : undefined;
}

/**
 * Look up the intro lines for a given adventure scenario id. Returns an
 * empty array when the stage has no registered intro (e.g. legacy stages
 * that handle their own pre-roll, or stages still being authored).
 *
 * Audio resolution: a line's explicit `audioId` (used by Stages 1 and 2,
 * which reuse already-recorded briefing/dialogue takes) is preserved. For
 * Su lines without an explicit `audioId`, the per-stage prefix scheme
 * (`stage-NN-intro-<lineId>`) fills one in, which is how Stages 3-10 wire
 * up once their TTS pipeline runs.
 */
export function getStageIntroLines(scenarioId: string): readonly CharacterDebugIntroLine[] {
  const lines = stageIntros[scenarioId] ?? [];
  return lines.map((line) => {
    if (line.speaker !== 'Su') return line;
    if (line.audioId) return line;
    return { ...line, audioId: getStageIntroAudioId(scenarioId, line.id) };
  });
}
