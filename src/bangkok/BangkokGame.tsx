import { useEffect, useRef, useState } from 'react';
import { BangkokWorld } from './BangkokWorld';
import { activities, choicesFor, days, phrases, queueFor, situationFor } from './curriculum';
import {
  addPracticeTime,
  duePhrases,
  finishActivity,
  localDate,
  persistTraining,
  readTraining,
  recordAttempt,
  type AttemptKind,
  type TrainingSave,
} from './learning';
import { usePracticeClock } from './PracticeTiming';
import TodayPractice from './TodayPractice';
import { useTrainingVoice } from './useTrainingVoice';
import SpeakChoice from './SpeakChoice';
import { useGameMusic } from '../hooks/useGameMusic';
import { useSoundSettings } from '../hooks/useSoundSettings';
import { saveSoundSettings } from '../services/soundSettings';
import { Modal } from '../components/ui/Modal';
import hotelMusic from '../assets/audio/music/stage-01-hotel-lobby.mp3';
import marketMusic from '../assets/audio/music/stage-03-night-market.mp3';
import './bangkok.css';

type Screen = 'home' | 'camp' | 'practice' | 'reward';
const ranks = ['New arrival', 'Curious traveller', 'River wanderer', 'Market regular', 'Bangkok friend'];
const readInitial = () => {
  const saved = readTraining();
  if (saved.session?.queue.some((id) => !phrases[id])) saved.session = null;
  return saved;
};

export default function BangkokGame() {
  const [save, setSave] = useState<TrainingSave>(readInitial);
  const [screen, setScreen] = useState<Screen>('home');
  const [worldStatus, setWorldStatus] = useState('loading');
  const [mapOpen, setMapOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [feedback, setFeedback] = useState<{
    success: boolean;
    text: string;
    kind?: AttemptKind;
    remembered?: boolean;
  } | null>(null);
  const [noMic, setNoMic] = useState(false);
  const [choiceBusy, setChoiceBusy] = useState(false);
  const [hint, setHint] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [rewardActivity, setRewardActivity] = useState(0);
  const [query, setQuery] = useState('');
  const host = useRef<HTMLDivElement>(null);
  const world = useRef<BangkokWorld | null>(null);
  const beginRef = useRef<() => void>(() => undefined);
  const saveRef = useRef(save);
  saveRef.current = save;
  const sound = useSoundSettings();
  const day = days[(save.session?.day ?? save.day) - 1];
  const active = save.session;
  const activity = activities[active?.activity ?? 0];
  const phraseId = active?.queue[active.index];
  const phrase = phraseId ? phrases[phraseId] : undefined;
  const voice = useTrainingVoice(screen === 'practice' ? phrase : undefined);
  const today = localDate();
  const elapsed = save.dailyPractice[today]?.seconds ?? 0;
  const level = 1 + Math.floor(save.xp / 250);
  const completed = save.completed[String(save.day)] ?? [];
  const nextActivity = activities.findIndex((_, i) => !completed.includes(i));
  const due = duePhrases(save, Object.keys(save.records));
  const isTrial = active?.activity === 4;
  const progress = active ? active.index / active.queue.length : 0;
  const recognitionMode = activity.mode === 'choice' || (noMic && activity.mode === 'spoken');
  const speakingCount = Object.values(save.records).filter((r) => r.spoken > 0).length;
  const recallCount = Object.values(save.records).filter((r) => r.recalled > 0).length;

  useGameMusic(day.district === 'market' ? marketMusic : hotelMusic, {
    ...sound,
    musicVolume: sound.musicVolume * 0.42,
  });
  useEffect(() => {
    if (!host.current) return;
    try {
      const instance = new BangkokWorld(host.current, setWorldStatus, () => beginRef.current());
      world.current = instance;
      instance.setBackdrop(`${import.meta.env.BASE_URL}bangkok/river-skyline.png`);
      return () => {
        instance.dispose();
        world.current = null;
      };
    } catch {
      setWorldStatus('error');
    }
  }, []);
  useEffect(() => {
    world.current?.setState({
      district: day.district,
      mode: screen === 'home' ? 'home' : screen === 'practice' ? 'encounter' : 'explore',
      trial: isTrial,
      progress,
    });
  }, [day.district, screen, isTrial, progress]);
  useEffect(() => {
    setSaveError(!persistTraining(save));
  }, [save]);
  usePracticeClock(
    screen === 'practice' && !!phrase && !feedback?.success && !mapOpen && !journalOpen && !helpOpen,
    (seconds) => setSave((s) => addPracticeTime(s, seconds)),
  );
  useEffect(() => {
    function leave() {
      persistTraining(saveRef.current);
    }
    window.addEventListener('pagehide', leave);
    return () => window.removeEventListener('pagehide', leave);
  }, []);

  function resetPrompt() {
    setFeedback(null);
    setRevealed(false);
    setHint(false);
  }
  function startActivity(index: number) {
    if (index < 0) index = 0;
    resetPrompt();
    setSave((s) => ({
      ...s,
      session: {
        day: s.day,
        activity: index,
        index: 0,
        queue: queueFor(s, days[s.day - 1], index),
        correct: 0,
      },
    }));
    setScreen('practice');
  }
  beginRef.current = () => {
    if (screen === 'camp') {
      if (save.session) {
        resetPrompt();
        setScreen('practice');
      } else if (nextActivity < 0 && save.day < 30) setSave((s) => ({ ...s, day: s.day + 1 }));
      else startActivity(nextActivity);
    }
  };
  function resolve(success: boolean, kind: AttemptKind, text?: string) {
    if (!phrase || !active || feedback?.success || voice.recording || voice.coachBusy || choiceBusy) return;
    if (success) {
      world.current?.celebrate();
      setFeedback({
        success: true,
        kind,
        remembered: true,
        text:
          text ??
          (kind === 'recall'
            ? 'Recalled from memory. This phrase will return on another day.'
            : kind === 'spoken'
              ? 'Speaking practice ready to log. Your recording is a self-check, not a pronunciation grade.'
              : kind === 'coach'
                ? 'The phrase was recognised. Speaking practice ready to log.'
                : kind === 'study'
                  ? 'A new phrase for your journey. You will meet it again in the city.'
                  : 'That fits the situation. The conversation moves forward.'),
      });
    } else {
      setFeedback({
        success: false,
        text: 'Not yet — that is useful information. Listen, try it aloud, then have another go.',
      });
      setHint(true);
    }
  }
  function next() {
    if (!active) return;
    if (voice.recording) voice.stop();
    const last = active.index + 1 >= active.queue.length;
    // Credit and checkpoint move together, so reloading a verdict cannot farm XP.
    setSave((s) => {
      const credited =
        phrase && feedback?.kind
          ? recordAttempt(s, phrase.id, feedback.kind, feedback.remembered ?? true)
          : s;
      return last
        ? finishActivity(credited)
        : {
            ...credited,
            session: credited.session
              ? {
                  ...credited.session,
                  index: credited.session.index + 1,
                  correct: credited.session.correct + (feedback?.remembered ? 1 : 0),
                }
              : null,
          };
    });
    if (last) {
      setRewardActivity(active.activity);
      setScreen('reward');
    }
    resetPrompt();
  }
  function resume() {
    resetPrompt();
    setScreen(save.session ? 'practice' : 'camp');
  }
  const voiceTools = phrase ? (
    <div className="bk-voice-tools">
      <button onClick={() => void voice.play()} disabled={voice.recording || voice.coachBusy || choiceBusy}>
        ♫ Listen
      </button>
      <button
        onClick={() => void voice.play(true)}
        disabled={voice.recording || voice.coachBusy || choiceBusy}
      >
        ◷ Slowly
      </button>
      <button
        className={voice.recording ? 'is-recording' : ''}
        onClick={() => void voice.record()}
        disabled={voice.coachBusy}
      >
        {voice.recording ? '■ Stop recording' : '◉ Record myself'}
      </button>
      {voice.clip && (
        <button
          onClick={() => void voice.play(false, true)}
          disabled={voice.recording || voice.coachBusy || choiceBusy}
        >
          ▷ My recording
        </button>
      )}
    </div>
  ) : null;

  return (
    <main className={`bk-game bk-${screen}`}>
      <div className="bk-world" ref={host} />
      <div className="bk-vignette" />
      <div className="bk-grain" />
      <header className="bk-topbar">
        <button
          className="bk-brand"
          onClick={() => {
            if (!voice.recording && !voice.coachBusy) setScreen(screen === 'home' ? 'camp' : 'home');
          }}
          disabled={voice.recording || voice.coachBusy || choiceBusy}
        >
          <span className="bk-sigil">✧</span>
          <span>
            BANGKOK RIFT<small>A THAI LANGUAGE ADVENTURE</small>
          </span>
        </button>
        <div className="bk-top-actions">
          {screen !== 'home' && (
            <span
              className="bk-session-clock"
              title="Active practice time today; pauses while hidden or idle"
            >
              ◷ {Math.floor(elapsed / 60)} min Thai practice
            </span>
          )}
          <button
            title="Toggle music"
            aria-label={sound.musicEnabled ? 'Mute music' : 'Play music'}
            onClick={() => saveSoundSettings({ ...sound, musicEnabled: !sound.musicEnabled })}
          >
            {sound.musicEnabled ? '♫' : '♪'}
          </button>
          <button aria-label="How to train" onClick={() => setHelpOpen(true)}>
            ?
          </button>
        </div>
      </header>

      {screen === 'home' && (
        <section className="bk-home-copy">
          <p className="bk-eyebrow">
            <span /> YOUR NEXT ADVENTURE STARTS WITH A WORD
          </p>
          <h1>
            Find your voice
            <br />
            in <em>Bangkok.</em>
          </h1>
          <p className="bk-home-description">
            A city of a thousand stories.
            <br />
            Thirty days to start telling yours in Thai.
          </p>
          <div className="bk-home-cta">
            <button className="bk-button bk-gold" onClick={resume}>
              {save.xp || active ? 'Continue your journey' : 'Begin your journey'} <span>↗</span>
            </button>
            <button className="bk-text-button" onClick={() => setMapOpen(true)}>
              Explore the 30-day route <span>→</span>
            </button>
          </div>
          <div className="bk-home-facts">
            <span>
              01 — 30<small>A MONTH OF ADVENTURE</small>
            </span>
            <span>
              ~60 MIN<small>YOUR DAILY RITUAL</small>
            </span>
            <span>
              YOUR VOICE<small>YOUR STRONGEST SPELL</small>
            </span>
          </div>
          <p className="bk-home-caption">INSPIRED BY BANGKOK · MADE FOR YOUR REAL JOURNEY</p>
        </section>
      )}

      {screen === 'camp' && (
        <>
          <aside className="bk-quest-card">
            <p className="bk-eyebrow">
              DAY {String(save.day).padStart(2, '0')} / 30 · {day.location}
            </p>
            <h1>{day.chapter}</h1>
            <p>{day.objective}</p>
            <div className="bk-quest-stats">
              <span>
                <b>{day.phraseIds.length}</b> phrases today
              </span>
              <span>
                <b>{due.length}</b> due for review
              </span>
            </div>
            <div className="bk-rule" />
            <p className="bk-coach-quote">
              “A little Thai opens a lot of doors. Come on — I’ll go with you.”
              <small>SU · YOUR GUIDE & PARTY MEMBER</small>
            </p>
            <button className="bk-button bk-gold" onClick={() => beginRef.current()}>
              {active
                ? 'Resume practice'
                : nextActivity < 0
                  ? save.day < 30
                    ? `Continue to day ${save.day + 1}`
                    : 'Practise again'
                  : 'Begin today’s practice'}{' '}
              <span>→</span>
            </button>
          </aside>
          <div className="bk-location-label">
            <span>✧</span>
            <div>
              {day.location}
              <small>Drag to look around · Click Su to begin</small>
            </div>
            <button onClick={() => world.current?.resetCamera()} aria-label="Reset camera">
              ↺
            </button>
          </div>
          <section className="bk-daily-plan" aria-label="Daily training activities">
            <div className="bk-plan-heading">
              <div>
                <p className="bk-eyebrow">YOUR DAILY RITUAL</p>
                <h2>Small steps. Real conversations.</h2>
              </div>
              <button className="bk-text-button" onClick={() => setMapOpen(true)}>
                Day {save.day} of 30 ↗
              </button>
            </div>
            <div className="bk-activity-grid">
              {activities.map((a, i) => (
                <button
                  key={a.name}
                  className={`bk-activity ${completed.includes(i) ? 'is-done' : ''} ${i === nextActivity ? 'is-next' : ''}`}
                  onClick={() => startActivity(i)}
                >
                  <span className="bk-activity-icon">{completed.includes(i) ? '✓' : a.icon}</span>
                  <span>
                    <small>
                      {String(i + 1).padStart(2, '0')} / {a.minutes} MIN
                    </small>
                    <strong>{a.name}</strong>
                    <em>
                      {completed.includes(i)
                        ? 'Complete · replay'
                        : i === nextActivity
                          ? 'Up next →'
                          : a.short === 'Speak'
                            ? 'Your voice, your pace'
                            : a.description.split('.')[0]}
                    </em>
                  </span>
                </button>
              ))}
            </div>
          </section>
          <footer className="bk-camp-footer">
            <span>
              ✦ LV {level} · {ranks[Math.min(4, Math.floor((level - 1) / 3))]}
            </span>
            <button onClick={() => setJournalOpen(true)}>
              ▤ Phrase journal · {Object.keys(save.records).length}
            </button>
            <span>PROGRESS SAVES AUTOMATICALLY</span>
          </footer>
        </>
      )}

      {screen === 'practice' && active && phrase && (
        <>
          <div className="bk-encounter-heading">
            <div>
              <p className="bk-eyebrow">
                DAY {active.day} · {day.location}
              </p>
              <h1>{activity.name}</h1>
            </div>
            <button
              className="bk-chip"
              onClick={() => {
                resetPrompt();
                setScreen('camp');
              }}
              disabled={voice.recording || voice.coachBusy || choiceBusy}
            >
              Ⅱ Save & rest
            </button>
          </div>
          <aside className="bk-party">
            <div className="bk-party-member">
              <span className="bk-party-initial">P</span>
              <div>
                <strong>
                  Patrick <small>LV {level}</small>
                </strong>
                <span>TRAVELLER · {save.xp} XP</span>
                <div className="bk-meter">
                  <i style={{ width: `${(save.xp % 250) / 2.5}%` }} />
                </div>
              </div>
            </div>
            <div className="bk-party-member">
              <span className="bk-party-initial su">S</span>
              <div>
                <strong>
                  Su <small>GUIDE</small>
                </strong>
                <span>ASK FOR HELP ANYTIME</span>
                <div className="bk-meter su">
                  <i style={{ width: '100%' }} />
                </div>
              </div>
            </div>
          </aside>
          {isTrial && (
            <div className="bk-spirit-status">
              <p>THE FORGETTING WISP</p>
              <span>Recover your words to restore its light.</span>
              <div className="bk-meter">
                <i style={{ width: `${(1 - progress) * 100}%` }} />
              </div>
              <small>{active.queue.length - active.index} memories to restore</small>
            </div>
          )}
          <section
            className={`bk-dialogue ${feedback?.success ? 'is-success' : ''}`}
            aria-label="Thai practice"
          >
            <div className="bk-dialogue-progress">
              <span>
                {isTrial
                  ? '✦ MEMORY MAGIC'
                  : activity.mode === 'spoken'
                    ? '◉ SPEAKING PRACTICE'
                    : '✧ YOUR NEXT WORD'}
              </span>
              <span>
                {active.index + 1} / {active.queue.length}
                <i style={{ width: `${progress * 100}%` }} />
              </span>
            </div>
            <div className="bk-dialogue-body">
              <div className="bk-dialogue-context">
                <p className="bk-speaker">
                  {activity.mode === 'choice' ? 'THE CITY ASKS' : 'SU'} <span>· {day.title}</span>
                </p>
                <h2>
                  {activity.mode === 'choice'
                    ? situationFor(phrase.id, active.index)
                    : activity.mode === 'recall' && !revealed
                      ? `How would you say “${phrase.translation}”?`
                      : phrase.translation}
                </h2>
                {(activity.mode !== 'recall' || revealed || feedback?.success) && !recognitionMode && (
                  <div className="bk-phrase">
                    <p lang="th">{phrase.targetPhrase}</p>
                    <span>{phrase.romanization}</span>
                  </div>
                )}
                {activity.mode === 'recall' && !revealed && !feedback?.success && (
                  <p className="bk-gentle">
                    Say it aloud before revealing the answer. Taking a moment to remember is part of learning.
                  </p>
                )}
                {hint && (
                  <p className="bk-hint">
                    <b>Su’s hint</b> {phrase.romanization} means “{phrase.translation}”. Listen first, then
                    give it another go.
                  </p>
                )}
                {!recognitionMode && voiceTools}
                <p className="bk-voice-message" role="status">
                  {voice.message ||
                    (activity.mode === 'spoken'
                      ? 'Recordings stay in this session unless you choose the voice coach.'
                      : activity.mode === 'study'
                        ? 'Hear it. Echo it. Try it once without looking.'
                        : '')}
                </p>
              </div>
              <div className="bk-dialogue-actions">
                {feedback?.success ? (
                  <div className="bk-feedback" role="status">
                    <span>✦</span>
                    <h3>
                      {activity.mode === 'choice'
                        ? 'Conversation unlocked.'
                        : isTrial
                          ? 'A memory restored.'
                          : 'One step closer.'}
                    </h3>
                    <p>{feedback.text}</p>
                    <button className="bk-button bk-gold" onClick={next}>
                      Continue <span>→</span>
                    </button>
                  </div>
                ) : (
                  <>
                    {feedback && (
                      <p className="bk-retry" role="status">
                        {feedback.text}
                      </p>
                    )}
                    {recognitionMode ? (
                      <SpeakChoice
                        key={`${active.activity}:${active.index}`}
                        choices={choicesFor(phrase.id, day, active.index)}
                        choicesClassName="bk-choice-list"
                        onSubmit={(id, spoken) => resolve(id === phrase.id, spoken ? 'spoken' : 'choice')}
                        onBusyChange={setChoiceBusy}
                        onPreview={voice.stopPlayback}
                      />
                    ) : activity.mode === 'study' ? (
                      <>
                        <p className="bk-action-label">LISTEN → ECHO → SAY IT YOURSELF</p>
                        <button
                          className="bk-button bk-gold"
                          onClick={() => resolve(true, 'study')}
                          disabled={voice.recording || voice.coachBusy || choiceBusy}
                        >
                          I’ve listened & practised <span>→</span>
                        </button>
                        <p className="bk-gentle">
                          Try a slow echo, a natural echo, then one from memory. Repeat as much as you need.
                        </p>
                      </>
                    ) : activity.mode === 'spoken' ? (
                      <>
                        <button
                          className="bk-button bk-gold"
                          disabled={
                            (!voice.clip && !voice.coachPass) ||
                            voice.recording ||
                            voice.coachBusy ||
                            choiceBusy
                          }
                          onClick={() => resolve(true, voice.coachPass ? 'coach' : 'spoken')}
                        >
                          Log speaking practice <span>✦</span>
                        </button>
                        <button
                          className="bk-button bk-outline"
                          onClick={() => void voice.record(true)}
                          disabled={voice.coachBusy || (voice.recording && !voice.coachBusy)}
                        >
                          {voice.coachBusy ? 'Listening…' : 'Check with voice coach'}
                        </button>
                        <p className="bk-gentle">
                          Record yourself, play it back, and compare. The optional coach checks recognised
                          wording; it does not grade Thai tones.
                        </p>
                        <button className="bk-text-button" onClick={() => setNoMic(true)}>
                          Practise with choices instead →
                        </button>
                      </>
                    ) : !revealed ? (
                      <>
                        <button className="bk-button bk-gold" onClick={() => setRevealed(true)}>
                          Reveal & compare <span>✧</span>
                        </button>
                        <p className="bk-gentle">
                          This is a self-check. Be honest with Su — difficult phrases return sooner.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="bk-action-label">SELF-CHECK · HOW DID YOU DO?</p>
                        <button
                          className="bk-button bk-gold"
                          onClick={() => resolve(true, 'recall')}
                          disabled={voice.recording || voice.coachBusy || choiceBusy}
                        >
                          I recalled it <span>✦</span>
                        </button>
                        <button
                          className="bk-button bk-outline"
                          onClick={() => {
                            setFeedback({
                              success: true,
                              kind: 'recall',
                              remembered: false,
                              text: 'Marked for another review. Needing practice is normal — Su will bring this phrase back.',
                            });
                          }}
                          disabled={voice.recording || voice.coachBusy || choiceBusy}
                        >
                          Needs more practice
                        </button>
                      </>
                    )}
                    <div className="bk-assist-row">
                      {noMic && activity.mode === 'spoken' && (
                        <button
                          onClick={() => {
                            setNoMic(false);
                            resetPrompt();
                          }}
                        >
                          ◉ Use my microphone
                        </button>
                      )}
                      <button onClick={() => setHint((v) => !v)}>{hint ? 'Hide hint' : '✧ Ask Su'}</button>
                      <button onClick={() => setJournalOpen(true)}>▤ Phrase journal</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>
        </>
      )}

      {screen === 'reward' && (
        <section className="bk-reward">
          <p className="bk-eyebrow">✦ {activities[rewardActivity].name} COMPLETE</p>
          <h1>
            Your words
            <br />
            <em>take you further.</em>
          </h1>
          <p>
            {completed.length === 6
              ? 'Today’s route is complete. Take a break, or spend the rest of your hour rehearsing the phrases that need more practice.'
              : 'Another part of your daily ritual is complete. Rest for a moment, then return to the city.'}
          </p>
          <div className="bk-reward-stats">
            <span>
              <b>{speakingCount}</b>phrases spoken
            </span>
            <span>
              <b>{recallCount}</b>phrases recalled
            </span>
            <span>
              <b>{Math.floor(elapsed / 60)}</b>practice minutes today
            </span>
          </div>
          <button className="bk-button bk-gold" onClick={() => setScreen('camp')}>
            Return to camp <span>→</span>
          </button>
          <button className="bk-button bk-outline" onClick={() => startActivity(rewardActivity)}>
            Practise another round
          </button>
          {completed.length === 6 && save.day < 30 && (
            <button
              className="bk-text-button"
              onClick={() => {
                setSave((s) => ({ ...s, day: s.day + 1 }));
                setScreen('camp');
              }}
            >
              Continue to day {save.day + 1} →
            </button>
          )}
        </section>
      )}

      {worldStatus === 'loading' && (
        <div className="bk-loading">
          <span /> Preparing your travelling party…
        </div>
      )}
      {(worldStatus === 'error' || worldStatus === 'fallback') && (
        <div className="bk-world-error">
          {worldStatus === 'error'
            ? 'The 3D scene could not load. Your practice and saved progress are still available.'
            : 'A character could not load. Your practice remains available.'}
          <button onClick={() => location.reload()}>Reload scene</button>
        </div>
      )}
      {saveError && (
        <div className="bk-save-error" role="alert">
          Your browser could not save progress. Keep this tab open or allow local storage.
        </div>
      )}

      <Modal
        isOpen={mapOpen}
        onClose={() => setMapOpen(false)}
        title="Thirty days to Thailand"
        eyebrow="YOUR TRAVEL ROUTE"
        className="bk-modal"
      >
        <p className="bk-modal-intro">
          Three small lessons per location. Review older phrases each day. Days 28–30 combine them into travel
          rehearsals. You can revisit or preview any day.
        </p>
        <div className="bk-route-grid">
          {days.map((d) => (
            <button
              key={d.day}
              className={d.day === save.day ? 'selected' : ''}
              onClick={() => {
                setSave((s) => ({ ...s, day: d.day, session: null }));
                resetPrompt();
                setMapOpen(false);
                setScreen('camp');
              }}
            >
              <span>
                DAY {String(d.day).padStart(2, '0')} {(save.completed[d.day]?.length ?? 0) === 6 ? '✓' : ''}
              </span>
              <strong>{d.title}</strong>
              <small>{d.location}</small>
            </button>
          ))}
        </div>
      </Modal>
      <Modal
        isOpen={journalOpen}
        onClose={() => setJournalOpen(false)}
        title="Your travel phrasebook"
        eyebrow="WORDS WORTH KEEPING"
        className="bk-modal"
      >
        <TodayPractice
          save={save}
          onReview={() => {
            setJournalOpen(false);
            startActivity(0);
          }}
        />
        <p className="bk-modal-intro">
          Recognition, recall, and speaking are different skills. The examples use Patrick’s polite masculine
          forms (ครับ / khrap). Recordings are synthetic Thai reference speech, not native-speaker
          assessments.
        </p>
        <input
          className="bk-search"
          aria-label="Search phrases"
          placeholder="Search English, Thai, or romanization…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="bk-journal-list">
          {Object.values(phrases)
            .filter((p) =>
              `${p.targetPhrase} ${p.translation} ${p.romanization}`
                .toLowerCase()
                .includes(query.toLowerCase()),
            )
            .map((p) => (
              <div key={p.id}>
                <div>
                  <strong lang="th">{p.targetPhrase}</strong>
                  <span>{p.romanization}</span>
                  <p>{p.translation}</p>
                </div>
                <small>
                  {save.records[p.id]?.spoken ? '◉ Spoken' : 'Speaking not practised'}
                  <br />
                  {save.records[p.id]?.recalled ? '✦ Recalled' : 'Not yet recalled'}
                </small>
              </div>
            ))}
        </div>
      </Modal>
      <Modal
        isOpen={helpOpen}
        onClose={() => setHelpOpen(false)}
        title="Make Thai part of your day"
        eyebrow="YOUR ONE-HOUR RITUAL"
        className="bk-modal"
      >
        <div className="bk-help">
          <p>
            Work through the six activities at camp. The minutes are a suggested rhythm, not a countdown you
            must wait out. Replay a round when you want more speaking time.
          </p>
          <ol>
            {activities.map((a) => (
              <li key={a.name}>
                <b>
                  {a.minutes} min · {a.name}
                </b>
                <span>{a.description}</span>
              </li>
            ))}
          </ol>
          <p>
            <b>Speak before you reveal.</b> Reading a phrase is easier than remembering it. Give yourself a
            moment, say it aloud, then compare.
          </p>
          <p>
            <b>Your microphone, your choice.</b> “Record myself” stays in the browser and is discarded when
            you move on. “Voice coach” uses your configured local Whisper or Realtime service. Phrase choices
            never count as spoken practice.
          </p>
          <p>
            <b>Honest feedback.</b> Recall is self-assessed. Recognised wording does not prove accurate tones.
            Use the Thai reference audio rather than relying on romanization alone.
          </p>
          <p>
            <b>A real trip, a fictional city.</b> This is a stylized Bangkok-inspired world. The curriculum
            reuses the project’s travel phrases; broader wording and pronunciation still need a Thai-speaker
            review.
          </p>
          <a
            href="https://www.tatnews.org/2024/10/10-essential-thai-phrases-every-tourist-should-know/"
            target="_blank"
            rel="noreferrer"
          >
            Tourism Authority of Thailand · essential phrases ↗
          </a>
        </div>
      </Modal>
    </main>
  );
}
