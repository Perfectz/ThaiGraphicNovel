import { useEffect, useState } from 'react';
import type { AdventureSave } from './adventure';
import {
  eveningChoices,
  eveningReason,
  eveningResponse,
  eveningRoute,
  eveningScene,
  eveningStep,
  type EveningStep,
} from './eveningOuting';
import { phrases } from './curriculum';
import SpeakChoice from './SpeakChoice';
import './cityServices.css';
import CharacterVoice from './CharacterVoice';

export default function EveningOutingPanel({
  save,
  onClose,
  onPractice,
  onAdvance,
}: {
  save: AdventureSave;
  onClose: () => void;
  onPractice: (id: string, spoken: boolean) => void;
  onAdvance: (step: EveningStep, reply: string) => boolean;
}) {
  const [reply, setReply] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const step = eveningStep(save),
    scene = eveningScene(save);
  const choices = eveningChoices(save);
  const reason = eveningReason(save);
  useEffect(() => {
    const leave = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', leave);
    return () => window.removeEventListener('keydown', leave);
  }, [busy, onClose]);
  return (
    <section className="rpg-dialogue city-service" aria-label="An Evening of Our Own">
      <div className="rpg-dialogue-heading">
        <span>◆ {scene.speaker}</span>
        <button aria-label="Leave evening conversation" disabled={busy} onClick={onClose}>
          ×
        </button>
      </div>
      <div className="city-service-body">
        <div className="city-service-story">
          <p className="bk-eyebrow">
            COMPANION STORY ·{' '}
            {step === 'plan'
              ? 'CHOOSE YOUR EVENING'
              : step === 'order'
                ? 'YOUR PREFERENCE MATTERS'
                : 'A MEMORY TO KEEP'}
          </p>
          <h2>{scene.title}</h2>
          <p>{scene.text}</p>
          {!reply && <CharacterVoice speaker={scene.speaker} text={scene.text} disabled={busy} />}
          <div className="service-quote">
            <strong>{step === 'finish' ? 'A gift for tomorrow' : 'What your words will do'}</strong>
            <p>{scene.consequence}</p>
          </div>
        </div>
        <div className="city-service-actions">
          {reply ? (
            <div className="service-confirm">
              <p className="rpg-feedback" role="status">
                {eveningResponse(save, reply)}
              </p>
              <CharacterVoice speaker={scene.speaker} text={eveningResponse(save, reply)} disabled={busy} />
              <button
                className="bk-button bk-gold"
                disabled={!!reason}
                onClick={() => {
                  if (step && onAdvance(step, reply)) setReply(null);
                }}
              >
                {reason ??
                  (step === 'plan'
                    ? reply === 'like-thai-food'
                      ? 'Make a plan for Yaowarat'
                      : 'Make a plan for Lumphini'
                    : step === 'order'
                      ? 'Confirm my order'
                      : 'Keep this evening in our journal')}
              </button>
              <button className="service-cancel" onClick={() => setReply(null)}>
                Choose another reply
              </button>
            </div>
          ) : (
            <SpeakChoice
              key={`${step}:${eveningRoute(save)}`}
              choices={choices.map((id) => phrases[id])}
              onBusyChange={setBusy}
              onSubmit={(id, spoken) => {
                if (!choices.includes(id)) return;
                onPractice(id, spoken);
                setReply(id);
              }}
            />
          )}
          <p className="service-currency-note">
            {step === 'plan'
              ? 'Confirming the plan marks your destination. You still walk there together.'
              : 'This outing is a gift from your hosts. No coins are spent.'}
          </p>
        </div>
      </div>
    </section>
  );
}
