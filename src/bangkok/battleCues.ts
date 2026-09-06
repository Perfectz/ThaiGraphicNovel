import type { Battle } from './expeditionCombat.ts';

export type BattleCue =
  | 'strike'
  | 'hurt'
  | 'guard'
  | 'parry'
  | 'dodge'
  | 'break'
  | 'heal'
  | 'expose'
  | 'duet'
  | 'victory'
  | 'defeat';
export function battleCue(previous: Battle, next: Battle): BattleCue | null {
  if (previous.id !== next.id || next.event.seq <= previous.event.seq) return null;
  if (next.phase === 'victory' && previous.phase !== 'victory') return 'victory';
  if (next.phase === 'defeat' && previous.phase !== 'defeat') return 'defeat';
  if (
    next.foes.some((f) => {
      const before = previous.foes.find((p) => p.id === f.id);
      return before && ((f.staggered && !before.staggered) || (f.exposed && f.break < before.break));
    })
  )
    return 'break';
  if (next.foes.some((f) => f.exposed && !previous.foes.find((p) => p.id === f.id)?.exposed)) return 'expose';
  if (next.event.kind === 'strike')
    return next.heroes.some((h) => h.id === next.event.target) ? 'hurt' : 'strike';
  if (next.event.kind === 'miss') return 'dodge';
  return next.event.kind;
}

const lengths: Record<BattleCue, number> = {
  strike: 0.28,
  hurt: 0.32,
  guard: 0.32,
  parry: 0.5,
  dodge: 0.3,
  break: 0.62,
  heal: 0.7,
  expose: 0.65,
  duet: 0.95,
  victory: 1.3,
  defeat: 0.95,
};
/** Original, deterministic fantasy cues. No speech, downloaded samples or ongoing audio graph. */
export function renderBattleCue(cue: BattleCue, sampleRate = 22050): Float32Array<ArrayBuffer> {
  const samples = new Float32Array(Math.ceil(lengths[cue] * sampleRate));
  function tone(start: number, duration: number, hz: number, end: number, gain: number, bright = false) {
    const from = Math.round(start * sampleRate),
      count = Math.round(duration * sampleRate);
    let phase = 0;
    for (let i = 0; i < count && from + i < samples.length; i++) {
      const t = i / count;
      phase += (Math.PI * 2 * (hz + (end - hz) * t)) / sampleRate;
      const attack = Math.min(1, i / (sampleRate * 0.006));
      const envelope = attack * Math.exp(-5 * t) * (1 - t);
      const signal =
        Math.sin(phase) +
        (bright ? 0.3 * Math.sin(phase * 2.76) + 0.12 * Math.sin(phase * 4.07) : 0.12 * Math.sin(phase * 2));
      samples[from + i] += signal * gain * envelope;
    }
  }
  function air(start: number, duration: number, gain: number, smooth: number) {
    let seed = 2917,
      filtered = 0;
    const from = Math.round(start * sampleRate),
      count = Math.round(duration * sampleRate);
    for (let i = 0; i < count && from + i < samples.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
      filtered += ((seed >>> 0) / 2147483648 - 1 - filtered) * smooth;
      samples[from + i] += filtered * gain * Math.sin((Math.PI * i) / count) * Math.exp((-4 * i) / count);
    }
  }
  const bell = (start: number, hz: number, gain = 0.27, duration = 0.4) =>
    tone(start, duration, hz, hz * 0.999, gain, true);
  switch (cue) {
    case 'strike':
      air(0, 0.16, 0.45, 0.8);
      tone(0.025, 0.25, 210, 65, 0.46);
      bell(0.03, 880, 0.1, 0.18);
      break;
    case 'hurt':
      air(0, 0.22, 0.5, 0.25);
      tone(0.01, 0.3, 130, 42, 0.46);
      break;
    case 'guard':
      tone(0, 0.3, 180, 110, 0.3);
      bell(0.015, 370, 0.22, 0.22);
      air(0, 0.09, 0.2, 0.4);
      break;
    case 'parry':
      bell(0, 1174, 0.32);
      bell(0.045, 1760, 0.22);
      tone(0, 0.19, 240, 95, 0.24);
      break;
    case 'dodge':
      air(0, 0.29, 0.65, 0.18);
      tone(0.02, 0.18, 520, 900, 0.07);
      break;
    case 'break':
      air(0, 0.3, 0.48, 0.9);
      tone(0, 0.42, 240, 46, 0.4);
      [740, 1109, 1480].forEach((hz, i) => bell(0.06 + i * 0.065, hz, 0.19));
      break;
    case 'heal':
      [440, 554, 659].forEach((hz, i) => bell(i * 0.11, hz, 0.22, 0.45));
      break;
    case 'expose':
      [660, 990, 1320].forEach((hz, i) => bell(i * 0.08, hz, 0.18, 0.47));
      break;
    case 'duet':
      tone(0, 0.45, 190, 65, 0.35);
      air(0, 0.28, 0.4, 0.4);
      [440, 659, 880, 1109].forEach((hz, i) => bell(0.08 + i * 0.12, hz, 0.23, 0.5));
      break;
    case 'victory':
      [440, 554, 659, 880].forEach((hz, i) => bell(i * 0.15, hz, 0.23, 0.65));
      bell(0.5, 440, 0.14, 0.7);
      break;
    case 'defeat':
      [330, 294, 220].forEach((hz, i) => tone(i * 0.17, 0.6, hz, hz * 0.96, 0.19));
      break;
  }
  // Fixed headroom, with a short tail fade to avoid clicks at the buffer boundary.
  for (let i = 0; i < samples.length; i++)
    samples[i] = Math.tanh(samples[i]) * 0.58 * Math.min(1, (samples.length - 1 - i) / (sampleRate * 0.015));
  return samples;
}
