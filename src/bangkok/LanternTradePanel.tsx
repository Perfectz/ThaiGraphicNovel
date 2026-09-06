import { useEffect, useState } from 'react';
import type { AdventureSave } from './adventure';
import { phrases } from './curriculum';
import SpeakChoice from './SpeakChoice';
import {
  lanternChoices,
  lanternConsequence,
  lanternName,
  lanternPrices,
  lanternReplyReason,
  lanternScene,
  leavesLanternTrade,
  type LanternOffer,
} from './lanternTrade';
import './cityServices.css';
import CharacterVoice from './CharacterVoice';

export default function LanternTradePanel({
  save,
  onClose,
  onPractice,
  onConfirm,
}: {
  save: AdventureSave;
  onClose: () => void;
  onPractice: (id: string, spoken: boolean) => void;
  onConfirm: (offer: LanternOffer, reply: string) => void;
}) {
  const [reply, setReply] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const trade = save.lantern;
  const choices = lanternChoices(trade.offer);
  const reason = reply ? lanternReplyReason(save, reply) : null;
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
    <section className="rpg-dialogue city-service" aria-label="Arun’s lantern workshop">
      <div className="rpg-dialogue-heading">
        <span>◆ Arun · lantern maker</span>
        <button aria-label="Leave lantern workshop" disabled={busy} onClick={onClose}>
          ×
        </button>
      </div>
      <div className="city-service-body">
        <div className="city-service-story">
          <p className="bk-eyebrow">A LIGHT OF YOUR OWN · YOUR BUDGET, YOUR CHOICE</p>
          <h2>{trade.offer === 'new' ? 'Something for the side paths.' : lanternName(trade)}</h2>
          <p>{lanternScene(trade)}</p>
          <CharacterVoice speaker="Arun" text={lanternScene(trade)} disabled={busy} />
          <div className="service-quote">
            <strong>
              {trade.offer === 'new'
                ? 'Ask before you buy'
                : `Current offer · ${lanternPrices[trade.offer]} game coins`}
            </strong>
            <p>
              Your bag: {save.coins} game coins. A lantern reveals hidden city memories from farther away.
              Both designs give the same benefit.
            </p>
          </div>
          <p className="service-currency-note">
            These are game prices. Practising a reply never spends coins. You can leave and return to the same
            offer.
          </p>
        </div>
        <div className="city-service-actions">
          {reply ? (
            <div className="service-confirm">
              <p className="bk-eyebrow">WHAT YOUR WORDS WILL DO</p>
              <p className="rpg-feedback" role="status">
                {lanternConsequence(trade, reply)}
              </p>
              {reason && <p role="status">{reason}</p>}
              <button
                className="bk-button bk-gold"
                disabled={!!reason}
                onClick={() => onConfirm(trade.offer, reply)}
              >
                {reply === 'i-will-buy'
                  ? `Buy this lantern · ${lanternPrices[trade.offer]} coins`
                  : leavesLanternTrade(reply)
                    ? 'Leave with my coins'
                    : reply === 'how-much'
                      ? 'Ask Arun’s price'
                      : 'Confirm my request'}
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
                if (!choices.includes(id)) return;
                onPractice(id, spoken);
                setReply(id);
              }}
            />
          )}
        </div>
      </div>
    </section>
  );
}
