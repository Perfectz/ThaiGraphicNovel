import test from 'node:test';
import assert from 'node:assert/strict';
import { bestSpeech, readSpeechAssessment, speechTurnKey, type SpeechAssessment } from '../src/bangkok/speechPower.ts';
import { freshAdventure, startBattle } from '../src/bangkok/adventure.ts';
import { performMove } from '../src/bangkok/expeditionCombat.ts';
const battle = () => startBattle({ ...freshAdventure(), flags: ['intro','innkeeper'] }, 'murmur').battle!;
function assessment(b = battle()): SpeechAssessment { return { attemptId: 'attempt-001', turnKey: speechTurnKey(b, b.foes[0].id), phraseId: 'hello', assessable: true, band: 'clear', heard: 'hello', feedback: 'Clear.', focus: '', correction: '' }; }
test('grades change First Light damage while preserving its AP and break mechanics', () => {
  for (const [band, damage] of [['developing',13],['understandable',18],['clear',22],['excellent',25]] as const) {
    const b = battle(), a = { ...assessment(b), band };
    const next = performMove(b, 'greet', b.foes[0].id, a);
    assert.equal(b.foes[0].hp - next.foes[0].hp, damage);
    assert.equal(next.heroes[0].ap, b.heroes[0].ap + 2);
    assert.equal(next.foes[0].break, b.foes[0].break + 20);
    assert.equal(b.turn, 0); assert.equal(next.turn, 1);
  }
});
test('foreign, unassessable and stale results cannot change damage', () => {
  const b = battle();
  for (const a of [{...assessment(b), turnKey: 'older-turn'}, {...assessment(b), assessable: false, band: null}, {...assessment(b), band:'fake'}]) {
    const next = performMove(b, 'greet', b.foes[0].id, a as SpeechAssessment);
    assert.equal(b.foes[0].hp-next.foes[0].hp,18);
  }
  const next = performMove(b,'greet',b.foes[0].id,assessment(b));
  assert.equal(performMove(next,'greet',b.foes[0].id,assessment(b)),next,'cannot replay Patrick attack on Su turn');
});
test('tactical exposure combines with speech power without scaling unrelated moves', () => {
  const b=battle(); b.foes[0].exposed=true;
  assert.equal(b.foes[0].hp-performMove(b,'greet',b.foes[0].id,assessment(b)).foes[0].hp,32);
  const plain=performMove(b,'resolve',b.foes[0].id), voiced=performMove(b,'resolve',b.foes[0].id,assessment(b));
  assert.deepEqual(plain,voiced);
});
test('invalid structures are rejected and a coached retry keeps the best valid attempt', () => {
  const a=assessment(); assert(readSpeechAssessment(a));
  for(const v of [null, {}, {...a,band:NaN}, {...a,assessable:false}, {...a,feedback:'x'.repeat(601)}]) assert.equal(readSpeechAssessment(v),null);
  assert.equal(bestSpeech(a,{...a,band:'developing'}),a);
  assert.equal(bestSpeech(a,{...a,assessable:false,band:null}),a);
  assert.equal(bestSpeech(a,{...a,band:'excellent'}).band,'excellent');
});
