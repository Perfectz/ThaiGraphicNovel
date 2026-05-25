import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { type MicrogameConfig, type MicrogameMechanic, type Stage, stageTitles } from '../../data/microgames';
import { type MicrogameMechanicProps } from './microgameTypes';
import { AddPoliteGame } from './mechanics/AddPoliteGame';
import { ChoiceGame } from './mechanics/ChoiceGame';
import { PeanutSwipeGame } from './mechanics/PeanutSwipeGame';
import { PointOrderGame } from './mechanics/PointOrderGame';
import { SpiceStopGame } from './mechanics/SpiceStopGame';
import { StackOrderGame } from './mechanics/StackOrderGame';
import { TapBeatGame } from './mechanics/TapBeatGame';

/**
 * Owns the WarioWare loop: intro card → play → verdict flash → next.
 *
 *  - The runner controls timing. Each microgame component decides WHEN it's
 *    done (by calling onResult). The runner force-fails on timeout.
 *  - We mount each mechanic with a fresh `key` so internal state resets
 *    between rounds without each mechanic having to teardown manually.
 *  - The intro card is short (900ms) because the command is what teaches the
 *    player what to do — there's no separate tutorial.
 */

const MECHANIC_MAP: Record<MicrogameMechanic, (props: MicrogameMechanicProps) => ReactElement> = {
  choice: ChoiceGame,
  addPolite: AddPoliteGame,
  tapBeat: TapBeatGame,
  stackOrder: StackOrderGame,
  spiceStop: SpiceStopGame,
  peanutSwipe: PeanutSwipeGame,
  pointOrder: PointOrderGame,
};

type RunnerPhase = 'intro' | 'play' | 'verdict' | 'summary';

const INTRO_MS = 900;
const VERDICT_MS = 900;

export type MicrogameRunnerProps = {
  stage: Stage;
  games: MicrogameConfig[];
  onExit: () => void;
};

export function MicrogameRunner({ stage, games, onExit }: MicrogameRunnerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<RunnerPhase>('intro');
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [lastPassed, setLastPassed] = useState<boolean | null>(null);
  const [timeLeftMs, setTimeLeftMs] = useState(0);

  // Lock the result so a mechanic can't double-call onResult, and a timeout
  // can't fire after the mechanic already resolved.
  const resolvedRef = useRef(false);
  const playStartedAt = useRef<number>(0);

  const current = games[currentIndex];
  const isLast = currentIndex === games.length - 1;

  const finishRound = useCallback((passed: boolean) => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    setLastPassed(passed);
    if (passed) {
      setScore((s) => s + 1);
      setStreak((s) => {
        const next = s + 1;
        setBestStreak((b) => Math.max(b, next));
        return next;
      });
    } else {
      setStreak(0);
    }
    setPhase('verdict');
  }, []);

  // Intro → Play transition.
  useEffect(() => {
    if (phase !== 'intro') return;
    const t = window.setTimeout(() => {
      resolvedRef.current = false;
      playStartedAt.current = performance.now();
      setTimeLeftMs(current.durationMs);
      setPhase('play');
    }, INTRO_MS);
    return () => window.clearTimeout(t);
  }, [phase, current]);

  // Play countdown — also force-fails on timeout.
  useEffect(() => {
    if (phase !== 'play') return;
    let frame = 0;
    function tick() {
      const elapsed = performance.now() - playStartedAt.current;
      const left = current.durationMs - elapsed;
      setTimeLeftMs(left);
      if (left <= 0) {
        finishRound(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [phase, current.durationMs, finishRound]);

  // Verdict → next round / summary.
  useEffect(() => {
    if (phase !== 'verdict') return;
    const t = window.setTimeout(() => {
      if (isLast) {
        setPhase('summary');
      } else {
        setCurrentIndex((i) => i + 1);
        setPhase('intro');
      }
    }, VERDICT_MS);
    return () => window.clearTimeout(t);
  }, [phase, isLast]);

  const Mechanic = MECHANIC_MAP[current.mechanic];
  const timePct = useMemo(
    () => Math.max(0, Math.min(1, timeLeftMs / current.durationMs)),
    [current.durationMs, timeLeftMs],
  );

  const handleReplay = () => {
    setCurrentIndex(0);
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setLastPassed(null);
    setPhase('intro');
  };

  return (
    <main className="microgame-runner fixed inset-0 z-[100] flex h-dvh w-screen flex-col bg-ink text-paper">
      {/* Top HUD */}
      <header className="microgame-runner__header flex items-center justify-between gap-3 border-b border-hairline px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-accent">
            Microgames · Stage {stage}
          </p>
          <p className="truncate font-display text-base font-black uppercase tracking-tight text-paper sm:text-lg">
            {stageTitles[stage]}
          </p>
        </div>
        <div className="flex items-center gap-3 text-right">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-paper-muted">Score</p>
            <p className="font-display text-xl font-black text-paper">
              {score}/{games.length}
            </p>
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-paper-muted">Streak</p>
            <p className="font-display text-xl font-black text-accent">{streak}</p>
          </div>
          <button
            type="button"
            onClick={onExit}
            aria-label="Exit microgames"
            className="grid h-9 w-9 place-items-center rounded-full border border-hairline text-base text-paper transition hover:border-accent hover:text-accent"
          >
            ✕
          </button>
        </div>
      </header>

      {/* Timer bar */}
      <div className="h-1.5 w-full bg-hairline">
        <div
          className={`h-full transition-[width,background-color] duration-100 ease-linear ${
            phase === 'play' ? (timePct < 0.25 ? 'bg-ember' : 'bg-accent') : 'bg-transparent'
          }`}
          style={{ width: `${timePct * 100}%` }}
        />
      </div>

      {/* Stage */}
      <section className="microgame-runner__stage relative min-h-0 flex-1 overflow-hidden">
        {phase === 'intro' ? <IntroCard config={current} index={currentIndex} total={games.length} /> : null}
        {phase === 'play' ? (
          <div className="absolute inset-0">
            {/* Big command banner — always visible while playing. */}
            <div className="microgame-command-banner absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full border border-accent/50 bg-ink-elevated/90 px-5 py-1.5 text-center backdrop-blur">
              <p className="font-display text-sm font-black uppercase tracking-[0.24em] text-accent sm:text-base">
                {current.command}
              </p>
            </div>
            <div className="microgame-mechanic-frame absolute inset-0 pt-12">
              <Mechanic key={current.id} config={current} onResult={finishRound} timeLeftMs={timeLeftMs} />
            </div>
          </div>
        ) : null}
        {phase === 'verdict' && lastPassed !== null ? (
          <VerdictFlash passed={lastPassed} config={current} />
        ) : null}
        {phase === 'summary' ? (
          <SummaryCard
            stage={stage}
            score={score}
            total={games.length}
            bestStreak={bestStreak}
            onReplay={handleReplay}
            onExit={onExit}
          />
        ) : null}
      </section>
    </main>
  );
}

/** Brief WarioWare-style "title card" with the command and skill blurb. */
function IntroCard({ config, index, total }: { config: MicrogameConfig; index: number; total: number }) {
  // Inline keyframes for a SAFE pop-in (no translate(-50%) — the global
  // fadeInDown keyframe assumes an absolutely-centered element and would
  // shove this card off-screen).
  return (
    <div className="grid h-full w-full place-items-center px-6">
      <div
        className="w-full max-w-xl rounded-2xl border border-accent/60 bg-ink-elevated p-6 text-center shadow-card"
        style={{ animation: 'microgameIntroPop 280ms cubic-bezier(0.18, 0.92, 0.22, 1) both' }}
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-paper-muted">
          Game {index + 1} of {total} · {config.title}
        </p>
        <p className="mt-4 font-display text-3xl font-black uppercase tracking-tight text-accent sm:text-5xl">
          {config.command}
        </p>
        <p className="mt-3 text-sm text-paper-muted sm:text-base">{config.skill}</p>
      </div>
    </div>
  );
}

/** Pass/fail flash at the end of a round. Uses jade for pass, ember for fail. */
function VerdictFlash({ passed, config }: { passed: boolean; config: MicrogameConfig }) {
  return (
    <div className="grid h-full w-full place-items-center px-6">
      <div
        className={`rounded-2xl border-2 px-8 py-6 text-center shadow-card ${
          passed ? 'border-jade bg-jade/10 text-jade' : 'border-ember bg-ember/10 text-ember'
        }`}
      >
        <p className="font-display text-4xl font-black uppercase tracking-wider sm:text-6xl">
          {passed ? 'GOT IT!' : 'OOPS!'}
        </p>
        <p className="mt-2 text-sm uppercase tracking-[0.22em] text-paper-muted">{config.title}</p>
      </div>
    </div>
  );
}

/** Final scorecard with replay + exit. */
function SummaryCard({
  stage,
  score,
  total,
  bestStreak,
  onReplay,
  onExit,
}: {
  stage: Stage;
  score: number;
  total: number;
  bestStreak: number;
  onReplay: () => void;
  onExit: () => void;
}) {
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const grade = pct >= 90 ? 'S' : pct >= 75 ? 'A' : pct >= 60 ? 'B' : pct >= 40 ? 'C' : 'D';
  return (
    <div className="grid h-full w-full place-items-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-accent/50 bg-ink-elevated p-7 text-center shadow-card">
        <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-accent">
          Stage {stage} · {stageTitles[stage]}
        </p>
        <p className="mt-2 font-display text-2xl font-black uppercase text-paper">Set complete</p>
        <div className="my-5 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg border border-hairline bg-ink-raised py-3">
            <p className="text-[9px] uppercase tracking-[0.18em] text-paper-muted">Score</p>
            <p className="font-display text-xl font-black text-paper">
              {score}/{total}
            </p>
          </div>
          <div className="rounded-lg border border-hairline bg-ink-raised py-3">
            <p className="text-[9px] uppercase tracking-[0.18em] text-paper-muted">Best streak</p>
            <p className="font-display text-xl font-black text-accent">{bestStreak}</p>
          </div>
          <div className="rounded-lg border border-jade/50 bg-jade/10 py-3">
            <p className="text-[9px] uppercase tracking-[0.18em] text-paper-muted">Grade</p>
            <p className="font-display text-xl font-black text-jade">{grade}</p>
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={onReplay}
            className="rounded-md bg-accent px-5 py-3 font-display text-sm font-black uppercase tracking-[0.18em] text-ink transition active:translate-y-px"
          >
            Replay
          </button>
          <button
            type="button"
            onClick={onExit}
            className="rounded-md border border-hairline px-5 py-3 font-display text-sm font-black uppercase tracking-[0.18em] text-paper transition hover:border-accent hover:text-accent"
          >
            Back to hub
          </button>
        </div>
      </div>
    </div>
  );
}
