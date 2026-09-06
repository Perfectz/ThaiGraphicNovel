import { useEffect, useRef, useState } from 'react';
import {
  activeHero,
  battleSpoils,
  actor,
  defend,
  enemyIntent,
  moveReason,
  moveEffect,
  moveDetail,
  hasTalent,
  moves,
  partyAction,
  performMove,
  timingResult,
  type Battle,
  type Defense,
  type Move,
} from './expeditionCombat';
import { phrases } from './curriculum';
import SpeakChoice from './SpeakChoice';
import { useBattleAudio } from './useBattleAudio';
import { useSoundSettings } from '../hooks/useSoundSettings';
import { saveSoundSettings } from '../services/soundSettings';
import './expedition.css';

type Props = {
  battle: Battle;
  onChange: (battle: Battle, practiced?: { id: string; spoken: boolean }) => void;
  onLeave: () => void;
  onScene: (battle: Battle, target: string | null) => void;
  onCharge: (progress: number | null) => void;
};

/** Timing exists only in enemy attacks. Reading, listening and speaking are always untimed. */
function ReactiveDefense({
  battle,
  onResolve,
  onCharge,
}: {
  battle: Battle;
  onResolve: (result: Defense) => void;
  onCharge: Props['onCharge'];
}) {
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const elapsed = useRef(0),
    settled = useRef(false),
    meter = useRef<HTMLDivElement>(null);
  const callback = useRef(onResolve);
  callback.current = onResolve;
  const charge = useRef(onCharge);
  charge.current = onCharge;
  const intent = enemyIntent(battle);
  const finish = (result: Defense) => {
    if (settled.current) return;
    settled.current = true;
    setRunning(false);
    charge.current(null);
    callback.current(result);
  };
  const finishRef = useRef(finish);
  finishRef.current = finish;
  useEffect(() => {
    if (!running || paused) return;
    let frame = 0,
      last = performance.now();
    function tick(now: number) {
      if (document.hidden) {
        setPaused(true);
        return;
      }
      // Cap single-frame stalls so software rendering cannot skip an entire defense window.
      elapsed.current += Math.min(80, now - last);
      last = now;
      const p = elapsed.current / 2400;
      if (meter.current) meter.current.style.setProperty('--timing', `${Math.min(100, p * 100)}%`);
      setProgress(p);
      charge.current(p);
      if (p >= 1) finishRef.current('miss');
      else frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    const pause = () => setPaused(true);
    window.addEventListener('blur', pause);
    document.addEventListener('visibilitychange', pause);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('blur', pause);
      document.removeEventListener('visibilitychange', pause);
    };
  }, [running, paused]);
  useEffect(() => () => charge.current(null), []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!running || paused || e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.code === 'Space' || e.code === 'KeyF') {
        e.preventDefault();
        finishRef.current(timingResult(e.code === 'KeyF' ? 'parry' : 'dodge', elapsed.current / 2400));
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [running, paused]);
  return (
    <div className="exp-defense" aria-label="Reactive defense">
      <p className="exp-kicker">
        {intent.foe.name} → {intent.target.name}
      </p>
      <h2>{intent.name}</h2>
      <p className="exp-intent-warning">{intent.hint}</p>
      <p>
        {intent.heavy
          ? 'A heavy wave is coming. Watch for the gold flash.'
          : 'Watch the marker. Defend as it reaches the colored zone.'}
      </p>
      <div
        className="exp-timing"
        ref={meter}
        role="meter"
        aria-label="Attack timing"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(Math.min(1, progress) * 100)}
      >
        <span className="exp-dodge-zone" />
        <span className="exp-parry-zone" />
        <i />
      </div>
      <div className="exp-timing-labels">
        <span>WIND-UP</span>
        <span>TEAL: DODGE · GOLD: PARRY</span>
      </div>
      {!running ? (
        <div className="exp-defense-controls">
          <button
            className="exp-primary"
            onClick={() => {
              elapsed.current = 0;
              setProgress(0);
              setRunning(true);
            }}
          >
            Face the attack
          </button>
          <button onClick={() => finish('block')}>Steady guard · no timing</button>
        </div>
      ) : paused ? (
        <button className="exp-primary" onClick={() => setPaused(false)}>
          Resume attack · paused while away
        </button>
      ) : (
        <div className="exp-defense-controls">
          <button onClick={() => finish(timingResult('dodge', elapsed.current / 2400))}>
            <b>SPACE · Dodge</b>
            <small>Wide window · avoid damage</small>
          </button>
          <button onClick={() => finish(timingResult('parry', elapsed.current / 2400))}>
            <b>F · Parry</b>
            <small>Tight window · counter +1 AP</small>
          </button>
        </div>
      )}
      <small>
        Press once inside the zone. An early input misses. Steady guard halves damage automatically.
      </small>
    </div>
  );
}

export default function ExpeditionBattle({ battle: b, onChange, onLeave, onScene, onCharge }: Props) {
  const sound = useSoundSettings();
  useBattleAudio(b, sound.effectsEnabled !== false);
  const [pane, setPane] = useState<'menu' | 'words' | 'items' | 'target' | 'speak' | 'intel'>('menu');
  const [intelTarget, setIntelTarget] = useState(b.foes[0].id);
  const [move, setMove] = useState<Move | null>(null);
  const [item, setItem] = useState<'rice' | 'tea' | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [help, setHelp] = useState(false);
  const scene = useRef(onScene);
  scene.current = onScene;
  const latest = useRef(b);
  latest.current = b;
  useEffect(() => {
    scene.current(b, target);
  }, [b, target]);
  useEffect(() => {
    if (!b.event.seq) return;
    setAnimating(true);
    const timer = setTimeout(() => setAnimating(false), 1000);
    return () => clearTimeout(timer);
  }, [b.event.seq]);
  const hero = activeHero(b);
  const livingFoes = b.foes.filter((f) => f.hp > 0);
  const shownPlan = livingFoes.find((f) => f.id === intelTarget)?.id ?? livingFoes[0]?.id;
  const lock = busy || animating;
  const terminal = b.phase === 'victory' || b.phase === 'defeat';
  const name = (id: string) =>
    b.heroes.find((h) => h.id === id)?.name ?? b.foes.find((f) => f.id === id)?.name ?? id;
  function commit(next: Battle, practiced?: { id: string; spoken: boolean }) {
    if (next === latest.current) return;
    setAnimating(true);
    setPane('menu');
    setMove(null);
    setItem(null);
    setTarget(null);
    onChange(next, practiced);
  }
  function chooseMove(m: Move) {
    setMove(m);
    setItem(null);
    setTarget(null);
    setPane('target');
  }
  const targets = move?.target === 'foe' ? b.foes.filter((f) => f.hp) : b.heroes;
  return (
    <div className={`exp-battle exp-phase-${b.phase}`}>
      <div className="exp-letterbox" />
      <section className="exp-round" aria-label="Turn order">
        <span>
          {b.practice ? 'SPARRING' : 'ROUND'} <b>{String(b.round).padStart(2, '0')}</b>
        </span>
        <div>
          {b.order.map((id, i) => {
            const dead = (b.heroes.find((h) => h.id === id) ?? b.foes.find((f) => f.id === id))?.hp === 0;
            return (
              <span
                key={id}
                className={`${i === b.turn && !terminal ? 'active' : ''} ${dead ? 'down' : ''} ${i < b.turn ? 'acted' : ''}`}
              >
                {i === b.turn && !terminal ? '◆ ' : ''}
                {name(id).split(' ')[0]}
                {dead ? ' ×' : ''}
              </span>
            );
          })}
        </div>
      </section>
      <aside className="exp-foes" aria-label="Enemy party">
        {b.foes.map((f) => (
          <div key={f.id} className={`${!f.hp ? 'defeated' : ''} ${target === f.id ? 'selected' : ''}`}>
            <small>
              {f.role === 'echo'
                ? 'SUPPORT · HEALS ITS COMPANION EACH TURN'
                : f.role === 'sentinel'
                  ? 'ARMOR · EXPOSE TO PIERCE · HEAVY EVERY SECOND ROUND'
                  : f.role === 'keeper'
                    ? 'BOSS · HEAVY ATTACK EVERY THIRD ROUND'
                    : 'SPIRIT · BREAK TO CANCEL ITS TURN'}
            </small>
            <h2>{f.name}</h2>
            <div className="exp-hp">
              <i style={{ width: `${(f.hp / f.maxHp) * 100}%` }} />
            </div>
            <span>
              {f.hp} / {f.maxHp} HP {f.exposed && ' · EXPOSED ×1.5'}
              {f.role === 'sentinel' && !f.exposed && ' · ARMOR ×0.5'}
              {f.weakened && ' · WEAKENED'}
            </span>
            <div className="exp-break">
              <i style={{ width: `${f.break}%` }} />
            </div>
            <small>{f.staggered ? 'BREAK · NEXT TURN CANCELLED' : `BREAK ${f.break} / 100`}</small>
          </div>
        ))}
      </aside>
      {animating && (
        <div key={b.event.seq} className={`exp-impact exp-impact-${b.event.kind}`} aria-hidden="true">
          <small>
            {b.event.kind === 'duet'
              ? 'TWO VOICES, ONE RIVER'
              : b.event.kind === 'parry'
                ? 'PARRY · COUNTER'
                : b.event.kind === 'dodge'
                  ? 'DODGE'
                  : name(b.event.target)}
          </small>
          <strong>
            {b.event.value
              ? `${b.event.kind === 'heal' ? '+' : '−'}${b.event.value}`
              : b.event.kind.toUpperCase()}
          </strong>
        </div>
      )}
      <div className="exp-party" aria-label="Your party">
        {b.heroes.map((h) => (
          <div
            key={h.id}
            className={`${actor(b) === h.id && !terminal ? 'active' : ''} ${!h.hp ? 'down' : ''}`}
          >
            <span className={`exp-portrait ${h.id}`}>{h.id === 'patrick' ? 'P' : 'S'}</span>
            <section>
              <small>
                {h.id === 'patrick' ? 'WAYFARER · BREAK & STRIKE' : 'RIVERKEEPER · REVEAL & RESTORE'}
              </small>
              <h3>
                {h.name}
                {b.growth && <small> · LV {b.growth.level}</small>}
                {h.guard && ' ◇'}
              </h3>
              <div className="exp-hp">
                <i style={{ width: `${(h.hp / h.maxHp) * 100}%` }} />
              </div>
              <span>
                HP {h.hp} / {h.maxHp} <b>AP {h.ap} / 6</b>
                {!h.hp && ' · DOWN'}
              </span>
            </section>
          </div>
        ))}
        <div className="exp-resonance">
          <small>DUET · {b.resonance}%</small>
          <div>
            <i style={{ width: `${b.resonance}%` }} />
          </div>
        </div>
      </div>
      <section
        className={`exp-command-panel ${pane === 'speak' ? 'rehearsing' : ''} ${pane === 'intel' ? 'scouting' : ''}`}
        aria-label="Battle commands"
      >
        {terminal ? (
          <div className="exp-result">
            <p className="exp-kicker">
              {b.phase === 'victory' ? 'ENCOUNTER COMPLETE' : 'THE RIVER OFFERS ANOTHER CHANCE'}
            </p>
            <h1>{b.phase === 'victory' ? 'The silence breaks.' : 'Regroup. Return stronger.'}</h1>
            <p>
              {b.practice
                ? 'Practice complete. Story progress, health, and provisions are unchanged.'
                : b.phase === 'victory'
                  ? `${battleSpoils(b.id).label} · ${battleSpoils(b.id).xp} XP · ${battleSpoils(b.id).coins} coins`
                  : 'Wake at the inn with 35 HP. All quest items are safe.'}
            </p>
            <button className="exp-primary" disabled={animating} onClick={onLeave}>
              {b.practice
                ? 'Finish sparring'
                : b.phase === 'victory'
                  ? 'Claim rewards & continue'
                  : 'Return to the inn'}
            </button>
          </div>
        ) : (
          <>
            <div className="exp-panel-heading">
              <span>
                {b.phase === 'defense' ? 'ENEMY TURN · REACT' : `${hero?.name.toUpperCase()} · YOUR TURN`}
              </span>
              <button disabled={lock} onClick={() => setHelp(!help)}>
                {help ? 'Close guide' : 'Battle guide'}
              </button>
              <button
                className="exp-sound-toggle"
                aria-pressed={sound.effectsEnabled !== false}
                onClick={() =>
                  saveSoundSettings({ ...sound, effectsEnabled: sound.effectsEnabled === false })
                }
              >
                Battle sound {sound.effectsEnabled === false ? 'off' : 'on'}
              </button>
            </div>
            {help && (
              <div className="exp-help">
                Use free word abilities to gain AP. Su’s Echo Lens exposes a foe; Patrick’s Clear Intent
                exploits it. Build 100 break to cancel an enemy turn. The Lantern Echo heals its companion, so
                choose your targets. Five word abilities fill your duet gauge. Learn and speak at your own
                pace; only enemy attacks use timing.
              </div>
            )}
            <div className="exp-battle-log" role="status">
              {b.log.at(-1) ?? b.event.text}
            </div>
            {animating ? (
              <div className="exp-resolving">
                <span>✦</span> {b.event.text}
              </div>
            ) : b.phase === 'defense' ? (
              <ReactiveDefense
                key={`${b.round}:${b.turn}`}
                battle={b}
                onResolve={(result) => commit(defend(latest.current, result))}
                onCharge={onCharge}
              />
            ) : pane === 'menu' ? (
              <div className="exp-command-layout">
                <div className="exp-turn-copy">
                  <p className="exp-kicker">
                    {hero?.id === 'patrick' ? 'GIVE YOUR WORDS WEIGHT' : 'SET UP THE NEXT STRIKE'}
                  </p>
                  <h2>{hero?.id === 'patrick' ? 'Speak. Shape the battle.' : 'Two voices. One purpose.'}</h2>
                  <p>
                    {hero?.id === 'patrick'
                      ? 'Build AP with a greeting. Break a foe, or spend energy on a decisive reply.'
                      : 'Expose an enemy for Patrick, repair a connection, or restore your energy.'}
                  </p>
                  <small>Your words are untimed. Preview the English, listen, then speak Thai.</small>
                  <button className="exp-read-plans" onClick={() => setPane('intel')}>
                    Read enemy plans · free
                  </button>
                </div>
                <div className="exp-commands">
                  <button className="exp-primary" onClick={() => setPane('words')}>
                    <b>✦ Word arts</b>
                    <small>Choose a Thai ability</small>
                  </button>
                  <button onClick={() => commit(partyAction(b, 'guard'))}>
                    <b>◇ Guard</b>
                    <small>−70% damage · +2 AP{hasTalent(b, 'patience') ? ' · +10 resonance' : ''}</small>
                  </button>
                  <button onClick={() => setPane('items')}>
                    <b>▣ Provisions</b>
                    <small>Heal a chosen ally</small>
                  </button>
                  <button
                    disabled={b.resonance < 100 || b.heroes.some((h) => !h.hp)}
                    onClick={() => {
                      setMove(null);
                      setItem(null);
                      setPane('speak');
                    }}
                  >
                    <b>✧ River duet</b>
                    <small>
                      {b.resonance < 100 ? `${b.resonance} / 100 resonance` : '65 damage to all · heal party'}
                    </small>
                  </button>
                </div>
              </div>
            ) : pane === 'intel' ? (
              <div className="exp-intel" aria-label="Enemy plans">
                <p>No turn or AP cost. Plans update as you break, weaken or defeat a foe.</p>
                <div className="exp-intel-tabs" aria-label="Choose an enemy plan">
                  {livingFoes.map((foe) => (
                    <button
                      key={foe.id}
                      aria-pressed={foe.id === shownPlan}
                      onClick={() => setIntelTarget(foe.id)}
                    >
                      {foe.name}
                    </button>
                  ))}
                </div>
                <div className="exp-intel-grid">
                  {livingFoes.map((foe) => {
                    const plan = enemyIntent(b, foe.id);
                    return (
                      <article
                        key={foe.id}
                        data-enemy-plan={foe.id}
                        className={foe.id === shownPlan ? 'selected' : ''}
                      >
                        <p className="exp-kicker">
                          {foe.name} · ROUND {b.round}
                        </p>
                        <h3>{foe.staggered ? 'Turn cancelled' : plan.name}</h3>
                        <strong>
                          {foe.staggered
                            ? 'Exposed to your next word art'
                            : `${plan.target.name} · ${plan.damage} base damage${foe.weakened ? ' · weakened' : ''}`}
                        </strong>
                        <p>{plan.hint}</p>
                      </article>
                    );
                  })}
                </div>
                <button className="exp-primary" onClick={() => setPane('words')}>
                  Choose a word art
                </button>
              </div>
            ) : pane === 'words' ? (
              <div className="exp-word-grid">
                {moves
                  .filter((m) => m.owner === hero?.id)
                  .map((m) => (
                    <button key={m.id} disabled={!!moveReason(b, m)} onClick={() => chooseMove(m)}>
                      <span className="exp-cost">{m.cost ? `${m.cost} AP` : '+2 AP'}</span>
                      <b>{m.name}</b>
                      <strong lang="en">“{phrases[m.phrase].translation}”</strong>
                      <span lang="th">{phrases[m.phrase].targetPhrase}</span>
                      <small>{moveEffect(b, m)}</small>
                    </button>
                  ))}
              </div>
            ) : pane === 'items' ? (
              <div className="exp-word-grid">
                {(['rice', 'tea'] as const).map((id) => (
                  <button
                    key={id}
                    disabled={!b[id]}
                    onClick={() => {
                      setItem(id);
                      setMove(null);
                      setPane('target');
                    }}
                  >
                    <b>
                      {id === 'rice' ? 'Rice parcel' : 'Thai tea'} ×{b[id]}
                    </b>
                    <small>
                      {id === 'rice' ? 'Restore 45 HP to one ally' : 'Restore 20 HP and all AP to one ally'}
                    </small>
                  </button>
                ))}
              </div>
            ) : pane === 'target' ? (
              <div className="exp-targeting">
                <div>
                  <p className="exp-kicker">{move?.name ?? (item === 'rice' ? 'Rice parcel' : 'Thai tea')}</p>
                  <h2>Choose a target.</h2>
                  <p>{move ? moveDetail(b, move) : 'Using a provision takes this character’s turn.'}</p>
                  {move && (
                    <strong>
                      “{phrases[move.phrase].translation}” · {moveEffect(b, move)}
                    </strong>
                  )}
                </div>
                <div className="exp-target-list">
                  {targets.map((t) => {
                    const dead = !t.hp && move?.id !== 'mend';
                    const full = 'ap' in t && (move?.id === 'mend' || item === 'rice') && t.hp === t.maxHp;
                    const refreshed =
                      'ap' in t && (move?.id === 'water' || item === 'tea') && t.hp === t.maxHp && t.ap === 6;
                    return (
                      <button
                        key={t.id}
                        disabled={dead || full || refreshed}
                        onMouseEnter={() => setTarget(t.id)}
                        onFocus={() => setTarget(t.id)}
                        onClick={() => {
                          setTarget(t.id);
                          if (item) commit(partyAction(b, item, t.id));
                          else setPane('speak');
                        }}
                      >
                        <b>◎ {t.name}</b>
                        <span>
                          {t.hp} / {t.maxHp} HP{'exposed' in t && t.exposed ? ' · EXPOSED' : ''}
                        </span>
                        {!t.hp && <small>Revive with Make Amends</small>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="exp-rehearsal">
                <div>
                  <p className="exp-kicker">
                    {move?.name ?? 'RIVER DUET'} · {target ? name(target) : 'ALL ENEMIES'}
                  </p>
                  <h2>{move ? phrases[move.phrase].translation : phrases['thank-you'].translation}</h2>
                  <p>
                    {move?.detail ??
                      'Let gratitude carry both voices across the river. Deal 65 damage to every foe and heal both allies for 15 HP.'}
                  </p>
                  <strong>
                    {move
                      ? moveEffect(b, move)
                      : `100 resonance · both allies required · heal ${b.growth?.talents.includes('harmony') ? 25 : 15} HP each`}
                  </strong>
                  <small>
                    Listen and practise as often as you like. The action only happens when you confirm your
                    reply.
                  </small>
                </div>
                <SpeakChoice
                  key={`${b.round}:${b.turn}:${move?.id ?? 'duet'}:${target}`}
                  initialPhraseId={move?.phrase ?? 'thank-you'}
                  choices={[phrases[move?.phrase ?? 'thank-you']]}
                  onBusyChange={setBusy}
                  onSubmit={(id, spoken) => {
                    if (busy) return;
                    const next =
                      move && target
                        ? performMove(latest.current, move.id, target)
                        : partyAction(latest.current, 'duet');
                    commit(next, { id, spoken });
                  }}
                />
              </div>
            )}
            {!animating && b.phase === 'command' && (
              <div className="exp-panel-footer">
                <button
                  disabled={busy}
                  onClick={() => {
                    setPane('menu');
                    setTarget(null);
                  }}
                >
                  {pane === 'menu' ? '◆ Plan your next move' : '← Commands'}
                </button>
                {pane === 'menu' && <button onClick={onLeave}>Retreat</button>}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
