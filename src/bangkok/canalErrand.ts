import { actors, type ActorId, type AdventureSave } from './adventure.ts';
import type { StoryLine } from './adventureStory.ts';

export const canalFlags = ['canal-accepted', 'canal-paper', 'canal-frame', 'canal-restored'] as const;
export type CanalStep = (typeof canalFlags)[number];
export const canalHost: Record<CanalStep, ActorId> = {
  'canal-accepted': 'canal-lantern',
  'canal-paper': 'gardener',
  'canal-frame': 'artisan',
  'canal-restored': 'canal-lantern',
};
export function canalApproach(actor: ActorId) {
  const person = actors.find((a) => a.id === actor)!;
  // Meet Pim beside the raised pavilion, rather than standing inside its floor.
  return actor === 'gardener' ? { x: person.x, z: person.z + 2 } : { x: person.x + 1, z: person.z - 1 };
}
export function canalStepFor(s: AdventureSave, actor: ActorId): CanalStep | null {
  const has = (f: string) => s.flags.includes(f);
  if (!has('innkeeper') || has('canal-restored')) return null;
  if (actor === 'canal-lantern') {
    if (!has('canal-accepted')) return 'canal-accepted';
    return has('canal-paper') && has('canal-frame') ? 'canal-restored' : null;
  }
  if (!has('canal-accepted')) return null;
  if (actor === 'gardener' && !has('canal-paper')) return 'canal-paper';
  if (actor === 'artisan' && !has('canal-frame')) return 'canal-frame';
  return null;
}
export function canalStatus(s: AdventureSave): string {
  if (s.flags.includes('canal-restored'))
    return 'The canal lantern shines again. Pim and Arun both helped you leave the path brighter.';
  if (!s.flags.includes('canal-accepted'))
    return 'A damaged lantern stands beside the canal. Visit it to begin an optional errand.';
  const missing = [
    !s.flags.includes('canal-paper') && 'paper from Pim in Lumphini',
    !s.flags.includes('canal-frame') && 'a frame from Arun in Old Town',
  ].filter(Boolean);
  return missing.length
    ? `Collect ${missing.join(' and ')}. Visit them in either order, then return to the canal lantern.`
    : 'Both pieces are in your bag. Return to the canal lantern and help Su fit them together.';
}
export function advanceCanalErrand(s: AdventureSave, step: CanalStep): AdventureSave {
  const actor = actors.find((a) => a.id === canalHost[step]);
  if (
    !actor ||
    s.battle ||
    canalStepFor(s, actor.id) !== step ||
    Math.hypot(s.position.x - actor.x, s.position.z - actor.z) > 2.5
  )
    return s;
  const finished = step === 'canal-restored';
  return {
    ...s,
    flags: [...s.flags, step],
    xp: s.xp + (finished ? 80 : 0),
    coins: s.coins + (finished ? 25 : 0),
    rice: s.rice + (finished ? 1 : 0),
    tea: s.tea + (finished ? 1 : 0),
  };
}
export const canalLines: Record<CanalStep, StoryLine[]> = {
  'canal-accepted': [
    {
      speaker: 'Su',
      text: 'The canal lantern has a torn shade and a bent frame. Under it, a little note reads: “For anyone walking home after dark.” Someone has been looking after this path.',
    },
    {
      speaker: 'Su',
      text: 'Pim keeps spare paper for the park signs. Arun makes lantern frames in Old Town. We could ask them for the two pieces, in either order, and bring them back here. A small favour can connect a whole neighbourhood.',
    },
  ],
  'canal-paper': [
    {
      speaker: 'Pim',
      text: '“The little lamp by the canal? I wondered who would notice.” Pim starts explaining the folds too quickly. Ask her to speak slowly so you can follow.',
      phrase: 'speak-slowly',
      response:
        'Pim slows down and demonstrates one fold at a time. “Keep the paper dry until Arun has checked the frame.”',
    },
    {
      speaker: 'Pim',
      text: 'She gives you a folded paper shade. “That lamp was my father’s idea. He used to walk this way after closing his stall.” Thank her for helping.',
      phrase: 'thank-you',
      response:
        '“Bring its light back, and we will both have helped someone get home.” The paper shade is ready to carry.',
    },
  ],
  'canal-frame': [
    {
      speaker: 'Arun',
      text: 'Arun sets a heavy metal frame beside a lighter one. Before you choose, ask what the lighter frame is made of.',
      phrase: 'what-material',
      response:
        '“Bamboo,” he says, bending a spare strip to show you. “Light enough for that little hanging shade.”',
    },
    {
      speaker: 'Arun',
      text: 'The bamboo frame fits the canal lamp. Tell Arun you will take this one.',
      phrase: 'want-this',
      response:
        '“A repair for the neighbourhood? No charge.” He wraps the frame. “Pim always kept that lamp going. I am glad she has help.”',
    },
  ],
  'canal-restored': [
    {
      speaker: 'Su',
      text: 'You bring the paper and frame together. Su holds the shade steady while you fit it over the lamp. Thank her for the extra pair of hands.',
      phrase: 'thank-you',
      response:
        '“Any time, Patrick.” Warm light spreads over the canal rail. A note from Pim waits beneath it: “For our two new neighbours.”',
    },
    {
      speaker: 'Su',
      text: 'A Light for Late Walkers · You brought the neighbourhood together. Receive 80 XP, 25 coins, a rice parcel and a flask of tea. The lantern will stay lit when we return.',
    },
  ],
};
