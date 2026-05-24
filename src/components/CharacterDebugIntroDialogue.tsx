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
};

export function CharacterDebugIntroDialogue({
  line,
  index,
  total,
  isFinalLine,
  onAdvance,
}: CharacterDebugIntroDialogueProps) {
  return (
    <section className={`jrpg-intro-dialogue jrpg-intro-dialogue--${line.side}`} aria-label="Level 1 intro dialogue">
      <div className="jrpg-intro-dialogue__portrait-wrap" key={`${line.id}-portrait`}>
        <img src={line.portraitUrl} alt={line.speaker} className="jrpg-intro-dialogue__portrait" draggable={false} />
      </div>

      <div className="jrpg-intro-dialogue__bubble" key={`${line.id}-bubble`}>
        <div className="jrpg-intro-dialogue__meta">
          <span className="jrpg-intro-dialogue__speaker">{line.speaker}</span>
          <span className="jrpg-intro-dialogue__count">
            Pre-training {index + 1}/{total}
          </span>
          <span className="jrpg-intro-dialogue__tone">{line.tone}</span>
        </div>
        <p className="jrpg-intro-dialogue__text">{line.text}</p>
        <div className="jrpg-intro-dialogue__footer">
          <span>{line.speaker === 'Su' ? 'Recorded Su line plays when available.' : 'Patrick is disoriented after the rift.'}</span>
          <button type="button" onClick={onAdvance} className="jrpg-intro-dialogue__button">
            {isFinalLine ? 'Start Moving' : 'Continue'}
          </button>
        </div>
      </div>
    </section>
  );
}
