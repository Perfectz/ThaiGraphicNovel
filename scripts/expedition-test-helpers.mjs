import assert from 'node:assert/strict';
export const adventureState = p => p.evaluate(() => JSON.parse(localStorage.getItem('bangkok-rift-adventure-v1')));
export async function settle(p) {
  await p.locator('.exp-resolving').waitFor({state:'hidden',timeout:45000});
}
export async function word(p, name, target, spoken=false) {
  await settle(p);
  await p.getByRole('button',{name:/^✦ Word arts/}).click();
  await p.locator('.exp-word-grid button').filter({hasText:name}).click();
  await p.locator('.exp-target-list button').filter({hasText:target}).click();
  if(spoken) {
    await p.getByRole('button',{name:'◉ Record this line',exact:true}).click();
    await p.getByRole('button',{name:'■ Stop recording',exact:true}).waitFor();
    await p.waitForTimeout(600);
    await p.getByRole('button',{name:'■ Stop recording',exact:true}).click();
    await p.getByRole('button',{name:'▷ Play my recording',exact:true}).click();
    await p.getByRole('button',{name:'Use my spoken reply →',exact:true}).click();
  } else await p.getByRole('button',{name:'Use text only this time',exact:true}).click();
  await settle(p);
}
export async function finishFight(p,id) {
  for(let i=0;i<110;i++) {
    await settle(p);
    const s=await adventureState(p),b=s.battle;
    console.log(`Combat ${id}: round ${b?.round ?? '-'} · ${b?.phase ?? 'complete'}`);
    if(!b) { assert(s.flags.includes(id));return; }
    if(b.phase==='victory') { await p.getByRole('button',{name:'Claim rewards & continue',exact:true}).click();continue; }
    assert.notEqual(b.phase,'defeat','Battle must be winnable with no-timing defenses');
    if(b.phase==='defense') { await p.getByRole('button',{name:'Steady guard · no timing',exact:true}).click();continue; }
    const hero=b.heroes.find(h=>h.id===b.order[b.turn]);
    const low=b.heroes.find(h=>h.hp<h.maxHp-35);
    if(hero.id==='su'&&low&&hero.ap>=2) {await word(p,'Make Amends',low.name);continue;}
    if(low&&low.hp>0&&b.rice) {
      await p.getByRole('button',{name:/^▣ Provisions/}).click();await p.locator('.exp-word-grid button').filter({hasText:'Rice parcel'}).click();await p.locator('.exp-target-list button').filter({hasText:low.name}).click();continue;
    }
    if(b.resonance===100&&b.heroes.every(h=>h.hp)) {
      await p.getByRole('button',{name:/^✧ River duet/}).click();await p.getByRole('button',{name:'Use text only this time',exact:true}).click();continue;
    }
    const foe=b.foes[1].hp?b.foes[1]:b.foes[0];
    await word(p,hero.id==='su'?'Kindred Spark':hero.ap>=3?'Clear Intent':'First Light',foe.name);
  }
  throw new Error('Battle exceeded 110 actions');
}
