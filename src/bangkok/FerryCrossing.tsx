import { useEffect, useRef, useState } from 'react';
import { crossingDuration, crossingTime } from './ferryPassage';
import './ferryCrossing.css';

export default function FerryCrossing({
  onProgress,
  onArrive,
  returning = false,
}: {
  onProgress: (progress: number) => void;
  onArrive: () => void;
  returning?: boolean;
}) {
  const [reduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [chapter, setChapter] = useState(0);
  const callbacks = useRef({ onProgress, onArrive });
  useEffect(() => {
    callbacks.current = { onProgress, onArrive };
  }, [onProgress, onArrive]);
  useEffect(() => {
    callbacks.current.onProgress(0);
    if (reduced) return;
    let elapsed = 0,
      last = performance.now(),
      frame = 0;
    const visibility = () => {
      last = performance.now();
    };
    document.addEventListener('visibilitychange', visibility);
    const step = (now: number) => {
      elapsed = crossingTime(elapsed, (now - last) / 1000, document.hidden);
      last = now;
      const p = elapsed / crossingDuration;
      callbacks.current.onProgress(p);
      setChapter(p < 0.35 ? 0 : p < 0.72 ? 1 : 2);
      if (p >= 1) callbacks.current.onArrive();
      else frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [reduced]);
  const lines = returning
    ? [
        'The timber houses recede as Niran leaves the Thonburi landing.',
        'Across the water, the familiar city lights come into view.',
        'Your friends are waiting on the other bank. The ferry can bring you back again.',
      ]
    : [
        'The lantern is alight. Niran eases the boat away from the pier.',
        'Sukhumvit, the park, the lantern streets. Each conversation brought you here.',
        'The timber walks of Thonburi come into view. There are people to meet on this bank too.',
      ];
  return (
    <section className="ferry-crossing" aria-label="The last ferry crossing">
      <p className="bk-eyebrow">THE LAST FERRY · CHAO PHRAYA</p>
      <h1>A passage earned.</h1>
      <p aria-live="polite">{lines[chapter]}</p>
      <button className="bk-button bk-outline" onClick={onArrive}>
        {reduced ? 'Arrive at the landing →' : 'Skip crossing →'}
      </button>
    </section>
  );
}
