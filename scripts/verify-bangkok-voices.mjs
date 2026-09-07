import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {localOpenAIKey} from './openai-local-key.mjs';
import {voicePlan,speechModel} from './bangkok-voice-plan.mjs';
const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6)??'artifacts/openai-voices';await mkdir(out,{recursive:true});
const decodeOnly=process.argv.includes('--decode-only');
const selectedSamples=process.argv.find(a=>a.startsWith('--samples='))?.slice(10).split(',');
const manifest=JSON.parse(await readFile('public/bangkok/voices/manifest.json','utf8'));
const report={finished:false,model:speechModel,checkedAt:new Date().toISOString(),transcriptionRequested:!decodeOnly,decoded:[],transcripts:[],failures:[]};
const save=()=>writeFile(`${out}/verification.json`,JSON.stringify(report,null,2));
const normalize=s=>s.normalize('NFC').replace(/[\s\p{P}\p{S}]/gu,'').toLowerCase();
try {
  const plannedRows=await voicePlan();
  if(selectedSamples)assert(selectedSamples.every(id=>plannedRows.some(row=>row.id===id&&row.kind==='phrase')),'unknown phrase sample');
  for(const planned of plannedRows.filter(row=>!selectedSamples||selectedSamples.includes(row.id))){
    const row=manifest.clips[planned.key];
    assert(row,`missing ${planned.id}`);
    assert.equal(row.model,speechModel,`model ${planned.id}`);
    assert.equal(row.voice,planned.voice,`voice ${planned.id}`);
    assert.equal(row.text,planned.text,`text ${planned.id}`);
    const path=`public${row.url}`,bytes=await readFile(path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),row.sha256);
    const decoded=spawnSync('ffmpeg',['-v','error','-i',path,'-f','f32le','-ac','1','-ar','16000','pipe:1'],{maxBuffer:12e6,windowsHide:true});
    assert.equal(decoded.status,0,`decode ${row.id}`);
    const buffer=decoded.stdout;let power=0,peak=0;
    for(let i=0;i<buffer.length;i+=4){const n=buffer.readFloatLE(i);assert(Number.isFinite(n));power+=n*n;peak=Math.max(peak,Math.abs(n));}
    const duration=buffer.length/4/16000,rms=Math.sqrt(power/(buffer.length/4));
    assert(duration>.3&&duration<100,`${row.id} duration ${duration}`);assert(rms>.001,`${row.id} non-silent`);assert(peak<1.01,`${row.id} level ${peak}`);
    report.decoded.push({id:row.id,speaker:row.speaker,seconds:duration,rms,peak});
  }
  console.log(`Decoded ${report.decoded.length} recordings.`);await save();
  const samples=selectedSamples??['hello','not-spicy','water-please','say-again','how-much','my-name-is-patrick','reservation-have','where-is-station'];
  const key=decodeOnly?null:localOpenAIKey();if(!decodeOnly)assert(key);
  for(const id of decodeOnly?[]:samples){
    const row=Object.values(manifest.clips).find(r=>r.id===id);
    const body=new FormData();body.set('model','gpt-transcribe');body.set('file',new Blob([await readFile(`public${row.url}`)],{type:'audio/mpeg'}),`${id}.mp3`);
    const response=await fetch('https://api.openai.com/v1/audio/transcriptions',{method:'POST',headers:{Authorization:`Bearer ${key}`},body,signal:AbortSignal.timeout(90000)});
    if(!response.ok)throw new Error(`Transcription API HTTP ${response.status}`);
    const result=await response.json();
    const entry={id,expected:row.text,heard:result.text,exact:normalize(row.text)===normalize(result.text)};
    report.transcripts.push(entry);console.log(`${id}: ${entry.exact?'matched':'review needed'}`);await save();
  }
  report.finished=true;
}catch(e){report.failures.push(e.message);throw e;}finally{await save();}
