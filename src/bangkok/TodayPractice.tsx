import { duePhrases, localDate, readTraining, type TrainingSave } from './learning';
import './practice.css';

export default function TodayPractice({
  save = readTraining(),
  onReview,
}: {
  save?: TrainingSave;
  onReview?: () => void;
}) {
  const today = localDate(),
    daily = save.dailyPractice[today] ?? { seconds: 0, spoken: 0, recalls: 0 };
  const due = duePhrases(save, Object.keys(save.records)).length;
  return (
    <section className="today-practice" aria-label="Today's Thai practice">
      <h3>Your Thai today</h3>
      <div className="today-practice-stats">
        <p>
          <strong>
            {Math.floor(daily.seconds / 60)}m {Math.floor(daily.seconds % 60)}s
          </strong>
          <span>active phrase practice</span>
        </p>
        <p>
          <strong>{daily.spoken}</strong>
          <span>spoken replies</span>
        </p>
        <p>
          <strong>{daily.recalls}</strong>
          <span>recall attempts</span>
        </p>
      </div>
      <p>
        Walking and menus pause the clock. Practice also pauses after 45 seconds without interaction. Spoken
        replies count submitted recordings or voice-coach checks; recall attempts include self-checks.
      </p>
      {(save.minutes[today] ?? 0) > 0 && (
        <small>
          Earlier activity time: {Math.floor(save.minutes[today] / 60)} minutes. The previous clock included
          exploration.
        </small>
      )}
      {onReview && (
        <button className="bk-button" onClick={onReview}>
          {due ? `${due} phrases due · review at camp` : 'Practise at camp'}
        </button>
      )}
    </section>
  );
}
