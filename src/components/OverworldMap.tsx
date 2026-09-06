import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { lessonScenarios } from '../data/lessonScenarios';
import { TECH_DEMO_PLAYABLE_STAGE_COUNT } from '../data/techDemoConfig';
import {
  getStageThemeByScenarioId,
  useActiveScenarioIndex,
  useNavigationActions,
  useProgressionSnapshot,
} from '../store/selectors';

/**
 * OverworldMap — a Sukhumvit-themed transit-line overworld for Bangkok Rift.
 *
 * Patrick's ten-stage journey across magical Bangkok is laid out as stations on
 * a stylised Sukhumvit Skytrain line: the line snakes left→right across three
 * rows, lighting up cyan as the player travels it. Each station carries its own
 * rift colour (from stageThemes), a route label, and the first Thai phrase the
 * stage teaches — so the map doubles as a "what can I say where" overview.
 *
 * It is a drop-in alternative to the carousel <LevelSelect/>: same
 * `{ isOpen, onClose }` contract, same progression selectors, same tech-demo
 * lock gate and keyboard model, so TitleScreen can mount either one.
 */

export type OverworldMapProps = {
  isOpen: boolean;
  onClose: () => void;
};

/**
 * Hand-placed station anchors in a 1000×640 viewBox. A serpentine three-row
 * route reads as a transit map / journey rather than a flat list, and keeps the
 * ten stops legible without crowding. Index = scenario index.
 */
const STATIONS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 96, y: 168 }, // 1  Lobby
  { x: 300, y: 138 }, // 2  Reception
  { x: 520, y: 176 }, // 3  Food row
  { x: 772, y: 146 }, // 4  Taxi stand
  { x: 892, y: 322 }, // 5  Charm shop
  { x: 648, y: 360 }, // 6  Pharmacy
  { x: 392, y: 330 }, // 7  Cafe table
  { x: 250, y: 502 }, // 8  Lost alley
  { x: 520, y: 540 }, // 9  Archive hall
  { x: 812, y: 516 }, // 10 Temple gate
];

const VIEW_W = 1000;
const VIEW_H = 640;

const INK = '#0A0A0B';
const PANEL = '#15171B';
const PAPER = '#F4F1EB';
const CYAN = '#67E8F9';
const AMBER = '#F59E0B';
const JADE = '#7AE3B3';
const LINE_DIM = '#2B2F38';

type StationDatum = {
  index: number;
  scenarioId: string;
  title: string;
  routeLabel: string;
  location: string;
  rift: string;
  thai: string;
  roman: string;
  x: number;
  y: number;
  isCompleted: boolean;
  isCurrent: boolean;
  isLocked: boolean;
};

function polyline(points: ReadonlyArray<{ x: number; y: number }>): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
}

/** Single station marker + label, overlaid on the SVG line as a real button. */
const Station = memo(function Station({
  datum,
  isFocused,
  onFocus,
  onPlay,
  registerRef,
}: {
  datum: StationDatum;
  isFocused: boolean;
  onFocus: (index: number) => void;
  onPlay: (index: number) => void;
  registerRef: (index: number, el: HTMLButtonElement | null) => void;
}) {
  const { index, x, y, rift, isCompleted, isCurrent, isLocked } = datum;

  const handleClick = useCallback(() => {
    if (isLocked) {
      onFocus(index);
      return;
    }
    if (isFocused) onPlay(index);
    else onFocus(index);
  }, [isFocused, isLocked, index, onFocus, onPlay]);

  const handleRef = useCallback(
    (el: HTMLButtonElement | null) => registerRef(index, el),
    [index, registerRef],
  );

  // The disc colour: completed glows in its rift hue, current pulses cyan,
  // locked goes dashed-grey, available sits as an outlined ring.
  const discColor = isLocked ? '#3A3D44' : isCompleted ? rift : isCurrent ? CYAN : PAPER;
  const ring = isFocused ? (isLocked ? AMBER : CYAN) : discColor;

  return (
    <button
      ref={handleRef}
      type="button"
      onClick={handleClick}
      onMouseEnter={() => onFocus(index)}
      aria-label={`Stage ${index + 1}: ${datum.title}${
        isLocked ? ' (locked — tech demo)' : isCompleted ? ' (completed)' : isCurrent ? ' (current)' : ''
      }`}
      aria-current={isCurrent ? 'true' : undefined}
      aria-disabled={isLocked ? 'true' : undefined}
      className={`group absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center focus:outline-none ${
        isLocked ? 'cursor-not-allowed' : 'cursor-pointer'
      }`}
      style={{
        left: `${(x / VIEW_W) * 100}%`,
        top: `${(y / VIEW_H) * 100}%`,
        zIndex: isFocused ? 30 : 20,
      }}
    >
      {/* Station disc */}
      <span
        className={`relative grid place-items-center rounded-full border-2 font-display font-black transition-all duration-300 ${
          isFocused ? 'h-12 w-12 text-base' : 'h-9 w-9 text-sm'
        } ${isCurrent && !isLocked ? 'om-pulse' : ''}`}
        style={{
          borderColor: ring,
          color: isCompleted || isCurrent ? INK : ring,
          background: isCompleted ? rift : isCurrent ? CYAN : PANEL,
          borderStyle: isLocked ? 'dashed' : 'solid',
          boxShadow: isFocused ? `0 0 0 4px ${ring}33, 0 12px 30px ${ring}40` : `0 4px 14px ${INK}`,
        }}
      >
        {isLocked ? '🔒' : isCompleted ? '✓' : String(index + 1).padStart(2, '0')}
      </span>

      {/* Label chip */}
      <span
        className={`mt-2 flex max-w-[8.5rem] flex-col items-center rounded-md border px-2 py-1 text-center backdrop-blur transition-all duration-300 ${
          isFocused ? 'scale-105' : ''
        }`}
        style={{
          borderColor: isFocused ? `${ring}aa` : '#3A3D4480',
          background: 'rgba(10,10,11,0.82)',
        }}
      >
        <span
          className="font-display text-[9px] font-bold uppercase tracking-[0.18em]"
          style={{ color: isLocked ? `${AMBER}cc` : `${rift}` }}
        >
          E{index + 1} · {datum.routeLabel}
        </span>
        <span className="font-display text-[11px] font-black leading-tight" style={{ color: PAPER }}>
          {datum.title}
        </span>
        <span className="text-[11px] font-bold leading-tight" style={{ color: isLocked ? '#6b7280' : CYAN }}>
          {datum.thai}
        </span>
        {isFocused ? (
          <span
            className="mt-0.5 font-display text-[9px] font-black uppercase tracking-[0.2em]"
            style={{ color: isLocked ? AMBER : JADE }}
          >
            {isLocked ? 'Locked 🔒' : isCompleted ? 'Replay ▶' : isCurrent ? 'Play ▶' : 'Jump in ▶'}
          </span>
        ) : null}
      </span>
    </button>
  );
});

export function OverworldMap({ isOpen, onClose }: OverworldMapProps) {
  const activeScenarioIndex = useActiveScenarioIndex();
  const { completedScenarioIds } = useProgressionSnapshot();
  const { jumpToScenario } = useNavigationActions();
  const [focusedIndex, setFocusedIndex] = useState(activeScenarioIndex);
  const cardsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const stations = useMemo<StationDatum[]>(
    () =>
      lessonScenarios.map((scenario, index) => {
        const theme = getStageThemeByScenarioId(scenario.id);
        const anchor = scenario.chunks[0]?.phrases[0];
        return {
          index,
          scenarioId: scenario.id,
          title: scenario.title,
          routeLabel: theme.routeLabel,
          location: scenario.location,
          rift: theme.rift,
          thai: anchor?.targetPhrase ?? '',
          roman: anchor?.romanization ?? '',
          x: STATIONS[index]?.x ?? 0,
          y: STATIONS[index]?.y ?? 0,
          isCompleted: completedScenarioIds.includes(scenario.id),
          isCurrent: index === activeScenarioIndex,
          isLocked: index >= TECH_DEMO_PLAYABLE_STAGE_COUNT,
        };
      }),
    [activeScenarioIndex, completedScenarioIds],
  );

  // The "travelled" line lights up through every stop up to (and including) the
  // current bookmark; the road ahead stays dim + dashed.
  const reachedPath = useMemo(
    () => polyline(STATIONS.slice(0, Math.max(1, activeScenarioIndex + 1))),
    [activeScenarioIndex],
  );
  const fullPath = useMemo(() => polyline(STATIONS), []);

  useEffect(() => {
    if (!isOpen) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    setFocusedIndex(activeScenarioIndex);
    return () => {
      const opener = previouslyFocusedRef.current;
      if (opener && typeof opener.focus === 'function') opener.focus();
    };
  }, [isOpen, activeScenarioIndex]);

  // Move DOM focus to the focused station so keyboard + screen-reader users
  // track the selection (and the browser scrolls it into view on mobile).
  useEffect(() => {
    if (!isOpen) return;
    const card = cardsRef.current[focusedIndex];
    if (!card) return;
    card.focus({ preventScroll: false });
  }, [focusedIndex, isOpen]);

  const handlePlay = useCallback(
    (index: number) => {
      if (index >= TECH_DEMO_PLAYABLE_STAGE_COUNT) return;
      jumpToScenario(index);
      onClose();
    },
    [jumpToScenario, onClose],
  );

  const handleFocus = useCallback((index: number) => setFocusedIndex(index), []);
  const registerRef = useCallback((index: number, el: HTMLButtonElement | null) => {
    cardsRef.current[index] = el;
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        setFocusedIndex((i) => Math.min(lessonScenarios.length - 1, i + 1));
        return;
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        setFocusedIndex((i) => Math.max(0, i - 1));
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handlePlay(focusedIndex);
        return;
      }
      if (event.key === 'Tab') {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const focusables = dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (event.shiftKey && active === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, focusedIndex, handlePlay, onClose]);

  const completedCount = useMemo(
    () => stations.filter((s) => s.isCompleted).length,
    [stations],
  );

  if (!isOpen) return null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Overworld Map"
      className="fixed inset-0 z-[100] flex flex-col bg-[rgba(10,10,11,0.9)] backdrop-blur-md"
    >
      <style>{`
        @keyframes omPulse { 0%,100% { box-shadow: 0 0 0 0 ${CYAN}66; } 50% { box-shadow: 0 0 0 9px ${CYAN}00; } }
        .om-pulse { animation: omPulse 1.8s ease-out infinite; }
        @keyframes omDash { to { stroke-dashoffset: -28; } }
        .om-travel { animation: omDash 1.1s linear infinite; }
      `}</style>

      <header className="flex items-baseline justify-between gap-4 border-b border-[#3A3D44]/70 px-6 py-4 sm:px-10">
        <div>
          <p className="font-display text-[10px] font-bold uppercase tracking-[0.32em] text-[#67E8F9] sm:text-xs">
            Bangkok Rift · Sukhumvit Line
          </p>
          <h2 className="mt-1 font-display text-2xl font-black uppercase tracking-tight text-[#F4F1EB] sm:text-3xl">
            Overworld Map
          </h2>
        </div>
        <div className="flex items-center gap-3 sm:gap-5">
          <p className="hidden text-[10px] font-bold uppercase tracking-[0.24em] text-[#F4F1EB]/60 sm:block sm:text-xs">
            {completedCount} of {TECH_DEMO_PLAYABLE_STAGE_COUNT} stops cleared
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close map"
            className="grid h-10 w-10 place-items-center rounded-full border border-[#3A3D44] bg-[#15171B] text-lg font-bold text-[#F4F1EB] transition hover:border-[#67E8F9]/60 hover:text-[#67E8F9]"
          >
            ✕
          </button>
        </div>
      </header>

      {/* Map surface — scrolls horizontally on narrow screens so the line never
          squashes below legibility. */}
      <div className="flex flex-1 items-center justify-center overflow-auto p-4 sm:p-8">
        <div
          className="relative w-full min-w-[680px] max-w-[1040px]"
          style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}` }}
        >
          <svg
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            className="absolute inset-0 h-full w-full"
            style={{ pointerEvents: 'none' }}
            aria-hidden="true"
          >
            <defs>
              <radialGradient id="omGlow" cx="50%" cy="40%" r="75%">
                <stop offset="0%" stopColor="#13212e" />
                <stop offset="100%" stopColor={INK} />
              </radialGradient>
              <pattern id="omGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1c2027" strokeWidth="1" />
              </pattern>
            </defs>

            {/* City backdrop: soft glow + faint street grid (the sois) */}
            <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill="url(#omGlow)" rx="18" />
            <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill="url(#omGrid)" opacity="0.5" rx="18" />

            {/* The full line — dim base */}
            <path
              d={fullPath}
              fill="none"
              stroke={LINE_DIM}
              strokeWidth="10"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Road-ahead dashes over the dim line for "not travelled yet" read */}
            <path
              d={fullPath}
              fill="none"
              stroke="#3b414c"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="2 16"
            />
            {/* Travelled portion — bright cyan with an animated flow */}
            <path
              d={reachedPath}
              fill="none"
              stroke={CYAN}
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.95"
              style={{ filter: `drop-shadow(0 0 6px ${CYAN}aa)` }}
            />
            <path
              d={reachedPath}
              className="om-travel"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="2 12"
              opacity="0.8"
            />
          </svg>

          {/* Stations overlay */}
          {stations.map((datum) => (
            <Station
              key={datum.scenarioId}
              datum={datum}
              isFocused={datum.index === focusedIndex}
              onFocus={handleFocus}
              onPlay={handlePlay}
              registerRef={registerRef}
            />
          ))}
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-[#3A3D44]/70 px-6 py-3 sm:px-10">
        <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#F4F1EB]/55">
          <span className="grid h-4 w-4 place-items-center rounded-full text-[8px] text-[#0A0A0B]" style={{ background: JADE }}>✓</span>
          Cleared
        </span>
        <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#F4F1EB]/55">
          <span className="h-4 w-4 rounded-full border-2" style={{ borderColor: CYAN, background: '#15171B' }} />
          You are here
        </span>
        <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#F4F1EB]/55">
          <span className="h-4 w-4 rounded-full border-2 border-dashed" style={{ borderColor: '#3A3D44' }} />
          Locked
        </span>
        <span className="hidden text-[10px] font-bold uppercase tracking-[0.28em] text-[#F4F1EB]/40 sm:inline">
          ← → to ride the line · Enter to play · Esc to close
        </span>
      </footer>
    </div>
  );
}
