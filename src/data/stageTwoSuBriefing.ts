export type StageTwoSuBriefingLine = {
  id: string;
  speaker: 'Su';
  text: string;
  audioId: string;
  side: 'right';
  portrait: 'smile' | 'explaining' | 'determined' | 'playful' | 'worried';
  tone: string;
  category: 'intro';
  note: string;
  voice: 'sage';
  model: 'gpt-realtime-2';
};

const stageTwoSuVoice = 'sage' as const;
const stageTwoSuModel = 'gpt-realtime-2' as const;

function line(
  id: string,
  portrait: StageTwoSuBriefingLine['portrait'],
  tone: string,
  text: string,
): StageTwoSuBriefingLine {
  return {
    id,
    speaker: 'Su',
    text,
    audioId: id,
    side: 'right',
    portrait,
    tone,
    category: 'intro',
    note: `Stage 2 Su briefing ${id}`,
    voice: stageTwoSuVoice,
    model: stageTwoSuModel,
  };
}

export const stageTwoSuBriefingLines = [
  line(
    'stage-02-briefing-01',
    'smile',
    'Hotel check-in briefing',
    'Level 2 is hotel check-in. ฟังนะ (fang na, listen), this room has people, objects, and a few steps before Patrick can leave.',
  ),
  line(
    'stage-02-briefing-02',
    'explaining',
    'Movement tutorial',
    'Click the floor to move Patrick. ดีมาก (dee maak, very good). When you see a glowing ring, that means you can inspect or interact.',
  ),
  line(
    'stage-02-briefing-03',
    'determined',
    'Command menu tutorial',
    'Use the command menu: Look, Take, Use, and Talk. ไม่ต้องรีบ (mai tong reep, no need to rush). Pick one action, then watch the Thai prompt.',
  ),
  line(
    'stage-02-briefing-04',
    'explaining',
    'Voice tutorial',
    'When the prompt appears, hold Speak, say the line, then release. ช้า ๆ (chaa chaa, slowly). Clear is better than fast.',
  ),
  line(
    'stage-02-briefing-05',
    'playful',
    'Goal setup',
    'The front desk is the important part. ไปกันเถอะ (pai gan thoe, let us go). Talk to the hostess when Patrick is ready.',
  ),
  line(
    'stage-02-briefing-06',
    'worried',
    'Blocked action hint',
    'Some items are locked behind the conversation. If something will not work yet, ใจเย็น ๆ (jai yen yen, stay calm), and check what is missing.',
  ),
  line(
    'stage-02-briefing-07',
    'determined',
    'Completion hint',
    'After check-in, collect what you need, then talk to the bellboy. เก่งมาก (geng maak, you are doing great).',
  ),
  line('stage-02-briefing-08', 'smile', 'Start signal', 'Ready? ลุยเลย (lui loei, let us go).'),
] as const satisfies readonly StageTwoSuBriefingLine[];
