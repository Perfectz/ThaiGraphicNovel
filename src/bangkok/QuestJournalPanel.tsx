import type { AdventureSave } from './adventure';
import { questJournal, trackedQuest, type QuestId, type QuestDestination } from './questJournal';

export default function QuestJournal({
  save,
  onTrack,
  onWalk,
}: {
  save: AdventureSave;
  onTrack: (id: QuestId) => void;
  onWalk: (id: QuestId, destination: QuestDestination) => void;
}) {
  const entries = questJournal(save);
  const tracked = trackedQuest(save);
  const occupied = !!save.battle || !!(save.journeys.active && !save.journeys.active.paused);
  const complete = entries.filter((q) => q.complete);
  return (
    <section className="quest-journal" aria-label="Your adventures">
      <p className="quest-journal-intro">
        Choose a story to follow. Walking follows the city paths; talk when you arrive. You can change
        direction at any time.
      </p>
      {occupied && (
        <p role="status">
          Finish your encounter or pause your travel mission in Journeys to track another story.
        </p>
      )}
      {entries
        .filter((q) => !q.complete)
        .map((q) => (
          <article
            key={q.id}
            className={`quest-card ${tracked.id === q.id ? 'tracked' : ''}`}
            data-quest={q.id}
          >
            <small>
              {q.kind}
              {tracked.id === q.id ? ' · Tracked' : ''}
            </small>
            <h3>{q.title}</h3>
            <p>{q.text}</p>
            <p className="quest-purpose">
              <b>Thai for this adventure</b>
              <br />
              {q.purpose}
            </p>
            <small className="quest-reward">{q.reward}</small>
            <div className="quest-actions">
              <button disabled={occupied || tracked.id === q.id} onClick={() => onTrack(q.id)}>
                {tracked.id === q.id ? 'Following this story' : 'Track this story'}
              </button>
              {q.destinations.map((d) => (
                <button key={d.actor} disabled={occupied} onClick={() => onWalk(q.id, d)}>
                  Walk to {d.label} ↗
                </button>
              ))}
            </div>
          </article>
        ))}
      {complete.length > 0 && (
        <details className="quest-completed">
          <summary>Completed stories · {complete.length}</summary>
          {complete.map((q) => (
            <article key={q.id} data-quest={q.id}>
              <h3>✓ {q.title}</h3>
              <p>{q.text}</p>
            </article>
          ))}
        </details>
      )}
    </section>
  );
}
