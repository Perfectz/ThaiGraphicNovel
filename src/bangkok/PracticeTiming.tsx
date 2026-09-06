import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { PracticeClock } from './practiceClock';
const PracticeRegistration = createContext<() => () => void>(() => () => {});

export function usePracticeSurface() {
  const register = useContext(PracticeRegistration);
  useEffect(() => register(), [register]);
}

export function usePracticeClock(active: boolean, onSeconds: (seconds: number) => void) {
  const state = useRef({ active, onSeconds });
  state.current = { active, onSeconds };
  const clock = useRef<PracticeClock | null>(null);
  useEffect(() => {
    clock.current?.reset(performance.now());
  }, [active]);
  useEffect(() => {
    const counter = new PracticeClock(performance.now());
    clock.current = counter;
    const touch = () => counter.touch(performance.now());
    const visibility = () => counter.reset(performance.now());
    window.addEventListener('pointerdown', touch);
    window.addEventListener('keydown', touch);
    document.addEventListener('visibilitychange', visibility);
    const timer = window.setInterval(() => {
      const seconds = counter.sample(performance.now(), state.current.active, !document.hidden);
      if (seconds > 0) state.current.onSeconds(seconds);
    }, 1000);
    return () => {
      clearInterval(timer);
      window.removeEventListener('pointerdown', touch);
      window.removeEventListener('keydown', touch);
      document.removeEventListener('visibilitychange', visibility);
      clock.current = null;
    };
  }, []);
}

export function PracticeScope({
  enabled,
  onSeconds,
  children,
}: {
  enabled: boolean;
  onSeconds: (seconds: number) => void;
  children: ReactNode;
}) {
  const [surfaces, setSurfaces] = useState(0);
  const register = useCallback(() => {
    setSurfaces((n) => n + 1);
    return () => setSurfaces((n) => Math.max(0, n - 1));
  }, []);
  usePracticeClock(enabled && surfaces > 0, onSeconds);
  return <PracticeRegistration.Provider value={register}>{children}</PracticeRegistration.Provider>;
}
