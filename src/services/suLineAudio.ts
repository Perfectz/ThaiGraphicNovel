import { generatedStageOneSuAudioById } from '../generated/stageOneSuAudioManifest';
import { generatedStageTwoSuAudioById } from '../generated/stageTwoSuAudioManifest';
import { generatedSuAudioById } from '../generated/suAudioManifest';

export function getStageOneSuAudioSrc(audioId: string | undefined): string | undefined {
  if (!audioId) return undefined;
  return generatedStageOneSuAudioById[audioId];
}

export function getStageTwoSuAudioSrc(audioId: string | undefined): string | undefined {
  if (!audioId) return undefined;
  return generatedStageTwoSuAudioById[audioId];
}

export function getSuAudioSrc(audioId: string | undefined): string | undefined {
  if (!audioId) return undefined;
  return (
    generatedStageOneSuAudioById[audioId] ??
    generatedStageTwoSuAudioById[audioId] ??
    generatedSuAudioById[audioId]
  );
}
