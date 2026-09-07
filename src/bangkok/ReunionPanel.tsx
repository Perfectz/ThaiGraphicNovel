import { useEffect, useState } from 'react';
import type { ActorId, AdventureSave } from './adventure';
import { reunionChoices, reunionReason, reunionScene, reunionStep, type ReunionStep } from './reunion';
import { phrases } from './curriculum';
import SpeakChoice from './SpeakChoice';
import CharacterVoice from './CharacterVoice';
import './cityServices.css';

export default function ReunionPanel({
  save,
  actor,
  onClose,
  onPractice,
  onAdvance,
}: {
  save: AdventureSave;
  actor: ActorId;
  onClose: () => void;
  onPractice: (id: string, spoken: boolean) => void;
  onAdvance: (actor: ActorId, step: ReunionStep, reply: string) => boolean;
}) {
  const [reply, setReply] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const step = reunionStep(save, actor);
  useEffect(() => {
    const leave = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', leave);
    return () => window.removeEventListener('keydown', leave);
  }, [busy, onClose]);
  if (!step) return null;
  const scene = reunionScene(save, step),
    choices = reunionChoices(step),
    reason = reunionReason(save, actor);
  return (
    <section className="rpg-dialogue city-service" aria-label="A Promise Kept">
      <div className="rpg-dialogue-heading">
        <span>◆ {scene.speaker}</span>
        <button aria-label="Leave reunion conversation" disabled={busy} onClick={onClose}>
          ×
        </button>
      </div>
      <div className="city-service-body">
        <div className="city-service-story">
          <p className="bk-eyebrow">CHAPTER II · A PROMISE KEPT</p>
          <h2>{scene.title}</h2>
          <p>{scene.text}</p>
          <CharacterVoice speaker={scene.speaker} text={scene.text} disabled={busy} />
          <div className="service-quote">
            <strong>What your words will do</strong>
            <p>{scene.consequence}</p>
            {(step === 'plan' || step === 'mali' || step === 'arun') && (
              <small>
                Once both invitations are delivered, your plan sets the scene: Yaowarat by lantern light,
                or a new morning beside the Lumphini lake.
              </small>
            )}
          </div>
        </div>
        <div className="city-service-actions">
          {reply ? (
            <div className="service-confirm">
              <p className="rpg-feedback" role="status">
                You chose: {phrases[reply].translation}
              </p>
              <button
                className="bk-button bk-gold"
                disabled={!!reason}
                onClick={() => onAdvance(actor, step, reply)}
              >
                {reason ??
                  (step === 'plan'
                    ? reply === 'free-evening'
                      ? 'Plan an evening in Yaowarat'
                      : 'Plan tomorrow in Lumphini'
                    : step === 'mali'
                      ? 'Invite Mali'
                      : step === 'arun'
                        ? 'Agree on the meeting place'
                        : step === 'welcome'
                          ? 'Share a moment with everyone'
                          : 'Keep this promise in our journal')}
              </button>
              <button className="service-cancel" onClick={() => setReply(null)}>
                Choose another reply
              </button>
            </div>
          ) : (
            <SpeakChoice
              choices={choices.map((id) => phrases[id])}
              onBusyChange={setBusy}
              onSubmit={(id, spoken) => {
                if (!choices.includes(id) || reunionReason(save, actor)) return;
                onPractice(id, spoken);
                setReply(id);
              }}
            />
          )}
          <p className="service-currency-note">
            English first. Listen, try speaking, then confirm your reply. Text-only replies also move the
            story forward.
          </p>
        </div>
      </div>
    </section>
  );
}
