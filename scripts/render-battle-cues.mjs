import { mkdir, writeFile } from 'node:fs/promises';
import { renderBattleCue } from '../src/bangkok/battleCues.ts';
const names = [
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
const rate = 22050,
  buffers = [],
  manifest = [];
let offset = 0;
for (const name of names) {
  const signal = renderBattleCue(name);
  buffers.push(signal, new Float32Array(rate * 0.5));
  manifest.push({ cue: name, start: offset, duration: signal.length / rate });
  offset += signal.length / rate + 0.5;
}
const length = buffers.reduce((sum, b) => sum + b.length, 0),
  wav = Buffer.alloc(44 + length * 2);
wav.write('RIFF');
wav.writeUInt32LE(wav.length - 8, 4);
wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(rate, 24);
wav.writeUInt32LE(rate * 2, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write('data', 36);
wav.writeUInt32LE(length * 2, 40);
let index = 44;
for (const b of buffers)
  for (const sample of b) {
    wav.writeInt16LE(Math.round(sample * 0.55 * 32767), index);
    index += 2;
  }
await mkdir('artifacts/battle-audio', { recursive: true });
await writeFile('artifacts/battle-audio/cue-preview.wav', wav);
await writeFile('artifacts/battle-audio/cue-manifest.json', JSON.stringify(manifest, null, 2));
