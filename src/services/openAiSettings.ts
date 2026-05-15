const OPENAI_KEY_STORAGE_KEY = 'isekai-thai-quest-openai-api-key-v1';
const VOICE_JUDGE_MODE_STORAGE_KEY = 'isekai-thai-quest-voice-judge-mode-v2';
const TUTORING_LEVEL_STORAGE_KEY = 'isekai-thai-quest-tutoring-level-v1';
export const VOICE_JUDGE_MODE_CHANGED_EVENT = 'isekai-thai-quest-voice-judge-mode-changed';

export type VoiceJudgeMode = 'realtime' | 'whisper';
export type TutoringLevel = 'easy' | 'medium' | 'hard';

export function getStoredOpenAiApiKey(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(OPENAI_KEY_STORAGE_KEY) ?? '';
}

export function hasStoredOpenAiApiKey(): boolean {
  return getStoredOpenAiApiKey().trim().length > 0;
}

export function saveOpenAiApiKey(apiKey: string): void {
  if (typeof window === 'undefined') return;
  const trimmedKey = apiKey.trim();
  if (!trimmedKey) {
    window.localStorage.removeItem(OPENAI_KEY_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(OPENAI_KEY_STORAGE_KEY, trimmedKey);
}

export function clearOpenAiApiKey(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(OPENAI_KEY_STORAGE_KEY);
}

export function getVoiceJudgeMode(): VoiceJudgeMode {
  if (typeof window === 'undefined') return 'whisper';
  return window.localStorage.getItem(VOICE_JUDGE_MODE_STORAGE_KEY) === 'realtime' ? 'realtime' : 'whisper';
}

export function saveVoiceJudgeMode(mode: VoiceJudgeMode): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(VOICE_JUDGE_MODE_STORAGE_KEY, mode);
  window.dispatchEvent(new CustomEvent(VOICE_JUDGE_MODE_CHANGED_EVENT, { detail: mode }));
}

export function getTutoringLevel(): TutoringLevel {
  if (typeof window === 'undefined') return 'medium';
  const savedLevel = window.localStorage.getItem(TUTORING_LEVEL_STORAGE_KEY);
  if (savedLevel === 'easy' || savedLevel === 'hard') return savedLevel;
  return 'medium';
}

export function saveTutoringLevel(level: TutoringLevel): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(TUTORING_LEVEL_STORAGE_KEY, level);
}
