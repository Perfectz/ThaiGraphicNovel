import riftGuardianModelUrl from '../../assets/battle/models/rift-guardian.glb?url';

/**
 * The Rift Guardian boss is a static Meshy export with no baked animation
 * clips, so unlike the hero rigs it exposes only a model URL. The battle stage
 * animates it procedurally (idle bob, hurt recoil, cast pulse, defeat topple)
 * by transforming the loaded group directly.
 */
export const riftGuardianModelAssetUrl = riftGuardianModelUrl;

/** Authored stage height for the boss, in metres. It towers over the heroes. */
export const riftGuardianHeight = 3.2;
