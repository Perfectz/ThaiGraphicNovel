import {mkdir,readFile,writeFile,rename,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {voicePlan,speechModel} from './bangkok-voice-plan.mjs';
import {localOpenAIKey} from './openai-local-key.mjs';
const out='public/bangkok/voices';
const rows=await voicePlan();
const dry=process.argv.includes('--dry-run');
const limit=Number(process.argv.find(a=>a.startsWith('--limit='))?.split('=')[1]??0);
console.log(JSON.stringify({model:speechModel,lines:rows.length,phrases:rows.filter(r=>r.kind==='phrase').length,characters:[...new Set(rows.map(r=>r.speaker))],keyConfigured:!!localOpenAIKey()}));
if(dry)process.exit(0);
const key=localOpenAIKey();if(!key)throw new Error('No configured local OpenAI key.');
await mkdir(out,{recursive:true});
let previous={};try{previous=JSON.parse(await readFile(`${out}/manifest.json`,'utf8'));}catch{}
const manifest={model:speechModel,source:'OpenAI Speech API',synthetic:true,nativeSpeakerReviewed:false,generatedAt:new Date().toISOString(),clips:{...previous.clips}};
let index=0,complete=0;const failures=[];
const selected=limit?rows.slice(0,limit):rows;
async function worker(){
  while(index<selected.length){
    const row=selected[index++];
    const instructions=row.kind==='phrase'
      ? 'Speak only the supplied Thai phrase, exactly once. Use clear standard Central Thai with accurate lexical tones and vowel lengths. Calm friendly tutor; slightly slower than conversation but natural connected speech. No English, no introduction, no extra particles, no music.'
      : `Voice the exact supplied script for ${row.speaker}, an original character in a Bangkok adventure. Warm, grounded, conversational storytelling. Clear relaxed English, natural Thai names. Read only the supplied words, preserving quoted dialogue; do not add an introduction, translation, sound effects, or music.`;
    const fingerprint=createHash('sha256').update(JSON.stringify({model:speechModel,...row,instructions})).digest('hex');
    const path=`${out}/${row.id}.mp3`;
    if(manifest.clips[row.key]?.fingerprint===fingerprint&&(await stat(path).catch(()=>null))?.size>1000){complete++;continue;}
    try{
      const response=await fetch('https://api.openai.com/v1/audio/speech',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:speechModel,voice:row.voice,input:row.text,instructions,response_format:'mp3'}),signal:AbortSignal.timeout(90000)});
      if(!response.ok)throw new Error(`Speech API HTTP ${response.status}`);
      const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length<1000)throw new Error('Audio response too small');
      await writeFile(`${path}.part`,bytes);await rename(`${path}.part`,path);
      manifest.clips[row.key]={...row,url:`/bangkok/voices/${row.id}.mp3`,model:speechModel,fingerprint,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
      complete++;console.log(`Saved ${complete}/${selected.length}: ${row.speaker} / ${row.id}`);
      // Each worker writes through the same serialized chain to preserve restartability.
      checkpoint=checkpoint.then(async()=>{await writeFile(`${out}/manifest.json.tmp`,JSON.stringify(manifest,null,2));await rename(`${out}/manifest.json.tmp`,`${out}/manifest.json`);});await checkpoint;
    }catch(error){failures.push({id:row.id,error:error.name==='TimeoutError'?'Speech API timeout':error.message.startsWith('Speech API HTTP')?error.message:'Speech generation failed'});console.log(`Failed ${row.id}: ${failures.at(-1).error}`);if(failures.length>=3)index=selected.length;}
  }
}
let checkpoint=Promise.resolve();await Promise.all([worker(),worker(),worker()]);await checkpoint;
await writeFile(`${out}/generation-report.json`,JSON.stringify({model:speechModel,planned:rows.length,selected:selected.length,complete,failures},null,2));
if(failures.length)process.exitCode=1;
