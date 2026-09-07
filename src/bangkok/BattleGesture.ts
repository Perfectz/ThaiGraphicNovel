import * as T from 'three';
import type { Battle, HeroId } from './expeditionCombat.ts';

export type Gesture = 'ready' | 'cast' | 'support' | 'guard' | 'hurt' | 'dodge' | 'parry' | 'duet' | 'down';
export function battleGesture(b: Battle, id: HeroId, age: number): { name: Gesture; weight: number } {
  const hero = b.heroes.find((h) => h.id === id)!;
  if (!hero.hp) return { name: 'down', weight: 1 };
  const e = b.event;
  const weight = age >= 0 && age < 1.05 ? Math.sin((Math.PI * age) / 1.05) ** 0.65 : 0;
  if (e.seq && weight > 0) {
    if (hero.guard && e.kind === 'guard' && (e.source === id || e.target === id))
      return { name: 'guard', weight: 1 };
    if (e.kind === 'duet') return { name: 'duet', weight };
    if (e.source === id && e.kind === 'parry') return { name: 'parry', weight };
    if (e.target === id && e.kind === 'guard') return { name: 'guard', weight };
    if (e.target === id && ['dodge', 'parry'].includes(e.kind)) return { name: e.kind as Gesture, weight };
    if (e.target === id && e.value > 0 && e.kind === 'strike') return { name: 'hurt', weight };
    if (e.source === id)
      return { name: e.kind === 'heal' ? 'support' : e.kind === 'guard' ? 'guard' : 'cast', weight };
  }
  return { name: hero.guard ? 'guard' : 'ready', weight: 1 };
}

// Small additive offsets retain each model's own animated stance and planted feet.
const poses: Record<Gesture, Record<string, [number, number, number]>> = {
  ready: { Spine02: [0.025, 0, 0], RightForeArm: [-0.12, 0, 0], LeftForeArm: [-0.12, 0, 0] },
  cast: {
    Spine02: [0.12, -0.16, 0],
    RightArm: [-0.65, 0, -0.18],
    RightForeArm: [-0.32, 0, 0],
    LeftForeArm: [-0.25, 0, 0],
  },
  support: {
    Spine02: [-0.04, 0, 0],
    RightArm: [-0.45, 0, -0.15],
    LeftArm: [-0.45, 0, 0.15],
    RightForeArm: [-0.55, 0, 0],
    LeftForeArm: [-0.55, 0, 0],
  },
  guard: {
    Spine02: [0.12, 0, 0],
    Head: [0.08, 0, 0],
    RightArm: [-0.4, 0, -0.2],
    LeftArm: [-0.4, 0, 0.2],
    RightForeArm: [-0.9, 0, 0],
    LeftForeArm: [-0.9, 0, 0],
  },
  hurt: {
    Spine02: [-0.22, 0, -0.12],
    Head: [-0.12, 0, 0],
    RightArm: [0.12, 0, -0.1],
    LeftArm: [0.12, 0, 0.1],
  },
  dodge: {
    Spine02: [0.23, 0.12, 0.18],
    Head: [-0.08, -0.12, 0],
    RightForeArm: [-0.55, 0, 0],
    LeftForeArm: [-0.55, 0, 0],
  },
  parry: {
    Spine02: [0.06, 0.18, 0],
    RightArm: [-0.8, 0, -0.2],
    RightForeArm: [-0.7, 0, 0],
    LeftForeArm: [-0.45, 0, 0],
  },
  duet: {
    Spine02: [-0.08, 0, 0],
    RightArm: [-0.9, 0, -0.28],
    LeftArm: [-0.9, 0, 0.28],
    RightForeArm: [-0.35, 0, 0],
    LeftForeArm: [-0.35, 0, 0],
  },
  down: { Spine02: [0.2, 0, 0], Head: [0.25, 0, 0] },
};

/** Restores the previous frame before the mixer runs: no drift, even with motion disabled. */
export class BattleGesture {
  private joints: { bone: T.Bone; base: T.Quaternion }[] = [];
  private applied = false;
  private offset = new T.Quaternion();
  private identity = new T.Quaternion();
  private euler = new T.Euler();
  private serial: number | null = null;
  private since = -Infinity;
  name: Gesture | null = null;
  weight = 0;
  readonly id: HeroId;
  constructor(body: T.Object3D, id: HeroId) {
    this.id = id;
    body.traverse((o) => {
      if (o instanceof T.Bone) this.joints.push({ bone: o, base: o.quaternion.clone() });
    });
  }
  clear() {
    if (this.applied) this.joints.forEach((j) => j.bone.quaternion.copy(j.base));
    this.applied = false;
  }
  apply(b: Battle | null, time: number, reduced: boolean) {
    this.clear();
    if (!b) {
      this.serial = null;
      this.since = -Infinity;
      this.name = null;
      this.weight = 0;
      return;
    }
    // A save reload restores the stance without replaying its last hit.
    if (this.serial !== null && b.event.seq !== this.serial) this.since = time;
    this.serial = b.event.seq;
    const gesture = battleGesture(b, this.id, reduced ? Infinity : time - this.since);
    this.name = gesture.name;
    this.weight = gesture.weight;
    for (const j of this.joints) {
      j.base.copy(j.bone.quaternion);
      const angles = poses[gesture.name][j.bone.name];
      if (angles) {
        this.euler.set(...angles);
        this.offset.setFromEuler(this.euler);
        this.offset.slerp(this.identity, 1 - gesture.weight);
        j.bone.quaternion.multiply(this.offset);
      }
    }
    this.applied = true;
  }
  snapshot() {
    return { id: this.id, name: this.name, weight: this.weight, joints: this.joints.length };
  }
}
