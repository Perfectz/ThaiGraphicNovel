import chaiKhrapAudio from '../assets/audio/legacy-phrases/chai khrap.mp3';
import bathroomWhereAudio from '../assets/audio/legacy-phrases/hong nam yoo tee nai khrap.mp3';
import sorryAudio from '../assets/audio/legacy-phrases/kho thot khrap.mp3';
import thankYouAudio from '../assets/audio/legacy-phrases/khop khun khrap.mp3';
import noAudio from '../assets/audio/legacy-phrases/mai chai khrap.mp3';
import myNameIsPatrickAudio from '../assets/audio/legacy-phrases/phom chue Patrick khrap.mp3';
import iAmThirstyAudio from '../assets/audio/legacy-phrases/phom hiw naam khrap.mp3';
import howMuchAudio from '../assets/audio/legacy-phrases/raa khaa tao rai khrap.mp3';
import helloAudio from '../assets/audio/legacy-phrases/sawatdee khrap.mp3';
import niceToMeetYouAudio from '../assets/audio/legacy-phrases/yin dee tee dai roo jak khrap.mp3';
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
