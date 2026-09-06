import { useEffect, useState } from 'react';
import { actors, type AdventureSave } from './adventure';
import {
  hostWelcome,
  serviceReason,
  servicesForHost,
  serviceFor,
  type ServiceHost,
  type CityServiceId,
} from './cityServices';
import { phrases } from './curriculum';
import SpeakChoice from './SpeakChoice';
import './cityServices.css';
import CharacterVoice from './CharacterVoice';

export default function CityServicePanel({
  save,
  host,
  onClose,
  onPractice,
  onUse,
}: {
  save: AdventureSave;
  host: ServiceHost;
  onClose: () => void;
  onPractice: (id: string, spoken: boolean) => void;
  onUse: (id: CityServiceId) => boolean;
}) {
  const [selected, setSelected] = useState<CityServiceId | null>(null);
  const [rehearsed, setRehearsed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState('');
  const service = selected ? serviceFor(selected) : undefined;
  const reason = selected ? serviceReason(save, selected) : null;
  const name = actors.find((a) => a.id === host)!.name;
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
    <section className="rpg-dialogue city-service" aria-label="Local services">
      <div className="rpg-dialogue-heading">
        <span>
          {name} · {save.coins} coins
        </span>
        <button aria-label="Leave local services" disabled={busy} onClick={onClose}>
          ×
        </button>
      </div>
      <div className="city-service-body">
        <div className="city-service-story">
          <p className="bk-eyebrow">A FAMILIAR FACE · PREPARE FOR THE ROAD</p>
          <h2>
            {host === 'innkeeper'
              ? 'A room to return to.'
              : host === 'cook'
                ? 'Something for the journey.'
                : 'A pause beside the lake.'}
          </h2>
          <p>{hostWelcome(save, host)}</p>
          {!receipt && <CharacterVoice speaker={name} text={hostWelcome(save, host)} disabled={busy} />}
          {service && (
            <div className="service-quote">
              <strong>
                {service.name} · {service.cost ? service.cost + ' coins' : 'Free'}
              </strong>
              <p>{service.effect}</p>
              <small>{service.invitation}</small>
            </div>
          )}
          {receipt && (
            <>
              <p className="rpg-feedback" role="status">
                {receipt}
              </p>
              <CharacterVoice speaker={name} text={receipt} disabled={busy} />
            </>
          )}
        </div>
        <div className="city-service-actions">
          {!service ? (
            <>
              {servicesForHost(host).map((s) => (
                <button
                  key={s.id}
                  className="service-offer"
                  disabled={!!serviceReason(save, s.id)}
                  onClick={() => {
                    setSelected(s.id);
                    setRehearsed(false);
                    setReceipt('');
                  }}
                >
                  <strong>
                    {s.name} · {s.cost ? s.cost + ' coins' : 'Free'}
                  </strong>
                  <span>{s.effect}</span>
                  <small>You will say: “{phrases[s.phrase].translation}”</small>
                  <b>{serviceReason(save, s.id) ?? 'Choose and practise →'}</b>
                </button>
              ))}
              <button className="bk-button bk-outline" onClick={onClose}>
                Back to the adventure →
              </button>
              <small className="service-currency-note">
                Coins are game currency. These are not real Bangkok prices.
              </small>
            </>
          ) : (
            <>
              {!rehearsed ? (
                <SpeakChoice
                  key={service.id}
                  choices={[phrases[service.phrase]]}
                  initialPhraseId={service.phrase}
                  onBusyChange={setBusy}
                  onSubmit={(id, spoken) => {
                    onPractice(id, spoken);
                    setRehearsed(true);
                  }}
                />
              ) : (
                <div className="service-confirm">
                  <p>
                    Your reply is ready.{' '}
                    {service.cost ? 'No coins have been spent yet.' : 'Your room is ready when you are.'}
                  </p>
                  <button
                    className="bk-button bk-gold"
                    disabled={!!reason}
                    onClick={() => {
                      if (onUse(service.id)) {
                        setReceipt(service.result);
                        setSelected(null);
                        setRehearsed(false);
                      }
                    }}
                  >
                    {reason ??
                      (service.cost
                        ? 'Receive ' + service.name.toLowerCase() + ' · pay ' + service.cost + ' coins'
                        : 'Rest now · full recovery')}
                  </button>
                </div>
              )}
              <button
                className="service-cancel"
                disabled={busy}
                onClick={() => {
                  setSelected(null);
                  setRehearsed(false);
                }}
              >
                Cancel · keep my coins
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
