import {readFile,writeFile} from 'node:fs/promises';
import {localOpenAIKey} from './openai-local-key.mjs';
const root='videos/bangkok-rift-showcase';
const story=JSON.parse(await readFile(`${root}/story.json`,'utf8'));
const captions={};
for(const scene of story){
 const form=new FormData();form.append('model','whisper-1');form.append('language','en');form.append('response_format','verbose_json');form.append('timestamp_granularities[]','word');
 form.append('file',new Blob([await readFile(`${root}/assets/vo-${scene.id}.mp3`)],{type:'audio/mpeg'}),`${scene.id}.mp3`);
 const r=await fetch('https://api.openai.com/v1/audio/transcriptions',{method:'POST',headers:{Authorization:`Bearer ${localOpenAIKey()}`},body:form});
 if(!r.ok)throw new Error(`Caption transcription failed: ${r.status}`);
 const result=await r.json();captions[scene.id]={text:result.text,words:result.words};
 console.log(`${scene.id}: ${result.words.length} timed words`);
}
await writeFile(`${root}/captions.json`,JSON.stringify(captions,null,2));
