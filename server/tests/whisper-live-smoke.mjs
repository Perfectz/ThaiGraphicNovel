import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  args.set(process.argv[i], process.argv[i + 1]);
}

const audioPath = args.get('--audio');
const useSilence = args.has('--silence');
const silenceSeconds = Math.max(1, Number(args.get('--seconds') ?? 1));
const targetPhrase = args.get('--target') ?? 'สวัสดีครับ';
const romanization = args.get('--romanization') ?? 'sawatdee khrap';
const translation = args.get('--translation') ?? 'Hello';
const serviceUrl = args.get('--url') ?? process.env.WHISPER_SERVICE_URL ?? 'http://127.0.0.1:8788/api/whisper';

if (!useSilence && (!audioPath || !existsSync(audioPath))) {
  console.error('Usage: npm run test:whisper:live -- --silence');
  console.error('   or: npm run test:whisper:live -- --audio path/to/recording.f32 --target "สวัสดีครับ" --romanization "sawatdee khrap" --translation "Hello"');
  process.exit(1);
}

const audioBytes = useSilence
  ? Buffer.alloc(Math.ceil(16000 * silenceSeconds) * Float32Array.BYTES_PER_ELEMENT)
  : await readFile(audioPath);
const formData = new FormData();
formData.set('audio', new Blob([audioBytes]), useSilence ? 'silence.f32' : basename(audioPath));
formData.set('audioFormat', 'f32le');
formData.set('sampleRate', '16000');
formData.set('targetPhrase', targetPhrase);
formData.set('romanization', romanization);
formData.set('translation', translation);

const response = await fetch(`${serviceUrl.replace(/\/$/, '')}/judge-audio`, {
  method: 'POST',
  body: formData,
});

const payload = await response.json().catch(async () => ({ error: await response.text() }));
console.log(JSON.stringify(payload, null, 2));

if (useSilence && response.status === 422 && /No clear microphone audio/i.test(String(payload.error ?? ''))) {
  process.exit(0);
}

if (!response.ok) {
  process.exit(1);
}
