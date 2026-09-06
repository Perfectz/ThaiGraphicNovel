import { useEffect, useState } from 'react';
import { discoveryFor, type DiscoveryId } from './discoveries';
import RecallLine from './RecallLine';
import CharacterVoice from './CharacterVoice';
import type { JourneyResult } from './cityJourneys';
import './cityServices.css';
import './journeys.css';

export default function FieldReviewPanel({
  site,
  onClose,
  onReview,
}: {
  site: DiscoveryId;
  onClose: () => void;
  onReview: (result: JourneyResult) => boolean;
}) {
  const d = discoveryFor(site)!;
  const [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [error, setError] = useState(false);
  useEffect(() => {
    const leave = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', leave);
    return () => window.removeEventListener('keydown', leave);
  }, [busy, onClose]);
  return (
    <section className="rpg-dialogue city-service field-review" aria-label="Return to a city memory">
      <div className="rpg-dialogue-heading">
        <span>◆ {d.name} · Return visit</span>
        <button aria-label="Leave memory review" disabled={busy} onClick={onClose}>
          ×
        </button>
      </div>
      <div className="rpg-conversation-body has-phrase" data-speaking-scroll>
        <div className="rpg-conversation-context">
          <small className="bk-eyebrow">WORDS BELONG TO PLACES</small>
          <h2>{d.name}</h2>
          <p className="rpg-story-text">{d.story}</p>
          <CharacterVoice speaker="Su" text={d.story} disabled={busy} />
          <p>
            Return to the moment. Try the Thai from memory, compare it with the reference, and decide what
            needs another visit.
          </p>
          <small>
            This updates your practice record. The discovery’s treasure has already been collected.
          </small>
        </div>
        <div>
          {done ? (
            <div className="journey-recall">
              <h3>A familiar place, a stronger memory.</h3>
              <p>
                Your self-check is saved. If the words needed help, they stay due for review. This place’s
                marker will rest for today.
              </p>
              <button className="bk-button bk-gold" onClick={onClose}>
                Return to the city →
              </button>
            </div>
          ) : (
            <RecallLine
              phraseId={d.phrase}
              meaningHelp={false}
              onBusy={setBusy}
              onDone={(result) => {
                const saved = onReview(result);
                setError(!saved);
                setDone(saved);
              }}
            />
          )}
          {error && (
            <p role="alert">
              Your browser could not save this review. Free some storage and try confirming again.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
