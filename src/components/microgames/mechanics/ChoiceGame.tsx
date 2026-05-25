import { useMemo, useState } from 'react';
import { type ChoiceOption, type ChoicePayload } from '../../../data/microgames';
import { type MicrogameMechanicProps } from '../microgameTypes';

/**
 * The workhorse mechanic — used by Match Meaning, Yes/No, Rescue Phrase,
 * Grab The Key, Floor Panic, Slow Down, Say It Again, One Plate, and
 * Compliment Combo. Two to four phrase buttons, one is correct, instant
 * pass/fail on tap.
 *
 * We shuffle options on first render so the correct answer is never in a
 * predictable slot. We do NOT re-shuffle on re-render (e.g. timeLeftMs ticks)
 * because that would move buttons under the player's finger mid-game.
 */
export function ChoiceGame({ config, onResult }: MicrogameMechanicProps) {
  const payload = config.payload as ChoicePayload;
  const shuffled = useMemo(() => shuffle(payload.options), [payload]);
  const [pickedIndex, setPickedIndex] = useState<number | null>(null);

  const handlePick = (index: number, opt: ChoiceOption) => {
    if (pickedIndex !== null) return;
    setPickedIndex(index);
    // Tiny delay so the player SEES which button they tapped flash, then the
    // runner takes over and shows the verdict overlay.
    window.setTimeout(() => onResult(Boolean(opt.correct)), 220);
  };

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-5 px-4">
      <div className="w-full max-w-xl rounded-xl border border-accent/40 bg-ink-elevated/80 p-5 text-center shadow-card">
        {payload.promptThai ? (
          <p className="font-display text-3xl font-black text-paper sm:text-4xl">{payload.promptThai}</p>
        ) : null}
        <p className="mt-2 text-xl font-bold text-accent sm:text-2xl">{payload.prompt}</p>
        {payload.promptHint ? (
          <p className="mt-2 text-xs uppercase tracking-[0.18em] text-paper-muted">{payload.promptHint}</p>
        ) : null}
      </div>

      <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
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
              className={`rounded-lg border px-4 py-3 text-left transition-[transform,background-color,border-color,color] duration-150 ease-out ${tone} disabled:cursor-not-allowed`}
            >
              {opt.thai ? (
                <p className="font-display text-lg font-black leading-tight sm:text-xl">{opt.thai}</p>
              ) : null}
              <p className="text-base font-bold leading-snug sm:text-lg">{opt.roman}</p>
              {opt.meaning ? (
                <p className="mt-0.5 text-xs uppercase tracking-[0.14em] text-paper-muted">{opt.meaning}</p>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Fisher-Yates shuffle on a fresh array — never mutates the caller's input. */
function shuffle<T>(items: ReadonlyArray<T>): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
