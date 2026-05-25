export type DialogueLine = {
  speaker: 'Su' | 'Patrick';
  text: string;
  thai?: string;
  translation?: string;
  spokenText?: string;
};

export const suTutorialDialogue: DialogueLine[] = [
  {
    speaker: 'Patrick',
    text: 'Ow... this is not my apartment. Why is the hotel lobby glowing?',
  },
  {
    speaker: 'Su',
    text: 'สวัสดี (hello - sawatdee), Patrick! You are awake. Do not panic. You fell through the Bangkok rift and landed in the lobby of the Chao Phraya Star Hotel.',
  },
  {
    speaker: 'Su',
    text: 'ไม่เป็นไร (it is okay - mai pen rai). Before you step outside, you need your first kind of magic: polite Thai. We will start with:',
    thai: 'สวัสดีครับ',
    translation: 'Hello',
  },
  {
    speaker: 'Su',
    text: 'วันนี้ (today - wan nee), I will teach you ten Thai basics you can use every day: greeting, checking in, food, tiredness, gratitude, apologies, care, and a gentle goodnight.',
  },
  {
    speaker: 'Patrick',
    text: 'So the first boss is... learning how to talk like a normal polite person?',
  },
  {
    speaker: 'Su',
    text: 'ใช่ (yes - chai). Battle rules, tiny rift hero: hold Speak and talk, release to let the AI judge, tap Hear for my example, Review to retry, and Skip only if your mouth has dramatically resigned. พร้อมไหม (ready? - phrom mai)',
    spokenText:
      'Chai, yes. Battle tutorial speedrun. Hold Speak and talk, then release so the AI can judge your pronunciation. Tap Hear if your ears need snacks, Review to redo the last phrase, and Skip only if your mouth has entered witness protection. Phrom mai, ready? Try not to duel the Thai language like it owes you rent.',
  },
];

export function buildScenarioDialogue(scenario: {
  scenarioNumber: number;
  title: string;
  location: string;
  storyGoal: string;
  lessonGoal: string;
  equipmentReward: { name: string };
  superMove: { name: string };
}): DialogueLine[] {
  if (scenario.scenarioNumber === 1) return suTutorialDialogue;

  return [
    {
      speaker: 'Su',
      text: `Stage ${scenario.scenarioNumber}: ${scenario.title}. We are moving through ${scenario.location}.`,
    },
    {
      speaker: 'Su',
      text: scenario.storyGoal,
    },
    {
      speaker: 'Patrick',
      text: `So this lesson is about: ${scenario.lessonGoal}`,
    },
    {
      speaker: 'Su',
      text: `Yes. Before the encounter: hold Speak and talk, release for the AI judge, use Hear for my example, Review for the previous phrase, and Skip only when your tongue is filing a formal complaint. Clear the chunks to earn ${scenario.equipmentReward.name} and charge ${scenario.superMove.name}.`,
      spokenText: `Stage ${scenario.scenarioNumber} briefing. Hold Speak and talk, release for the AI judge, tap Hear for my perfect example, Review the previous phrase when your brain drops a receipt, and Skip only in a pronunciation emergency. Clear the chunks to earn ${scenario.equipmentReward.name} and charge ${scenario.superMove.name}. Let's cause educational chaos politely.`,
    },
  ];
}
