import waveAnimationUrl from '../../assets/debug/bellboy-rig/Meshy_AI_Azure_Vanguard_biped/Meshy_AI_Azure_Vanguard_biped_Animation_Big_Wave_Hello_withSkin.glb?url';
import talkAnimationUrl from '../../assets/debug/bellboy-rig/Meshy_AI_Azure_Vanguard_biped/Meshy_AI_Azure_Vanguard_biped_Animation_Talk_with_Right_Hand_Open_withSkin.glb?url';
import runningAnimationUrl from '../../assets/debug/stage-3-character-rig/Meshy_AI_Bandana_Clad_Adventur_biped/Meshy_AI_Bandana_Clad_Adventur_biped_Animation_Running_withSkin.glb?url';
import walkingAnimationUrl from '../../assets/debug/stage-3-character-rig/Meshy_AI_Bandana_Clad_Adventur_biped/Meshy_AI_Bandana_Clad_Adventur_biped_Animation_Walking_withSkin.glb?url';
import stage3CharacterModelUrl from '../../assets/debug/stage-3-character-rig/Meshy_AI_Bandana_Clad_Adventur_biped/Meshy_AI_Bandana_Clad_Adventur_biped_Character_output.glb?url';

export type Stage3CharacterAnimationId = 'idle' | 'walk' | 'run' | 'wave' | 'talk';

export type Stage3CharacterAnimationSource = {
  id: Stage3CharacterAnimationId;
  label: string;
  url: string;
  preload: boolean;
  loop: 'repeat';
};

export const stage3CharacterModelAssetUrl = stage3CharacterModelUrl;

export const stage3CharacterAnimationSources: Stage3CharacterAnimationSource[] = [
  { id: 'idle', label: 'Stage 3 Vendor Idle', url: stage3CharacterModelUrl, preload: true, loop: 'repeat' },
  { id: 'walk', label: 'Stage 3 Vendor Walk', url: walkingAnimationUrl, preload: false, loop: 'repeat' },
  { id: 'run', label: 'Stage 3 Vendor Run', url: runningAnimationUrl, preload: false, loop: 'repeat' },
  { id: 'wave', label: 'Stage 3 Vendor Wave', url: waveAnimationUrl, preload: true, loop: 'repeat' },
  { id: 'talk', label: 'Stage 3 Vendor Talk', url: talkAnimationUrl, preload: false, loop: 'repeat' },
];
