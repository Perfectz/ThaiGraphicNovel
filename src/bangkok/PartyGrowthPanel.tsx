import {
  levelThresholds,
  partyGrowth,
  talents,
  talentCost,
  talentReason,
  type TalentId,
} from './partyGrowth';
import './partyGrowth.css';

export default function PartyGrowthPanel({
  xp,
  selected,
  onToggle,
}: {
  xp: number;
  selected: TalentId[];
  onToggle: (id: TalentId) => void;
}) {
  const g = partyGrowth(xp, selected),
    spent = talentCost(g.talents),
    next = levelThresholds[g.level];
  const floor = levelThresholds[g.level - 1],
    progress = next ? Math.min(1, (xp - floor) / (next - floor)) : 1;
  return (
    <section className="party-growth">
      <div className="growth-heading">
        <div>
          <p className="bk-eyebrow">PATRICK & SU · GROW TOGETHER</p>
          <h2>Find your way of fighting.</h2>
        </div>
        <strong>LV {g.level}</strong>
      </div>
      <p>
        Choose talents for your next encounter. You can change them freely outside battle. Your basic word
        abilities remain available.
      </p>
      <div
        className="growth-track"
        role="progressbar"
        aria-label="Progress to next party level"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
      >
        <i style={{ width: `${progress * 100}%` }} />
      </div>
      <div className="growth-stats">
        <span>
          {next
            ? `${xp} / ${next} adventure XP · ${next - xp} to level ${g.level + 1}`
            : 'Highest party level reached'}
        </span>
        <b role="status">
          {g.level - 1 - spent} / {g.level - 1} talent points available
        </b>
      </div>
      <div className="growth-talents">
        {talents.map((t) => {
          const equipped = g.talents.includes(t.id),
            reason = talentReason(g, t.id);
          return (
            <button
              key={t.id}
              aria-pressed={equipped}
              disabled={!!reason}
              onClick={() => onToggle(t.id)}
              className={equipped ? 'equipped' : ''}
            >
              <span>
                {t.owner} · LV {t.level} · {t.cost} POINT{t.cost === 1 ? '' : 'S'}
              </span>
              <h3>{t.name}</h3>
              <p>{t.description}</p>
              <strong>{equipped ? '✓ Equipped · remove' : (reason ?? 'Equip talent →')}</strong>
            </button>
          );
        })}
      </div>
      <p className="growth-footnote">
        Earn adventure XP from story battles, quests, city memories, first-time phrases and completed outings. Party levels
        are game progression; your Thai recall and speaking practice are tracked separately at camp.
      </p>
    </section>
  );
}
