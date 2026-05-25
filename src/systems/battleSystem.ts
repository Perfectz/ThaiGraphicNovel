import { getPhrasePhoneticSpelling, type ThaiPhrase } from '../data/thaiPhrases';

export type BattleOption = 'Speak Phrase' | 'Hear Example' | 'Try Previous Phrase Again' | 'Skip Phrase';

export type BattleResult = {
  confidenceDamage: number;
  courageDelta: number;
  shouldAdvancePhrase: boolean;
  playerText: string;
  enemyText: string;
};

export type PronunciationBattleResult = {
  score: number;
  pass: boolean;
  heard: string;
  feedback: string;
  tip: string;
};

export function resolveBattleTurn(option: BattleOption, phrase: ThaiPhrase): BattleResult {
  switch (option) {
    case 'Speak Phrase':
      return {
        confidenceDamage: 0,
        courageDelta: 0,
        shouldAdvancePhrase: false,
        playerText: `Patrick focuses on "${phrase.targetPhrase}".`,
        enemyText:
          'Su points to the mic button. Say it out loud so the language magic can judge your pronunciation.',
      };
    case 'Hear Example':
      return {
        confidenceDamage: 0,
        courageDelta: 1,
        shouldAdvancePhrase: false,
        playerText: 'Patrick listens carefully while Su repeats the rhythm.',
        enemyText: `Su says: ${phrase.romanization}. Phonetic: ${getPhrasePhoneticSpelling(phrase)}. Keep the ending polite with khrap.`,
      };
    case 'Try Previous Phrase Again':
      return {
        confidenceDamage: 0,
        courageDelta: 0,
        shouldAdvancePhrase: false,
        playerText: 'Patrick asks to review the previous phrase.',
        enemyText: 'Su rewinds the lesson for one practice attempt. Review does not advance the trial.',
      };
    case 'Skip Phrase':
      return {
        confidenceDamage: 0,
        courageDelta: -2,
        shouldAdvancePhrase: false,
        playerText: `Patrick skips "${phrase.translation}".`,
        enemyText:
          'Su lets the lesson move on, but no Understanding or Super charge is earned for this phrase.',
      };
  }
}

export function resolvePronunciationTurn(
  result: PronunciationBattleResult,
  phrase: ThaiPhrase,
): BattleResult {
  if (!result.pass) {
    return {
      confidenceDamage: 0,
      courageDelta: -4,
      shouldAdvancePhrase: false,
      playerText: `Patrick tries "${phrase.targetPhrase}" but scores ${result.score}/100.`,
      enemyText: result.tip || 'Su suggests slowing down and trying the rhythm again.',
    };
  }

  const confidenceDamage = 10;
  // courageDelta depends on the phrase's mechanical effect:
  //   - 'heal'        restores a chunk of Courage (used for needs-phrasing like "I'm thirsty")
  //   - 'damage'      penalises Courage (rude phrasing the player should learn to avoid)
  //   - 'reveal-hint' is purely informational; it advances and grants a neutral tick
  //   - undefined     baseline +1 tick
  const courageDelta = phrase.phraseEffect === 'heal' ? 8 : phrase.phraseEffect === 'damage' ? -3 : 1;

  return {
    confidenceDamage,
    courageDelta,
    shouldAdvancePhrase: true,
    playerText: `Patrick says "${phrase.targetPhrase}" clearly enough for ${result.score}/100 pronunciation.`,
    enemyText: result.feedback || 'Su nods. The phrase lands clearly and the lesson advances.',
  };
}
