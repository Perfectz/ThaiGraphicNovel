import { generatedCharacterVoiceAudioById } from '../generated/characterVoiceAudioManifest';

export function getCharacterVoiceAudioSrc(audioId: string | undefined): string | undefined {
  if (!audioId) return undefined;
  return generatedCharacterVoiceAudioById[audioId];
}
