import { lessonScenarios } from '../data/lessonScenarios';
import type { AdventureConversationTurn } from '../data/adventures/types';
import { buildMastery, resultLabel, type PhraseResult, type PhraseResultMap } from './stageClear';

/**
 * Stage Clear payoff card — the moment the drill becomes a *level*.
 *
 * Replaces the old one-line "Stage Clear" prompt with a real reward beat:
 *   1. A star rating + how many phrases were cleared.
 *   2. The stage reward (equipment + super move) the data always defined but
 *      the UI never surfaced.
 *   3. A per-phrase mastery recap (English / romanized / Thai + the player's
 *      best result) — reinforcing what was actually learned.
 *   4. A narrative "the doors unlock" bridge into the next stage.
 *
 * Pure presentation: all maths live in stageClear.ts; this only renders.
 */

type StageClearPayoffProps = {
  scenarioNumber: number;
  completionMessage: string;
  /** The full phrase list of the completed drill, in lesson order. */
  turns: AdventureConversationTurn[];
  /** Per-phrase outcomes recorded during the drill. */
  results: PhraseResultMap;
  /** RPG spoils tallied across the stage's duels (XP, baht, gear, level). */
  spoils?: { xp: number; baht: number; equipment: string[]; level: number };
  onProceed: () => void;
};

function badgeTone(result: PhraseResult | null): 'pass' | 'confirmed' | 'skip' {
  if (typeof result === 'number') return 'pass';
  if (result === 'confirmed') return 'confirmed';
  return 'skip';
}

export function StageClearPayoff({
  scenarioNumber,
  completionMessage,
  turns,
  results,
  spoils,
  onProceed,
}: StageClearPayoffProps) {
  const scenario = lessonScenarios.find((s) => s.scenarioNumber === scenarioNumber);
  const nextTitle = lessonScenarios.find((s) => s.scenarioNumber === scenarioNumber + 1)?.title ?? null;
  const mastery = buildMastery(turns, results);

  const bridgeLine = nextTitle
    ? `Su returns your bow. The lobby doors slide open — beyond them, ${nextTitle} awaits.`
    : 'Su returns your bow. The doors slide open onto whatever comes next.';

  return (
    <div className="pointer-events-none absolute inset-0 z-[55] grid place-items-center p-3">
      <div className="adventure-3d-completion adventure-3d-clear pointer-events-auto">
        <span className="adventure-3d-completion__eyebrow">Stage Clear</span>
        <h2 className="adventure-3d-completion__title">{completionMessage}</h2>

        {/* Score summary: stars from mic-scored phrases, or a no-mic confirm. */}
        <div className="adventure-3d-clear__summary">
          {mastery.numericAverage !== null ? (
            <span
              className="adventure-3d-clear__stars"
              aria-label={`${mastery.stars} of 3 stars, average score ${mastery.numericAverage}`}
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className={`adventure-3d-clear__star ${i < mastery.stars ? 'is-on' : 'is-off'}`}
                >
                  ★
                </span>
              ))}
              <span className="adventure-3d-clear__avg">avg {mastery.numericAverage}</span>
            </span>
          ) : (
            <span className="adventure-3d-clear__avg">Confirmed without mic</span>
          )}
          <span className="adventure-3d-clear__count">
            {mastery.clearedCount}/{mastery.totalCount} phrases
          </span>
        </div>

        {/* Spoils — the RPG haul from this stage's duels, in one beat. */}
        {spoils && (spoils.xp > 0 || spoils.baht > 0 || spoils.equipment.length > 0) ? (
          <div className="adventure-3d-clear__summary" aria-label="Stage spoils">
            <span className="adventure-3d-clear__count">Lv {spoils.level}</span>
            {spoils.xp > 0 ? <span className="adventure-3d-clear__count">+{spoils.xp} XP</span> : null}
            {spoils.baht > 0 ? <span className="adventure-3d-clear__count">+฿{spoils.baht}</span> : null}
            {spoils.equipment.map((gear) => (
              <span key={gear} className="adventure-3d-clear__count">
                {gear.split(' — ')[0]}
              </span>
            ))}
          </div>
        ) : null}

        <p className="adventure-3d-completion__body">{bridgeLine}</p>

        {/* Reward — surfaced from the lesson data for the first time. */}
        {scenario ? (
          <div className="adventure-3d-clear__reward">
            <span className="adventure-3d-clear__section-eyebrow">Reward earned</span>
            <div className="adventure-3d-clear__reward-row">
              <span className="adventure-3d-clear__reward-icon" aria-hidden>
                📓
              </span>
              <span className="adventure-3d-clear__reward-text">
                <span className="adventure-3d-clear__reward-name">
                  {scenario.equipmentReward.name}
                  <em> · {scenario.equipmentReward.slot}</em>
                </span>
                <span className="adventure-3d-clear__reward-effect">
                  {scenario.equipmentReward.effect}
                </span>
              </span>
            </div>
            <div className="adventure-3d-clear__reward-row">
              <span className="adventure-3d-clear__reward-icon" aria-hidden>
                ✶
              </span>
              <span className="adventure-3d-clear__reward-text">
                <span className="adventure-3d-clear__reward-name">
                  {scenario.superMove.name}
                  <em> · Super move</em>
                </span>
                <span className="adventure-3d-clear__reward-effect">{scenario.superMove.effect}</span>
              </span>
            </div>
          </div>
        ) : null}

        {/* Per-phrase mastery recap. */}
        {mastery.rows.length ? (
          <div className="adventure-3d-clear__recap">
            <span className="adventure-3d-clear__section-eyebrow">Phrases learned</span>
            <ul className="adventure-3d-clear__recap-list">
              {mastery.rows.map((row) => (
                <li key={row.id} className="adventure-3d-clear__recap-row">
                  <span className="adventure-3d-clear__recap-thai" lang="th">
                    {row.thai}
                  </span>
                  <span className="adventure-3d-clear__recap-text">
                    <span className="adventure-3d-clear__recap-en">{row.translation}</span>
                    <span className="adventure-3d-clear__recap-rom">{row.romanization}</span>
                  </span>
                  <span
                    className={`adventure-3d-clear__badge adventure-3d-clear__badge--${badgeTone(row.result)}`}
                  >
                    {resultLabel(row.result)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <button
          type="button"
          onClick={onProceed}
          className="adventure-3d-connect adventure-3d-clear__cta"
          style={{ display: 'inline-grid' }}
        >
          {nextTitle ? `Proceed to Level ${scenarioNumber + 1}: ${nextTitle}` : 'Finish the demo'}
        </button>
      </div>
    </div>
  );
}
