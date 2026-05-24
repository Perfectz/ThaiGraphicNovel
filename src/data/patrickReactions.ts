import determinedUrl from '../assets/characters/patrick-reactions/patrick-determined.png';
import explainingUrl from '../assets/characters/patrick-reactions/patrick-explaining.png';
import playfulUrl from '../assets/characters/patrick-reactions/patrick-playful.png';
import smileUrl from '../assets/characters/patrick-reactions/patrick-smile.png';
import surprisedUrl from '../assets/characters/patrick-reactions/patrick-surprised.png';
import worriedUrl from '../assets/characters/patrick-reactions/patrick-worried.png';

export type PatrickReaction = 'smile' | 'explaining' | 'surprised' | 'worried' | 'determined' | 'playful';

export const patrickReactions: Record<PatrickReaction, string> = {
  smile: smileUrl,
  explaining: explainingUrl,
  surprised: surprisedUrl,
  worried: worriedUrl,
  determined: determinedUrl,
  playful: playfulUrl,
};
