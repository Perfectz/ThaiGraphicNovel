export type DialogueLine = {
  speaker: 'Su' | 'Patrick';
  text: string;
  thai?: string;
  translation?: string;
};

export const suTutorialDialogue: DialogueLine[] = [
  {
    speaker: 'Patrick',
    text: 'Ow... this is not my apartment. Why is the hotel lobby glowing?',
  },
  {
    speaker: 'Su',
    text: 'Patrick! You are awake. Do not panic. You fell through the Bangkok rift and landed in the lobby of the Chao Phraya Star Hotel.',
  },
  {
    speaker: 'Su',
    text: 'Before you step outside, you need your first kind of magic: polite Thai. We will start with:',
    thai: 'สวัสดีครับ',
    translation: 'Hello',
  },
  {
    speaker: 'Su',
    text: 'I will teach you ten Thai basics you can use every day: greeting, checking in, food, tiredness, gratitude, apologies, care, and a gentle goodnight.',
  },
  {
    speaker: 'Patrick',
    text: 'So the first boss is... learning how to talk like a normal polite person?',
  },
  {
    speaker: 'Su',
    text: 'Exactly. Say each phrase into the AI mic. Clear pronunciation builds Understanding and completes your first Thai lesson.',
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
      text: `Yes. Clear the chunks to earn ${scenario.equipmentReward.name} and charge ${scenario.superMove.name}.`,
    },
  ];
}
