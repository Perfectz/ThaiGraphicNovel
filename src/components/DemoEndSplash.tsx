import { lessonScenarios } from '../data/lessonScenarios';
import { TECH_DEMO_PLAYABLE_STAGE_COUNT } from '../data/techDemoConfig';

/**
 * End-of-demo splash shown when the player clears Stage 3 (the last stage
 * in the tech demo). Replaces the generic "Continue Journey" CTA with:
 *
 *   - A proper "End of the demo" framing so the player knows this isn't
 *     a bug or a soft-lock
 *   - A roll of every phrase Patrick learned across Stages 1–3 (matches
 *     the demo's actual scope, doesn't promise content that isn't here)
 *   - Two CTAs: Replay (back to LessonRoadmap so they can pick any stage
 *     again) and Feedback (mailto until a real channel is wired)
 *   - A small credits line tying the demo to its tech stack
 *
 * Stages 1 and 2 still use the existing in-stage "Stage Clear → Continue"
 * pill — this splash is only mounted when scenarioNumber matches the
 * final playable stage from techDemoConfig.
 */
export function DemoEndSplash({
  onReplay,
  onContinue,
}: {
  /** Called when the player taps Replay — close the splash and pop them
   *  back to the level select / lesson roadmap. */
  onReplay: () => void;
  /** Called when the player taps Continue — same as the legacy
   *  "Continue Journey" CTA: hand control back to gameStore which
   *  routes them to the overworld. */
  onContinue: () => void;
}) {
  // Pull every phrase Patrick learned across the playable stages so the
  // splash shows real content, not a hand-written list that can drift.
  const learnedPhrases = lessonScenarios.slice(0, TECH_DEMO_PLAYABLE_STAGE_COUNT).flatMap((scenario) =>
    scenario.chunks.flatMap((chunk) =>
      chunk.phrases.map((phrase) => ({
        targetPhrase: phrase.targetPhrase,
        romanization: phrase.romanization,
        translation: phrase.translation,
      })),
    ),
  );

  const feedbackMailto = `mailto:pzgambo@gmail.com?subject=${encodeURIComponent(
    'Bangkok Rift — demo feedback',
  )}&body=${encodeURIComponent(
    `What I liked:\n\nWhat felt rough:\n\nWhat I'd play next:\n\nBrowser / device:\n`,
  )}`;

  return (
    <div className="pointer-events-auto absolute inset-0 z-[60] grid place-items-center bg-[#0A0A0B]/90 backdrop-blur-sm">
      <div className="adventure-3d-completion max-h-[88dvh] w-full max-w-2xl overflow-y-auto px-4 py-5 sm:px-8 sm:py-7">
        <span className="adventure-3d-completion__eyebrow">End of the Bangkok Rift tech demo</span>
        <h2 className="adventure-3d-completion__title">
          {learnedPhrases.length} polite phrases. One Patrick.
        </h2>
        <p className="adventure-3d-completion__body">
          You woke up in a hotel, checked in at the front desk, and ordered street food in Thai. The full game
          continues with taxi rides, floating markets, clinics, embassy negotiations, and the rift gate finale
          — but this build ships the first {TECH_DEMO_PLAYABLE_STAGE_COUNT} stages.
        </p>

        <div className="mt-5 grid gap-2 rounded-md border border-hairline bg-ink-elevated/60 p-3 text-left">
          <p className="font-display text-[0.65rem] font-bold uppercase tracking-[0.22em] text-accent">
            Phrases you can now say in Bangkok
          </p>
          <ul className="grid gap-1.5">
            {learnedPhrases.map((phrase) => (
              <li
                key={phrase.targetPhrase}
                className="grid gap-1 rounded-md border border-hairline/60 bg-ink-raised/60 p-2 sm:grid-cols-[1fr_1fr]"
              >
                <p className="font-display text-sm font-bold text-paper">{phrase.targetPhrase}</p>
                <div>
                  <p className="text-[0.7rem] font-semibold text-accent">{phrase.romanization}</p>
                  <p className="text-[0.62rem] font-medium uppercase tracking-[0.16em] text-paper-muted">
                    {phrase.translation}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onReplay}
            className="adventure-3d-connect"
            style={{ display: 'inline-grid' }}
          >
            Replay any stage
          </button>
          <a href={feedbackMailto} className="adventure-3d-room-pill text-center">
            Send feedback
          </a>
          <button
            type="button"
            onClick={onContinue}
            className="adventure-3d-room-pill text-center"
            title="Close this splash and return to the level select."
          >
            Close
          </button>
        </div>

        <p className="mt-4 text-center text-[0.6rem] font-medium uppercase tracking-[0.2em] text-paper-quiet">
          Bangkok Rift — built with React, Three.js, OpenAI Realtime &amp; local Whisper.
        </p>
      </div>
    </div>
  );
}
