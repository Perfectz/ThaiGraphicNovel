import { MAP_SIZE, type GridPosition } from '../data/map';

export function isSamePosition(a: GridPosition, b: GridPosition): boolean {
  return a.x === b.x && a.y === b.y;
}

export function isInsideMap(position: GridPosition): boolean {
  return position.x >= 0 && position.x < MAP_SIZE && position.y >= 0 && position.y < MAP_SIZE;
}

export function getNextGridStep(current: GridPosition, target: GridPosition): GridPosition {
  if (isSamePosition(current, target)) return current;

  if (current.x !== target.x) {
    return { x: current.x + Math.sign(target.x - current.x), y: current.y };
  }

  return { x: current.x, y: current.y + Math.sign(target.y - current.y) };
}
