import {execFileSync} from 'node:child_process';
import {mkdir,stat,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const root='videos/bangkok-rift-showcase',file=`${root}/renders/bangkok-rift-showcase.mp4`;
const ffmpeg=process.env.SHOWCASE_FFMPEG||'C:/Users/pzgam/scoop/shims/ffmpeg.exe';
const ffprobe=process.env.SHOWCASE_FFPROBE||'C:/Users/pzgam/scoop/shims/ffprobe.exe';
const probe=JSON.parse(execFileSync(ffprobe,['-v','error','-show_format','-show_streams','-of','json',file],{encoding:'utf8'}));
const duration=Number(probe.format.duration);assert(duration>=120&&duration<=180);
const video=probe.streams.find(s=>s.codec_type==='video'),audio=probe.streams.find(s=>s.codec_type==='audio');
assert.equal(video.width,1920);assert.equal(video.height,1080);assert(audio);assert.equal(video.avg_frame_rate,'30/1');assert((await stat(file)).size>1000000);
await mkdir(`${root}/renders/qa`,{recursive:true});
for(const at of [4,22,42,59,78,91,101,107,124,133])execFileSync(ffmpeg,['-y','-v','error','-ss',String(at),'-i',file,'-frames:v','1',`${root}/renders/qa/frame-${at}.png`]);
execFileSync(ffmpeg,['-y','-v','error','-i',file,'-vn','-ar','16000','-ac','1','-c:a','libmp3lame','-b:a','64k',`${root}/renders/qa/final-audio.mp3`]);
execFileSync(ffmpeg,['-v','error','-i',file,'-f','null','-'],{stdio:'pipe'});
const browser=await chromium.launch({channel:'chrome',headless:true});
let playback;
try{
 const page=await browser.newPage();await page.goto(pathToFileURL(resolve(file)).href);
 await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2);
 playback=await page.evaluate(async()=>{const v=document.querySelector('video');v.muted=true;await v.play();const before=v.currentTime;await new Promise(r=>setTimeout(r,2500));const after=v.currentTime;v.pause();return {before,after,duration:v.duration,width:v.videoWidth,height:v.videoHeight,error:v.error?.message||null};});
 assert(playback.after>playback.before+1);assert.equal(playback.error,null);
}finally{await browser.close();}
await writeFile(`${root}/renders/qa/report.json`,JSON.stringify({file,duration,bytes:(await stat(file)).size,video:{codec:video.codec_name,width:video.width,height:video.height,fps:video.avg_frame_rate},audio:{codec:audio.codec_name,sampleRate:audio.sample_rate,channels:audio.channels},playback,decode:'passed'},null,2));
console.log(`Verified ${duration}s, 1080p30, audio stream, full decode and actual browser playback.`);
