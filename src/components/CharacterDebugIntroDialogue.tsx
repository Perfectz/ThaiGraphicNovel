import { DialoguePanel } from './ui';

export type CharacterDebugIntroLine = {
  id: string;
  speaker: 'Patrick' | 'Su';
  text: string;
  audioId?: string;
  side: 'left' | 'right';
  portraitUrl: string;
  tone: string;
};

type CharacterDebugIntroDialogueProps = {
  line: CharacterDebugIntroLine;
  index: number;
  total: number;
  isFinalLine: boolean;
  onAdvance: () => void;
  progressLabel?: string;
  continueLabel?: string;
  finalContinueLabel?: string;
};

/**
 * Pre-training intro dialogue used on the character-debug route. Now wraps
 * the same `DialoguePanel` primitive that backs the in-game VN dialogue so
 * the two VN surfaces look identical.
 */
export function CharacterDebugIntroDialogue({
  line,
  index,
  total,
  isFinalLine,
  onAdvance,
  progressLabel = 'Pre-training',
  continueLabel = 'Tap to continue',
  finalContinueLabel = 'Tap to start moving',
}: CharacterDebugIntroDialogueProps) {
  return (
    <DialoguePanel
      speaker={line.speaker}
      body={
        <span>
          {line.text}
          <span className="ml-2 align-middle text-[0.7em] font-medium uppercase tracking-[0.18em] text-paper-quiet">
            {progressLabel} {index + 1}/{total}
          </span>
        </span>
      }
      portrait={{ src: line.portraitUrl, alt: line.speaker, side: line.side }}
      onAdvance={onAdvance}
      continueLabel={isFinalLine ? finalContinueLabel : continueLabel}
    />
  );
}
