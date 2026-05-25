import determinedUrl from '../assets/characters/stage-05/charm-shop-vendor/charm-shop-vendor-determined.png';
import explainingUrl from '../assets/characters/stage-05/charm-shop-vendor/charm-shop-vendor-explaining.png';
import playfulUrl from '../assets/characters/stage-05/charm-shop-vendor/charm-shop-vendor-playful.png';
import smileUrl from '../assets/characters/stage-05/charm-shop-vendor/charm-shop-vendor-smile.png';
import surprisedUrl from '../assets/characters/stage-05/charm-shop-vendor/charm-shop-vendor-surprised.png';
import worriedUrl from '../assets/characters/stage-05/charm-shop-vendor/charm-shop-vendor-worried.png';

export type CharmShopVendorReaction =
  | 'smile'
  | 'explaining'
  | 'surprised'
  | 'worried'
  | 'determined'
  | 'playful';

export const charmShopVendorReactions: Record<CharmShopVendorReaction, string> = {
  smile: smileUrl,
  explaining: explainingUrl,
  surprised: surprisedUrl,
  worried: worriedUrl,
  determined: determinedUrl,
  playful: playfulUrl,
};
