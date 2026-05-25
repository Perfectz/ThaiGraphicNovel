import { useEffect, useRef, useState } from 'react';
import { type TapBeatPayload } from '../../../data/microgames';
import { type MicrogameMechanicProps } from '../microgameTypes';

/**
 * Tap The Beat — each syllable is a chip. Markers light up one by one on
 * a steady gap. The player taps each chip while its marker is hot (inside
 * `hitWindowMs` of the beat target). Hitting all syllables in their windows
 * = pass. Missing a beat (window closes) or tapping out of order = fail.
 *
 * The goal is rhythmic awareness, NOT precision — windows default to 420ms
 * which is generous on touch.
 */
export function TapBeatGame({ config, onResult }: MicrogameMechanicProps) {
  const payload = config.payload as TapBeatPayload;
  const syllables = payload.syllables;
  const beatGap = payload.beatGapMs ?? 700;
  const hitWindow = payload.hitWindowMs ?? 420;

  // ms offset from mount when each beat fires.
  const beatTimes = useRef<number[]>(syllables.map((_, i) => 500 + i * beatGap));
  const startedAt = useRef<number>(performance.now());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hits, setHits] = useState<boolean[]>(() => syllables.map(() => false));
  const [nowMs, setNowMs] = useState(0);
  const resolved = useRef(false);

  // Animation loop — drives the marker pulse + checks for missed-beat fail.
  useEffect(() => {
    let frame = 0;
    function loop() {
      const elapsed = performance.now() - startedAt.current;
      setNowMs(elapsed);
      // Miss check: if the active beat's window has fully passed, fail.
      const target = beatTimes.current[currentIndex];
      if (target !== undefined && elapsed > target + hitWindow && !hits[currentIndex]) {
        if (!resolved.current) {
          resolved.current = true;
          onResult(false);
        }
        return;
      }
      frame = requestAnimationFrame(loop);
    }
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [currentIndex, hitWindow, hits, onResult]);

  const handleTap = (index: number) => {
    if (resolved.current) return;
    if (index !== currentIndex) {
      // Tapped a syllable out of order — fail. This is the "understand the
      // beat" check: random tapping shouldn't pass.
      resolved.current = true;
      onResult(false);
      return;
    }
    const elapsed = performance.now() - startedAt.current;
    const target = beatTimes.current[index];
    const delta = Math.abs(elapsed - target);
    if (delta > hitWindow) {
      resolved.current = true;
      onResult(false);
      return;
    }
    const nextHits = hits.slice();
    nextHits[index] = true;
    setHits(nextHits);
    if (index + 1 >= syllables.length) {
      resolved.current = true;
      window.setTimeout(() => onResult(true), 120);
    } else {
      setCurrentIndex(index + 1);
    }
  };

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 px-4">
      <div className="text-center">
        {payload.thai ? (
          <p className="font-display text-3xl font-black text-paper sm:text-4xl">{payload.thai}</p>
        ) : null}
        <p className="mt-1 text-sm font-bold uppercase tracking-[0.18em] text-paper-muted">
          {payload.meaning}
        </p>
      </div>

      {/* Beat track: one tile per syllable. Active tile pulses inside its
          hit window. Hit tiles latch jade, idle tiles dim. */}
      <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
        {syllables.map((syl, i) => {
          const target = beatTimes.current[i];
          const inWindow = Math.abs(nowMs - target) <= hitWindow;
          const isActive = i === currentIndex && inWindow;
          const isHit = hits[i];
          const tone = isHit
            ? 'border-jade bg-jade/20 text-jade'
            : isActive
              ? 'border-accent bg-accent/30 text-paper scale-110 shadow-[0_0_24px_var(--cyan-soft)]'
              : i === currentIndex
                ? 'border-accent/60 bg-ink-raised text-paper-muted'
                : 'border-hairline bg-ink-raised text-paper-quiet';
          return (
            <button
              key={`${syl}-${i}`}
              type="button"
              onClick={() => handleTap(i)}
              disabled={resolved.current}
              className={`min-w-[4.5rem] rounded-full border-2 px-4 py-3 font-display text-xl font-black uppercase tracking-wider transition-all duration-150 ease-out ${tone}`}
            >
              {syl}
            </button>
          );
        })}
      </div>

      <p className="text-xs uppercase tracking-[0.22em] text-paper-muted">Tap each syllable on the beat</p>
    </div>
  );
}
