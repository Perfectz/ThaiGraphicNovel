import determinedUrl from '../assets/characters/stage-03/street-food-vendor/street-food-vendor-determined.png';
import explainingUrl from '../assets/characters/stage-03/street-food-vendor/street-food-vendor-explaining.png';
import playfulUrl from '../assets/characters/stage-03/street-food-vendor/street-food-vendor-playful.png';
import smileUrl from '../assets/characters/stage-03/street-food-vendor/street-food-vendor-smile.png';
import surprisedUrl from '../assets/characters/stage-03/street-food-vendor/street-food-vendor-surprised.png';
import worriedUrl from '../assets/characters/stage-03/street-food-vendor/street-food-vendor-worried.png';

export type StreetFoodVendorReaction =
  | 'smile'
  | 'explaining'
  | 'surprised'
  | 'worried'
  | 'determined'
  | 'playful';

export const streetFoodVendorReactions: Record<StreetFoodVendorReaction, string> = {
  smile: smileUrl,
  explaining: explainingUrl,
  surprised: surprisedUrl,
  worried: worriedUrl,
  determined: determinedUrl,
  playful: playfulUrl,
};
