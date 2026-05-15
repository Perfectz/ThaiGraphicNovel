export type GridPosition = {
  x: number;
  y: number;
};

export type TileType = 'marble' | 'carpet' | 'wood' | 'runner';

export type LobbyProp = {
  id: string;
  type: 'frontDesk' | 'couch' | 'plant' | 'luggage' | 'lamp' | 'elevatorRift';
  position: GridPosition;
  rotation?: number;
};

export const MAP_SIZE = 8;

export const startPosition: GridPosition = { x: 3, y: 5 };
export const suPosition: GridPosition = { x: 4, y: 5 };
export const suEntrancePosition: GridPosition = { x: 6, y: 2 };
export const portalPosition: GridPosition = { x: 3, y: 1 };

export const tileMap: TileType[][] = [
  ['wood', 'wood', 'wood', 'runner', 'runner', 'wood', 'wood', 'wood'],
  ['wood', 'marble', 'marble', 'runner', 'runner', 'marble', 'marble', 'wood'],
  ['wood', 'marble', 'marble', 'carpet', 'carpet', 'marble', 'marble', 'wood'],
  ['wood', 'marble', 'carpet', 'carpet', 'carpet', 'carpet', 'marble', 'wood'],
  ['wood', 'marble', 'carpet', 'carpet', 'carpet', 'carpet', 'marble', 'wood'],
  ['wood', 'marble', 'marble', 'carpet', 'carpet', 'marble', 'marble', 'wood'],
  ['wood', 'marble', 'marble', 'runner', 'runner', 'marble', 'marble', 'wood'],
  ['wood', 'wood', 'wood', 'runner', 'runner', 'wood', 'wood', 'wood'],
];

export const lobbyProps: LobbyProp[] = [
  { id: 'front-desk', type: 'frontDesk', position: { x: 3, y: 1 } },
  { id: 'wakeup-couch', type: 'couch', position: { x: 2, y: 5 }, rotation: Math.PI / 2 },
  { id: 'left-plant', type: 'plant', position: { x: 1, y: 2 } },
  { id: 'right-plant', type: 'plant', position: { x: 6, y: 2 } },
  { id: 'bell-lamp-left', type: 'lamp', position: { x: 1, y: 6 } },
  { id: 'bell-lamp-right', type: 'lamp', position: { x: 6, y: 6 } },
  { id: 'patrick-luggage', type: 'luggage', position: { x: 3, y: 6 }, rotation: -0.35 },
  { id: 'elevator-rift', type: 'elevatorRift', position: portalPosition },
];

export function tileToWorld(position: GridPosition): [number, number, number] {
  const centerOffset = (MAP_SIZE - 1) / 2;
  return [(position.x - centerOffset) * 1.18, 0, (position.y - centerOffset) * 1.18];
}
