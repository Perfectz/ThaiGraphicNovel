import { generatedDialogueAudioById } from '../generated/conversationAudioManifest';
import { generatedStageOneSuAudioById } from '../generated/stageOneSuAudioManifest';

export function getDialogueAudioId(scenarioId: string, lineIndex: number): string {
  return `dialogue-${scenarioId}-${String(lineIndex + 1).padStart(2, '0')}`;
}

export function getDialogueAudioSrc(scenarioId: string, lineIndex: number): string | undefined {
  const audioId = getDialogueAudioId(scenarioId, lineIndex);
  return generatedStageOneSuAudioById[audioId] ?? generatedDialogueAudioById[audioId];
}
