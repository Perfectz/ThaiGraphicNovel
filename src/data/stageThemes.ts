import hotelLobbyBackgroundUrl from '../assets/ui/hotel-lobby-background.png';
import clinicAndPharmacyBackgroundUrl from '../assets/backgrounds/clinic-and-pharmacy.png';
import directionsEmergencyBackgroundUrl from '../assets/backgrounds/directions-emergency-alley.png';
import formalMeetingBackgroundUrl from '../assets/backgrounds/formal-meeting-archive.png';
import friendshipPlansBackgroundUrl from '../assets/backgrounds/friendship-plans-cafe.png';
import frontDeskBackgroundUrl from '../assets/backgrounds/front-desk-check-in.png';
import marketBargainBackgroundUrl from '../assets/backgrounds/market-bargain-charm-shop.png';
import riftNegotiationBackgroundUrl from '../assets/backgrounds/rift-negotiation-temple-gate.png';
import streetFoodBackgroundUrl from '../assets/backgrounds/street-food-order.png';
import taxiRideBackgroundUrl from '../assets/backgrounds/taxi-ride-sukhumvit.png';
import { lessonScenarios } from './lessonScenarios';
import type { TileType } from './map';

export type StageTheme = {
  scenarioId: string;
  sceneName: string;
  routeLabel: string;
  nextRouteLabel: string;
  backgroundImage: string;
  background: string;
  wall: string;
  backWall: string;
  sign: string;
  rift: string;
  tilePalette: Record<TileType, { color: string; accent: string; height: number }>;
};

const sharedHeight = {
  marble: 0.16,
  carpet: 0.18,
  wood: 0.18,
  runner: 0.19,
};

export const stageThemes: StageTheme[] = [
  {
    scenarioId: 'hotel-lobby-basics',
    sceneName: 'Chao Phraya Star Hotel',
    routeLabel: 'Lobby',
    nextRouteLabel: 'Front desk',
    backgroundImage: hotelLobbyBackgroundUrl,
    background: '#fef3c7',
    wall: '#fbbf24',
    backWall: '#f7c56b',
    sign: '#7c2d12',
    rift: '#a78bfa',
    tilePalette: {
      marble: { color: '#f8e7bd', accent: '#e8c98f', height: sharedHeight.marble },
      carpet: { color: '#dc3b4d', accent: '#f7b267', height: sharedHeight.carpet },
      wood: { color: '#9a5a2d', accent: '#63361e', height: sharedHeight.wood },
      runner: { color: '#2563eb', accent: '#facc15', height: sharedHeight.runner },
    },
  },
  {
    scenarioId: 'front-desk-check-in',
    sceneName: 'Front Desk Check-in',
    routeLabel: 'Reception',
    nextRouteLabel: 'Night market',
    backgroundImage: frontDeskBackgroundUrl,
    background: '#e0f2fe',
    wall: '#38bdf8',
    backWall: '#bae6fd',
    sign: '#075985',
    rift: '#22d3ee',
    tilePalette: {
      marble: { color: '#e0f2fe', accent: '#7dd3fc', height: sharedHeight.marble },
      carpet: { color: '#facc15', accent: '#0f766e', height: sharedHeight.carpet },
      wood: { color: '#92400e', accent: '#451a03', height: sharedHeight.wood },
      runner: { color: '#0f766e', accent: '#fde68a', height: sharedHeight.runner },
    },
  },
  {
    scenarioId: 'street-food-order',
    sceneName: 'Night Market Food Stall',
    routeLabel: 'Food row',
    nextRouteLabel: 'Taxi stand',
    backgroundImage: streetFoodBackgroundUrl,
    background: '#111827',
    wall: '#7c2d12',
    backWall: '#991b1b',
    sign: '#f97316',
    rift: '#fb7185',
    tilePalette: {
      marble: { color: '#fed7aa', accent: '#fb923c', height: sharedHeight.marble },
      carpet: { color: '#ef4444', accent: '#fde047', height: sharedHeight.carpet },
      wood: { color: '#78350f', accent: '#f97316', height: sharedHeight.wood },
      runner: { color: '#16a34a', accent: '#fef08a', height: sharedHeight.runner },
    },
  },
  {
    scenarioId: 'taxi-ride',
    sceneName: 'Taxi Ride Across Bangkok',
    routeLabel: 'Taxi stand',
    nextRouteLabel: 'Floating market',
    backgroundImage: taxiRideBackgroundUrl,
    background: '#fef9c3',
    wall: '#facc15',
    backWall: '#fde047',
    sign: '#111827',
    rift: '#60a5fa',
    tilePalette: {
      marble: { color: '#e5e7eb', accent: '#9ca3af', height: sharedHeight.marble },
      carpet: { color: '#facc15', accent: '#111827', height: sharedHeight.carpet },
      wood: { color: '#374151', accent: '#f59e0b', height: sharedHeight.wood },
      runner: { color: '#1d4ed8', accent: '#fef08a', height: sharedHeight.runner },
    },
  },
  {
    scenarioId: 'market-bargain',
    sceneName: 'Floating Market Charm Shop',
    routeLabel: 'Charm shop',
    nextRouteLabel: 'Pharmacy',
    backgroundImage: marketBargainBackgroundUrl,
    background: '#ccfbf1',
    wall: '#14b8a6',
    backWall: '#99f6e4',
    sign: '#134e4a',
    rift: '#2dd4bf',
    tilePalette: {
      marble: { color: '#d9f99d', accent: '#84cc16', height: sharedHeight.marble },
      carpet: { color: '#fb7185', accent: '#fef3c7', height: sharedHeight.carpet },
      wood: { color: '#a16207', accent: '#713f12', height: sharedHeight.wood },
      runner: { color: '#0891b2', accent: '#fef08a', height: sharedHeight.runner },
    },
  },
  {
    scenarioId: 'clinic-and-pharmacy',
    sceneName: 'Neighborhood Pharmacy',
    routeLabel: 'Pharmacy',
    nextRouteLabel: 'Riverside cafe',
    backgroundImage: clinicAndPharmacyBackgroundUrl,
    background: '#ecfdf5',
    wall: '#34d399',
    backWall: '#bbf7d0',
    sign: '#065f46',
    rift: '#22c55e',
    tilePalette: {
      marble: { color: '#dcfce7', accent: '#86efac', height: sharedHeight.marble },
      carpet: { color: '#f0fdf4', accent: '#16a34a', height: sharedHeight.carpet },
      wood: { color: '#94a3b8', accent: '#475569', height: sharedHeight.wood },
      runner: { color: '#0d9488', accent: '#ffffff', height: sharedHeight.runner },
    },
  },
  {
    scenarioId: 'friendship-plans',
    sceneName: 'Riverside Cafe',
    routeLabel: 'Cafe table',
    nextRouteLabel: 'Lost alley',
    backgroundImage: friendshipPlansBackgroundUrl,
    background: '#fce7f3',
    wall: '#f472b6',
    backWall: '#fbcfe8',
    sign: '#831843',
    rift: '#e879f9',
    tilePalette: {
      marble: { color: '#fdf2f8', accent: '#f9a8d4', height: sharedHeight.marble },
      carpet: { color: '#f472b6', accent: '#fef3c7', height: sharedHeight.carpet },
      wood: { color: '#7c2d12', accent: '#f9a8d4', height: sharedHeight.wood },
      runner: { color: '#0ea5e9', accent: '#fef08a', height: sharedHeight.runner },
    },
  },
  {
    scenarioId: 'directions-and-emergency',
    sceneName: 'Lost Alley Near the Shrine',
    routeLabel: 'Lost alley',
    nextRouteLabel: 'Embassy archive',
    backgroundImage: directionsEmergencyBackgroundUrl,
    background: '#dbeafe',
    wall: '#475569',
    backWall: '#1e293b',
    sign: '#f8fafc',
    rift: '#f43f5e',
    tilePalette: {
      marble: { color: '#cbd5e1', accent: '#94a3b8', height: sharedHeight.marble },
      carpet: { color: '#dc2626', accent: '#fef2f2', height: sharedHeight.carpet },
      wood: { color: '#334155', accent: '#0f172a', height: sharedHeight.wood },
      runner: { color: '#f97316', accent: '#f8fafc', height: sharedHeight.runner },
    },
  },
  {
    scenarioId: 'formal-meeting',
    sceneName: 'Embassy Archive',
    routeLabel: 'Archive hall',
    nextRouteLabel: 'Temple gate',
    backgroundImage: formalMeetingBackgroundUrl,
    background: '#eef2ff',
    wall: '#818cf8',
    backWall: '#c7d2fe',
    sign: '#312e81',
    rift: '#6366f1',
    tilePalette: {
      marble: { color: '#eef2ff', accent: '#a5b4fc', height: sharedHeight.marble },
      carpet: { color: '#4338ca', accent: '#fef3c7', height: sharedHeight.carpet },
      wood: { color: '#4c1d95', accent: '#312e81', height: sharedHeight.wood },
      runner: { color: '#64748b', accent: '#f8fafc', height: sharedHeight.runner },
    },
  },
  {
    scenarioId: 'rift-negotiation',
    sceneName: 'Temple Gate Under the Rift',
    routeLabel: 'Temple gate',
    nextRouteLabel: 'Campaign clear',
    backgroundImage: riftNegotiationBackgroundUrl,
    background: '#1f2937',
    wall: '#b45309',
    backWall: '#92400e',
    sign: '#fef3c7',
    rift: '#facc15',
    tilePalette: {
      marble: { color: '#fef3c7', accent: '#f59e0b', height: sharedHeight.marble },
      carpet: { color: '#7f1d1d', accent: '#facc15', height: sharedHeight.carpet },
      wood: { color: '#451a03', accent: '#f97316', height: sharedHeight.wood },
      runner: { color: '#581c87', accent: '#fef08a', height: sharedHeight.runner },
    },
  },
];

export function getStageTheme(scenarioIndex: number): StageTheme {
  const scenario = lessonScenarios[scenarioIndex] ?? lessonScenarios[0];
  return stageThemes.find((theme) => theme.scenarioId === scenario.id) ?? stageThemes[0];
}
