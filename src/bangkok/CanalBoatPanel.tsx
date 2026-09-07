import { useEffect, useState } from 'react';
import type { AdventureSave } from './adventure';
import {
  boatStart,
  boatCommands,
  boatHeadingNames,
  boatReplies,
  gardenIntro,
  gardenReady,
  gardenComplete,
  gardenStops,
  boatCellOpen,
  type BoatReply,
} from './canalNavigation';
import { phrases } from './curriculum';
import SpeakChoice from './SpeakChoice';
import CharacterVoice from './CharacterVoice';
import './canalBoat.css';

export default function CanalBoatPanel({
  save,
  onBegin,
  onCommand,
  onRecall,
  onClose,
}: {
  save: AdventureSave;
  onBegin: () => void;
  onCommand: (command: string, spoken: boolean) => BoatReply | undefined;
  onRecall: () => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [cooling, setCooling] = useState(false),
    [reply, setReply] = useState<BoatReply>();
  const b = save.canalBoat ?? boatStart(),
    complete = save.flags.includes('canal-garden');
  useEffect(() => {
    if (!cooling) return;
    const timer = setTimeout(() => setCooling(false), 1400);
    return () => clearTimeout(timer);
  }, [cooling]);
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
  const line = complete && (!reply || reply === 'delivered') ? gardenComplete : reply ? boatReplies[reply] : save.canalBoat ? gardenReady : gardenIntro;
  return (
    <section className="canal-boat-panel" aria-label="A Garden Between the Quays" data-speaking-scroll>
      <header>
        <div>
          <small>THONBURI · A GARDEN BETWEEN THE QUAYS</small>
          <h2>{complete ? 'The quays are in bloom.' : 'Give your words a direction.'}</h2>
        </div>
        <button aria-label="Leave garden boat" disabled={busy} onClick={onClose}>
          ×
        </button>
      </header>
      <div className="canal-boat-body">
        <div className="canal-boat-route">
          <p role="status">
            {save.canalBoat
              ? `${b.delivered.length}/3 trays delivered · Bow facing ${boatHeadingNames[b.heading]}`
              : 'Three neighbours, one shared garden. Choose the order.'}
          </p>
          <details open={!save.canalBoat}>
            <summary>Channel chart & instructions</summary>
            <svg
              viewBox="0 0 280 110"
              role="img"
              aria-label={`Canal chart. Boat facing ${boatHeadingNames[b.heading]}. Floating planters block the middle of the south lane.`}
            >
              {[0, 1].flatMap((row) =>
                [0, 1, 2, 3, 4].map((col) => (
                  <g key={`${col}:${row}`} transform={`translate(${25 + col * 57},${row ? 24 : 84})`}>
                    {boatCellOpen(col, row) ? (
                      <>
                        <circle r="5" fill="#c9bb81" />
                        {col < 4 && boatCellOpen(col + 1, row) && <path d="M5 0h47" stroke="#587f7c" />}
                        {row === 1 && boatCellOpen(col, 0) && <path d="M0 5v50" stroke="#587f7c" />}
                      </>
                    ) : (
                      <circle r="13" fill="#57825a" />
                    )}
                    {gardenStops
                      .filter((s) => s.col === col && s.row === row)
                      .map((s) => (
                        <text key={s.id} y={row ? -12 : 20} textAnchor="middle" fill={s.color} fontSize="10">
                          {b.delivered.includes(s.id) ? '✓ ' : ''}
                          {s.id}
                        </text>
                      ))}
                  </g>
                )),
              )}
              <g transform={`translate(${25 + b.col * 57},${b.row ? 24 : 84}) rotate(${b.heading * 90})`}>
                <path d="M12 0L-7-6L-4 0L-7 6Z" fill="#ffe3a0" stroke="#132f34" strokeWidth="2" />
              </g>
            </svg>
            <p>
              Left and right turn the bow in place. Straight moves to the next marker. Stop unloads beside a
              coloured pennant. Use the chart’s north-up arrow to read the boat’s heading.
            </p>
            <p>
              Choose any delivery order. The tender waits between requests; there is no timer or lost cargo.
            </p>
          </details>
          <p className="canal-boat-feedback">{line.text}</p>
          <details className="canal-boat-help">
          <summary>Voice & boat recall</summary>
          <CharacterVoice speaker={line.speaker} text={line.text} disabled={busy} />
          {save.canalBoat && (
            <button
              className="canal-boat-recall"
              disabled={busy || cooling}
              onClick={() => {
                onRecall();
                setReply(undefined);
                setCooling(true);
              }}
            >
              Recall to loading steps · keep deliveries
            </button>
          )}
          </details>
        </div>
        <div className="canal-boat-commands">
          {!save.canalBoat ? (
            <button className="bk-button bk-gold" onClick={event => { onBegin(); event.currentTarget.closest('section')?.scrollTo({ top: 0 }); }}>
              Help with the garden deliveries →
            </button>
          ) : cooling ? (
            <p role="status">The tender follows your instruction…</p>
          ) : (
            <SpeakChoice
              choices={boatCommands.map((id) => phrases[id])}
              onBusyChange={setBusy}
              onSubmit={(id, spoken) => {
                const next = onCommand(id, spoken);
                if (next) {
                  setReply(next);
                  setCooling(true);
                }
              }}
            />
          )}
        </div>
      </div>
    </section>
  );
}
