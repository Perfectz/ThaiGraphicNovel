function slugifyAudioId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getStageIntroCharacterVoiceAudioId(
  scenarioId: string,
  lineId: string,
  speaker: string,
): string {
  return `voice-${slugifyAudioId(scenarioId)}-intro-${slugifyAudioId(lineId)}-${slugifyAudioId(speaker)}`;
}

export function getConversationTurnCharacterVoiceAudioId(
  scenarioId: string,
  conversationId: string,
  turnId: string,
  speaker: string,
): string {
  return `voice-${slugifyAudioId(scenarioId)}-${slugifyAudioId(conversationId)}-${slugifyAudioId(turnId)}-${slugifyAudioId(speaker)}`;
}

export function getCommandCharacterVoiceAudioId(
  scenarioId: string,
  hotspotId: string,
  verb: string,
  speaker: string,
): string {
  return `voice-${slugifyAudioId(scenarioId)}-${slugifyAudioId(hotspotId)}-${slugifyAudioId(verb)}-${slugifyAudioId(speaker)}`;
}
