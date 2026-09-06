import { useEffect, useRef, useState } from 'react';
import type { ActiveJourney, JourneyResult } from './cityJourneys';
import {
  cityJourneys,
  journeyHosts,
  journeyPhrase,
  journeyIsRecall,
  journeyIntentChoices,
  journeyUsedMeaningHelp,
} from './cityJourneys';
import { journeySituation } from './journeySituations';
import { phrases } from './curriculum';
import SpeakChoice from './SpeakChoice';
import { usePracticeSurface } from './PracticeTiming';
import { useTrainingVoice } from './useTrainingVoice';

export default function JourneyVisit({
  active,
  onDone,
  onBusy,
  onMeaningHelp,
}: {
  active: ActiveJourney;
  onDone: (result: JourneyResult) => void;
  onBusy: (busy: boolean) => void;
  onMeaningHelp: () => void;
}) {
  const [intentionChosen, setIntentionChosen] = useState(false);
  const definition = cityJourneys[active.id - 1],
    host = journeyHosts[definition.actors[active.stop]];
  const phrase = phrases[journeyPhrase(active)],
    recall = journeyIsRecall(active);
  return (
    <section className="journey-visit" data-speaking-scroll>
      <div className="journey-brief">
        <p className="bk-eyebrow">
          STOP {active.stop + 1}/3 · {host.name} ·{' '}
          {active.step >= 3 ? 'PUT IT TO USE' : recall ? 'TRY WITHOUT THAI' : 'LISTEN & REHEARSE'}{' '}
          {(active.step % 3) + 1}/3
        </p>
        <h2>{definition.title}</h2>
        <div className="journey-situation" aria-label="Your speaking situation">
          <small>YOUR SITUATION</small>
          <p>{journeySituation(definition.actors[active.stop], phrase.id)}</p>
        </div>
        <div className="journey-step-track">
          {Array.from({ length: 6 }, (_, i) => (
            <i key={i} className={i <= active.step ? 'active' : ''} />
          ))}
        </div>
        <p className="journey-companion-note">
          {recall && active.step < 3
            ? 'Earlier self-checks show you have recalled this line on more than one day. Try it before opening the Thai; a hint is always available.'
            : active.step >= 3
              ? 'Read the situation and decide what you want to say. Then try the Thai from memory. You can always ask for help.'
              : 'Su stays beside you. Listen, take a breath, and give the words a try. We can always practise again.'}
        </p>
      </div>
      {active.step >= 3 && !intentionChosen ? (
        <JourneyIntent active={active} onChosen={() => setIntentionChosen(true)} onHelp={onMeaningHelp} />
      ) : !recall ? (
        <SpeakChoice
          choices={[phrase]}
          initialPhraseId={phrase.id}
          onBusyChange={onBusy}
          onSubmit={(_, spoken) => onDone({ spoken })}
        />
      ) : (
        <RecallLine
          phraseId={phrase.id}
          meaningHelp={journeyUsedMeaningHelp(active)}
          onDone={onDone}
          onBusy={onBusy}
        />
      )}
    </section>
  );
}
function JourneyIntent({
  active,
  onChosen,
  onHelp,
}: {
  active: ActiveJourney;
  onChosen: () => void;
  onHelp: () => void;
}) {
  usePracticeSurface();
  const [feedback, setFeedback] = useState('');
  const host = journeyHosts[cityJourneys[active.id - 1].actors[active.stop]];
  return (
    <div className="journey-intent">
      <small>DECIDE WHAT TO SAY</small>
      <h3>What would help here?</h3>
      <p>Choose your meaning in English. You will practise saying it in Thai next.</p>
      <div className="journey-intent-choices">
        {journeyIntentChoices(active).map((id) => (
          <button
            key={id}
            lang="en"
            data-intention={id}
            onClick={() => {
              if (id === journeyPhrase(active)) onChosen();
              else {
                onHelp();
                setFeedback(
                  `“${phrases[id].translation}” means something different. Think about what ${host.name} needs from you in this situation, then try another reply. No progress is lost.`,
                );
              }
            }}
          >
            {phrases[id].translation}
            <span aria-hidden="true">→</span>
          </button>
        ))}
      </div>
      <p className="journey-intent-feedback" role="status">
        {feedback}
      </p>
    </div>
  );
}
function RecallLine({
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
