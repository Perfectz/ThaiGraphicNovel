/** Deterministic party combat. Speaking practice never pretends to be a pronunciation score. */
import { normalizeTalents, type PartyGrowth, type TalentId } from './partyGrowth.ts';
import { worldArts, normalizeWorldArts } from './worldArts.ts';
import { readSpeechAssessment, speechPower, speechTurnKey, type SpeechAssessment } from './speechPower.ts';
export type HeroId = 'patrick' | 'su';
export type Hero = { id: HeroId; name: string; hp: number; maxHp: number; ap: number; guard: boolean };
export type Foe = {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  break: number;
  exposed: boolean;
  staggered: boolean;
  weakened: boolean;
  role: 'keeper' | 'murmur' | 'echo' | 'sentinel';
};
export type BattleEvent = {
  seq: number;
  source: string;
  target: string;
  kind: 'strike' | 'heal' | 'guard' | 'dodge' | 'parry' | 'miss' | 'duet';
  value: number;
  text: string;
};
export type Battle = {
  arts?: string[];
  growth?: PartyGrowth;
  version: 2;
  practice: boolean;
  id: 'murmur' | 'keeper' | 'sentinel';
  round: number;
  turn: number;
  phase: 'command' | 'defense' | 'victory' | 'defeat';
  heroes: Hero[];
  foes: Foe[];
  order: string[];
  resonance: number;
  event: BattleEvent;
  log: string[];
  rice: number;
  tea: number;
  ward: boolean;
};
export type Move = {
  id: string;
  name: string;
  owner: HeroId;
  phrase: string;
  cost: number;
  target: 'foe' | 'ally' | 'all';
  effect: string;
  detail: string;
};
export const moves: Move[] = [
  {
    id: 'greet',
    name: 'First Light',
    owner: 'patrick',
    phrase: 'hello',
    cost: 0,
    target: 'foe',
    effect: '18 damage · +2 AP · 20 break',
    detail: 'A greeting opens the conversation. Build energy for your stronger words.',
  },
  {
    id: 'resolve',
    name: 'Clear Intent',
    owner: 'patrick',
    phrase: 'want-this',
    cost: 3,
    target: 'foe',
    effect: '42 damage · 25 break',
    detail: 'Say what you want. Deals 63 damage against an exposed enemy, then consumes exposure.',
  },
  {
    id: 'slow',
    name: 'Still the River',
    owner: 'patrick',
    phrase: 'speak-slowly',
    cost: 2,
    target: 'foe',
    effect: '12 damage · 65 break',
    detail: 'Ask them to slow down. At 100 break the enemy loses its next turn and becomes exposed.',
  },
  {
    id: 'cool',
    name: 'Gentle Flame',
    owner: 'patrick',
    phrase: 'not-spicy',
    cost: 2,
    target: 'foe',
    effect: '24 damage · weaken next attack',
    detail: 'Ask for no spice. Halves this enemy’s next attack before your defense is applied.',
  },
  {
    id: 'thanks',
    name: 'Kindred Spark',
    owner: 'su',
    phrase: 'thank-you',
    cost: 0,
    target: 'foe',
    effect: '16 damage · +2 AP · 20 break',
    detail: 'Gratitude keeps the connection alive. Restore energy and build toward a break.',
  },
  {
    id: 'reveal',
    name: 'Echo Lens',
    owner: 'su',
    phrase: 'say-again',
    cost: 2,
    target: 'foe',
    effect: '10 damage · expose target',
    detail: 'Ask to hear it again. Reveal an opening: the next damaging word deals 50% more damage.',
  },
  {
    id: 'mend',
    name: 'Make Amends',
    owner: 'su',
    phrase: 'sorry',
    cost: 2,
    target: 'ally',
    effect: 'Restore 38 HP · revive if down',
    detail: 'An apology repairs a connection. Bring a fallen ally back with 24 HP.',
  },
  {
    id: 'water',
    name: 'River’s Gift',
    owner: 'su',
    phrase: 'water-please',
    cost: 2,
    target: 'ally',
    effect: 'Restore 20 HP · grant 2 AP',
    detail: 'Ask for water. Refresh an ally so they can use a stronger ability next turn.',
  },
];
moves.push(...worldArts);
export const actor = (b: Battle) => b.order[b.turn];
export const activeHero = (b: Battle) => b.heroes.find((h) => h.id === actor(b));
export const battleSpoils = (id: Battle['id']) =>
  ({
    murmur: { xp: 50, coins: 20, label: 'Lantern spark recovered' },
    keeper: { xp: 100, coins: 20, label: 'River lantern restored' },
    sentinel: { xp: 75, coins: 25, label: 'Wayfinder Seal · start future battles with 20 resonance' },
  })[id];
export function createBattle(
  id: Battle['id'],
  hp: number,
  rice: number,
  tea: number,
  ward: boolean,
  practice = false,
  growth?: PartyGrowth,
  wayfinder = false,
  arts: string[] = [],
): Battle {
  const foe = (id: string, name: string, hp: number, role: Foe['role']): Foe => ({
    id,
    name,
    hp,
    maxHp: hp,
    role,
    break: 0,
    exposed: false,
    staggered: false,
    weakened: false,
  });
  const foes =
    id === 'sentinel'
      ? [foe('sentinel', 'Waywarden', 170, 'sentinel'), foe('echo', 'Crossroads Echo', 64, 'echo')]
      : id === 'keeper'
        ? [foe('keeper', 'Keeper of Unsaid Words', 230, 'keeper'), foe('echo', 'Lantern Echo', 76, 'echo')]
        : [foe('murmur', 'Murmur Wisp', 100, 'murmur'), foe('echo', 'Lantern Echo', 56, 'echo')];
  return {
    arts: normalizeWorldArts(arts),
    ...(growth ? { growth: { level: growth.level, talents: [...growth.talents] } } : {}),
    version: 2,
    practice,
    id,
    round: 1,
    turn: 0,
    phase: 'command',
    heroes: [
      {
        id: 'patrick',
        name: 'Patrick',
        hp: Math.max(1, hp),
        maxHp: 100,
        ap: growth?.talents.includes('ready') ? 4 : 3,
        guard: false,
      },
      {
        id: 'su',
        name: 'Su',
        hp: 90,
        maxHp: 90,
        ap: growth?.talents.includes('guiding') ? 4 : 3,
        guard: false,
      },
    ],
    foes,
    order: ['patrick', 'su', ...foes.map((f) => f.id)],
    resonance: wayfinder ? 20 : 0,
    rice,
    tea,
    ward,
    event: {
      seq: 0,
      source: 'su',
      target: 'patrick',
      kind: 'guard',
      value: 0,
      text:
        id === 'sentinel'
          ? 'Su: “Its armor halves word damage. Echo Lens exposes an opening; counters and our duet bypass the armor. Heavy attacks come every second round.”'
          : 'Su: “I can expose an enemy. Save your strongest words for the opening.”',
    },
    log: [],
  };
}
function copy(b: Battle): Battle {
  return {
    ...b,
    ...(b.arts ? { arts: [...b.arts] } : {}),
    heroes: b.heroes.map((h) => ({ ...h })),
    foes: b.foes.map((f) => ({ ...f })),
    log: [...b.log],
    event: { ...b.event },
  };
}
function event(b: Battle, e: Omit<BattleEvent, 'seq'>) {
  b.event = { ...e, seq: b.event.seq + 1 };
  b.log = [...b.log.slice(-5), e.text];
}
function finished(b: Battle) {
  if (b.foes.every((f) => !f.hp)) {
    b.phase = 'victory';
    return true;
  }
  if (b.heroes.every((h) => !h.hp)) {
    b.phase = 'defeat';
    return true;
  }
  return false;
}
function advance(b: Battle) {
  if (finished(b)) return;
  for (let n = 0; n < b.order.length * 2; n++) {
    b.turn++;
    if (b.turn >= b.order.length) {
      b.turn = 0;
      b.round++;
    }
    const hero = activeHero(b);
    if (hero?.hp) {
      hero.guard = false;
      b.phase = 'command';
      return;
    }
    const foe = b.foes.find((f) => f.id === actor(b));
    if (foe?.hp) {
      if (foe.staggered) {
        foe.staggered = false;
        b.log.push(`${foe.name} is broken — its turn is skipped.`);
        continue;
      }
      b.phase = 'defense';
      return;
    }
  }
}
function strike(foe: Foe, amount: number, pressure: number) {
  const damage = Math.round(amount * (foe.exposed ? 1.5 : foe.role === 'sentinel' ? 0.5 : 1));
  foe.exposed = false;
  foe.hp = Math.max(0, foe.hp - damage);
  foe.break += pressure;
  if (foe.break >= 100) {
    foe.break = 0;
    foe.staggered = true;
    foe.exposed = true;
  }
  return damage;
}
export function moveReason(b: Battle, move: Move): string | null {
  const hero = activeHero(b);
  if (b.phase !== 'command' || !hero || move.owner !== hero.id) return 'Not this character’s turn';
  const discovery = worldArts.find(a => a.id === move.id);
  if (discovery && !b.arts?.includes(move.id)) return `Learn by completing ${discovery.source}`;
  if (hero.ap < move.cost) return `Needs ${move.cost} AP`;
  return null;
}
export const hasTalent = (b: Battle, id: TalentId) => b.growth?.talents.includes(id) ?? false;
export const moveEffect = (b: Battle, m: Move) =>
  m.id === 'slow' && hasTalent(b, 'unhurried')
    ? '12 damage · 80 break'
    : m.id === 'mend' && hasTalent(b, 'kindness')
      ? 'Restore 48 HP · revive with 34 HP'
      : m.effect;
export const moveDetail = (b: Battle, m: Move) =>
  m.id === 'mend' && hasTalent(b, 'kindness')
    ? 'An apology repairs a connection. Bring a fallen ally back with 34 HP.'
    : m.detail;
export function performMove(original: Battle, moveId: string, target: string, assessment?: SpeechAssessment): Battle {
  const move = moves.find((m) => m.id === moveId);
  if (!move || moveReason(original, move)) return original;
  const b = copy(original),
    hero = activeHero(b)!;
  const foe = b.foes.find((f) => f.id === target && f.hp > 0),
    ally = b.heroes.find((h) => h.id === target);
  if (
    (move.target === 'foe' && !foe) ||
    (move.target === 'ally' && (!ally || (!ally.hp && move.id !== 'mend')))
  )
    return original;
  if (ally && move.id === 'mend' && ally.hp === ally.maxHp) return original;
  if (ally && move.id === 'water' && ally.hp === ally.maxHp && ally.ap === 6) return original;
  if (ally && move.id === 'shelter' && ally.guard && ally.ap === 6) return original;
  hero.ap -= move.cost;
  if (!move.cost) hero.ap = Math.min(6, hero.ap + 2);
  b.resonance = Math.min(100, b.resonance + 20);
  let amount = 0,
    extra = '';
  if (foe) {
    const power = { greet: 18, resolve: 42, slow: 12, cool: 24, thanks: 16, reveal: 10, 'open-book': 12 }[move.id] ?? 0;
    amount = strike(
      foe,
      power * (moveId === 'greet' && assessment?.assessable && assessment.band &&
        readSpeechAssessment(assessment) && assessment.turnKey === speechTurnKey(original, target)
        ? speechPower[assessment.band] : 1),
      move.id === 'slow' ? (hasTalent(b, 'unhurried') ? 80 : 65) : move.id === 'resolve' ? 25 : move.id === 'open-book' ? 10 : 20,
    );
    if (move.id === 'reveal' && foe.hp) {
      foe.exposed = true;
      extra = ' · EXPOSED';
    }
    if (move.id === 'cool') {
      foe.weakened = true;
      extra = ' · WEAKENED';
    }
    if (move.id === 'open-book' && foe.hp) {
      foe.exposed = true;
      foe.weakened = true;
      extra = ' · EXPOSED · WEAKENED';
    }
    if (foe.staggered && foe.hp) extra += ' · BREAK! Next turn cancelled';
  } else if (ally) {
    if (move.id === 'shelter') {
      ally.guard = true;
      ally.ap = Math.min(6, ally.ap + 1);
      event(b, { source: hero.id, target, kind: 'guard', value: 0, text: `${hero.name} · Lantern Shelter: ${ally.name} is guarded until their next turn · +1 AP.` });
      advance(b);
      return b;
    }
    const heal = move.id === 'mend' ? (ally.hp ? 38 : 24) + (hasTalent(b, 'kindness') ? 10 : 0) : 20;
    amount = Math.min(ally.maxHp - ally.hp, heal);
    ally.hp += amount;
    if (move.id === 'water') {
      ally.ap = Math.min(6, ally.ap + 2);
      extra = ' · +2 AP';
    }
  }
  event(b, {
    source: hero.id,
    target,
    kind: ally ? 'heal' : 'strike',
    value: amount,
    text: `${hero.name} · ${move.name}: ${ally ? '+' : '−'}${amount} HP${extra}.`,
  });
  advance(b);
  return b;
}
export function partyAction(
  original: Battle,
  action: 'guard' | 'rice' | 'tea' | 'duet',
  target?: string,
): Battle {
  if (original.phase !== 'command' || !activeHero(original)) return original;
  const b = copy(original),
    hero = activeHero(b)!;
  let text = '',
    amount = 0;
  const ally = b.heroes.find((h) => h.id === target);
  if (action === 'guard') {
    hero.guard = true;
    hero.ap = Math.min(6, hero.ap + 2);
    text = `${hero.name} guards: −70% incoming damage and +2 AP.`;
    if (hasTalent(b, 'patience')) {
      b.resonance = Math.min(100, b.resonance + 10);
      text += ' +10 resonance.';
    }
  } else if (action === 'duet') {
    if (b.resonance < 100 || b.heroes.some((h) => !h.hp)) return original;
    b.resonance = 0;
    amount = 65;
    b.foes.forEach((f) => {
      f.hp = Math.max(0, f.hp - 65);
    });
    const recovery = hasTalent(b, 'harmony') ? 25 : 15;
    b.heroes.forEach((h) => {
      h.hp = Math.min(h.maxHp, h.hp + recovery);
    });
    text = `TWO VOICES, ONE RIVER · 65 damage to every enemy. Both allies recover ${recovery} HP.`;
  } else {
    if (!ally || !ally.hp || !b[action]) return original;
    if (ally.hp === ally.maxHp && (action === 'rice' || ally.ap === 6)) return original;
    b[action]--;
    amount = Math.min(ally.maxHp - ally.hp, action === 'rice' ? 45 : 20);
    ally.hp += amount;
    if (action === 'tea') ally.ap = 6;
    text = `${hero.name} gives ${ally.name} ${action === 'rice' ? 'a rice parcel' : 'Thai tea'}: +${amount} HP${action === 'tea' ? ' · AP restored' : ''}.`;
  }
  event(b, {
    source: hero.id,
    target: target ?? hero.id,
    kind: action === 'guard' ? 'guard' : action === 'duet' ? 'duet' : 'heal',
    value: amount,
    text,
  });
  advance(b);
  return b;
}
export function enemyIntent(b: Battle, foeId = actor(b)) {
  const foe = b.foes.find((f) => f.id === foeId && f.hp) ?? b.foes.find((f) => f.hp)!;
  const live = b.heroes.filter((h) => h.hp);
  const target = live[(b.round + b.foes.indexOf(foe) - 1) % live.length] ?? b.heroes[0];
  const heavy =
    (foe.role === 'keeper' && b.round % 3 === 0) || (foe.role === 'sentinel' && b.round % 2 === 0);
  const siphon = foe.role === 'murmur' && b.round % 2 === 0;
  const healing = foe.role === 'echo' && b.foes.some((f) => f.id !== foe.id && f.hp > 0);
  return {
    foe,
    target,
    heavy,
    siphon,
    healing,
    hint: foe.staggered
      ? 'Broken: its next turn is cancelled. Exploit the exposed opening.'
      : siphon
        ? 'An unguarded hit steals up to 2 AP. Guard, dodge, parry, or weaken the Wisp to prevent the drain.'
        : healing
          ? 'Restores up to 10 HP to its companion after attacking. Parry interrupts the healing; defeating or breaking the Echo prevents its turn.'
          : foe.role === 'sentinel'
            ? 'Armor halves word damage. Echo Lens exposes it; counters and the duet bypass armor. Heavy attacks arrive every second round.'
            : foe.role === 'keeper'
              ? 'Tidal Requiem strikes every third round. Build break to cancel it, or weaken the Keeper before the wave.'
              : foe.role === 'murmur'
                ? 'Every second round, Mist Siphon threatens your AP. Save energy or plan a guard before it arrives.'
                : 'Its companion is gone. The Echo can no longer restore another enemy.',
    damage: heavy ? (foe.role === 'sentinel' ? 34 : 38) : siphon ? 14 : foe.role === 'echo' ? 12 : 20,
    name:
      foe.role === 'sentinel'
        ? heavy
          ? 'Four Roads Converge'
          : 'Compass Sweep'
        : siphon
          ? 'Mist Siphon'
          : heavy
            ? 'Tidal Requiem'
            : foe.role === 'echo'
              ? 'Needle of Mist'
              : 'Crescent Echo',
  };
}
export type Defense = 'dodge' | 'parry' | 'block' | 'miss';
export function timingResult(kind: 'dodge' | 'parry', progress: number): Defense {
  return Number.isFinite(progress) &&
    progress >= (kind === 'parry' ? 0.79 : 0.62) &&
    progress <= (kind === 'parry' ? 0.93 : 0.98)
    ? kind
    : 'miss';
}
export function defend(original: Battle, defense: Defense): Battle {
  if (original.phase !== 'defense') return original;
  const b = copy(original),
    intent = enemyIntent(b),
    { foe, target } = intent;
  let damage = Math.max(
    1,
    Math.round(
      intent.damage * (foe.weakened ? 0.5 : 1) * (target.guard ? 0.3 : 1) * (defense === 'block' ? 0.5 : 1),
    ) - (b.ward ? 3 : 0),
  );
  if (defense === 'parry' || defense === 'dodge') damage = 0;
  const drained =
    intent.siphon && damage > 0 && !target.guard && !foe.weakened && defense !== 'block'
      ? Math.min(2, target.ap)
      : 0;
  target.ap -= drained;
  target.hp = Math.max(0, target.hp - damage);
  foe.weakened = false;
  if (defense === 'parry') {
    foe.hp = Math.max(0, foe.hp - 22);
    target.ap = Math.min(6, target.ap + 1);
    b.resonance = Math.min(100, b.resonance + 15);
  }
  // The Echo sustains its companion: focusing it down prevents future healing.
  let restored = 0;
  if (foe.role === 'echo' && foe.hp && defense !== 'parry') {
    const companion = b.foes.find((f) => f.id !== foe.id && f.hp);
    if (companion) {
      restored = Math.min(10, companion.maxHp - companion.hp);
      companion.hp += restored;
    }
  }
  event(b, {
    source: defense === 'parry' ? target.id : foe.id,
    target: defense === 'parry' ? foe.id : target.id,
    kind: defense === 'block' ? 'guard' : defense === 'miss' ? 'strike' : defense,
    value: defense === 'parry' ? 22 : damage,
    text:
      (defense === 'parry'
        ? `${target.name} PARRIES! 22 counter damage · +1 AP.`
        : defense === 'dodge'
          ? `${target.name} DODGES ${intent.name}. No damage.`
          : `${target.name} ${defense === 'block' ? 'blocks' : 'takes'} ${intent.name}: −${damage} HP.`) +
      (intent.siphon ? (drained ? ` Mist Siphon steals ${drained} AP.` : ' Mist Siphon steals no AP.') : '') +
      (intent.healing && defense === 'parry'
        ? ' Echo restoration interrupted.'
        : restored
          ? ` The Echo restores ${restored} HP to its companion.`
          : ''),
  });
  advance(b);
  return b;
}
/** Never trust stored indices/vitals. Old battles restart; adventure rewards remain untouched. */
export function restoreBattle(value: unknown, fallback: Battle): Battle {
  if (!value || typeof value !== 'object') return fallback;
  const b = value as Battle;
  if (
    b.growth !== undefined &&
    (!b.growth ||
      typeof b.growth !== 'object' ||
      !Number.isInteger(b.growth.level) ||
      b.growth.level < 1 ||
      b.growth.level > 6 ||
      JSON.stringify(normalizeTalents(b.growth.talents, b.growth.level)) !== JSON.stringify(b.growth.talents))
  )
    return fallback;
  const bounded = (n: number, max: number) => Number.isInteger(n) && n >= 0 && n <= max;
  if (
    b.version !== 2 ||
    b.id !== fallback.id ||
    !bounded(b.turn, 3) ||
    !bounded(b.round, 99999) ||
    b.round < 1 ||
    !['command', 'defense', 'victory', 'defeat'].includes(b.phase)
  )
    return fallback;
  if (
    JSON.stringify(b.order) !== JSON.stringify(fallback.order) ||
    !Array.isArray(b.heroes) ||
    b.heroes.length !== 2 ||
    !Array.isArray(b.foes) ||
    b.foes.length !== 2
  )
    return fallback;
  if (
    !b.heroes.every(
      (h, i) =>
        h?.id === fallback.heroes[i].id &&
        h.maxHp === fallback.heroes[i].maxHp &&
        bounded(h.hp, h.maxHp) &&
        bounded(h.ap, 6) &&
        typeof h.guard === 'boolean',
    )
  )
    return fallback;
  if (
    !b.foes.every(
      (f, i) =>
        f?.id === fallback.foes[i].id &&
        f.role === fallback.foes[i].role &&
        f.maxHp === fallback.foes[i].maxHp &&
        bounded(f.hp, f.maxHp) &&
        bounded(f.break, 99) &&
        ['exposed', 'staggered', 'weakened'].every((k) => typeof f[k as keyof Foe] === 'boolean'),
    )
  )
    return fallback;
  if (
    !bounded(b.resonance, 100) ||
    !bounded(b.rice, 99999) ||
    !bounded(b.tea, 99999) ||
    !b.event ||
    !bounded(b.event.seq, 999999) ||
    typeof b.event.text !== 'string' ||
    !Array.isArray(b.log) ||
    !b.log.every((t) => typeof t === 'string')
  )
    return fallback;
  if (
    (b.phase === 'command' && !activeHero(b)?.hp) ||
    (b.phase === 'defense' && !b.foes.find((f) => f.id === actor(b))?.hp) ||
    (b.phase === 'victory' && b.foes.some((f) => f.hp)) ||
    (b.phase === 'defeat' && b.heroes.some((h) => h.hp))
  )
    return fallback;
  return { ...copy(b), arts: normalizeWorldArts(fallback.arts ?? []), practice: b.practice === true, ward: fallback.ward };
}
