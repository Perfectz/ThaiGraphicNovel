import { useMemo, useState } from 'react';
import { type ChoiceOption, type PointOrderPayload } from '../../../data/microgames';
import { type MicrogameMechanicProps } from '../microgameTypes';

/**
 * Point And Order — two-step microgame:
 *
 *   1. Tap the dish (left big glyph). This unlocks the phrase row.
 *   2. Tap the correct order phrase ("ao an nee khrap" = "I'll take this one").
 *
 * Forcing step 1 first matches the real-world ordering ritual: you point,
 * THEN you speak. Picking the phrase without pointing first does NOT pass
 * even if the phrase is right — that teaches the order of actions.
 */
export function PointOrderGame({ config, onResult }: MicrogameMechanicProps) {
  const payload = config.payload as PointOrderPayload;
  const shuffled = useMemo(() => shuffle(payload.options), [payload]);
  const [pointed, setPointed] = useState(false);
  const [pickedIndex, setPickedIndex] = useState<number | null>(null);

  const handlePoint = () => {
    if (pickedIndex !== null) return;
    setPointed(true);
  };

  const handlePick = (index: number, opt: ChoiceOption) => {
    if (pickedIndex !== null) return;
    if (!pointed) {
      // The player tried to speak before pointing. Treat as fail so the
      // sequence matters.
      setPickedIndex(index);
      window.setTimeout(() => onResult(false), 240);
      return;
    }
    setPickedIndex(index);
    window.setTimeout(() => onResult(Boolean(opt.correct)), 220);
  };

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-5 px-4">
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-6">
        <button
          type="button"
          onClick={handlePoint}
          disabled={pointed}
          aria-label={`Point at ${payload.dishLabel}`}
          className={`grid h-32 w-32 place-items-center rounded-2xl border-2 text-6xl transition-all ${
            pointed
              ? 'border-jade bg-jade/20 scale-105'
              : 'border-hairline bg-ink-elevated/80 hover:border-accent hover:scale-105 animate-pulse'
          }`}
        >
          {payload.dishGlyph}
        </button>
        <div className="text-center sm:text-left">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-paper-muted">Step 1</p>
          <p className="font-display text-lg font-black text-paper">Point at the {payload.dishLabel}</p>
          <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.22em] text-paper-muted">Step 2</p>
          <p className="font-display text-lg font-black text-paper">Pick the order phrase</p>
        </div>
      </div>

      <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
        {shuffled.map((opt, index) => {
          const isPicked = pickedIndex === index;
          const tone = isPicked
            ? opt.correct && pointed
              ? 'border-jade bg-jade/20 text-jade'
              : 'border-ember bg-ember/20 text-ember'
            : pointed
              ? 'border-hairline bg-ink-raised text-paper hover:border-accent hover:text-accent'
              : 'border-hairline bg-ink-raised/40 text-paper-quiet';
          return (
            <button
              key={`${opt.roman}-${index}`}
              type="button"
              onClick={() => handlePick(index, opt)}
              disabled={pickedIndex !== null}
              className={`rounded-lg border px-3 py-3 text-left transition-[transform,background-color,border-color,color] duration-150 ease-out ${tone} disabled:cursor-not-allowed`}
            >
              {opt.thai ? (
                <p className="font-display text-base font-black leading-tight">{opt.thai}</p>
              ) : null}
              <p className="text-sm font-bold leading-snug">{opt.roman}</p>
              {opt.meaning ? (
                <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-paper-muted">
                  {opt.meaning}
                </p>
              ) : null}
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
