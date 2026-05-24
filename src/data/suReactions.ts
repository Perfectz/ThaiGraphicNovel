import determinedUrl from '../assets/characters/su-reactions/su-determined.png';
import explainingUrl from '../assets/characters/su-reactions/su-explaining.png';
import playfulUrl from '../assets/characters/su-reactions/su-playful.png';
import smileUrl from '../assets/characters/su-reactions/su-smile.png';
import surprisedUrl from '../assets/characters/su-reactions/su-surprised.png';
import worriedUrl from '../assets/characters/su-reactions/su-worried.png';
import excellentUrl from '../assets/characters/su-stage/su-stage-excellent.png';
import failureUrl from '../assets/characters/su-stage/su-stage-failure.png';
import greatUrl from '../assets/characters/su-stage/su-stage-great.png';
import listeningUrl from '../assets/characters/su-stage/su-stage-listening.png';
import tryHarderUrl from '../assets/characters/su-stage/su-stage-try-harder.png';

export type SuReaction =
  | 'smile'
  | 'explaining'
  | 'surprised'
  | 'worried'
  | 'determined'
  | 'playful'
  | 'listening'
  | 'great'
  | 'excellent'
  | 'tryHarder'
  | 'failure';

export const suReactions: Record<SuReaction, string> = {
  smile: smileUrl,
  explaining: explainingUrl,
  surprised: surprisedUrl,
  worried: worriedUrl,
  determined: determinedUrl,
  playful: playfulUrl,
  listening: listeningUrl,
  great: greatUrl,
  excellent: excellentUrl,
  tryHarder: tryHarderUrl,
  failure: failureUrl,
};
