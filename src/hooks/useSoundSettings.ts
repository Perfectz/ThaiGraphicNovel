import { useEffect, useState } from 'react';
import {
  getSoundSettings,
  SOUND_SETTINGS_CHANGED_EVENT,
  type SoundSettings,
} from '../services/soundSettings';

export function useSoundSettings(): SoundSettings {
  const [soundSettings, setSoundSettings] = useState<SoundSettings>(() => getSoundSettings());

  useEffect(() => {
    function syncSoundSettings() {
      setSoundSettings(getSoundSettings());
    }

    window.addEventListener(SOUND_SETTINGS_CHANGED_EVENT, syncSoundSettings);
    window.addEventListener('focus', syncSoundSettings);
    return () => {
      window.removeEventListener(SOUND_SETTINGS_CHANGED_EVENT, syncSoundSettings);
      window.removeEventListener('focus', syncSoundSettings);
    };
  }, []);

  return soundSettings;
}
