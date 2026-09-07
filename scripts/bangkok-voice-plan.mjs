import {readFileSync,readdirSync} from 'node:fs';
import ts from 'typescript';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';

export const speechModel='gpt-4o-mini-tts';
export const cast={Su:'marin',Mali:'coral',Suda:'coral',Dao:'sage',Pim:'shimmer',Arun:'cedar','Uncle Lek':'onyx',Niran:'ash',Nok:'verse',Kanya:'nova',Narrator:'ballad'};
export const normalizeSpeaker=s=>s.split(' ·')[0];
export const lineKey=(speaker,text)=>`${normalizeSpeaker(speaker)}|${text}`;
export async function voicePlan(){
  const lines=new Map();
  function add(speaker,text,kind='story',id){
    if(!text)return;
    speaker=normalizeSpeaker(speaker);
    const key=lineKey(speaker,text),voice=cast[speaker]??cast.Narrator;
    lines.set(key,{id:id??`line-${createHash('sha256').update(key).digest('hex').slice(0,16)}`,kind,speaker,text,voice,key});
  }
  function strings(n){
    if(!n)return [];
    if(ts.isStringLiteralLike(n))return [n.text];
    if(ts.isConditionalExpression(n))return [...strings(n.whenTrue),...strings(n.whenFalse)];
    if(ts.isTemplateExpression(n)){
      let values=[n.head.text];
      for(const span of n.templateSpans){const tails=strings(span.expression);if(!tails.length)return [];values=values.flatMap(v=>tails.map(t=>v+t+span.literal.text));}return values;
    }
    return [];
  }
  // Exact authored story text, including both branches of conditional lines.
  for(const name of readdirSync('src/bangkok').filter(n=>/\.(ts|tsx)$/.test(n))){
    const ast=ts.createSourceFile(name,readFileSync(`src/bangkok/${name}`,'utf8'),ts.ScriptTarget.Latest,true);
    function visit(node){
      if(ts.isObjectLiteralExpression(node)){
        const props=Object.fromEntries(node.properties.filter(ts.isPropertyAssignment).map(p=>[p.name.getText(ast).replace(/["']/g,''),p.initializer]));
        for(const speaker of strings(props.speaker))for(const text of strings(props.text))add(speaker,text);
        for(const speaker of strings(props.responseSpeaker ?? props.speaker))for(const response of strings(props.response))add(speaker,response);
        for(const story of strings(props.story)){
          add('Su',story);
          for(const response of strings(props.response))add('Su',response);
        }
      }
      ts.forEachChild(node,visit);
    }visit(ast);
  }
  const server=await createServer({server:{middlewareMode:true,hmr:false},logLevel:'silent'});
  try{
    const {archiveScene,archiveStatus}=await server.ssrLoadModule('/src/bangkok/archiveQuest.ts');
    const {archiveSites}=await server.ssrLoadModule('/src/bangkok/archiveLayout.ts');
    const archiveProgress=['innkeeper','archive-accepted','archive-cargo','archive-river','archive-lantern','archive-found','archive-document','archive-complete'];
    for(let i=0;i<=archiveProgress.length;i++){const state={flags:archiveProgress.slice(0,i)};for(const site of archiveSites){const scene=archiveScene(state,site.id);add(scene.speaker,scene.text);}add('Su',`${archiveStatus(state)} Look around, open your map, or talk to people again. If you want to rehearse a phrase, we can train at camp.`);}
    const {phrases}=await server.ssrLoadModule('/src/bangkok/curriculum.ts');
    for(const p of Object.values(phrases))add('Su',p.targetPhrase,'phrase',p.id);
    const {freshAdventure,objective}=await server.ssrLoadModule('/src/bangkok/adventure.ts');
    const {boatStart,gardenStops}=await server.ssrLoadModule('/src/bangkok/canalNavigation.ts');
    for(let count=0;count<=3;count++) {
      const s={...freshAdventure(),position:{x:18,z:-57},trackedQuest:'canal-garden',flags:['intro','innkeeper','murmur','cook','ferry','keeper','departed','canal-post','canal-junction','blue-house',...(count===3?['canal-garden']:[])],canalBoat:{...boatStart(),delivered:gardenStops.slice(0,count).map(s=>s.id)}};
      add('Su',`${objective(s).text} Look around, open your map, or talk to people again. If you want to rehearse a phrase, we can train at camp.`);
    }
    const {hostWelcome,cityServices}=await server.ssrLoadModule('/src/bangkok/cityServices.ts');
    const {eveningScene,eveningChoices,eveningResponse}=await server.ssrLoadModule('/src/bangkok/eveningOuting.ts');
    for(const service of cityServices)add({innkeeper:'Mali',cook:'Uncle Lek',gardener:'Pim'}[service.host],service.result);
    for(const flags of [[],['evening-food'],['evening-park'],['evening-food','evening-mild'],['evening-food','evening-chilli'],['evening-park','evening-water'],['evening-park','evening-tea']]){
      const s={...freshAdventure(),flags:['innkeeper',...flags]};
      for(const reply of eveningChoices(s))add(eveningScene(s).speaker,eveningResponse(s,reply));
    }
    const {lanternScene}=await server.ssrLoadModule('/src/bangkok/lanternTrade.ts');
    const {canalStatus}=await server.ssrLoadModule('/src/bangkok/canalErrand.ts');
    const {reunionFlags,reunionStatus}=await server.ssrLoadModule('/src/bangkok/reunion.ts');
    for(let mask=0;mask<1<<reunionFlags.length;mask++) {
      const s={...freshAdventure(),flags:['intro','innkeeper','departed',...reunionFlags.filter((_,i)=>mask&(1<<i))]};
      add('Su',`${reunionStatus(s)} Look around, open your map, or talk to people again. If you want to rehearse a phrase, we can train at camp.`);
    }
    for(const offer of ['new','carved','discount','paper'])add('Arun',lanternScene({offer,owned:null,paid:0}));
    for(const flags of [[],['keeper','ferry','murmur']]){
      const s={...freshAdventure(),flags};
      for(const [host,name] of [['innkeeper','Mali'],['cook','Uncle Lek'],['gardener','Pim']])add(name,hostWelcome(s,host));
    }
    const flags=['intro','innkeeper','cook','ferry','murmur','keeper','departed','canal-accepted','canal-paper','canal-frame','canal-restored'];
    for(let mask=0;mask<1<<flags.length;mask++){
      const s={...freshAdventure(),flags:flags.filter((_,i)=>mask&(1<<i))};
      add('Su',`${objective(s).text} Look around, open your map, or talk to people again. If you want to rehearse a phrase, we can train at camp.`);
      add('Su',canalStatus(s));
    }
    for(let count=1;count<=6;count++)add('Su',`A new page for our explorer’s journal. You found ${count} of 6 city memories. ${count===6?'Together, these memories form a River Charm. After a story battle victory, it restores 15 HP.':'Find all six to earn the River Charm: it restores 15 HP after each story battle victory.'}`);
  }finally{await server.close();}
  return [...lines.values()].sort((a,b)=>a.id.localeCompare(b.id));
}
