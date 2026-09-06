import { getStageIntroLines } from './adventures/stageIntros';
import { buildScenarioDialogue } from './dialogue';
import { lessonScenarios } from './lessonScenarios';
import { stagePhraseCoachLines } from './stagePhraseCoachLines';

export type SuVoiceLine = {
  id: string;
  text: string;
  category: 'dialogue' | 'stage-intro' | 'phrase-coach';
  note: string;
  voice: 'sage';
  model: 'gpt-realtime-2';
};

const suVoice = 'sage' as const;
const suModel = 'gpt-realtime-2' as const;

function suVoiceLine(id: string, category: SuVoiceLine['category'], note: string, text: string): SuVoiceLine {
  return {
    id,
    category,
    note,
    text,
    voice: suVoice,
    model: suModel,
  };
}

function dialogueLineText(line: { text: string; thai?: string; translation?: string; spokenText?: string }) {
  return [line.spokenText ?? line.text, line.thai, line.translation ? `Meaning: ${line.translation}.` : '']
    .filter(Boolean)
    .join(' ');
}

export const suVoiceLines: SuVoiceLine[] = [
  ...lessonScenarios.flatMap((scenario) => {
    if (scenario.scenarioNumber === 1) return [];
    return buildScenarioDialogue(scenario)
      .map((line, lineIndex) => ({ line, lineIndex }))
      .filter(({ line }) => line.speaker === 'Su')
      .map(({ line, lineIndex }) =>
        suVoiceLine(
          `dialogue-${scenario.id}-${String(lineIndex + 1).padStart(2, '0')}`,
          'dialogue',
          `Scenario ${scenario.scenarioNumber} VN Su dialogue ${lineIndex + 1}`,
          dialogueLineText(line),
        ),
      );
  }),
  ...lessonScenarios.flatMap((scenario) =>
    getStageIntroLines(scenario.id)
      .filter((line) => line.speaker === 'Su' && line.audioId)
      .map((line) =>
        suVoiceLine(
          line.audioId!,
          'stage-intro',
          `Scenario ${scenario.scenarioNumber} 3D intro ${line.id}`,
          line.text,
        ),
      ),
  ),
  // Per-phrase Su prompt + coaching tips for the Stage 2/3 command cues —
  // closes the "demo goes silent after Stage 1" gap.
  ...stagePhraseCoachLines,
];
