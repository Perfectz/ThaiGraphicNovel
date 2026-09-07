import test from 'node:test';
import assert from 'node:assert/strict';
import handler, { validateVoiceRequest, assessRealtime, parseAssessment } from '../battle-voice.mjs';
const request = {mode:'assess',phraseId:'hello',attemptId:'attempt-test-01',turnKey:'turn-01',audio:Buffer.alloc(24000).toString('base64')};
test('battle endpoint bounds audio, phrase, mode and identifiers before requesting AI',()=>{
  assert.equal(validateVoiceRequest(request),request);
  for(const value of [{...request,phraseId:'anything'}, {...request,audio:'bad'}, {...request,audio:Buffer.alloc(1000000).toString('base64')}, {...request,mode:'execute'}, {...request,attemptId:'!'}, {...request,mode:'coach'}]) assert.throws(()=>validateVoiceRequest(value));
});
test('silent audio is ungraded without opening an API connection',async()=>{
  const result=await assessRealtime(request,'unused-test-value');
  assert.equal(result.assessment.assessable,false);assert.equal(result.assessment.band,null);
  assert.equal(result.assessment.turnKey,request.turnKey);
});
test('model response is bounded and validated before becoming a game grade',()=>{
  const reply='Heard: สวัสดีครับ\nRating: clear\nFeedback: Clear delivery.\nFocus: none\nCorrection: none';
  assert.equal(parseAssessment(reply,request).band,'clear');
  assert.equal(parseAssessment(reply.replace('clear','invincible'),request),null);
  assert.equal(parseAssessment('Rating: excellent',request),null);
  assert.equal(parseAssessment(reply.replace('Clear delivery.','x'.repeat(601)),request),null);
});
test('malformed or foreign origins fail before touching the voice service',async()=>{
  for(const origin of ['not a URL','https://foreign.example']){
    let result;const res={setHeader(){},end(body){result=JSON.parse(body)}};
    await handler({method:'POST',headers:{origin,host:'localhost:5188'}},res);
    assert.equal(res.statusCode,403);assert.equal(result.error,'Origin not allowed');
  }
});
