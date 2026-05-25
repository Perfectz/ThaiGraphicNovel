import idleAnimationUrl from '../../assets/debug/su-rig/Meshy_AI_Neon_Circuit_Princess_biped_Animation_Idle_4_withSkin.glb?url';
import runningAnimationUrl from '../../assets/debug/su-rig/Meshy_AI_Neon_Circuit_Princess_biped_Animation_Running_withSkin.glb?url';
import talkAnimationUrl from '../../assets/debug/su-rig/Meshy_AI_Neon_Circuit_Princess_biped_Animation_Talk_Passionately_withSkin.glb?url';
import walkingAnimationUrl from '../../assets/debug/su-rig/Meshy_AI_Neon_Circuit_Princess_biped_Animation_Walking_withSkin.glb?url';
import waveAnimationUrl from '../../assets/debug/su-rig/Meshy_AI_Neon_Circuit_Princess_biped_Animation_Wave_for_Help_4_withSkin.glb?url';
import suModelUrl from '../../assets/debug/su-rig/Meshy_AI_Neon_Circuit_Princess_biped_Character_output.glb?url';

export type SuAnimationId = 'idle' | 'walk' | 'run' | 'talk' | 'wave';

export type SuAnimationSource = {
  id: SuAnimationId;
  label: string;
  url: string;
  preload: boolean;
  loop: 'repeat';
};

export const suModelAssetUrl = suModelUrl;

export const suAnimationSources: SuAnimationSource[] = [
  { id: 'idle', label: 'Su Idle', url: idleAnimationUrl, preload: true, loop: 'repeat' },
  { id: 'walk', label: 'Su Walk', url: walkingAnimationUrl, preload: false, loop: 'repeat' },
  { id: 'run', label: 'Su Run', url: runningAnimationUrl, preload: false, loop: 'repeat' },
  { id: 'talk', label: 'Su Talk', url: talkAnimationUrl, preload: false, loop: 'repeat' },
  { id: 'wave', label: 'Su Wave', url: waveAnimationUrl, preload: true, loop: 'repeat' },
];
