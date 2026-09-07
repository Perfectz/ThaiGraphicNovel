import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { localOpenAIKey } from './openai-local-key.mjs';
import { spawnSync } from 'node:child_process';
const root='videos/bangkok-rift-showcase'; await mkdir(`${root}/assets`,{recursive:true});
const rows=JSON.parse(await readFile(`${root}/story.json`,'utf8')), report=[];
for(const row of rows){
  const path=`${root}/assets/vo-${row.id}.mp3`;
  try { await readFile(path); } catch {
    const response=await fetch('https://api.openai.com/v1/audio/speech',{method:'POST',headers:{Authorization:`Bearer ${localOpenAIKey()}`,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-4o-mini-tts',voice:'cedar',input:row.narration,instructions:'An assured, warm documentary narrator presenting a beautiful independent RPG. Clear conversational English, measured but energetic. Read exactly the script, no additions. About 155 words per minute. Pronounce Thai as tie and Su as soo.',response_format:'mp3'}),signal:AbortSignal.timeout(90000)});
    if(!response.ok)throw Error(`Narration HTTP ${response.status}`);
    await writeFile(path,Buffer.from(await response.arrayBuffer()));
  }
  const probe=spawnSync('ffprobe',['-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',path],{encoding:'utf8'});
  report.push({id:row.id,path,duration:Number(probe.stdout.trim()),slot:row.duration,synthetic:true,model:'gpt-4o-mini-tts'});
  console.log(report.at(-1));
}
await writeFile(`${root}/audio_meta.json`,JSON.stringify(report,null,2));
