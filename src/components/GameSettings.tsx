import { useEffect, useRef, useState } from 'react';
import {
  clearOpenAiApiKey,
  getStoredOpenAiApiKey,
  getVoiceJudgeMode,
  hasStoredOpenAiApiKey,
  saveOpenAiApiKey,
  saveVoiceJudgeMode,
  type VoiceJudgeMode,
} from '../services/openAiSettings';
import { getSoundSettings, saveSoundSettings, type SoundSettings } from '../services/soundSettings';

type GameSettingsProps = {
  isOpen: boolean;
  onClose: () => void;
  onOpenRoadmap: () => void;
};

type VoiceServiceStatus = {
  realtime: string;
  whisper: string;
  isChecking: boolean;
};

export function GameSettings({ isOpen, onClose, onOpenRoadmap }: GameSettingsProps) {
  const [apiKey, setApiKey] = useState('');
  const [hasSavedKey, setHasSavedKey] = useState(false);
  const [voiceJudgeMode, setVoiceJudgeMode] = useState<VoiceJudgeMode>('whisper');
  const [soundSettings, setSoundSettings] = useState<SoundSettings>(() => getSoundSettings());
  const voiceServiceCheckId = useRef(0);
  const [voiceServiceStatus, setVoiceServiceStatus] = useState<VoiceServiceStatus>({
    realtime: 'Not checked yet.',
    whisper: 'Not checked yet.',
    isChecking: false,
  });

  useEffect(() => {
    if (!isOpen) return;
    setApiKey(getStoredOpenAiApiKey());
    setHasSavedKey(hasStoredOpenAiApiKey());
    setVoiceJudgeMode(getVoiceJudgeMode());
    setSoundSettings(getSoundSettings());
    void checkVoiceServices();
  }, [isOpen]);

  if (!isOpen) return null;

  function saveSettings() {
    saveOpenAiApiKey(apiKey);
    saveVoiceJudgeMode(voiceJudgeMode);
    saveSoundSettings(soundSettings);
    setHasSavedKey(hasStoredOpenAiApiKey());
    onClose();
  }

  function clearSettings() {
    clearOpenAiApiKey();
    setApiKey('');
    setHasSavedKey(false);
    void checkVoiceServices('');
  }

  function updateApiKey(nextApiKey: string) {
    setApiKey(nextApiKey);
    saveOpenAiApiKey(nextApiKey);
    setHasSavedKey(nextApiKey.trim().length > 0);
    void checkVoiceServices(nextApiKey);
  }

  function updateVoiceJudgeMode(nextMode: VoiceJudgeMode) {
    setVoiceJudgeMode(nextMode);
    saveVoiceJudgeMode(nextMode);
  }

  function openRoadmap() {
    onClose();
    onOpenRoadmap();
  }

  function updateSoundSettings(nextSettings: Partial<SoundSettings>) {
    const updatedSettings = { ...soundSettings, ...nextSettings };
    setSoundSettings(updatedSettings);
    saveSoundSettings(updatedSettings);
  }

  async function readServiceStatus(url: string, serviceName: string, apiKeyForHealth = ''): Promise<string> {
    try {
      const headers: HeadersInit = {};
      if (apiKeyForHealth.trim()) {
        headers['X-OpenAI-API-Key'] = apiKeyForHealth.trim();
      }

      const response = await fetch(url, { headers });
      const payload = await response.json().catch(async () => ({ error: await response.text() }));
      if (!response.ok) {
        return `${serviceName} error: HTTP ${response.status}.`;
      }

      if (payload.requiresApiKey) {
        return `${serviceName} is running, but needs an API key.`;
      }

      const model = typeof payload.model === 'string' ? ` (${payload.model})` : '';
      return `${serviceName} is ready${model}.`;
    } catch {
      return `${serviceName} is not running.`;
    }
  }

  async function checkVoiceServices(nextApiKey = apiKey || getStoredOpenAiApiKey()) {
    const checkId = voiceServiceCheckId.current + 1;
    voiceServiceCheckId.current = checkId;
    setVoiceServiceStatus((currentStatus) => ({ ...currentStatus, isChecking: true }));
    const [realtime, whisper] = await Promise.all([
      readServiceStatus('/api/realtime/health', 'Realtime API', nextApiKey),
      readServiceStatus('/api/whisper/health', 'Whisper'),
    ]);

    if (checkId !== voiceServiceCheckId.current) return;
    setVoiceServiceStatus({
      realtime,
      whisper,
      isChecking: false,
    });
  }

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/72 px-4 backdrop-blur-sm">
      <section className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-3xl border-4 border-cyan-950 bg-cyan-50 p-5 text-slate-950 shadow-rpg">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="font-display text-xs font-black uppercase tracking-[0.18em] text-cyan-800">Game Settings</p>
            <h2 className="text-2xl font-black">Audio and Voice Coach</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border-2 border-slate-950 bg-white px-3 py-1 text-sm font-black text-slate-950 active:translate-y-1"
          >
            Close
          </button>
        </div>

        <div className="rounded-2xl border-2 border-slate-950 bg-white/90 p-4">
          <p className="font-display text-xs font-black uppercase tracking-[0.16em] text-slate-600">Sound</p>
          <div className="mt-3 grid gap-4">
            <label className="flex items-center justify-between gap-4">
              <span className="text-sm font-black uppercase tracking-[0.12em] text-slate-700">Background Music</span>
              <input
                type="checkbox"
                checked={soundSettings.musicEnabled}
                onChange={(event) => updateSoundSettings({ musicEnabled: event.target.checked })}
                className="h-6 w-6 accent-cyan-600"
              />
            </label>

            <label className="grid gap-2">
              <span className="flex items-center justify-between gap-3 text-sm font-black uppercase tracking-[0.12em] text-slate-700">
                <span>Music Volume</span>
                <span>{Math.round(soundSettings.musicVolume * 100)}%</span>
              </span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={soundSettings.musicVolume}
                onChange={(event) => updateSoundSettings({ musicVolume: Number(event.target.value) })}
                className="w-full accent-cyan-600"
              />
            </label>

            <label className="flex items-center justify-between gap-4">
              <span className="text-sm font-black uppercase tracking-[0.12em] text-slate-700">Guide Audio</span>
              <input
                type="checkbox"
                checked={soundSettings.guideAudioEnabled}
                onChange={(event) => updateSoundSettings({ guideAudioEnabled: event.target.checked })}
                className="h-6 w-6 accent-fuchsia-600"
              />
            </label>

            <label className="grid gap-2">
              <span className="flex items-center justify-between gap-3 text-sm font-black uppercase tracking-[0.12em] text-slate-700">
                <span>Guide Volume</span>
                <span>{Math.round(soundSettings.guideAudioVolume * 100)}%</span>
              </span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={soundSettings.guideAudioVolume}
                onChange={(event) => updateSoundSettings({ guideAudioVolume: Number(event.target.value) })}
                className="w-full accent-fuchsia-600"
              />
            </label>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border-2 border-slate-950 bg-white/90 p-4">
          <p className="font-display text-xs font-black uppercase tracking-[0.16em] text-slate-600">Voice Coach</p>

          <label className="mt-3 grid gap-2">
            <span className="text-sm font-black uppercase tracking-[0.12em] text-slate-700">API Key for Realtime</span>
            <input
              type="password"
              value={apiKey}
              onChange={(event) => updateApiKey(event.target.value)}
              placeholder="Only needed for Realtime mode"
              className="w-full rounded-2xl border-4 border-slate-950 bg-white px-4 py-3 font-mono text-sm font-bold outline-none focus:border-cyan-700"
              autoComplete="off"
              spellCheck={false}
            />
          </label>

          <div className="mt-4 grid gap-2">
            <p className="text-sm font-black uppercase tracking-[0.12em] text-slate-700">Voice Judge Mode</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => updateVoiceJudgeMode('realtime')}
                className={`rounded-2xl border-4 px-3 py-3 text-sm font-black uppercase tracking-[0.1em] active:translate-y-1 ${
                  voiceJudgeMode === 'realtime'
                    ? 'border-cyan-950 bg-cyan-300 text-cyan-950'
                    : 'border-slate-950 bg-white text-slate-800'
                }`}
              >
                Realtime
              </button>
              <button
                type="button"
                onClick={() => updateVoiceJudgeMode('whisper')}
                className={`rounded-2xl border-4 px-3 py-3 text-sm font-black uppercase tracking-[0.1em] active:translate-y-1 ${
                  voiceJudgeMode === 'whisper'
                    ? 'border-amber-950 bg-amber-300 text-amber-950'
                    : 'border-slate-950 bg-white text-slate-800'
                }`}
              >
                Whisper
              </button>
            </div>
          </div>

          <p className="mt-3 text-sm font-bold leading-snug text-slate-700">
            Free local Whisper does not use a key. Realtime sends this key only to the local Realtime service on this machine.
          </p>

          <div className="mt-4 rounded-2xl border-2 border-slate-950 bg-white px-3 py-2 text-sm font-black text-slate-800">
            {hasSavedKey ? 'A key is saved on this browser.' : 'No key saved yet.'}
          </div>

          <div className="mt-4 rounded-2xl border-2 border-slate-950 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800">
            <div className="flex items-center justify-between gap-3">
              <p className="font-display text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">Service Status</p>
              <button
                type="button"
                onClick={() => void checkVoiceServices()}
                className="rounded-xl border-2 border-slate-950 bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-slate-950 active:translate-y-1"
              >
                {voiceServiceStatus.isChecking ? 'Checking' : 'Refresh'}
              </button>
            </div>
            <p className="mt-2">{voiceServiceStatus.realtime}</p>
            <p className="mt-1">{voiceServiceStatus.whisper}</p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border-2 border-slate-950 bg-white/90 p-4">
          <p className="font-display text-xs font-black uppercase tracking-[0.16em] text-slate-600">Progress</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
            <p className="text-sm font-bold leading-snug text-slate-700">
              View the full Thai Quest lesson route, phrase chunks, and rewards.
            </p>
            <button
              type="button"
              onClick={openRoadmap}
              className="rounded-2xl border-4 border-cyan-950 bg-cyan-300 px-4 py-3 text-sm font-black uppercase tracking-[0.12em] text-cyan-950 shadow-md active:translate-y-1"
            >
              Open Roadmap
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-[1fr_auto]">
          <button
            type="button"
            onClick={saveSettings}
            className="rounded-2xl border-4 border-emerald-950 bg-emerald-400 px-4 py-3 text-base font-black uppercase tracking-[0.12em] text-emerald-950 shadow-md active:translate-y-1"
          >
            Save Settings
          </button>
          <button
            type="button"
            onClick={clearSettings}
            className="rounded-2xl border-4 border-red-950 bg-white px-4 py-3 text-base font-black uppercase tracking-[0.12em] text-red-800 shadow-md active:translate-y-1"
          >
            Clear Key
          </button>
        </div>
      </section>
    </div>
  );
}
