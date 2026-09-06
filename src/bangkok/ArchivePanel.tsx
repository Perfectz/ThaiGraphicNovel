import { useState } from 'react';
import type { AdventureSave } from './adventure';
import type { ArchiveActor } from './archiveLayout';
import { archiveScene, archiveClues } from './archiveQuest';
import { phrases } from './curriculum';
import SpeakChoice from './SpeakChoice';
import CharacterVoice from './CharacterVoice';
import './cityServices.css';
export default function ArchivePanel({
  save,
  actor,
  onClose,
  onPractice,
  onAdvance,
}: {
  save: AdventureSave;
  actor: ArchiveActor;
  onClose: () => void;
  onPractice: (id: string, spoken: boolean) => void;
  onAdvance: (action: string, answer?: string) => void;
}) {
  const scene = archiveScene(save, actor);
  const [reply, setReply] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [mistake, setMistake] = useState(false);
  const ready = (!scene.phrase && !scene.puzzle) || !!reply;
  return (
    <section className="rpg-dialogue city-service" aria-label="The House of Returning Maps">
      <div className="rpg-dialogue-heading">
        <span>◆ {scene.speaker}</span>
        <button aria-label="Leave archive conversation" disabled={busy} onClick={onClose}>
          ×
        </button>
      </div>
      <div className="city-service-body">
        <div className="city-service-story">
          <p className="bk-eyebrow">OLD TOWN · THE HOUSE OF RETURNING MAPS</p>
          <h2>{scene.title}</h2>
          <p>{scene.text}</p>
          <CharacterVoice speaker={scene.speaker} text={scene.text} disabled={busy} />
          {save.flags.includes('archive-accepted') && (
            <details className="service-quote">
              <summary>
                Clues in your notebook · {archiveClues.filter((c) => save.flags.includes(c.id)).length} / 3
              </summary>
              {archiveClues
                .filter((c) => save.flags.includes(c.id))
                .map((c) => (
                  <p key={c.id}>
                    <strong>{c.title}</strong>
                    <br />
                    {c.text}
                  </p>
                ))}
            </details>
          )}
        </div>
        <div className="city-service-actions">
          {scene.phrase && !reply && (
            <SpeakChoice
              choices={[phrases[scene.phrase]]}
              onBusyChange={setBusy}
              onSubmit={(id, spoken) => {
                onPractice(id, spoken);
                setReply(id);
              }}
            />
          )}
          {scene.puzzle && !reply && (
            <div className="archive-collections">
              {[
                { id: 'road', name: 'Road surveys', hint: 'Street widths and land boundaries' },
                {
                  id: 'pattern',
                  name: 'Lantern patterns',
                  hint: 'Shapes, measurements and decorative designs',
                },
                {
                  id: 'ferry',
                  name: 'Ferry deliveries',
                  hint: 'Cargo, departure times and river destinations',
                },
              ].map((c) => (
                <button
                  className="service-offer"
                  key={c.id}
                  onClick={() => {
                    if (c.id === 'ferry') {
                      setReply(c.id);
                      setMistake(false);
                    } else setMistake(true);
                  }}
                >
                  <strong>{c.name}</strong>
                  <span>{c.hint}</span>
                </button>
              ))}
              {mistake && (
                <p role="status">
                  That collection does not account for the boat and its departure. Compare all three clues;
                  you can try again without losing anything.
                </p>
              )}
            </div>
          )}
          {ready && scene.action && (
            <button
              className="bk-button bk-gold"
              onClick={() => onAdvance(scene.action!, reply ?? undefined)}
            >
              {scene.action === 'archive-accepted'
                ? 'Accept Kanya’s search'
                : scene.action === 'archive-found'
                  ? 'Mark the ferry ledger'
                  : scene.action === 'archive-document'
                    ? 'Ask to see the original'
                    : scene.action === 'archive-complete'
                      ? 'Thank Kanya · complete the visit'
                      : 'Keep this clue'}
            </button>
          )}
          {reply && (
            <button className="service-cancel" onClick={() => setReply(null)}>
              Reconsider my reply
            </button>
          )}
          <button className="service-cancel" disabled={busy} onClick={onClose}>
            Return to the galleries
          </button>
        </div>
      </div>
    </section>
  );
}
