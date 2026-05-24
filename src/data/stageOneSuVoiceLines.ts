export type StageOneConversationLine = {
  suLine: string;
  coachingLine: string;
  playerIntent: string;
  suAudioId: string;
  coachingAudioId: string;
};

export type StageOneSuVoiceLine = {
  id: string;
  text: string;
  category: 'intro' | 'battle';
  note: string;
  voice: 'sage';
  model: 'gpt-realtime-2';
};

const stageOneSuVoice = 'sage' as const;
const stageOneSuModel = 'gpt-realtime-2' as const;

function suLine(id: string, category: StageOneSuVoiceLine['category'], note: string, text: string): StageOneSuVoiceLine {
  return {
    id,
    category,
    note,
    text,
    voice: stageOneSuVoice,
    model: stageOneSuModel,
  };
}

export const stageOneConversationDeck: Record<string, StageOneConversationLine> = {
  hello: {
    suLine: 'สวัสดี (hello - sawatdee), Patrick. Look at me first. Start with a polite hello.',
    coachingLine: 'Say it slowly: sawatdee... khrap. สวัสดี (hello - sawatdee) means hello. ครับ (polite ending - khrap) makes it polite.',
    playerIntent: 'Answer Su with a clear greeting.',
    suAudioId: 'stage-01-hello-su',
    coachingAudioId: 'stage-01-hello-coach',
  },
  'my-name-is-patrick': {
    suLine: 'ดีมาก (very good - dee mak). Now tell me who you are before the lobby asks questions.',
    coachingLine: 'Break it down: ผม (I - phom), ชื่อ (named - chue), Patrick, and ครับ (polite ending - khrap). Repeat: phom chue Patrick khrap.',
    playerIntent: 'Introduce yourself to Su.',
    suAudioId: 'stage-01-my-name-is-patrick-su',
    coachingAudioId: 'stage-01-my-name-is-patrick-coach',
  },
  'nice-to-meet-you': {
    suLine: 'I am Su. ยินดี (pleased - yin dee), Patrick. When someone gives you their name, respond warmly.',
    coachingLine: 'ยินดี (pleased - yin dee) starts the phrase. รู้จัก (meet or know - roo jak) is the connection. Repeat: yin dee tee dai roo jak khrap.',
    playerIntent: 'Tell Su it is nice to meet her.',
    suAudioId: 'stage-01-nice-to-meet-you-su',
    coachingAudioId: 'stage-01-nice-to-meet-you-coach',
  },
  'thank-you': {
    suLine: 'I am helping you through this. ขอบคุณ (thank you - khop khun) is what you need here.',
    coachingLine: 'ขอบคุณ (thank you - khop khun) means thank you. Add ครับ (polite ending - khrap) to sound respectful. Repeat: khop khun khrap.',
    playerIntent: 'Thank Su politely.',
    suAudioId: 'stage-01-thank-you-su',
    coachingAudioId: 'stage-01-thank-you-coach',
  },
  sorry: {
    suLine: 'Oops. You bumped the suitcase. ขอโทษ (sorry - kho thot), say sorry before it gets awkward.',
    coachingLine: 'ขอโทษ (sorry or excuse me - kho thot) repairs the moment. ครับ (polite ending - khrap) makes it polite. Repeat: kho thot khrap.',
    playerIntent: 'Apologize or excuse yourself.',
    suAudioId: 'stage-01-sorry-su',
    coachingAudioId: 'stage-01-sorry-coach',
  },
  yes: {
    suLine: 'พร้อมไหม (are you ready? - phrom mai), are you ready to keep practicing?',
    coachingLine: 'ใช่ (yes or correct - chai) answers yes. Add ครับ (polite ending - khrap). Repeat: chai khrap.',
    playerIntent: 'Say yes clearly.',
    suAudioId: 'stage-01-yes-su',
    coachingAudioId: 'stage-01-yes-coach',
  },
  no: {
    suLine: 'If something is wrong, say ไม่ใช่ (not correct - mai chai). Do not freeze.',
    coachingLine: 'ไม่ (not - mai) changes the meaning. ใช่ (yes or correct - chai) becomes ไม่ใช่ (not correct - mai chai). Repeat: mai chai khrap.',
    playerIntent: 'Say no or not correct.',
    suAudioId: 'stage-01-no-su',
    coachingAudioId: 'stage-01-no-coach',
  },
  'how-much': {
    suLine: 'Before you buy water or a charm, ask ราคา (price - raa khaa).',
    coachingLine: 'ราคา (price - raa khaa) sets the topic. เท่าไหร่ (how much - tao rai) asks the amount. Repeat: raa khaa tao rai khrap.',
    playerIntent: 'Ask how much it costs.',
    suAudioId: 'stage-01-how-much-su',
    coachingAudioId: 'stage-01-how-much-coach',
  },
  'bathroom-where': {
    suLine: 'The lobby is huge. Ask for ห้องน้ำ (bathroom - hong nam).',
    coachingLine: 'ห้องน้ำ (bathroom - hong nam) is what you need. อยู่ที่ไหน (where is it - yoo tee nai) asks the location. Repeat: hong nam yoo tee nai khrap.',
    playerIntent: 'Ask for the bathroom location.',
    suAudioId: 'stage-01-bathroom-where-su',
    coachingAudioId: 'stage-01-bathroom-where-coach',
  },
  'i-am-thirsty': {
    suLine: 'Your Courage is dipping. Tell me, หิวน้ำ (thirsty - hiw naam), you are thirsty.',
    coachingLine: 'ผม (I - phom) starts it. หิวน้ำ (thirsty for water - hiw naam) says what you need. Repeat: phom hiw naam khrap.',
    playerIntent: 'Say you are thirsty to recover.',
    suAudioId: 'stage-01-i-am-thirsty-su',
    coachingAudioId: 'stage-01-i-am-thirsty-coach',
  },
};

export const stageOneSuVoiceLines: StageOneSuVoiceLine[] = [
  suLine(
    'dialogue-hotel-lobby-basics-02',
    'intro',
    'Stage 1 intro Su line 1',
    'Hello, Patrick! Sawatdee. You are awake. Do not panic. You fell through the Bangkok rift and landed in the lobby of the Chao Phraya Star Hotel.',
  ),
  suLine(
    'dialogue-hotel-lobby-basics-03',
    'intro',
    'Stage 1 intro Su line 2',
    'ไม่เป็นไร (it is okay - mai pen rai). Before you step outside, you need your first kind of magic: polite Thai. We will start with: สวัสดีครับ. Hello.',
  ),
  suLine(
    'dialogue-hotel-lobby-basics-04',
    'intro',
    'Stage 1 intro Su line 3',
    'วันนี้ (today - wan nee), I will teach you ten Thai basics you can use right now: hello, your name, nice to meet you, thank you, sorry, yes, no, price, bathroom, and I am thirsty.',
  ),
  suLine(
    'dialogue-hotel-lobby-basics-05',
    'intro',
    'Stage 1 3D intro Su movement tutorial',
    'I am across the room. Click the glowing floor path or press Go To Su, and Patrick will walk to me.',
  ),
  suLine(
    'dialogue-hotel-lobby-basics-06',
    'intro',
    'Stage 1 intro Su line 4',
    'Before you step outside, you need your first kind of magic: polite Thai. Hold Speak and talk, release to let the AI judge, tap Hear for my example, Review to retry, and Skip only if your mouth has dramatically resigned.',
  ),
  ...Object.values(stageOneConversationDeck).flatMap((line) => [
    suLine(line.suAudioId, 'battle', 'Stage 1 battle Su prompt', line.suLine),
    suLine(line.coachingAudioId, 'battle', 'Stage 1 battle Su coaching', line.coachingLine),
  ]),
];
