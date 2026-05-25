import { useEffect, useMemo, useRef, useState } from 'react';
import { type PeanutSwipePayload } from '../../../data/microgames';
import { type MicrogameMechanicProps } from '../microgameTypes';

/**
 * Peanut Alert — peanuts (🥜) fall from the top of the play area toward the
 * dish at the bottom. Player either:
 *
 *   1. Taps/swipes each peanut to flick it away, OR
 *   2. Hits the "mai ao thua khrap" button to instantly clear all peanuts
 *      (the language win — saying "no peanuts" beats swiping them all).
 *
 * If any peanut reaches the dish (timeline complete and still falling) the
 * game fails. The text-finisher button is the "smart" path; we reward it
 * with an immediate pass so the player learns the phrase is the shortcut.
 */
export function PeanutSwipeGame({ config, onResult }: MicrogameMechanicProps) {
  const payload = config.payload as PeanutSwipePayload;
  const count = payload.peanutCount ?? 5;
  const fallMs = Math.max(2400, config.durationMs - 1800);
  const startedAt = useRef(performance.now());

  // Each peanut: horizontal position (0..1) and stagger offset (0..1 of total
  // fall window) so they don't all start at the top at the exact same moment.
  const peanuts = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: 0.12 + 0.76 * ((i + 0.5) / count) + (Math.random() - 0.5) * 0.08,
      delayMs: i * 200,
    }));
  }, [count]);

  const [swiped, setSwiped] = useState<Set<number>>(() => new Set());
  const [now, setNow] = useState(performance.now());
  const resolved = useRef(false);

  useEffect(() => {
    let frame = 0;
    function loop() {
      const t = performance.now();
      setNow(t);
      // Fail condition: any peanut not swiped, past its fall window, AND we
      // haven't already resolved with the finisher button.
      const elapsed = t - startedAt.current;
      for (const p of peanuts) {
        if (swiped.has(p.id)) continue;
        if (elapsed - p.delayMs > fallMs) {
          if (!resolved.current) {
            resolved.current = true;
            onResult(false);
          }
          return;
        }
      }
      // Win condition: all peanuts swiped.
      if (swiped.size >= count && !resolved.current) {
        resolved.current = true;
        window.setTimeout(() => onResult(true), 200);
        return;
      }
      frame = requestAnimationFrame(loop);
    }
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [count, fallMs, onResult, peanuts, swiped]);

  const handleSwipe = (id: number) => {
    if (resolved.current) return;
    if (swiped.has(id)) return;
    const next = new Set(swiped);
    next.add(id);
    setSwiped(next);
  };

  const handleFinisher = () => {
    if (resolved.current) return;
    resolved.current = true;
    // Mark all peanuts as swiped for visual consistency, then resolve.
    setSwiped(new Set(peanuts.map((p) => p.id)));
    window.setTimeout(() => onResult(Boolean(payload.textFinisher?.correct ?? true)), 280);
  };

  return (
    <div className="relative flex h-full w-full flex-col items-stretch justify-end gap-3 overflow-hidden px-4 pb-4 pt-8">
      <p className="absolute left-0 right-0 top-3 text-center text-xs uppercase tracking-[0.22em] text-paper-muted">
        Swipe peanuts away — or just tell the vendor NO PEANUTS
      </p>

      {/* Falling peanuts */}
      <div className="absolute inset-0 top-12 bottom-24">
        {peanuts.map((p) => {
          const isGone = swiped.has(p.id);
          const elapsed = now - startedAt.current - p.delayMs;
          const progress = Math.max(0, Math.min(1, elapsed / fallMs));
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => handleSwipe(p.id)}
              onMouseEnter={(event) => {
                if (event.buttons & 1) handleSwipe(p.id);
              }}
              onTouchMove={() => handleSwipe(p.id)}
              disabled={isGone}
              aria-label="Swipe peanut away"
              className={`absolute -ml-6 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full text-3xl transition-all duration-150 ease-out ${
                isGone ? 'pointer-events-none opacity-0 scale-50' : 'hover:scale-110 active:scale-90'
              }`}
              style={{
                left: `${p.x * 100}%`,
                top: `${progress * 100}%`,
                touchAction: 'none',
              }}
            >
              🥜
            </button>
          );
        })}
      </div>

      {/* Dish at the bottom — visual target for the player to defend. */}
      <div className="pointer-events-none mx-auto mb-3 grid h-16 w-40 place-items-center rounded-3xl border-2 border-accent/40 bg-ink-elevated/70 text-4xl shadow-card">
        🍛
      </div>

      {/* Text-finisher — the "language win". */}
      {payload.textFinisher ? (
        <button
          type="button"
          onClick={handleFinisher}
          disabled={resolved.current}
          className="mx-auto rounded-lg border border-accent bg-accent/10 px-5 py-3 text-center text-paper transition hover:bg-accent/20 disabled:cursor-not-allowed"
        >
          {payload.textFinisher.thai ? (
            <p className="font-display text-lg font-black leading-tight">{payload.textFinisher.thai}</p>
          ) : null}
          <p className="text-base font-bold leading-tight">{payload.textFinisher.roman}</p>
          {payload.textFinisher.meaning ? (
            <p className="text-[10px] uppercase tracking-[0.18em] text-paper-muted">
              {payload.textFinisher.meaning}
            </p>
          ) : null}
        </button>
      ) : null}
    </div>
  );
}
