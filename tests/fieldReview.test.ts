import test from 'node:test';
import assert from 'node:assert/strict';
import {fieldReviewDue,recordFieldReview} from '../src/bangkok/fieldReview.ts';
import {freshTraining,normalizeTraining} from '../src/bangkok/learning.ts';
import {freshAdventure} from '../src/bangkok/adventure.ts';

const today='2026-09-06',flags=['hotel-journal','park-basket'];
test('return markers reveal only discovered memories that are due and not reviewed today',()=>{
 const s=freshTraining();assert.deepEqual(fieldReviewDue([],s,today),[]);
 assert.deepEqual(fieldReviewDue(flags,s,today).map(d=>d.id),flags);
 s.records['water-please']={seen:1,recalled:1,spoken:0,interval:3,due:'2026-09-08'};
 assert.deepEqual(fieldReviewDue(flags,s,today).map(d=>d.id),['hotel-journal']);
});
test('recorded unaided recall persists, schedules another day and never changes adventure rewards',()=>{
 const adventure={...freshAdventure(),flags};const before=structuredClone(adventure);
 const s=recordFieldReview(freshTraining(),flags,'park-basket',{spoken:true,recalled:true},today);
 assert.equal(s.records['water-please'].recalled,1);assert.equal(s.records['water-please'].spoken,1);
 assert.equal(s.records['water-please'].due,'2026-09-07');assert.equal(s.fieldReviews?.['park-basket'],today);
 assert(!fieldReviewDue(flags,s,today).some(d=>d.id==='park-basket'));
 assert(fieldReviewDue(flags,s,'2026-09-07').some(d=>d.id==='park-basket'));
 assert.deepEqual(normalizeTraining(JSON.parse(JSON.stringify(s))),s);assert.deepEqual(adventure,before);
 const repeat=recordFieldReview(s,flags,'park-basket',{spoken:true,recalled:true},today);
 assert.equal(repeat.records['water-please'].recalled,1);assert.equal(repeat.records['water-please'].interval,1);
});
test('hinted or unsuccessful recall stays due without inflating mastery; today is still acknowledged',()=>{
 for(const result of [{spoken:false,recalled:true,hinted:true},{spoken:false,recalled:false}]){
 const s=recordFieldReview(freshTraining(),flags,'park-basket',result,today);
 assert.equal(s.records['water-please'].interval,0);assert.equal(s.records['water-please'].recalled,0);assert.equal(s.records['water-please'].due,today);
 assert(!fieldReviewDue(flags,s,today).some(d=>d.id==='park-basket'));
 assert(fieldReviewDue(flags,s,'2026-09-07').some(d=>d.id==='park-basket'));
 }
 const s=freshTraining();assert.equal(recordFieldReview(s,[],'park-basket',{spoken:true,recalled:true},today),s);
 const clean=normalizeTraining({...s,fieldReviews:{'park-basket':today,'hotel-journal':5,'bad key':'yesterday'}});
 assert.deepEqual(clean.fieldReviews,{'park-basket':today});
});
