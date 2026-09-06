import type { BattleInventory } from '../data/phantasyBattleCommands';

/**
 * Session-scoped battle vitals — carries Patrick's Confidence (HP), Focus
 * (MP), and item inventory BETWEEN story duels, classic-RPG style: win the
 * Su trial battered and you walk up to the hostess battered, items spent
 * stay spent.
 *
 * Deliberately in-memory only (not saved to disk): a stage replay or page
 * reload starts fresh, and the /battle-demo route never touches it
 * (encounters opt in via `persistVitals`).
 */

export type BattleVitals = {
  hp: number;
  mp: number;
  inventory: BattleInventory;
};

let carried: BattleVitals | null = null;

/**
 * Floor carried Confidence at 25% of max so a narrow win never makes the
 * next duel hopeless on arrival — soft defeat handles the rest.
 */
export function loadBattleVitals(maxHp: number, maxMp: number): BattleVitals | null {
  if (!carried) return null;
  return {
    hp: Math.min(maxHp, Math.max(Math.round(maxHp * 0.25), carried.hp)),
    mp: Math.min(maxMp, Math.max(Math.round(maxMp * 0.2), carried.mp)),
    inventory: { ...carried.inventory },
  };
}

export function saveBattleVitals(vitals: BattleVitals) {
  carried = { ...vitals, inventory: { ...vitals.inventory } };
}

/** Hard reset — new game / explicit restart. */
export function resetBattleVitals() {
  carried = null;
  lastStageNumber = null;
}

let lastStageNumber: number | null = null;

/**
 * Called when a stage mounts. Campaign continuity: advancing to the NEXT
 * stage keeps Patrick's Confidence/Focus/items (one adventuring day, not
 * three separate sessions); replaying or jumping stages starts fresh.
 */
export function enterStageForVitals(stageNumber: number) {
  if (lastStageNumber !== null && stageNumber === lastStageNumber + 1) {
    lastStageNumber = stageNumber;
    return;
  }
  carried = null;
  lastStageNumber = stageNumber;
}
