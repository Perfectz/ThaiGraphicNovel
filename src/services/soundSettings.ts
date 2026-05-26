const SOUND_SETTINGS_STORAGE_KEY = 'isekai-thai-quest-sound-settings-v1';
export const SOUND_SETTINGS_CHANGED_EVENT = 'isekai-thai-quest-sound-settings-changed';

export type SoundSettings = {
  musicEnabled: boolean;
  musicVolume: number;
  guideAudioEnabled: boolean;
  guideAudioVolume: number;
  /**
   * When true, Su's voice lines render an on-screen caption strip while
   * they play. Helpful for accessibility (deaf/HoH players, public-transit
   * playthroughs) and for learners who want to read the Thai inline as Su
   * says it. Default on — captions don't compete with the audio so showing
   * them by default is strictly additive.
   */
  captionsEnabled: boolean;
};

const defaultSoundSettings: SoundSettings = {
  musicEnabled: true,
  musicVolume: 0.55,
  guideAudioEnabled: true,
  guideAudioVolume: 0.9,
  captionsEnabled: true,
};

function clampVolume(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  return Math.max(0, Math.min(1, value));
}

function normalizeSoundSettings(settings: Partial<SoundSettings>): SoundSettings {
  return {
    musicEnabled:
      typeof settings.musicEnabled === 'boolean' ? settings.musicEnabled : defaultSoundSettings.musicEnabled,
    musicVolume: clampVolume(settings.musicVolume, defaultSoundSettings.musicVolume),
    guideAudioEnabled:
      typeof settings.guideAudioEnabled === 'boolean'
        ? settings.guideAudioEnabled
        : defaultSoundSettings.guideAudioEnabled,
    guideAudioVolume: clampVolume(settings.guideAudioVolume, defaultSoundSettings.guideAudioVolume),
    captionsEnabled:
      typeof settings.captionsEnabled === 'boolean'
        ? settings.captionsEnabled
        : defaultSoundSettings.captionsEnabled,
  };
}

export function getSoundSettings(): SoundSettings {
  if (typeof window === 'undefined') return defaultSoundSettings;

  const storedSettings = window.localStorage.getItem(SOUND_SETTINGS_STORAGE_KEY);
  if (!storedSettings) return defaultSoundSettings;

  try {
    return normalizeSoundSettings(JSON.parse(storedSettings) as Partial<SoundSettings>);
  } catch {
    return defaultSoundSettings;
  }
}

export function saveSoundSettings(settings: SoundSettings): void {
  if (typeof window === 'undefined') return;

  const normalizedSettings = normalizeSoundSettings(settings);
  window.localStorage.setItem(SOUND_SETTINGS_STORAGE_KEY, JSON.stringify(normalizedSettings));
  window.dispatchEvent(new CustomEvent(SOUND_SETTINGS_CHANGED_EVENT, { detail: normalizedSettings }));
}
