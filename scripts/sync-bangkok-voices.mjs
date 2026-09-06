import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { voicePlan } from './bangkok-voice-plan.mjs';
const rows=await voicePlan();
const manifest=JSON.parse(await readFile('public/bangkok/voices/manifest.json','utf8'));
const urls={};
for(const row of rows){
  const clip=manifest.clips[row.key];if(!clip)throw new Error(`Missing recording: ${row.id}`);
  const bytes=await readFile(`public${clip.url}`);
  if(createHash('sha256').update(bytes).digest('hex')!==clip.sha256)throw new Error(`Changed recording: ${row.id}`);
  urls[row.key]=clip.url;
}
await writeFile('src/bangkok/generatedVoices.ts',`// Generated from verified local OpenAI recordings. No runtime API calls.\nexport const recordedVoices: Record<string, string> = ${JSON.stringify(urls,null,2)};\n`);
console.log(`Linked ${rows.length} verified recordings.`);
