import deadAnimationUrl from '../../assets/debug/patrick-rig/Meshy_AI_Red_Jacket_Rebel_biped_Animation_Dead_withSkin.glb?url';
import depressedTurnAnimationUrl from '../../assets/debug/patrick-rig/Meshy_AI_Red_Jacket_Rebel_biped_Animation_Depressed_Full_Turn_Left_withSkin.glb?url';
import idleAnimationUrl from '../../assets/debug/patrick-rig/Meshy_AI_Red_Jacket_Rebel_biped_Animation_Idle_02_withSkin.glb?url';
import idleAltAnimationUrl from '../../assets/debug/patrick-rig/Meshy_AI_Red_Jacket_Rebel_biped_Animation_Idle_03_withSkin.glb?url';
import runningAnimationUrl from '../../assets/debug/patrick-rig/Meshy_AI_Red_Jacket_Rebel_biped_Animation_Running_withSkin.glb?url';
import talkAnimationUrl from '../../assets/debug/patrick-rig/Meshy_AI_Red_Jacket_Rebel_biped_Animation_Talk_Passionately_withSkin.glb?url';
import victoryAnimationUrl from '../../assets/debug/patrick-rig/Meshy_AI_Red_Jacket_Rebel_biped_Animation_Victory_Cheer_withSkin.glb?url';
import walkingAnimationUrl from '../../assets/debug/patrick-rig/Meshy_AI_Red_Jacket_Rebel_biped_Animation_Walking_withSkin.glb?url';
import patrickModelUrl from '../../assets/debug/patrick-rig/Meshy_AI_Red_Jacket_Rebel_biped_Character_output.glb?url';

export type PatrickAnimationId = 'idle' | 'idle-alt' | 'walk' | 'run' | 'talk' | 'victory' | 'turn' | 'dead';

export type PatrickAnimationSource = {
  id: PatrickAnimationId;
  label: string;
  url: string;
  preload: boolean;
  loop: 'repeat' | 'once';
};

export const patrickModelAssetUrl = patrickModelUrl;

export const patrickAnimationSources: PatrickAnimationSource[] = [
  { id: 'idle', label: 'Idle', url: idleAnimationUrl, preload: true, loop: 'repeat' },
  { id: 'idle-alt', label: 'Idle Alt', url: idleAltAnimationUrl, preload: false, loop: 'repeat' },
  { id: 'walk', label: 'Walk', url: walkingAnimationUrl, preload: true, loop: 'repeat' },
  { id: 'run', label: 'Run', url: runningAnimationUrl, preload: true, loop: 'repeat' },
  { id: 'talk', label: 'Talk', url: talkAnimationUrl, preload: true, loop: 'repeat' },
  { id: 'victory', label: 'Victory', url: victoryAnimationUrl, preload: false, loop: 'once' },
  { id: 'turn', label: 'Turn', url: depressedTurnAnimationUrl, preload: false, loop: 'once' },
  { id: 'dead', label: 'Dead', url: deadAnimationUrl, preload: false, loop: 'once' },
];
