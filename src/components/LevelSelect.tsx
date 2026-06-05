import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { lessonScenarios } from '../data/lessonScenarios';
import { type StageTheme } from '../data/stageThemes';
import { TECH_DEMO_PLAYABLE_STAGE_COUNT } from '../data/techDemoConfig';
import {
  getStageThemeByScenarioId,
  useActiveScenarioIndex,
  useNavigationActions,
  useProgressionSnapshot,
} from '../store/selectors';
import stage01 from '../assets/levels/stage-01-hotel-lobby.png';
import stage02 from '../assets/levels/stage-02-front-desk.png';
import stage03 from '../assets/levels/stage-03-street-food.png';
import stage04 from '../assets/levels/stage-04-taxi.png';
import stage05 from '../assets/levels/stage-05-market.png';
import stage06 from '../assets/levels/stage-06-clinic.png';
import stage07 from '../assets/levels/stage-07-cafe.png';
import stage08 from '../assets/levels/stage-08-alley.png';
import stage09 from '../assets/levels/stage-09-archive.png';
import stage10 from '../assets/levels/stage-10-rift.png';

const thumbnails: ReadonlyArray<string> = [
  stage01,
  stage02,
  stage03,
  stage04,
  stage05,
  stage06,
  stage07,
  stage08,
  stage09,
  stage10,
];

type AnchorPhrase = { readonly thai: string; readonly roman: string };

/**
 * One Thai anchor phrase per stage. Hand-picked from each scenario's first
 * chunk so the level card carries a real piece of vocabulary the player
 * encounters in that stage. Keeps the title screen on-brief: "this game
 * teaches Thai."
 */
const stageAnchorPhrases: ReadonlyArray<AnchorPhrase> = [
  { thai: 'สวัสดีครับ', roman: 'sawatdee khrap' },
  { thai: 'ขอเช็คอินครับ', roman: 'khor check-in khrap' },
  { thai: 'เอาอันนี้ครับ', roman: 'ao an-nee khrap' },
  { thai: 'ไปที่นี่ครับ', roman: 'pai tee-nee khrap' },
  { thai: 'ลดหน่อยได้ไหม', roman: 'lot noi dai mai' },
  { thai: 'ปวดหัวครับ', roman: 'puat hua khrap' },
  { thai: 'ไปด้วยกันไหม', roman: 'pai duay gan mai' },
  { thai: 'ช่วยด้วยครับ', roman: 'chuay duay khrap' },
  { thai: 'ขออนุญาตครับ', roman: 'kho anuyat khrap' },
  { thai: 'ปิดรอยปริ', roman: 'pit roi pri' },
];

export type LevelSelectProps = {
  isOpen: boolean;
  onClose: () => void;
};

type LevelCardProps = {
  index: number;
  scenarioId: string;
  title: string;
  location: string;
  thumbnail: string;
  theme: StageTheme;
  phrase: AnchorPhrase | undefined;
  isCompleted: boolean;
  isCurrent: boolean;
  isFocused: boolean;
  isLocked: boolean;
  onFocus: (index: number) => void;
  onPlay: (index: number) => void;
  registerRef: (index: number, el: HTMLButtonElement | null) => void;
};

/**
 * Single level card. Memoized so changing `focusedIndex` only re-renders the
 * two cards whose focus state actually flipped (incoming + outgoing) instead
 * of all ten on every arrow keypress.
 */
const LevelCard = memo(function LevelCard({
  index,
  scenarioId,
  title,
  location,
  thumbnail,
  theme,
  phrase,
  isCompleted,
  isCurrent,
  isFocused,
  isLocked,
  onFocus,
  onPlay,
  registerRef,
}: LevelCardProps) {
  // Locked cards are still browsable (so the player can read what's coming
  // after launch) but tapping never jumps in — the second click just keeps
  // focus on the card so the tech-demo lock chip remains visible.
  const handleClick = useCallback(() => {
    if (isLocked) {
      onFocus(index);
      return;
    }
    if (isFocused) {
      onPlay(index);
    } else {
      onFocus(index);
    }
  }, [isFocused, isLocked, index, onFocus, onPlay]);

  const handleRef = useCallback(
    (el: HTMLButtonElement | null) => registerRef(index, el),
    [index, registerRef],
  );

  // The dark-fade-to-black thumbnail gradient is tinted with this stage's own
  // rift color (from stageThemes) so the carousel has visual rhythm without
  // breaking the surrounding Ink/Paper/Cyan title-screen palette.
  const thumbOverlay = useMemo<React.CSSProperties>(
    () => ({
      background: `linear-gradient(180deg, transparent 30%, rgba(21, 23, 27, 0.9) 100%), linear-gradient(180deg, ${theme.rift}20 0%, transparent 40%)`,
    }),
    [theme.rift],
  );

  const cardStyle = useMemo<React.CSSProperties>(
    () => ({ background: '#15171B', scrollSnapAlign: 'center', borderRadius: '14px' }),
    [],
  );

  const className = isLocked
    ? `group relative shrink-0 overflow-hidden border text-left transition-all duration-300 ${isFocused ? 'h-[26rem] w-80 scale-[1.04] border-[#F59E0B]/70 shadow-[0_24px_70px_rgba(245,158,11,0.18)]' : 'h-[24rem] w-64 border-[#3A3D44]/60'} cursor-not-allowed opacity-65`
    : isFocused
      ? 'group relative shrink-0 overflow-hidden border text-left transition-all duration-300 h-[26rem] w-80 scale-[1.04] border-[#67E8F9] shadow-[0_24px_70px_rgba(103,232,249,0.25)]'
      : 'group relative shrink-0 overflow-hidden border text-left transition-all duration-300 h-[24rem] w-64 border-[#3A3D44]/80 opacity-80 hover:opacity-100';

  return (
    <button
      key={scenarioId}
      ref={handleRef}
      type="button"
      onClick={handleClick}
      aria-label={`Stage ${index + 1}: ${title}${isLocked ? ' (locked — tech demo)' : isCompleted ? ' (completed)' : isCurrent ? ' (current)' : ''}`}
      aria-current={isCurrent ? 'true' : undefined}
      aria-disabled={isLocked ? 'true' : undefined}
      className={className}
      style={cardStyle}
    >
      <div className="relative h-44 w-full overflow-hidden">
        <img
          src={thumbnail}
          alt=""
          loading="lazy"
          decoding="async"
          className={`h-full w-full object-cover transition duration-500 ${isFocused ? 'scale-105' : 'scale-100'}`}
          draggable={false}
        />
        <div className="absolute inset-0" style={thumbOverlay} />
        <div className="absolute right-3 top-3 flex items-center gap-2">
          {isLocked ? (
            <span
              className="rounded-full border border-[#F59E0B]/70 bg-[#0A0A0B]/70 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.22em] text-[#F59E0B]"
              aria-hidden="true"
            >
              Locked
            </span>
          ) : null}
          {!isLocked && isCompleted ? (
            <span
              className="grid h-7 w-7 place-items-center rounded-full bg-[#7AE3B3] text-xs font-black text-[#0A0A0B]"
              aria-label="Completed"
            >
              ✓
            </span>
          ) : null}
          {!isLocked && isCurrent && !isCompleted ? (
            <span className="rounded-full border border-[#67E8F9]/70 bg-[#0A0A0B]/60 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.22em] text-[#67E8F9]">
              Next up
            </span>
          ) : null}
        </div>
        <div className="absolute bottom-3 left-3 font-display text-4xl font-black leading-none text-[#F4F1EB]">
          {String(index + 1).padStart(2, '0')}
        </div>
      </div>

      <div className="flex flex-col gap-2 p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#F4F1EB]/50">{location}</p>
        <h3 className="font-display text-lg font-black leading-tight tracking-tight text-[#F4F1EB]">
          {title}
        </h3>
        {phrase ? (
          <div className="mt-1">
            <p className="text-lg font-bold leading-tight text-[#67E8F9]">{phrase.thai}</p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#F4F1EB]/50">{phrase.roman}</p>
          </div>
        ) : null}
      </div>

      {isFocused && isLocked ? (
        <div className="absolute inset-x-4 bottom-4">
          <div className="flex items-center justify-between rounded-md border border-[#F59E0B]/60 bg-[#15171B] px-4 py-2.5 text-[#F59E0B]">
            <span className="font-display text-[11px] font-black uppercase tracking-[0.22em]">
              Coming after launch
            </span>
            <span aria-hidden="true" className="text-lg leading-none">
              🔒
            </span>
          </div>
        </div>
      ) : null}

      {isFocused && !isLocked ? (
        <div className="absolute inset-x-4 bottom-4">
          <div className="flex items-center justify-between rounded-md bg-[#67E8F9] px-4 py-2.5 text-[#0A0A0B]">
            <span className="font-display text-xs font-black uppercase tracking-[0.22em]">
              {isCompleted ? 'Replay' : isCurrent ? 'Play' : 'Jump in'}
            </span>
            <span aria-hidden="true" className="text-lg leading-none">
              ▶
            </span>
          </div>
        </div>
      ) : null}
    </button>
  );
});

export function LevelSelect({ isOpen, onClose }: LevelSelectProps) {
  const activeScenarioIndex = useActiveScenarioIndex();
  const { completedScenarioIds } = useProgressionSnapshot();
  const { jumpToScenario } = useNavigationActions();
  const [focusedIndex, setFocusedIndex] = useState(activeScenarioIndex);
  const cardsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  // When the overlay opens, snap focus to the current stage and remember
  // who opened us so we can restore focus to them on close.
  useEffect(() => {
    if (!isOpen) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    setFocusedIndex(activeScenarioIndex);
    return () => {
      const opener = previouslyFocusedRef.current;
      if (opener && typeof opener.focus === 'function') {
        opener.focus();
      }
    };
  }, [isOpen, activeScenarioIndex]);

  // Smooth-scroll the focused card into view + transfer DOM focus to it.
  useEffect(() => {
    if (!isOpen) return;
    const card = cardsRef.current[focusedIndex];
    if (!card) return;
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    card.focus({ preventScroll: true });
  }, [focusedIndex, isOpen]);

  const handlePlay = useCallback(
    (index: number) => {
      // Tech-demo gate: stages beyond the playable window are visible but
      // not enterable. Silently no-op the play action so the keyboard
      // Enter shortcut doesn't accidentally jump in.
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

  // Keyboard nav. Tab is trapped inside the dialog so the user can't escape
  // into the underlying page chrome while the modal is open.
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
        setFocusedIndex((index) => Math.min(lessonScenarios.length - 1, index + 1));
        return;
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        setFocusedIndex((index) => Math.max(0, index - 1));
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
    () => lessonScenarios.filter((scenario) => completedScenarioIds.includes(scenario.id)).length,
    [completedScenarioIds],
  );

  if (!isOpen) return null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Level Select"
      className="fixed inset-0 z-[100] flex flex-col bg-[rgba(10,10,11,0.78)] backdrop-blur-md"
    >
      <header className="flex items-baseline justify-between gap-4 border-b border-[#3A3D44]/70 px-6 py-4 sm:px-10">
        <div>
          <p className="font-display text-[10px] font-bold uppercase tracking-[0.32em] text-[#67E8F9] sm:text-xs">
            Bangkok Rift
          </p>
          <h2 className="mt-1 font-display text-2xl font-black uppercase tracking-tight text-[#F4F1EB] sm:text-3xl">
            Level Select
          </h2>
        </div>
        <div className="flex items-center gap-3 sm:gap-5">
          <p className="hidden text-[10px] font-bold uppercase tracking-[0.24em] text-[#F4F1EB]/60 sm:block sm:text-xs">
            {completedCount} of {TECH_DEMO_PLAYABLE_STAGE_COUNT} completed
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close level select"
            className="grid h-10 w-10 place-items-center rounded-full border border-[#3A3D44] bg-[#15171B] text-lg font-bold text-[#F4F1EB] transition hover:border-[#67E8F9]/60 hover:text-[#67E8F9]"
          >
            ✕
          </button>
        </div>
      </header>

      <div
        className="flex flex-1 items-center gap-6 overflow-x-auto overflow-y-hidden px-6 py-8 sm:gap-8 sm:px-16"
        style={{ scrollbarWidth: 'thin', scrollSnapType: 'x mandatory' }}
      >
        {lessonScenarios.map((scenario, index) => {
          const theme = getStageThemeByScenarioId(scenario.id);
          const isCompleted = completedScenarioIds.includes(scenario.id);
          const isCurrent = index === activeScenarioIndex;
          const isFocused = index === focusedIndex;
          const phrase = stageAnchorPhrases[index];
          const thumbnail = thumbnails[index];

          const isLocked = index >= TECH_DEMO_PLAYABLE_STAGE_COUNT;
          return (
            <LevelCard
              key={scenario.id}
              index={index}
              scenarioId={scenario.id}
              title={scenario.title}
              location={scenario.location}
              thumbnail={thumbnail}
              theme={theme}
              phrase={phrase}
              isCompleted={isCompleted}
              isCurrent={isCurrent}
              isFocused={isFocused}
              isLocked={isLocked}
              onFocus={handleFocus}
              onPlay={handlePlay}
              registerRef={registerRef}
            />
          );
        })}
      </div>

      <footer className="border-t border-[#3A3D44]/70 px-6 py-3 sm:px-10">
        <p className="text-center text-[10px] font-bold uppercase tracking-[0.28em] text-[#F4F1EB]/40">
          ← → to browse · Enter to play · Esc to close
        </p>
      </footer>
    </div>
  );
}
