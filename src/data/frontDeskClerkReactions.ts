import determinedUrl from '../assets/characters/stage-02/front-desk-clerk/front-desk-clerk-determined.png';
import explainingUrl from '../assets/characters/stage-02/front-desk-clerk/front-desk-clerk-explaining.png';
import playfulUrl from '../assets/characters/stage-02/front-desk-clerk/front-desk-clerk-playful.png';
import smileUrl from '../assets/characters/stage-02/front-desk-clerk/front-desk-clerk-smile.png';
import surprisedUrl from '../assets/characters/stage-02/front-desk-clerk/front-desk-clerk-surprised.png';
import worriedUrl from '../assets/characters/stage-02/front-desk-clerk/front-desk-clerk-worried.png';

export type FrontDeskClerkReaction = 'smile' | 'explaining' | 'surprised' | 'worried' | 'determined' | 'playful';

export const frontDeskClerkReactions: Record<FrontDeskClerkReaction, string> = {
  smile: smileUrl,
  explaining: explainingUrl,
  surprised: surprisedUrl,
  worried: worriedUrl,
  determined: determinedUrl,
  playful: playfulUrl,
};
