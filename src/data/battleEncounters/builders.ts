import {
  buildBattleMove,
  type BattleElement,
  type ConversationTurn,
} from '../phantasyBattleDemo';

/**
 * Shared factory for social-duel rounds. Every stage encounter describes its
 * rounds as DuelRoundSpec (phrases + NPC press lines) and gets the full
 * five-technique ConversationTurn (simple/super/heal/defend/counter) with
 * consistent power/MP tuning:
 *
 *   simple  = short phrase, modest damage (the "Attack" slot)
 *   super   = longer/combined phrase, big damage + charge
 *   counter = the forced reply when the NPC presses between rounds
 *   heal    = re-saying the round's phrase slowly restores Confidence
 *   defend  = a clean polite "khrap" braces for the next press
 */

export type DuelRoundSpec = {
  id: string;
  topic: string;
  enemyLine: string;
  simple: { name: string; thai: string; rom: string; en: string; cry: string };
  superMove: { name: string; thai: string; rom: string; en: string; cry: string };
  counter: { thai: string; rom: string; en: string; prompt: string };
};

export function duelTurn(index: number, spec: DuelRoundSpec, element: BattleElement): ConversationTurn {
  return {
    id: spec.id,
    turnNo: index + 1,
    topic: spec.topic,
    enemyLine: spec.enemyLine,
    simple: buildBattleMove(
      index,
      'standard',
      `${spec.id}-simple`,
      spec.simple.name,
      spec.simple.thai,
      spec.simple.rom,
      spec.simple.en,
      22,
      0,
      element,
      'Short and clear. Easy to say, modest impression.',
      spec.simple.cry,
      `Say: ${spec.simple.rom}`,
    ),
    super: buildBattleMove(
      index,
      'super',
      `${spec.id}-super`,
      spec.superMove.name,
      spec.superMove.thai,
      spec.superMove.rom,
      spec.superMove.en,
      44,
      10,
      'fire',
      'A longer line. Harder to land, much stronger when scored well.',
      spec.superMove.cry,
      `Say: ${spec.superMove.rom}`,
    ),
    heal: buildBattleMove(
      index,
      'heal',
      `${spec.id}-heal`,
      'Slow Repetition',
      spec.simple.thai,
      spec.simple.rom,
      spec.simple.en,
      26,
      8,
      'holy',
      'Repeat the phrase slowly and carefully to recover Confidence.',
      'One more time, slowly…',
      `Repeat slowly: ${spec.simple.rom}`,
    ),
    defend: buildBattleMove(
      index,
      'defend',
      `${spec.id}-defend`,
      'Polite Stance',
      'ครับ',
      'khrap',
      'Yes (polite particle)',
      0,
      0,
      'wind',
      'A composed, polite acknowledgment. Braces against the next press.',
      'Khrap.',
      'Say: khrap',
    ),
    counter: buildBattleMove(
      index,
      'counter',
      `${spec.id}-counter`,
      'Forced Reply',
      spec.counter.thai,
      spec.counter.rom,
      spec.counter.en,
      18,
      0,
      'shadow',
      spec.counter.prompt,
      spec.counter.thai,
      spec.counter.prompt,
    ),
  };
}

/** Default Patrick stats shared by story duels. */
export const STORY_HERO = {
  id: 'patrick',
  name: 'Patrick',
  subtitle: 'Beginner Thai Speaker',
  hp: 220,
  maxHp: 220,
  mp: 90,
  maxMp: 90,
};
