import { findPath, followPath, type AdventureSave, type Point } from './adventure.ts';
import { cityWalkable, recoverCityPosition } from './city.ts';
import type { StoryLine } from './adventureStory.ts';

export const escortStart = { x: -20, z: 18 };
export const escortDestination = { x: -41.8, z: 17.2 };
export type EscortSave = { stage: 'waiting' | 'following' | 'arrived' | 'complete'; position: Point };
export const freshEscort = (): EscortSave => ({ stage: 'waiting', position: { ...escortStart } });
export function normalizeEscort(value: unknown): EscortSave {
  const s = value as EscortSave | undefined;
  if (!s || !['waiting', 'following', 'arrived', 'complete'].includes(s.stage)) return freshEscort();
  if (s.stage === 'waiting') return freshEscort();
  if (s.stage === 'complete') return { stage: 'complete', position: { ...escortDestination } };
  if (
    !s.position ||
    !Number.isFinite(s.position.x) ||
    !Number.isFinite(s.position.z)
  )
    return freshEscort();
  const position = cityWalkable(s.position) ? s.position : recoverCityPosition(s.position);
  if (!position) return freshEscort();
  return {
    stage:
      s.stage === 'arrived' &&
      Math.hypot(position.x - escortDestination.x, position.z - escortDestination.z) > 4
        ? 'following'
        : s.stage,
    position: { ...position },
  };
}
export function beginEscort(s: AdventureSave): AdventureSave {
  if (
    s.battle ||
    !s.flags.includes('innkeeper') ||
    s.escort.stage !== 'waiting' ||
    Math.hypot(s.position.x - escortStart.x, s.position.z - escortStart.z) > 2.5
  )
    return s;
  return { ...s, escort: { ...s.escort, stage: 'following' } };
}
export function finishEscort(s: AdventureSave): AdventureSave {
  if (s.battle || s.escort.stage !== 'arrived' || Math.hypot(s.escort.position.x - escortDestination.x, s.escort.position.z - escortDestination.z) > 4 || Math.hypot(s.position.x + 40, s.position.z - 17.5) > 2.5)
    return s;
  return {
    ...s,
    escort: { stage: 'complete', position: { ...escortDestination } },
    xp: s.xp + 70,
    coins: s.coins + 20,
    tea: s.tea + 1,
  };
}
export function escortStatus(s: AdventureSave): string {
  return {
    waiting:
      'Nok is waiting near the park entrance. A walk to the station could help you both find your bearings.',
    following:
      'Nok is walking with you. Follow the main road west to Dao in Sukhumvit. Your escort waits during conversations and battles.',
    arrived: 'You reached the station together. Ask Dao about Nok’s route to finish the errand.',
    complete: 'Nok found the station and stays near Dao. You helped another traveller find their way.',
  }[s.escort.stage];
}
export const escortInvitation: StoryLine[] = [
  {
    speaker: 'Nok',
    text: '“I took a wrong turn after the park. I can see the train above the shops, but every soi looks different from down here.” Nok adjusts a bright orange backpack. Su suggests walking to Dao, the station guide, together.',
  },
  {
    speaker: 'Su',
    text: 'Invite Nok to walk with us. You know where Dao stands, and two travellers can find their way together.',
    phrase: 'go-together',
    responseSpeaker: 'Nok',
    response: 'Nok smiles. “Yes, please. Lead the way. I will stay close.”',
  },
];
export const escortArrival: StoryLine[] = [
  {
    speaker: 'Dao',
    text: 'Nok reaches the train viaduct beside you. Before pointing the way, check with Dao: where is the station?',
    phrase: 'where-is-station',
    response:
      'Dao points along the viaduct. “You found it. Follow the station signs from here.” Nok lets out a relieved breath.',
  },
  {
    speaker: 'Nok',
    text: '“I thought I would have to find my way alone.” Su nods toward Dao. Thank the guide for helping you both.',
    phrase: 'thank-you',
    responseSpeaker: 'Dao',
    response:
      '“Come back whenever you need directions,” Dao says. Nok leaves you a flask of tea for your next walk.',
  },
  {
    speaker: 'Su',
    text: 'A Way Back Together · You helped Nok reach the station. Receive 70 XP, 20 coins and a flask of tea. Nok will be here when you return.',
  },
];

/** Follows walkable paths rather than cutting through the park or shops. */
export class EscortFollower {
  state: EscortSave = freshEscort();
  moving = false;
  facing = 0;
  private path: Point[] = [];
  private replan = 0;
  sync(value: EscortSave, initial = false) {
    const ranks = { waiting: 0, following: 1, arrived: 2, complete: 3 };
    if (initial || ranks[value.stage] > ranks[this.state.stage]) {
      this.state = normalizeEscort(value);
      this.path = [];
      this.replan = 0;
    }
  }
  update(player: Point, dt: number, paused: boolean) {
    this.moving = false;
    if (paused || this.state.stage !== 'following') return;
    const p = this.state.position;
    const byStation = Math.hypot(player.x - escortDestination.x, player.z - escortDestination.z) < 3;
    if (byStation && Math.hypot(p.x - escortDestination.x, p.z - escortDestination.z) < .7) {
      this.state = { ...this.state, stage: 'arrived' };
      this.path = [];
      return;
    }
    const distance = Math.hypot(player.x - p.x, player.z - p.z);
    if (!byStation && distance < 2.2) {
      this.path = [];
      return;
    }
    this.replan -= dt;
    if (this.replan <= 0) {
      this.path = findPath(p, byStation ? escortDestination : player);
      this.replan = 0.65;
    }
    const next = followPath(p, this.path, Math.min(dt, 0.2) * (distance > 6 ? 5.1 : 4.1));
    if (Math.hypot(next.x - p.x, next.z - p.z) > 0.001) {
      this.moving = true;
      this.facing = Math.atan2(next.x - p.x, next.z - p.z);
      this.state = { ...this.state, position: next };
    }
  }
}
