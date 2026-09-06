import test from 'node:test';
import assert from 'node:assert/strict';
import {recordedVoices} from '../src/bangkok/generatedVoices.ts';
import {conversations} from '../src/bangkok/adventureStory.ts';
import {canalLines} from '../src/bangkok/canalErrand.ts';
import {escortInvitation,escortArrival} from '../src/bangkok/stationEscort.ts';
import {discoveries} from '../src/bangkok/discoveries.ts';
import {actors,freshAdventure} from '../src/bangkok/adventure.ts';
import {cityServices} from '../src/bangkok/cityServices.ts';
import {eveningChoices,eveningResponse,eveningScene} from '../src/bangkok/eveningOuting.ts';

function recorded(speaker:string,text:string){
  assert(recordedVoices[`${speaker.split(' ·')[0]}|${text}`],`Unvoiced response from ${speaker}: ${text}`);
}
test('authored conversation, canal, discovery and escort responses have prerecorded voices',()=>{
  const lines=[...Object.values(conversations).flat(),...Object.values(canalLines).flat(),...escortInvitation,...escortArrival];
  for(const line of lines)if(line.response)recorded(line.responseSpeaker??line.speaker,line.response);
  for(const discovery of discoveries)recorded('Su',discovery.response);
});
test('all evening branches and local service receipts have character responses',()=>{
  for(const flags of [[],['evening-food'],['evening-park'],['evening-food','evening-mild'],['evening-food','evening-chilli'],['evening-park','evening-water'],['evening-park','evening-tea']]){
    const save={...freshAdventure(),flags:['innkeeper',...flags]};
    for(const reply of eveningChoices(save))recorded(eveningScene(save).speaker,eveningResponse(save,reply));
  }
  for(const service of cityServices)recorded(actors.find(a=>a.id===service.host)!.name,service.result);
});
test('Nok answers the invitation and Dao answers thanks at the station',()=>{
  assert.equal(escortInvitation.find(l=>l.phrase==='go-together')?.responseSpeaker,'Nok');
  assert.equal(escortArrival.find(l=>l.phrase==='thank-you')?.responseSpeaker,'Dao');
});
