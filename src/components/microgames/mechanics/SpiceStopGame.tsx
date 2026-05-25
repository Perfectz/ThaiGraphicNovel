import { useEffect, useRef, useState } from 'react';
import { type SpiceStopPayload } from '../../../data/microgames';
import { type MicrogameMechanicProps } from '../microgameTypes';

/**
 * Spice Stop — a cursor sweeps left→right across labeled spice bands. Player
 * taps STOP to freeze the cursor; succeeds if it lands inside the band
 * marked `correct: true`. The cursor pings back and forth so the player has
 * a second chance if they miss the first pass before time runs out.
 *
 * The chosen band's romanized phrase is shown big after stopping so the
 * player connects "tap on NOT SPICY" to the actual Thai they would say.
 */
export function SpiceStopGame({ config, onResult }: MicrogameMechanicProps) {
  const payload = config.payload as SpiceStopPayload;
  const sweepMs = payload.sweepMs ?? 1700;
  const startedAt = useRef(performance.now());
  const [pct, setPct] = useState(0); // 0..1
  const [stopped, setStopped] = useState(false);
  const [pickedBandIndex, setPickedBandIndex] = useState<number | null>(null);
  const resolved = useRef(false);

  useEffect(() => {
    if (stopped) return;
    let frame = 0;
    function loop() {
      const elapsed = performance.now() - startedAt.current;
      // Triangle wave: 0 → 1 → 0 → 1, period = sweepMs.
      const phase = (elapsed / sweepMs) % 2;
      const value = phase < 1 ? phase : 2 - phase;
      setPct(value);
      frame = requestAnimationFrame(loop);
    }
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [stopped, sweepMs]);

  const handleStop = () => {
    if (stopped || resolved.current) return;
    setStopped(true);
    const bandCount = payload.bands.length;
    const bandIndex = Math.min(bandCount - 1, Math.floor(pct * bandCount));
    setPickedBandIndex(bandIndex);
    const picked = payload.bands[bandIndex];
    resolved.current = true;
    window.setTimeout(() => onResult(Boolean(picked.correct)), 380);
  };

  const cursorLeft = `${(pct * 100).toFixed(2)}%`;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-5 px-4">
      <p className="max-w-xl text-center text-base font-bold text-paper sm:text-lg">{payload.prompt}</p>

      {/* Spice meter — bands stretch the full width, cursor sits absolutely. */}
      <div className="relative w-full max-w-2xl">
        <div className="flex h-20 w-full overflow-hidden rounded-xl border-2 border-hairline">
          {payload.bands.map((band, i) => {
            const isPicked = pickedBandIndex === i;
            const tone = isPicked
              ? band.correct
                ? 'bg-jade/40 text-jade'
                : 'bg-ember/40 text-ember'
              : band.correct
                ? 'bg-jade/10 text-paper'
                : 'bg-gradient-to-b from-ember/20 to-ember/30 text-paper';
            return (
              <div
                key={band.label}
                className={`grid flex-1 place-items-center border-l border-hairline first:border-l-0 text-center transition-colors ${tone}`}
              >
                <p className="font-display text-sm font-black uppercase tracking-wider sm:text-base">
                  {band.label}
                </p>
              </div>
            );
          })}
        </div>
        {/* Cursor */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-[-8px] h-[calc(100%+16px)] w-[6px] -translate-x-1/2 rounded-full bg-paper shadow-[0_0_18px_var(--cyan)]"
          style={{ left: cursorLeft }}
        />
      </div>

      <button
        type="button"
        onClick={handleStop}
        disabled={stopped}
        className="rounded-full bg-accent px-10 py-4 font-display text-xl font-black uppercase tracking-[0.22em] text-ink shadow-card transition active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
      >
        STOP!
      </button>

      {pickedBandIndex !== null ? (
        <p className="text-center text-base font-bold text-paper">
          You said: <span className="text-accent">{payload.bands[pickedBandIndex].roman}</span>
        </p>
      ) : (
        <p className="text-xs uppercase tracking-[0.22em] text-paper-muted">
          Stop on the band you actually want
        </p>
      )}
    </div>
  );
}
