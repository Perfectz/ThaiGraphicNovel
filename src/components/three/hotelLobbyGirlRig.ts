import waveAnimationUrl from '../../assets/debug/bellboy-rig/Meshy_AI_Azure_Vanguard_biped/Meshy_AI_Azure_Vanguard_biped_Animation_Big_Wave_Hello_withSkin.glb?url';
import talkAnimationUrl from '../../assets/debug/bellboy-rig/Meshy_AI_Azure_Vanguard_biped/Meshy_AI_Azure_Vanguard_biped_Animation_Talk_with_Right_Hand_Open_withSkin.glb?url';
import runningAnimationUrl from '../../assets/debug/hotel-lobby-girl-rig/Meshy_AI_Goldleaf_Ensemble_biped/Meshy_AI_Goldleaf_Ensemble_biped_Animation_Running_withSkin.glb?url';
import walkingAnimationUrl from '../../assets/debug/hotel-lobby-girl-rig/Meshy_AI_Goldleaf_Ensemble_biped/Meshy_AI_Goldleaf_Ensemble_biped_Animation_Walking_withSkin.glb?url';
import hotelLobbyGirlModelUrl from '../../assets/debug/hotel-lobby-girl-rig/Meshy_AI_Goldleaf_Ensemble_biped/Meshy_AI_Goldleaf_Ensemble_biped_Character_output.glb?url';

export type HotelLobbyGirlAnimationId = 'idle' | 'walk' | 'run' | 'wave' | 'talk';

export type HotelLobbyGirlAnimationSource = {
  id: HotelLobbyGirlAnimationId;
  label: string;
  url: string;
  preload: boolean;
  loop: 'repeat';
};

export const hotelLobbyGirlModelAssetUrl = hotelLobbyGirlModelUrl;

export const hotelLobbyGirlAnimationSources: HotelLobbyGirlAnimationSource[] = [
  { id: 'idle', label: 'Hostess Idle', url: hotelLobbyGirlModelUrl, preload: true, loop: 'repeat' },
  { id: 'walk', label: 'Hostess Walk', url: walkingAnimationUrl, preload: false, loop: 'repeat' },
  { id: 'run', label: 'Hostess Run', url: runningAnimationUrl, preload: false, loop: 'repeat' },
  { id: 'wave', label: 'Hostess Wave', url: waveAnimationUrl, preload: true, loop: 'repeat' },
  { id: 'talk', label: 'Hostess Talk', url: talkAnimationUrl, preload: false, loop: 'repeat' },
];
