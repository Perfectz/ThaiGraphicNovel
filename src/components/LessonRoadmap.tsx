import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { lessonScenarios } from '../data/lessonScenarios';
import { getPhrasePhoneticSpelling } from '../data/thaiPhrases';
import { useProgressionSnapshot } from '../store/selectors';
import { Card, Chip, Modal } from './ui';

type LessonRoadmapProps = {
  isOpen: boolean;
  onClose: () => void;
};

type StageStatus = 'completed' | 'current' | 'upcoming';

function statusFor(
  scenarioIndex: number,
  activeIndex: number,
  completedIds: ReadonlyArray<string>,
): StageStatus {
  const scenario = lessonScenarios[scenarioIndex];
  if (scenario && completedIds.includes(scenario.id)) return 'completed';
  if (scenarioIndex === activeIndex) return 'current';
  return 'upcoming';
}

/**
 * Two-pane scannable roadmap. Replaces the previous wall-of-cards layout
 * (10 scenarios × 3 chunks × 3-4 phrases all rendered at once in a 2-col
 * grid) with a sticky left rail of stages and a detail pane that swaps to
 * the focused one. Keyboard nav matches LevelSelect (↑↓ focus, Enter selects,
 * Esc closes via the parent Modal). See plan §2.4.
 */
export function LessonRoadmap({ isOpen, onClose }: LessonRoadmapProps) {
  const { activeScenarioIndex, completedScenarioIds } = useProgressionSnapshot();
  const [focusedIndex, setFocusedIndex] = useState(activeScenarioIndex);
  const railRefs = useRef<Array<HTMLButtonElement | null>>([]);
  // Track whether the rail itself holds the keyboard focus — only then should
  // ↑↓ Home/End behave as a roving tabindex list (the spec for radio-style
  // single-selection lists). If the user has tabbed into the detail pane we
  // leave their typing alone.
  const [railHasFocus, setRailHasFocus] = useState(false);

  // Snap focus to the player's current stage every time the modal opens.
  useEffect(() => {
    if (!isOpen) return;
    setFocusedIndex(activeScenarioIndex);
  }, [isOpen, activeScenarioIndex]);

  // When the focused rail item changes (via keyboard or click), move DOM focus
  // and scroll it into view. Only do this if the rail currently owns focus —
  // otherwise we'd yank focus away from the user mid-action.
  useEffect(() => {
    if (!isOpen || !railHasFocus) return;
    const button = railRefs.current[focusedIndex];
    if (!button) return;
    button.focus({ preventScroll: true });
    button.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [focusedIndex, isOpen, railHasFocus]);

  const handleRailKey = useCallback((event: React.KeyboardEvent<HTMLElement>) => {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        event.preventDefault();
        setFocusedIndex((index) => Math.min(lessonScenarios.length - 1, index + 1));
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        event.preventDefault();
        setFocusedIndex((index) => Math.max(0, index - 1));
        break;
      case 'Home':
        event.preventDefault();
        setFocusedIndex(0);
        break;
      case 'End':
        event.preventDefault();
        setFocusedIndex(lessonScenarios.length - 1);
        break;
      default:
    }
  }, []);

  const completedCount = useMemo(
    () => lessonScenarios.filter((scenario) => completedScenarioIds.includes(scenario.id)).length,
    [completedScenarioIds],
  );

  const focusedScenario = lessonScenarios[focusedIndex] ?? lessonScenarios[0];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      eyebrow="Thai Quest Roadmap"
      title="Bangkok Rift — Lessons"
      className="!max-w-5xl"
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Chip>
          {completedCount} of {lessonScenarios.length} completed
        </Chip>
        <Chip tone="accent">Stage {activeScenarioIndex + 1} next up</Chip>
      </div>

      <div className="grid gap-4 sm:grid-cols-[14rem_minmax(0,1fr)]">
        {/* Left rail — stage list with roving-tabindex keyboard nav.
            Uses <div role="listbox"> rather than <nav> because listbox is an
            interactive ARIA role and `<nav>` is a non-interactive landmark;
            assigning an interactive role to a landmark element fails
            jsx-a11y rules. The aria-label still announces "Lessons" to a
            screen reader. tabIndex=0 makes the container focusable so
            aria-activedescendant has a focusable owner. */}
        <div
          aria-label="Lessons"
          role="listbox"
          tabIndex={0}
          aria-activedescendant={`roadmap-rail-${lessonScenarios[focusedIndex]?.id ?? lessonScenarios[0].id}`}
          onKeyDown={handleRailKey}
          onFocus={() => setRailHasFocus(true)}
          onBlur={(event) => {
            // Stay focused if focus moved to another rail button; only release
            // when focus leaves the rail entirely.
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setRailHasFocus(false);
            }
          }}
          className="grid content-start gap-1.5"
        >
          {lessonScenarios.map((scenario, index) => {
            const status = statusFor(index, activeScenarioIndex, completedScenarioIds);
            const isFocused = index === focusedIndex;
            return (
              <button
                key={scenario.id}
                id={`roadmap-rail-${scenario.id}`}
                ref={(el) => {
                  railRefs.current[index] = el;
                }}
                type="button"
                role="option"
                aria-selected={isFocused}
                tabIndex={isFocused ? 0 : -1}
                onClick={() => {
                  setFocusedIndex(index);
                  setRailHasFocus(true);
                }}
                className={
                  `group flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-left transition-colors duration-[120ms] ` +
                  `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink ` +
                  (isFocused
                    ? 'border-accent bg-accent/10 text-paper'
                    : 'border-hairline bg-ink-elevated text-paper-muted hover:border-accent/60 hover:text-paper')
                }
              >
                <span className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-paper-quiet">
                    Stage {scenario.scenarioNumber}
                  </span>
                  <span className="truncate text-sm font-semibold">{scenario.title}</span>
                </span>
                {status === 'completed' ? (
                  <span aria-label="Completed" className="text-[0.7rem] text-jade">
                    ✓
                  </span>
                ) : status === 'current' ? (
                  <span
                    aria-label="Current"
                    className="text-[0.55rem] font-bold uppercase tracking-[0.18em] text-accent"
                  >
                    Now
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Right pane — detail */}
        <article
          aria-labelledby={`roadmap-stage-${focusedScenario.id}`}
          className="min-w-0 grid content-start gap-3"
        >
          <header>
            <p className="font-display text-[0.65rem] font-bold uppercase tracking-[0.28em] text-accent">
              Stage {focusedScenario.scenarioNumber} · {focusedScenario.difficulty}
            </p>
            <h3
              id={`roadmap-stage-${focusedScenario.id}`}
              className="mt-1 font-display text-xl font-black uppercase tracking-tight text-paper sm:text-2xl"
            >
              {focusedScenario.title}
            </h3>
            <p className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-paper-muted">
              {focusedScenario.location}
            </p>
          </header>

          <Card className="p-3">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-paper-muted">
              Story goal
            </p>
            <p className="mt-1 text-sm font-medium leading-relaxed text-paper">{focusedScenario.storyGoal}</p>
            <div className="mt-3 border-t border-hairline pt-3">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-paper-muted">
                Lesson goal
              </p>
              <p className="mt-1 text-sm font-medium leading-relaxed text-paper">
                {focusedScenario.lessonGoal}
              </p>
            </div>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2">
            <Card tone="jade" className="p-3">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-paper-muted">Reward</p>
              <p className="mt-1 text-sm font-semibold text-paper">{focusedScenario.equipmentReward.name}</p>
              <p className="mt-0.5 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-paper-muted">
                {focusedScenario.equipmentReward.slot}
              </p>
              <p className="mt-2 text-xs font-medium leading-relaxed text-paper-muted">
                {focusedScenario.equipmentReward.effect}
              </p>
            </Card>
            <Card tone="accent" className="p-3">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-paper-muted">
                Super move
              </p>
              <p className="mt-1 text-sm font-semibold text-paper">{focusedScenario.superMove.name}</p>
              <p className="mt-2 text-xs font-medium leading-relaxed text-paper-muted">
                {focusedScenario.superMove.effect}
              </p>
            </Card>
          </div>

          {/* Chunks + phrases — collapsed by default summary, expand on demand */}
          <div className="grid gap-2">
            {focusedScenario.chunks.map((chunk, index) => (
              <details
                key={chunk.id}
                className="overflow-hidden rounded-md border border-hairline bg-ink-elevated"
              >
                <summary className="cursor-pointer list-none p-3 hover:bg-ink-raised">
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-paper-muted">
                        Chunk {index + 1}
                      </span>
                      <span className="text-sm font-semibold text-paper">{chunk.title}</span>
                    </span>
                    <Chip tone="default">{chunk.focus}</Chip>
                  </span>
                  <span className="mt-1 block text-xs font-medium leading-relaxed text-paper-muted">
                    {chunk.objective}
                  </span>
                </summary>
                <ul className="grid gap-1.5 border-t border-hairline bg-ink p-3">
                  {chunk.phrases.map((phrase) => (
                    <li
                      key={phrase.id}
                      className="grid gap-1 rounded-md border border-hairline bg-ink-raised p-2.5 sm:grid-cols-[1fr_1fr]"
                    >
                      <p className="font-display text-base font-bold text-paper">{phrase.targetPhrase}</p>
                      <div>
                        <p className="text-xs font-semibold text-accent">{phrase.romanization}</p>
                        <p className="text-[0.65rem] font-medium uppercase tracking-[0.16em] text-paper-muted">
                          {phrase.translation} · {getPhrasePhoneticSpelling(phrase)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </article>
      </div>
    </Modal>
  );
}
