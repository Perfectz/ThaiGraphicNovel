import { starterScenario } from './lessonScenarios';

export type ThaiPhrase = {
  id: string;
  lesson: string;
  targetPhrase: string;
  romanization: string;
  phoneticSpelling?: string;
  translation: string;
  context: string;
  example: string;
  isHeal?: boolean;
};

export const thaiBasicsPhrases: ThaiPhrase[] = starterScenario.chunks.flatMap((chunk) => chunk.phrases);

export function getPhrasePhoneticSpelling(phrase: ThaiPhrase): string {
  return phrase.phoneticSpelling ?? phrase.romanization
    .replace(/\bkhrap\b/gi, 'krahp')
    .replace(/\bphom\b/gi, 'pohm')
    .replace(/\bphuut\b/gi, 'poot')
    .replace(/\bng\b/gi, 'ng')
    .replace(/\bchue\b/gi, 'cheu')
    .replace(/\bchuai\b/gi, 'choo-ai')
    .replace(/\byoo\b/gi, 'yoo')
    .replace(/\btee\b/gi, 'tee')
    .replace(/\bmai\b/gi, 'my')
    .replace(/\bchai\b/gi, 'chai')
    .replace(/\bkho\b/gi, 'kaw')
    .replace(/\bkhop\b/gi, 'kawp')
    .replace(/\bkhun\b/gi, 'koon')
    .replace(/\braa\b/gi, 'rah')
    .replace(/\bkhaa\b/gi, 'kah')
    .replace(/\bnaam\b/gi, 'nahm')
    .replace(/\bhiw\b/gi, 'hew')
    .replace(/\s+/g, ' ')
    .trim();
}
