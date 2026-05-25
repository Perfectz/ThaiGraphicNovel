import waveAnimationUrl from '../../assets/debug/bellboy-rig/Meshy_AI_Azure_Vanguard_biped/Meshy_AI_Azure_Vanguard_biped_Animation_Big_Wave_Hello_withSkin.glb?url';
import runningAnimationUrl from '../../assets/debug/bellboy-rig/Meshy_AI_Azure_Vanguard_biped/Meshy_AI_Azure_Vanguard_biped_Animation_Running_withSkin.glb?url';
import talkAnimationUrl from '../../assets/debug/bellboy-rig/Meshy_AI_Azure_Vanguard_biped/Meshy_AI_Azure_Vanguard_biped_Animation_Talk_with_Right_Hand_Open_withSkin.glb?url';
import walkingAnimationUrl from '../../assets/debug/bellboy-rig/Meshy_AI_Azure_Vanguard_biped/Meshy_AI_Azure_Vanguard_biped_Animation_Walking_withSkin.glb?url';
import bellboyModelUrl from '../../assets/debug/bellboy-rig/Meshy_AI_Azure_Vanguard_biped/Meshy_AI_Azure_Vanguard_biped_Character_output.glb?url';

export type BellboyAnimationId = 'wave' | 'walk' | 'run' | 'talk';

export type BellboyAnimationSource = {
  id: BellboyAnimationId;
  label: string;
  url: string;
  preload: boolean;
  loop: 'repeat';
};

export const bellboyModelAssetUrl = bellboyModelUrl;

export const bellboyAnimationSources: BellboyAnimationSource[] = [
  { id: 'wave', label: 'Bellboy Wave', url: waveAnimationUrl, preload: true, loop: 'repeat' },
  { id: 'walk', label: 'Bellboy Walk', url: walkingAnimationUrl, preload: false, loop: 'repeat' },
  { id: 'run', label: 'Bellboy Run', url: runningAnimationUrl, preload: false, loop: 'repeat' },
  { id: 'talk', label: 'Bellboy Talk', url: talkAnimationUrl, preload: false, loop: 'repeat' },
];
