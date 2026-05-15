import determinedUrl from '../assets/characters/su-reactions/su-determined.png';
import explainingUrl from '../assets/characters/su-reactions/su-explaining.png';
import playfulUrl from '../assets/characters/su-reactions/su-playful.png';
import smileUrl from '../assets/characters/su-reactions/su-smile.png';
import surprisedUrl from '../assets/characters/su-reactions/su-surprised.png';
import worriedUrl from '../assets/characters/su-reactions/su-worried.png';

export type SuReaction = 'smile' | 'explaining' | 'surprised' | 'worried' | 'determined' | 'playful';

export const suReactions: Record<SuReaction, string> = {
  smile: smileUrl,
  explaining: explainingUrl,
  surprised: surprisedUrl,
  worried: worriedUrl,
  determined: determinedUrl,
  playful: playfulUrl,
};
