import { useMemo, useState } from 'react';
import { type StackOrderPayload } from '../../../data/microgames';
import { type MicrogameMechanicProps } from '../microgameTypes';

/**
 * Stack Check-In — chunks appear in scrambled order in a "tray". The player
 * taps them in conversational order; each tap moves the chunk into the
 * "stacked line" above. Once all chunks are stacked correctly = pass. A
 * single wrong tap = instant fail.
 *
 * Why tap-to-stack instead of drag-and-drop: drag has terrible touch ergonomics
 * inside a 6-second microgame window, and tap-to-place teaches the same
 * sequencing skill.
 */
export function StackOrderGame({ config, onResult }: MicrogameMechanicProps) {
  const payload = config.payload as StackOrderPayload;
  const correct = payload.chunks;
  const scrambled = useMemo(() => shuffleWithIndex(correct), [correct]);

  // `placed` holds the indices (into the correct order) that the player has
  // already tapped, in their tap order. `usedOriginalIdx` is the set of
  // scrambled-tray chunks the player has consumed.
  const [placed, setPlaced] = useState<number[]>([]);
  const [usedOriginalIdx, setUsedOriginalIdx] = useState<Set<number>>(() => new Set());
  const resolved = useMemo(() => placed.length === correct.length, [placed.length, correct.length]);

  const handleTap = (scrambledIdx: number, correctIdx: number) => {
    if (resolved) return;
    if (usedOriginalIdx.has(scrambledIdx)) return;
    const expected = placed.length;
    if (correctIdx !== expected) {
      // Wrong chunk for this slot → fail.
      onResult(false);
      return;
    }
    const nextPlaced = placed.concat(correctIdx);
    const nextUsed = new Set(usedOriginalIdx);
    nextUsed.add(scrambledIdx);
    setPlaced(nextPlaced);
    setUsedOriginalIdx(nextUsed);
    if (nextPlaced.length === correct.length) {
      window.setTimeout(() => onResult(true), 200);
    }
  };

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-5 px-4 py-2">
      <p className="text-xs uppercase tracking-[0.22em] text-paper-muted">Tap chunks in the right order</p>

      {/* Stacked line (top) — fills as the player taps correctly. */}
      <div className="flex w-full max-w-2xl flex-col gap-2">
        {correct.map((chunk, i) => {
          const filled = placed.length > i;
          return (
            <div
              key={chunk.roman}
              className={`min-h-[3.2rem] rounded-lg border px-4 py-2 transition-colors ${
                filled
                  ? 'border-jade bg-jade/15 text-jade'
                  : 'border-dashed border-hairline bg-ink-raised/60 text-paper-quiet'
              }`}
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.18em]">Step {i + 1}</p>
              {filled ? (
                <>
                  {chunk.thai ? (
                    <p className="font-display text-base font-black leading-tight">{chunk.thai}</p>
                  ) : null}
                  <p className="text-sm font-bold leading-tight">{chunk.roman}</p>
                </>
              ) : (
                <p className="text-sm italic">— next chunk goes here —</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Scrambled tray (bottom). */}
      <div className="flex w-full max-w-2xl flex-wrap justify-center gap-2.5">
        {scrambled.map((entry) => {
          const used = usedOriginalIdx.has(entry.scrambledIdx);
          return (
            <button
              key={entry.scrambledIdx}
              type="button"
              onClick={() => handleTap(entry.scrambledIdx, entry.correctIdx)}
              disabled={used || resolved}
              className={`max-w-[18rem] flex-1 rounded-lg border px-3 py-2 text-left transition-[transform,background-color,border-color,color] duration-150 ease-out ${
                used
                  ? 'border-jade/40 bg-jade/10 text-paper-quiet opacity-60'
                  : 'border-hairline bg-ink-raised text-paper hover:border-accent hover:text-accent'
              } disabled:cursor-not-allowed`}
            >
              {entry.chunk.thai ? (
                <p className="font-display text-base font-black leading-tight">{entry.chunk.thai}</p>
              ) : null}
              <p className="text-sm font-bold leading-tight">{entry.chunk.roman}</p>
              <p className="text-[10px] uppercase tracking-[0.14em] text-paper-muted">
                {entry.chunk.meaning}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

type IndexedChunk = {
  scrambledIdx: number; // its index in the scrambled tray
  correctIdx: number; // its index in the conversational order
  chunk: StackOrderPayload['chunks'][number];
};

function shuffleWithIndex(chunks: StackOrderPayload['chunks']): IndexedChunk[] {
  const indexed: IndexedChunk[] = chunks.map((chunk, correctIdx) => ({
    scrambledIdx: 0,
    correctIdx,
    chunk,
  }));
  for (let i = indexed.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indexed[i], indexed[j]] = [indexed[j], indexed[i]];
  }
  return indexed.map((entry, scrambledIdx) => ({ ...entry, scrambledIdx }));
}
