import { worldArts } from './worldArts';
import { phrases } from './curriculum';

export default function WorldArtsPanel({
  flags,
  onTrack,
}: {
  flags: string[];
  onTrack: (quest: 'canal' | 'archive') => void;
}) {
  return (
    <section className="rpg-world-arts" aria-label="Word arts learned in the city">
      <h3>Words the city taught us</h3>
      <p>
        Helping your neighbours teaches the party new tactics. These arts join your battle commands when you
        complete their stories.
      </p>
      {worldArts.map((art) => {
        const learned = flags.includes(art.unlock),
          phrase = phrases[art.phrase];
        return (
          <article key={art.id} data-world-art={art.id} data-unlocked={learned}>
            <small>
              {learned ? '✦ LEARNED' : '◇ DISCOVER IN THE CITY'} · {art.owner === 'su' ? 'Su' : 'Patrick'} ·{' '}
              {art.cost} AP
            </small>
            <h4>{art.name}</h4>
            <p lang="en">“{phrase.translation}”</p>
            <p lang="th">{phrase.targetPhrase}</p>
            <strong>{art.effect}</strong>
            <p>{art.detail}</p>
            {learned ? (
              <small>Learned through {art.source}</small>
            ) : (
              <button
                className="bk-button bk-outline"
                disabled={!flags.includes('innkeeper')}
                onClick={() => onTrack(art.quest)}
              >
                Track {art.source} ↗
              </button>
            )}
          </article>
        );
      })}
    </section>
  );
}
