import type { BattleEncounterConfig } from '../phantasyBattleDemo';
import { hostessCheckInEncounter, suLobbySparringEncounter, touristFriendlyDuel } from './stage01';
import { clerkCheckInEncounter } from './stage02';
import { riftEchoEncounter, vendorOrderEncounter } from './stage03';

/**
 * Registry of story battle encounters. Talk commands reference these by id
 * (`battleEncounterId`); Stage3DAdventure resolves them here and stages the
 * fight on the turn-based battle screen.
 */
const ENCOUNTERS_BY_ID: Record<string, BattleEncounterConfig> = {
  [suLobbySparringEncounter.id]: suLobbySparringEncounter,
  [hostessCheckInEncounter.id]: hostessCheckInEncounter,
  [clerkCheckInEncounter.id]: clerkCheckInEncounter,
  [vendorOrderEncounter.id]: vendorOrderEncounter,
  [riftEchoEncounter.id]: riftEchoEncounter,
  [touristFriendlyDuel.id]: touristFriendlyDuel,
};

export function getBattleEncounter(id: string): BattleEncounterConfig | null {
  return ENCOUNTERS_BY_ID[id] ?? null;
}
