import { recordedVoices } from './generatedVoices';
export const storyVoiceStopEvent = 'bangkok-stop-story-voice';
export const voiceSpeaker = (speaker: string) => speaker.split(' ·')[0];
export const recordedVoiceUrl = (speaker: string, text: string) =>
  recordedVoices[`${voiceSpeaker(speaker)}|${text}`];
export function stopStoryVoice() {
  window.dispatchEvent(new Event(storyVoiceStopEvent));
}
