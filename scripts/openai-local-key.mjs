import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
/** Credentials stay in process memory. Never include values in logs or manifests. */
export function localOpenAIKey() {
  let key=process.env.OPENAI_API_KEY?.trim();
  for(const name of ['.env.local','.env']) {
    const path=resolve(name);if(key||!existsSync(path))continue;
    for(const line of readFileSync(path,'utf8').split(/\r?\n/)) {
      const match=line.match(/^\s*OPENAI_API_KEY\s*=\s*(.*?)\s*$/);
      if(match)key=match[1].replace(/^["']|["']$/g,'').trim();
    }
  }
  return key && key.startsWith('sk-') && !/PLACEHOLDER|YOUR_|ROTATED/.test(key)?key:'';
}
if(process.argv.includes('--status'))console.log({openAIKeyConfigured:!!localOpenAIKey()});
