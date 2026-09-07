import { useEffect, useRef, useState } from 'react';
import type { ThaiPhrase } from '../data/thaiPhrases';
import { useTrainingVoice } from './useTrainingVoice';
import './SpeakChoice.css';
import { usePracticeSurface } from './PracticeTiming';
import { stopStoryVoice } from './recordedVoice';
import RealtimeAttack from './RealtimeAttack';
import type { SpeechAssessment } from './speechPower';

type Props = {
  choices: ThaiPhrase[];
  onSubmit: (id: string, spoken: boolean, assessment?: SpeechAssessment) => void;
  speechAttack?: { turnKey: string; baseDamage: number };
  onBusyChange: (busy: boolean) => void;
  choicesClassName?: string;
  onPreview?: () => void;
  initialPhraseId?: string;
};
/** Selecting a meaning is a preview, never a submitted answer. */
export default function SpeakChoice({
  choices,
  onSubmit,
  onBusyChange,
  choicesClassName = 'rpg-answers',
  onPreview,
  initialPhraseId,
  speechAttack,
}: Props) {
  usePracticeSurface();
  const [selectedId, setSelectedId] = useState<string | null>(initialPhraseId ?? null);
  const root = useRef<HTMLDivElement>(null);
  const meaningHeading = useRef<HTMLHeadingElement>(null);
  const previousChoice = useRef<string | null>(null);
  const selected = choices.find((p) => p.id === selectedId);
  const voice = useTrainingVoice(selected);
  const [assessmentBusy, setAssessmentBusy] = useState(false);
  const busy = voice.recording || voice.coachBusy || assessmentBusy;
  useEffect(() => {
    onBusyChange(busy);
    return () => onBusyChange(false);
  }, [busy, onBusyChange]);
  useEffect(() => {
    if (selectedId) {
      stopStoryVoice();
      previousChoice.current = selectedId;
      // A choice low in a scrolling conversation must reveal the new speaking view from its top.
      root.current?.closest('[data-speaking-scroll]')?.scrollTo({ top: 0, behavior: 'instant' });
      meaningHeading.current?.focus({ preventScroll: true });
    } else if (previousChoice.current) {
      const choices = root.current?.querySelectorAll<HTMLButtonElement>('[data-phrase-choice]');
      Array.from(choices ?? [])
        .find((button) => button.dataset.phraseChoice === previousChoice.current)
        ?.focus();
    }
  }, [selectedId]);
  function submit(spoken: boolean, assessment?: SpeechAssessment) {
    if (!selected || busy || (spoken && !voice.clip)) return;
    const id = selected.id;
    setSelectedId(null);
    onSubmit(id, spoken, assessment);
  }
  return (
    <div className="speak-choice" ref={root}>
      {!selected ? (
        <>
          <p className="speak-step">1 · Choose what you mean</p>
          <p className="speak-guidance">
            Read the English first. Choose a line to practise saying it in Thai.
          </p>
          <div className={`${choicesClassName} thai-choice-list`}>
            {choices.map((p) => (
              <button
                key={p.id}
                data-phrase-choice={p.id}
                onClick={() => {
                  onPreview?.();
                  setSelectedId(p.id);
                }}
              >
                <span className="choice-meaning" lang="en">
                  {p.translation}
                </span>
                <strong lang="th">{p.targetPhrase}</strong>
                <small>{p.romanization}</small>
                <span className="choice-invitation">Practise this line →</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <section className="speak-preview" aria-label="Practise your selected reply">
          <p className="speak-step">2 · Say it in Thai</p>
          <span className="speak-meaning-label">YOU ARE SAYING</span>
          <h3 lang="en" ref={meaningHeading} tabIndex={-1}>
            {selected.translation}
          </h3>
          <p className="speak-thai" lang="th">
            {selected.targetPhrase}
          </p>
          <p className="speak-roman">{selected.romanization}</p>
          <p className="speak-guidance">Listen to Su’s AI voice, then say the Thai aloud.</p>
          <div className="speak-listen-controls">
            <button onClick={() => void voice.play()} disabled={busy}>
              ♫ Hear this line
            </button>
            <button onClick={() => void voice.play(true)} disabled={busy}>
              Hear it slowly
            </button>
            {voice.clip && (
              <button onClick={() => void voice.play(false, true)} disabled={busy}>
                ▷ Play my recording
              </button>
            )}
          </div>
          <button
            className="bk-button bk-gold speak-record"
            onClick={() => void voice.record()}
            disabled={voice.coachBusy || assessmentBusy}
          >
            {voice.recording
              ? '■ Stop recording'
              : voice.coachBusy
                ? 'Opening microphone…'
                : voice.clip
                  ? '◉ Record again'
                  : '◉ Record this line'}
          </button>
          <p className="speak-status" role="status">
            {voice.message || 'Your turn. A small attempt aloud is worth making.'}
          </p>
          {speechAttack && selected.id === 'hello' && <RealtimeAttack key={speechAttack.turnKey}
            clip={voice.clip} blocked={voice.recording || voice.coachBusy} {...speechAttack}
            onBusy={setAssessmentBusy} onCommit={assessment => submit(true, assessment)} />}
          <button
            className="bk-button bk-outline"
            onClick={() => submit(true)}
            disabled={busy || !voice.clip}
          >
            Use my spoken reply →
          </button>
          <p className="speak-honesty">
            Recording logs speaking practice. It does not automatically grade your pronunciation.
          </p>
          <div className="speak-secondary">
            <button onClick={() => setSelectedId(null)} disabled={busy}>
              ← Choose a different meaning
            </button>
            <button onClick={() => submit(false)} disabled={busy}>
              Use text only this time
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
