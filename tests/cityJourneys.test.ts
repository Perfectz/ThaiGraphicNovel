import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { cityJourneys, journeyHosts, beginJourney, advanceJourney, freshJourneys, journeyCursor, normalizeJourneys } from '../src/bangkok/cityJourneys.ts';
import { freshTraining, recordAttempt } from '../src/bangkok/learning.ts';
import { freshAdventure, completeJourneyStep, normalizeAdventure, objective } from '../src/bangkok/adventure.ts';
const today = '2026-09-04';

test('all 30 outings have three reachable hosts and existing Thai audio for every prompt', () => {
  const ids = new Set(JSON.parse(readFileSync('public/bangkok/audio/phrases.json', 'utf8')).map((p: {id: string}) => p.id));
  assert.equal(cityJourneys.length, 30);
  assert.equal(new Set(cityJourneys.map(j => j.title)).size, 30);
  for (const j of cityJourneys) {
    assert.equal(new Set(j.actors).size, 3);
    for (const actor of j.actors) for (const id of journeyHosts[actor].pool) {
      assert(ids.has(id), id); assert(existsSync(`public/bangkok/audio/${id}.mp3`), id);
    }
    const a = beginJourney(freshJourneys(), freshTraining(), today, j.id).active!;
    for (const q of a.queues) assert.equal(new Set(q).size, 3);
  }
});
test('due review is included and the exact in-progress queue survives reload and repeat starts', () => {
  const t = recordAttempt(freshTraining(), 'thank-you', 'recall', false, '2026-09-01');
  const s = beginJourney(freshJourneys(), t, today);
  assert.equal(s.active!.queues[0][0], 'thank-you');
  assert.equal(beginJourney(s, freshTraining(), today), s);
  const next = advanceJourney(s, journeyCursor(s.active!), { spoken: true });
  assert.deepEqual(normalizeJourneys(JSON.parse(JSON.stringify(next))), next);
});
test('hints and text never create speaking or recall credit; paused and stale submissions do nothing', () => {
  let s = beginJourney(freshJourneys(), freshTraining(), today);
  const cursor = journeyCursor(s.active!);
  s = advanceJourney(s, cursor, { spoken: false, recalled: true });
  assert.equal(s.active!.spoken, 0); assert.equal(s.active!.recalled, 0);
  assert.equal(advanceJourney(s, cursor, {spoken: true}), s);
  const paused = {...s, active: {...s.active!, paused: true}};
  assert.equal(advanceJourney(paused, journeyCursor(paused.active), {spoken: true}), paused);
  s = {...s, active: {...s.active!, step: 3}};
  s = advanceJourney(s, journeyCursor(s.active!), {spoken: false, recalled: true, hinted: true});
  assert.equal(s.active!.recalled, 0);
});
test('eighteen attempts complete three stops and reward only the first completion', () => {
  let s = freshAdventure();
  s.journeys = beginJourney(s.journeys, freshTraining(), today);
  const initial = {xp:s.xp, coins:s.coins, rice:s.rice};
  for(let i=0;i<18;i++) {
    assert.equal(s.journeys.active!.stop, Math.floor(i/6));
    s = completeJourneyStep(s, journeyCursor(s.journeys.active!), {spoken: true, recalled: true});
  }
  assert.equal(s.journeys.active, null);
  assert.deepEqual(s.journeys.completed, [{id:1,date:today,spoken:18,recalled:9}]);
  assert.equal(s.xp, initial.xp+60);assert.equal(s.coins, initial.coins+20);assert.equal(s.rice, initial.rice+1);
  const first = s;
  assert.equal(completeJourneyStep(s, '1:2:5', {spoken:true}), s);
  s = {...s, journeys: beginJourney(s.journeys, freshTraining(), today, 1)};
  for(let i=0;i<18;i++) s = completeJourneyStep(s, journeyCursor(s.journeys.active!), {spoken: false});
  assert.deepEqual(s, first);
  assert.equal(beginJourney(s.journeys, freshTraining(), today).active!.id, 2);
});
test('old adventures retain progress and a paused outing restores the story objective', () => {
  const old = {...freshAdventure(), flags:['intro','innkeeper'], xp:130, journeys:undefined};
  const s = normalizeAdventure(old);
  assert.deepEqual(s.journeys, freshJourneys());assert.equal(s.xp,130);assert.deepEqual(s.flags,old.flags);
  const main = objective(s);
  s.journeys = beginJourney(s.journeys, freshTraining(), today);
  assert.equal(objective(s).actor,'innkeeper');
  s.journeys.active!.paused = true;
  assert.deepEqual(objective(s),main);
});
test('invalid journey queues cannot resume into missing phrases or actors', () => {
  const s = beginJourney(freshJourneys(), freshTraining(), today);
  for (const active of [{...s.active,stop:3}, {...s.active,step:6}, {...s.active,queues:[['missing'],[],[]]}, {...s.active,id:31}])
    assert.equal(normalizeJourneys({active}).active,null);
});
