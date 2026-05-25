import { useMemo, useState } from 'react';
import { type AddPolitePayload, type ChoiceOption } from '../../../data/microgames';
import { type MicrogameMechanicProps } from '../microgameTypes';

/**
 * "Add Khrap!" — phrase appears with the polite ending missing. Player taps
 * the right token to slot it in. Distractor tokens look similar enough
 * (khap / kha / mai) that the player can't pattern-match by length; they
 * have to know the male polite particle.
 */
export function AddPoliteGame({ config, onResult }: MicrogameMechanicProps) {
  const payload = config.payload as AddPolitePayload;
  const shuffled = useMemo(() => shuffle(payload.options), [payload]);
  const [pickedIndex, setPickedIndex] = useState<number | null>(null);
  const pickedOption = pickedIndex !== null ? shuffled[pickedIndex] : null;

  const handlePick = (index: number, opt: ChoiceOption) => {
    if (pickedIndex !== null) return;
    setPickedIndex(index);
    window.setTimeout(() => onResult(Boolean(opt.correct)), 280);
  };

  const showCorrect = pickedOption?.correct === true;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 px-4">
      {/* Phrase with blank slot. When picked, the slot fills with the chosen
          token so the player sees their build complete in real time. */}
      <div className="w-full max-w-xl rounded-xl border border-accent/40 bg-ink-elevated/80 p-5 text-center shadow-card">
        {payload.fullThai ? (
          <p className="text-xs uppercase tracking-[0.18em] text-paper-muted">Target: {payload.fullThai}</p>
        ) : null}
        <p className="mt-2 font-display text-3xl font-black leading-tight text-paper sm:text-4xl">
          {payload.phraseStem.split('___').map((chunk, i, arr) => (
            <span key={i}>
              <span>{chunk}</span>
              {i < arr.length - 1 ? (
                <span
                  className={`mx-1 inline-block min-w-[5ch] rounded-md border-2 border-dashed px-2 py-0.5 align-middle text-2xl font-black sm:text-3xl ${
                    pickedOption
                      ? showCorrect
                        ? 'border-jade bg-jade/15 text-jade'
                        : 'border-ember bg-ember/15 text-ember'
                      : 'border-accent/60 bg-ink-raised text-accent'
                  }`}
                >
                  {pickedOption ? pickedOption.roman : '___'}
                </span>
              ) : null}
            </span>
          ))}
        </p>
        <p className="mt-2 text-sm font-bold text-accent">{payload.meaning}</p>
      </div>

      <div className="flex w-full max-w-2xl flex-wrap justify-center gap-3">
        {shuffled.map((opt, index) => {
          const isPicked = pickedIndex === index;
          const tone = isPicked
            ? opt.correct
              ? 'border-jade bg-jade/20 text-jade'
              : 'border-ember bg-ember/20 text-ember'
            : 'border-hairline bg-ink-raised text-paper hover:border-accent hover:text-accent';
          return (
            <button
              key={`${opt.roman}-${index}`}
              type="button"
              onClick={() => handlePick(index, opt)}
              disabled={pickedIndex !== null}
              className={`min-w-[6rem] rounded-lg border px-4 py-3 text-center transition-[transform,background-color,border-color,color] duration-150 ease-out ${tone} disabled:cursor-not-allowed`}
            >
              {opt.thai ? <p className="font-display text-2xl font-black leading-none">{opt.thai}</p> : null}
              <p className="mt-1 text-base font-bold leading-none">{opt.roman}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function shuffle<T>(items: ReadonlyArray<T>): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
