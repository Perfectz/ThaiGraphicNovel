import type { GridPosition } from '../data/map';

export type SaveData = {
  hasStarted: boolean;
  completedTutorial: boolean;
  activeScenarioIndex?: number;
  completedScenarioIds?: string[];
  lastPlayerPosition: GridPosition;
};

const STORAGE_KEY = 'isekai-thai-quest-save-v1';

export function loadSave(): SaveData | null {
  if (typeof window === 'undefined') return null;

  try {
    const rawSave = window.localStorage.getItem(STORAGE_KEY);
    if (!rawSave) return null;
    const parsed = JSON.parse(rawSave) as SaveData;

    if (
      typeof parsed.hasStarted !== 'boolean' ||
      typeof parsed.completedTutorial !== 'boolean' ||
      typeof parsed.lastPlayerPosition?.x !== 'number' ||
      typeof parsed.lastPlayerPosition?.y !== 'number' ||
      (parsed.activeScenarioIndex !== undefined && typeof parsed.activeScenarioIndex !== 'number') ||
      (parsed.completedScenarioIds !== undefined && !Array.isArray(parsed.completedScenarioIds))
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function writeSave(saveData: SaveData): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
}

export function clearSave(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}
