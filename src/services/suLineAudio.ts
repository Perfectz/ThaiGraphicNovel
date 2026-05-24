import { generatedStageOneSuAudioById } from '../generated/stageOneSuAudioManifest';

export function getStageOneSuAudioSrc(audioId: string | undefined): string | undefined {
  if (!audioId) return undefined;
  return generatedStageOneSuAudioById[audioId];
}
