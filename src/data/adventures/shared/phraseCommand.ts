import type { ThaiPhrase } from '../../thaiPhrases';
import type { AdventureCommand, AdventureVerb } from '../types';

/**
 * Builds an AdventureCommand from one of the lesson scenario's ThaiPhrase entries.
 * The phrase text is used as the spoken target; success/blocked text and inventory
 * effects are layered on top.
 */
export function phraseCommand(
  verb: AdventureVerb,
  label: string,
  phrase: ThaiPhrase,
  successText: string,
  extras: Partial<
    Pick<
      AdventureCommand,
      | 'blockedText'
      | 'characterVoice'
      | 'conversationBlockedText'
      | 'givesItem'
      | 'requiresItems'
      | 'requiresConversation'
      | 'conversationId'
      | 'conversation'
      | 'conversationCompleteText'
      | 'completesAdventure'
      | 'entersRoom'
      | 'recapDrill'
      | 'battleEncounterId'
      | 'entersStageIndex'
    >
  > = {},
): AdventureCommand {
  return {
    verb,
    label,
    phraseId: phrase.id,
    targetPhrase: phrase.targetPhrase,
    romanization: phrase.romanization,
    phoneticSpelling: phrase.phoneticSpelling ?? phrase.romanization,
    translation: phrase.translation,
    successText,
    ...extras,
  };
}

/**
 * Builds an AdventureCommand from a raw set of phrase fields. Use when a stage
 * needs a hotspot for a sentence not present in the lesson scenario phrases.
 */
export function customPhraseCommand(
  verb: AdventureVerb,
  label: string,
  targetPhrase: string,
  romanization: string,
  phoneticSpelling: string,
  translation: string,
  successText: string,
  extras: Partial<
    Pick<
      AdventureCommand,
      | 'blockedText'
      | 'characterVoice'
      | 'conversationBlockedText'
      | 'givesItem'
      | 'requiresItems'
      | 'requiresConversation'
      | 'conversationId'
      | 'conversation'
      | 'conversationCompleteText'
      | 'completesAdventure'
      | 'entersRoom'
      | 'recapDrill'
      | 'battleEncounterId'
      | 'entersStageIndex'
    >
  > = {},
): AdventureCommand {
  return {
    verb,
    label,
    targetPhrase,
    romanization,
    phoneticSpelling,
    translation,
    successText,
    ...extras,
  };
}
