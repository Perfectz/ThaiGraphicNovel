import determinedUrl from '../assets/characters/stage-04/taxi-driver/taxi-driver-determined.png';
import explainingUrl from '../assets/characters/stage-04/taxi-driver/taxi-driver-explaining.png';
import playfulUrl from '../assets/characters/stage-04/taxi-driver/taxi-driver-playful.png';
import smileUrl from '../assets/characters/stage-04/taxi-driver/taxi-driver-smile.png';
import surprisedUrl from '../assets/characters/stage-04/taxi-driver/taxi-driver-surprised.png';
import worriedUrl from '../assets/characters/stage-04/taxi-driver/taxi-driver-worried.png';

export type TaxiDriverReaction = 'smile' | 'explaining' | 'surprised' | 'worried' | 'determined' | 'playful';

export const taxiDriverReactions: Record<TaxiDriverReaction, string> = {
  smile: smileUrl,
  explaining: explainingUrl,
  surprised: surprisedUrl,
  worried: worriedUrl,
  determined: determinedUrl,
  playful: playfulUrl,
};
