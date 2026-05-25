import { type ReactNode } from 'react';
import { Chip } from './Chip';

export type DialoguePanelProps = {
  /** Speaker name (e.g. "Su", "Patrick", "Hostess"). */
  speaker: string;
  /** True when the speaker has voiced audio available. Renders a ▶ glyph before the chip. */
  hasVoice?: boolean;
  /** Main body line — the spoken sentence. */
  body: ReactNode;
  /** Optional Thai phrase rendered as Thai-Hero type below the body. */
  thai?: string;
  /** Optional romanization rendered as Thai-Inline below the Thai. */
  romanization?: string;
  /** Optional English translation rendered as Body-Strong below the romanization. */
  translation?: string;
  /** Optional portrait image rendered to the left or right of the bubble. */
  portrait?: { src: string; alt: string; side?: 'left' | 'right' };
  /** Called when the panel is clicked OR Enter / Space is pressed. */
  onAdvance: () => void;
  /** Continue-affordance label — defaults to "Tap to continue". */
  continueLabel?: string;
};

/**
 * Single VN-style dialogue primitive shared by DialogueBox and the debug
 * intro dialogue. Replaces two VN dialects (.vn-glass-panel and
 * .jrpg-intro-dialogue) with one tokenized panel — see plan §2.3.
 *
 * Accessibility:
 *   - The body line has aria-live="polite" so screen readers announce each
 *     new line as it appears.
 *   - The full panel is a button (Enter / Space advance, click anywhere
 *     advances).
 */
export function DialoguePanel({
  speaker,
  hasVoice = false,
  body,
  thai,
  romanization,
  translation,
  portrait,
  onAdvance,
  continueLabel = 'Tap to continue',
}: DialoguePanelProps) {
  const portraitSide = portrait?.side ?? 'left';
  // Force an EXPLICIT height on the portrait box. Before this used `h-full`
  // and let the button height drive it, which collapsed the sprite to a
  // ~80px sliver because the button is only as tall as the text content.
  // VN cut-in style: portrait stands tall next to the bubble, anchored to
  // the bottom so the face sits above the speaker chip. Visible from xs+
  // (not just sm+) so the sprite is part of the experience on phones too.
  const portraitImg = portrait ? (
    <div
      aria-hidden="true"
      className={`relative h-40 w-32 shrink-0 sm:h-56 sm:w-44 lg:h-64 lg:w-48 ${
        portraitSide === 'right' ? 'order-2' : 'order-0'
      }`}
    >
      <img
        src={portrait.src}
        alt={portrait.alt}
        decoding="async"
        draggable={false}
        className="absolute inset-0 h-full w-full object-contain object-bottom drop-shadow-[0_8px_18px_rgba(0,0,0,0.55)]"
      />
    </div>
  ) : null;

  return (
    <section className="dialogue-panel pointer-events-auto absolute inset-x-3 bottom-3 z-50 sm:inset-x-10 lg:inset-x-16">
      <button
        type="button"
        onClick={onAdvance}
        className="group flex w-full items-stretch gap-3 rounded-[12px] border border-hairline bg-ink-raised/95 px-4 py-4 text-left text-paper shadow-card backdrop-blur-sm transition-colors duration-[120ms] hover:border-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink sm:px-6 sm:py-5"
        aria-label={`${speaker} dialogue. ${continueLabel}.`}
      >
        {portraitImg}

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <header className="flex items-center justify-between gap-3">
            <Chip iconBefore={hasVoice ? '▶' : undefined} tone="default">
              {speaker}
            </Chip>
          </header>

          <p aria-live="polite" className="text-base font-medium leading-relaxed text-paper sm:text-lg">
            {body}
          </p>

          {thai ? (
            <div className="mt-2 flex flex-col gap-1">
              <p className="font-display text-3xl font-bold leading-tight text-paper sm:text-4xl">{thai}</p>
              {romanization ? (
                <p className="text-xl font-bold leading-tight text-accent sm:text-2xl">{romanization}</p>
              ) : null}
              {translation ? (
                <p className="text-sm font-semibold text-paper-muted sm:text-base">{translation}</p>
              ) : null}
            </div>
          ) : null}

          <footer className="mt-2 flex items-center justify-end gap-2 text-paper-muted">
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.28em] text-paper-quiet">
              {continueLabel}
            </span>
            <span aria-hidden="true" className="dialogue-panel__chevron text-base text-accent">
              ▼
            </span>
          </footer>
        </div>
      </button>
    </section>
  );
}
