import test from 'node:test';
import assert from 'node:assert/strict';
import { renderBattleCue, battleCue, type BattleCue } from '../src/bangkok/battleCues.ts';
import { BattleAudio } from '../src/bangkok/BattleAudio.ts';
import { createBattle } from '../src/bangkok/expeditionCombat.ts';
import { getSoundSettings } from '../src/services/soundSettings.ts';
const names: BattleCue[] = [
  'strike',
  'hurt',
  'guard',
  'parry',
  'dodge',
  'break',
  'heal',
  'expose',
  'duet',
  'victory',
  'defeat',
];
test('old music-muted settings migrate quietly and an explicit effects preference wins', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  try {
    for (const [saved, expected] of [
      [{ musicEnabled: false }, false],
      [{ musicEnabled: true }, true],
      [{ musicEnabled: false, effectsEnabled: true }, true],
      [{ musicEnabled: true, effectsEnabled: false }, false],
    ] as const) {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: { localStorage: { getItem: () => JSON.stringify(saved) } },
      });
      assert.equal(getSoundSettings().effectsEnabled, expected);
    }
  } finally {
    if (original) Object.defineProperty(globalThis, 'window', original);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
test('all feedback cues contain finite signals, headroom and silent boundaries', () => {
  const signatures = new Set<string>();
  for (const cue of names) {
    const samples = renderBattleCue(cue);
    assert(samples.length <= 22050 * 1.31 && samples.length > 4000);
    assert(samples.every(Number.isFinite));
    assert(Math.max(...samples.map(Math.abs)) < 0.59);
    assert(Math.sqrt(samples.reduce((sum, n) => sum + n * n, 0) / samples.length) > 0.005);
    assert.equal(Math.abs(samples[0]), 0);
    assert.equal(Math.abs(samples.at(-1)!), 0);
    signatures.add(samples.slice(0, 500).join(','));
    assert.deepEqual(samples, renderBattleCue(cue));
  }
  assert.equal(signatures.size, names.length);
});
test('feedback follows new outcomes and never replays a saved event or preview', () => {
  const b = createBattle('keeper', 100, 1, 1, false);
  assert.equal(battleCue(b, structuredClone(b)), null);
  for (const cue of ['guard', 'heal', 'parry', 'dodge', 'duet'] as const) {
    const next = structuredClone(b);
    next.event = { ...b.event, seq: b.event.seq + 1, kind: cue };
    assert.equal(battleCue(b, next), cue);
  }
  const next = structuredClone(b);
  next.event = { ...b.event, seq: b.event.seq + 1, kind: 'strike', target: b.heroes[0].id };
  assert.equal(battleCue(b, next), 'hurt');
  next.event.target = b.foes[0].id;
  assert.equal(battleCue(b, next), 'strike');
  next.foes[0].exposed = true;
  assert.equal(battleCue(b, next), 'expose');
  next.foes[0].staggered = true;
  assert.equal(battleCue(b, next), 'break');
  next.foes[0].staggered = false;
  const charged = structuredClone(b);
  charged.foes[0].break = 80;
  assert.equal(
    battleCue(charged, next),
    'break',
    'a break still sounds when advance immediately consumes the skipped turn',
  );
  next.phase = 'victory';
  assert.equal(battleCue(b, next), 'victory');
  next.phase = 'defeat';
  assert.equal(battleCue(b, next), 'defeat');
  assert.equal(battleCue(next, b), null);
});
function fixture() {
  const stats = { contexts: 0, starts: 0, stops: 0, disconnects: 0, closes: 0, buffers: 0 };
  const sources: {
    onended: (() => void) | null;
    start: () => void;
    stop: () => void;
    connect: () => void;
    disconnect: () => void;
    buffer: unknown;
  }[] = [];
  const context = {
    state: 'running',
    destination: {},
    createGain: () => ({ gain: { value: 0 }, connect() {}, disconnect() {} }),
    createBuffer: () => {
      stats.buffers++;
      return { copyToChannel() {} };
    },
    createBufferSource: () => {
      const source = {
        buffer: null,
        onended: null as (() => void) | null,
        start() {
          stats.starts++;
        },
        stop() {
          stats.stops++;
        },
        connect() {},
        disconnect() {
          stats.disconnects++;
        },
      };
      sources.push(source);
      return source;
    },
    resume: async () => {},
    close: async () => {
      stats.closes++;
    },
  };
  return {
    stats,
    sources,
    context,
    engine: new BattleAudio(() => {
      stats.contexts++;
      return context as unknown as AudioContext;
    }),
  };
}
test('audio needs a gesture, honors focus and mute, and never queues blocked cues', () => {
  const { engine, stats, context } = fixture();
  assert.equal(engine.play('guard'), false);
  assert.equal(stats.contexts, 0);
  engine.setAllowed(false);
  engine.unlock();
  assert.equal(stats.contexts, 0);
  engine.setAllowed(true);
  engine.unlock();
  assert(engine.play('parry'));
  engine.setAllowed(false);
  assert.equal(stats.stops, 1);
  assert.equal(stats.disconnects, 1);
  assert.equal(engine.play('victory'), false);
  engine.setAllowed(true);
  assert.equal(stats.starts, 1);
  context.state = 'suspended';
  assert.equal(engine.play('strike'), false);
  context.state = 'running';
  assert(engine.play('parry'));
  assert.equal(stats.buffers, 1, 'same cue reuses its buffer');
  engine.dispose();
  engine.dispose();
  assert.equal(stats.closes, 1);
  assert.equal(engine.play('strike'), false);
  engine.unlock();
  assert.equal(stats.contexts, 1);
});
test('completed sounds disconnect and teardown does not stop them again', () => {
  const { engine, stats, sources } = fixture();
  engine.unlock();
  engine.play('heal');
  sources[0].onended!();
  assert.equal(stats.disconnects, 1);
  engine.dispose();
  assert.equal(stats.stops, 0);
});
