import { useEffect, useRef, useState } from 'react';
import type { JourneyResult } from './cityJourneys';
import { phrases } from './curriculum';
import { usePracticeSurface } from './PracticeTiming';
import { useTrainingVoice } from './useTrainingVoice';
export default function RecallLine({
  phraseId,
  meaningHelp,
  onDone,
  onBusy,
}: {
  phraseId: string;
  meaningHelp: boolean;
  onDone: (r: JourneyResult) => void;
  onBusy: (b: boolean) => void;
}) {
  usePracticeSurface();
  const phrase = phrases[phraseId],
    voice = useTrainingVoice(phrase);
  const [revealed, setRevealed] = useState(false),
    [hinted, setHinted] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const supported = hinted || meaningHelp;
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const busy = voice.recording || voice.coachBusy;
  useEffect(() => {
    onBusy(busy);
    return () => onBusy(false);
  }, [busy, onBusy]);
  return (
    <div className="journey-recall">
      <small>YOUR INTENTION — IN ENGLISH</small>
      <h3 lang="en" tabIndex={-1} ref={heading}>
        {phrase.translation}
      </h3>
      <p>Try saying the Thai before you reveal it. Take as long as you need.</p>
      {!revealed ? (
        <>
          <button
            className="bk-button bk-gold"
            disabled={voice.coachBusy}
            onClick={() => void voice.record()}
          >
            {voice.recording ? '■ Stop recording' : voice.clip ? '◉ Record again' : '◉ Say it from memory'}
          </button>
          <p role="status">{voice.message}</p>
          {voice.clip ? (
            <button className="bk-button" disabled={busy} onClick={() => setRevealed(true)}>
              Compare with the Thai →
            </button>
          ) : (
            <button className="bk-button bk-outline" disabled={busy} onClick={() => setRevealed(true)}>
              I said it aloud · compare without a recording
            </button>
          )}
          <button
            className="journey-help"
            disabled={busy}
            onClick={() => {
              setHinted(true);
              setRevealed(true);
            }}
          >
            Show me the Thai first
          </button>
        </>
      ) : (
        <>
          <p className="speak-thai" lang="th">
            {phrase.targetPhrase}
          </p>
          <p>{phrase.romanization}</p>
          <div className="speak-listen-controls">
            <button onClick={() => void voice.play()}>♫ Hear Thai</button>
            <button onClick={() => void voice.play(true)}>Hear it slowly</button>
            {voice.clip && <button onClick={() => void voice.play(false, true)}>▷ Play my recording</button>}
          </div>
          <p>
            {supported
              ? meaningHelp
                ? 'You needed help choosing the meaning. This phrase will stay in your review list.'
                : 'You used a hint. This phrase will stay in your review list.'
              : 'Compare your attempt. Did you remember the phrase before seeing it?'}
          </p>
          <div className="journey-assessment">
            <button
              className="bk-button bk-gold"
              disabled={supported}
              onClick={() => onDone({ spoken: !!voice.clip, recalled: true, hinted: supported })}
            >
              I recalled it →
            </button>
            <button
              className="bk-button bk-outline"
              onClick={() => onDone({ spoken: !!voice.clip, recalled: false, hinted: supported })}
            >
              Needs more practice →
            </button>
          </div>
          <small>
            Memory is your self-check. Recordings count as speaking practice, not a pronunciation score.
          </small>
        </>
      )}
    </div>
  );
}
