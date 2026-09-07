import {readFile,writeFile} from 'node:fs/promises';
const root='videos/bangkok-rift-showcase';
const story=JSON.parse(await readFile(`${root}/story.json`,'utf8'));
const meta=JSON.parse(await readFile(`${root}/audio_meta.json`,'utf8'));
const captions=JSON.parse(await readFile(`${root}/captions.json`,'utf8'));
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const duration=134;
const video=(id,file,start,length,cls='full',offset=0)=>`<video id="${id}" class="clip ${cls}" src="assets/${file}-padded.mp4" data-start="${start}" data-duration="${length}" data-media-start="${offset}" data-track-index="1" muted playsinline></video>`;
const title=(id,start,length,kicker,heading,copy='',cls='')=>`<section id="${id}" class="clip editorial ${cls}" data-start="${start}" data-duration="${length}" data-track-index="3"><div class="eyebrow">${kicker}</div><div class="mask"><h1>${heading}</h1></div>${copy?`<p>${copy}</p>`:''}<div class="rule"></div></section>`;
let html=`<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=1920,height=1080"><title>Bangkok Rift · Words Become Power</title><script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script><style>
*{box-sizing:border-box}body{margin:0;background:#071d27;color:#f5e8c7;font-family:'Segoe UI',sans-serif}#showcase{position:relative;width:1920px;height:1080px;overflow:hidden}.clip{position:absolute}.full{inset:0;width:1920px;height:1080px;object-fit:cover}.game{left:495px;top:160px;width:1380px;height:776.25px;object-fit:contain;border:1px solid #527879}.phone{left:1250px;top:100px;width:390px;height:844px;border:2px solid #a68d5c;border-radius:28px;object-fit:contain}.shade{inset:0;background:linear-gradient(90deg,rgba(7,29,39,.88),rgba(7,29,39,.2) 65%,rgba(7,29,39,.08))}.editorial{left:88px;top:230px;width:870px}.eyebrow{font-size:25px;letter-spacing:4px;font-weight:600;color:#e5bd72;margin-bottom:28px}.mask{overflow:hidden}h1{font:normal 106px/1.04 Georgia,serif;letter-spacing:-3px;margin:0}p{font-size:33px;line-height:1.5;max-width:700px;color:#d4e8e3;margin:34px 0 0}.rule{height:3px;width:120px;background:#e5bd72;margin-top:35px;transform-origin:left}.top{top:65px;width:1500px}.top h1{font-size:72px}.top .eyebrow{font-size:23px;margin-bottom:12px}.top .rule{margin-top:18px}.rail{left:70px;top:190px;width:370px}.rail h1{font-size:70px;line-height:1.1;letter-spacing:-1px}.rail .eyebrow{font-size:22px;line-height:1.5;letter-spacing:2px}.rail p{font-size:28px;line-height:1.5}.rail .rule{margin-top:27px}.caption{left:150px;bottom:28px;width:1620px;text-align:center;font-size:32px;line-height:1.35;color:#fff5dc;padding:12px 30px;background:rgba(4,16,24,.95);border-radius:6px}.brand{left:80px;top:44px;font:25px Georgia,serif;letter-spacing:3px;color:#ffe2a7}.note{left:500px;top:115px;font-size:22px;color:#d3e8e0;letter-spacing:.5px}.models{left:55px;top:260px;width:1810px;height:650px;object-fit:contain;border-radius:5px}.craft-labels{left:165px;top:925px;width:1590px;display:flex;justify-content:space-between;font-size:26px;color:#e5bd72}.closing{width:1000px;top:195px}.closing h1{font-size:97px}.link{left:90px;top:780px;font-size:32px;letter-spacing:1px;color:#f5e8c7}.scene-bg{inset:0;background:#071d27}.small-credit{left:90px;top:900px;font-size:23px;color:#bfd5d0}.divider{left:455px;top:160px;height:776px;width:1px;background:#42656a}
</style></head><body><main id="showcase" data-composition-id="showcase" data-width="1920" data-height="1080" data-duration="134" data-start="0">`;
html+=video('arrival-city','yaowarat',0,18);
html+=`<div id="arrival-shade" class="clip shade" data-start="0" data-duration="18" data-track-index="2"></div>`;
html+=title('arrival',0,18,'BANGKOK RIFT · A GPT 6 BUILD SHOWCASE','Words<br>become power.','A Thai-learning RPG.<br>A city worth getting lost in.');
html+=video('story-world','river',18,18);
html+=`<div id="story-shade" class="clip shade" data-start="18" data-duration="18" data-track-index="2"></div>`;
html+=title('story',18,18,'THE LAST FERRY','A city.<br>A companion.<br>A quest.','Follow Su through Bangkok.<br>Restore the light of the last ferry.');
html+=`<div id="scene-bg" class="clip scene-bg" data-start="36" data-duration="18" data-track-index="0"></div><img id="asset-models" class="clip models" src="assets/models.png" data-start="36" data-duration="18" data-track-index="1" alt="Actual Blender environment models"><div id="craft-labels" class="clip craft-labels" data-start="36" data-duration="18" data-track-index="4"><span>YAOWARAT SHOPHOUSES</span><span>ELEVATED RAILWAY</span><span>CHAO PHRAYA RIVERBOAT</span></div>`;
html+=title('craft',36,18,'BLENDER + PYTHON → GLB → THREE.JS','From code to craft.','','top');
html+=video('voices-world','hotel',54,16,'game');
html+=title('voices',54,16,'CHARACTER + AUDIO PIPELINE','A voice.<br>A presence.','Supplied character models.<br>Prerecorded OpenAI dialogue.<br>Listen. Repeat. Compare.','rail');
html+=video('battle-demo','combat',70,26,'game');
html+=title('combat',70,26,'TURN-BASED COMBAT','Choose.<br>Speak.<br>Power up.','① Select an art + target<br>② Read the English meaning<br>③ Speak the Thai phrase<br>④ Preview your damage','rail');
html+=`<div id="note" class="clip note" data-start="70" data-duration="46" data-track-index="4">ACTUAL GAMEPLAY · Prerecorded Thai test input · Live Realtime API result</div>`;
html+=video('coach-demo','coach',96,20,'game');
html+=title('coach',96,20,'COACHING INSIDE YOUR TURN','Hear it.<br>Try again.<br>Cast it.','One focused correction.<br>Two graded attempts.<br>Keep your better result.<br>Confirm to release the attack.','rail');
html+=video('phone-demo','phone',116,18,'phone');
html+=title('close',116,18,'BANGKOK RIFT · PLAY THE WORK IN PROGRESS','Learn through<br>adventure.','Explore. Prepare. Practise. Return stronger.','closing');
html+=`<div id="link" class="clip link" data-start="119" data-duration="15" data-track-index="4">bangkok-rift-playtest.vercel.app</div><div id="small-credit" class="clip small-credit" data-start="116" data-duration="18" data-track-index="5">GPT 6 build collaboration · HyperFrames showcase<br>Experimental AI grading · Thai-speaker calibration pending</div>`;
// Captions are clause-sized and paced over each generated narration file.
for(const s of story){
 const entry=Array.isArray(meta)?meta.find(x=>x.id===s.id):meta[s.id];
 const length=entry?.duration || ({arrival:16.248,story:16.056,craft:15.504,voices:13.848,combat:15.648,coach:14.16,close:16.32}[s.id]);
 const at=s.start+(s.id==='voices'?.1:.5);
 html+=`<audio id="vo-${s.id}" class="clip" src="assets/vo-${s.id}.mp3" data-start="${at}" data-duration="${length}" data-track-index="10" data-volume="1"></audio>`;
 const words=captions[s.id].words;
 for(let i=0;i<words.length;i+=10){const group=words.slice(i,i+10);const begin=at+group[0].start,end=at+(words[i+10]?.start??group.at(-1).end);const copy=group.map(w=>w.word.replace(/^Sue\b/,'Su').replace(/^tie\b/,'Thai').replace('GPT-6','GPT 6')).join(' ');html+=`<div id="caption-${s.id}-${i}" class="clip caption" data-start="${begin.toFixed(3)}" data-duration="${(end-begin).toFixed(3)}" data-track-index="8">${esc(copy)}</div>`;}
}
html+=`<audio id="thai-example" class="clip" src="assets/hello.mp3" data-start="68" data-duration="1.968" data-track-index="11" data-volume="1"></audio><audio id="music" class="clip" src="assets/music.mp3" data-start="0" data-duration="134" data-track-index="12" data-volume="1"></audio></main><script>
const tl=gsap.timeline({paused:true});
const scenes=${JSON.stringify(story.map(x=>({id:x.id,start:x.start,duration:x.duration})))};
for(const s of scenes){tl.from('#'+s.id+' h1',{y:125,opacity:0,duration:1,ease:'power3.out'},s.start+.25);tl.from('#'+s.id+' .eyebrow',{opacity:0,x:-20,duration:.7},s.start+.1);tl.from('#'+s.id+' .rule',{scaleX:0,duration:1},s.start+.5);if(document.querySelector('#'+s.id+' p'))tl.from('#'+s.id+' p',{opacity:0,y:20,duration:.8},s.start+.75);}
tl.from('#asset-models',{opacity:0,duration:.8},36.1);
tl.from('.craft-labels',{opacity:0,y:10,duration:.8},38);
tl.from('.link',{opacity:0,y:10,duration:.8},119);
tl.fromTo('#music',{volume:0},{volume:.12,duration:2},0);tl.to('#music',{volume:0,duration:3},131);
window.__timelines=window.__timelines||{};window.__timelines.showcase=tl;
</script></body></html>`;
await writeFile(`${root}/index.html`,html);
await writeFile(`${root}/STORYBOARD.md`,'# Bangkok Rift showcase\n\nDuration: 134 seconds. 1920×1080. Actual staged game footage; synthetic Thai test input with live Realtime results.\n\n'+story.map(s=>`- ${s.start}–${s.start+s.duration}s: ${s.title}\n  ${s.narration}`).join('\n\n'));
console.log(`Authored ${duration}s composition.`);
