import chaiKhrapAudio from '../../humandropbox/chai khrap.mp3';
import bathroomWhereAudio from '../../humandropbox/hong nam yoo tee nai khrap.mp3';
import sorryAudio from '../../humandropbox/kho thot khrap.mp3';
import thankYouAudio from '../../humandropbox/khop khun khrap.mp3';
import noAudio from '../../humandropbox/mai chai khrap.mp3';
import myNameIsPatrickAudio from '../../humandropbox/phom chue Patrick khrap.mp3';
import iAmThirstyAudio from '../../humandropbox/phom hiw naam khrap.mp3';
import howMuchAudio from '../../humandropbox/raa khaa tao rai khrap.mp3';
import helloAudio from '../../humandropbox/sawatdee khrap.mp3';
import niceToMeetYouAudio from '../../humandropbox/yin dee tee dai roo jak khrap.mp3';
import { type ThaiPhrase } from '../data/thaiPhrases';
import { generatedPhraseAudioById } from '../generated/conversationAudioManifest';

const phraseAudioById: Partial<Record<string, string>> = {
  hello: helloAudio,
  'my-name-is-patrick': myNameIsPatrickAudio,
  'nice-to-meet-you': niceToMeetYouAudio,
  'thank-you': thankYouAudio,
  sorry: sorryAudio,
  yes: chaiKhrapAudio,
  no: noAudio,
  'how-much': howMuchAudio,
  'bathroom-where': bathroomWhereAudio,
  'i-am-thirsty': iAmThirstyAudio,
};

export function getPhraseAudioSrc(phrase: ThaiPhrase): string | undefined {
  return generatedPhraseAudioById[phrase.id] ?? phraseAudioById[phrase.id];
}
