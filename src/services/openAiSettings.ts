const OPENAI_KEY_STORAGE_KEY = 'isekai-thai-quest-openai-api-key-v1';
const VOICE_JUDGE_MODE_STORAGE_KEY = 'isekai-thai-quest-voice-judge-mode-v2';
const TUTORING_LEVEL_STORAGE_KEY = 'isekai-thai-quest-tutoring-level-v1';
export const VOICE_JUDGE_MODE_CHANGED_EVENT = 'isekai-thai-quest-voice-judge-mode-changed';

const REALTIME_HEALTH_URL = '/api/realtime/health';

/**
 * Cached `serverEnvKeyAvailable` from the most recent health probe. Treated as
 * a session-scoped optimistic value — the GameSettings UI refreshes it every
 * time the modal opens via `fetchServerEnvKeyStatus()`, and the Realtime
 * pronunciation flow reads it synchronously when deciding whether the user's
 * stack has a usable key. Falsey by default so we never falsely claim an env
 * key is available; the cache only flips true after the server confirms it.
 */
let cachedServerEnvKeyAvailable = false;

export function isStaticGitHubPagesHost(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname.endsWith('github.io');
}

/**
 * Three modes for how a player completes pronunciation prompts:
 *
 * - 'realtime' — OpenAI Realtime API judges the spoken audio over WebRTC.
 *   Requires an API key (server env or user-supplied).
 * - 'whisper'  — Local Whisper model judges the spoken audio. No key needed.
 * - 'no-mic'   — No microphone at all. The mic UI is replaced by a
 *   single-tap "Confirm phrase" button so players with broken/missing/no
 *   microphone permission can still play through the full stage by reading
 *   and tapping. Tech-demo-friendly fallback.
 */
export type VoiceJudgeMode = 'realtime' | 'whisper' | 'no-mic';
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
  const stored = window.localStorage.getItem(VOICE_JUDGE_MODE_STORAGE_KEY);
  if (stored === 'realtime' || stored === 'whisper' || stored === 'no-mic') return stored;
  return 'whisper';
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

/**
 * Probe the local Realtime session server for whether it has a usable
 * OPENAI_API_KEY in its environment. Cached for the rest of the session
 * after the first successful response. Returns `false` (silently) when the
 * server is offline or the response is malformed — that's safe, because the
 * UI's fallback assumption is "you still need to enter a key".
 */
export async function fetchServerEnvKeyStatus(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (isStaticGitHubPagesHost()) return false;
  try {
    const response = await fetch(REALTIME_HEALTH_URL);
    if (!response.ok) return cachedServerEnvKeyAvailable;
    const payload = (await response.json()) as { serverEnvKeyAvailable?: boolean };
    cachedServerEnvKeyAvailable = payload.serverEnvKeyAvailable === true;
    return cachedServerEnvKeyAvailable;
  } catch {
    return cachedServerEnvKeyAvailable;
  }
}

/**
 * Synchronous read of the most recent server env-key probe. Used by callers
 * that can't easily await (e.g. the Realtime pronunciation flow deciding
 * whether to surface a "missing key" error). Always call
 * `fetchServerEnvKeyStatus()` at least once during app boot or modal open
 * to seed this — otherwise it stays `false`.
 */
export function getCachedServerEnvKeyAvailable(): boolean {
  return cachedServerEnvKeyAvailable;
}

/**
 * True when *any* usable OpenAI key is available — either the user pasted
 * one into Settings (localStorage) or the local dev server is running with
 * an env key. Use this anywhere the UI gates Realtime-mode availability;
 * `hasStoredOpenAiApiKey()` is now only for "should we show the Clear Key
 * button" since it ignores the server's default.
 */
export function hasUsableOpenAiKey(): boolean {
  return hasStoredOpenAiApiKey() || cachedServerEnvKeyAvailable;
}
