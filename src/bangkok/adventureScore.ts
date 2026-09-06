import type { CityArea } from './city.ts';
export type ScoreTheme = 'hotel' | 'street' | 'market' | 'journey';
export function adventureScore(area: CityArea | null, screen: string): ScoreTheme | null {
  if (screen === 'title' || screen === 'crossing' || screen === 'ending') return 'journey';
  if (screen === 'battle') return 'market';
  if (!area) return null;
  return {
    hotel: 'hotel',
    sukhumvit: 'street',
    lumphini: 'hotel',
    yaowarat: 'market',
    riverside: 'street',
    oldtown: 'journey',
  }[area] as ScoreTheme;
}
