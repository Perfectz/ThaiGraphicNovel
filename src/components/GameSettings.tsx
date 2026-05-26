import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  clearOpenAiApiKey,
  fetchServerEnvKeyStatus,
  getStoredOpenAiApiKey,
  getTutoringLevel,
  getVoiceJudgeMode,
  hasStoredOpenAiApiKey,
  isStaticGitHubPagesHost,
  saveOpenAiApiKey,
  saveTutoringLevel,
  saveVoiceJudgeMode,
  type TutoringLevel,
  type VoiceJudgeMode,
} from '../services/openAiSettings';
import { getSoundSettings, saveSoundSettings, type SoundSettings } from '../services/soundSettings';
import { useGameStore } from '../store/gameStore';
import { useCurrentScene, useHasSavedGame } from '../store/selectors';
import { Button, Card, Chip, Modal, SegmentedControl, type SegmentedOption } from './ui';

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

type KeySource = 'local' | 'custom';

const VOICE_MODES: ReadonlyArray<SegmentedOption<VoiceJudgeMode>> = [
  { value: 'whisper', label: 'Whisper', description: 'Local mic. No API key.' },
  { value: 'realtime', label: 'Realtime', description: 'Cloud mic. Needs key.' },
  { value: 'no-mic', label: 'No mic', description: 'Read & tap. No audio in.' },
];

const KEY_SOURCES: ReadonlyArray<SegmentedOption<KeySource>> = [
  { value: 'local', label: 'Local .env key', description: 'Use the OPENAI_API_KEY loaded by the server.' },
  { value: 'custom', label: 'My own key', description: 'Paste a personal key that overrides the .env one.' },
];

const TUTORING_LEVELS: ReadonlyArray<SegmentedOption<TutoringLevel>> = [
  { value: 'easy', label: 'Easy', description: 'Passes if a native speaker would understand.' },
  { value: 'medium', label: 'Medium', description: 'Balanced beginner coaching.' },
  { value: 'hard', label: 'Hard', description: 'Strict pronunciation, tone, and rhythm.' },
];

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="font-display text-[0.65rem] font-bold uppercase tracking-[0.22em] text-paper-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

function Section({
  eyebrow,
  description,
  tone = 'none',
  children,
}: {
  eyebrow: string;
  description?: string;
  tone?: 'none' | 'ember';
  children: ReactNode;
}) {
  return (
    <Card tone={tone === 'ember' ? 'ember' : 'none'} className="p-4 sm:p-5">
      <p
        className={`font-display text-[0.65rem] font-bold uppercase tracking-[0.28em] ${
          tone === 'ember' ? 'text-ember' : 'text-accent'
        }`}
      >
        {eyebrow}
      </p>
      {description ? (
        <p className="mt-1 text-xs font-medium leading-relaxed text-paper-muted">{description}</p>
      ) : null}
      <div className="mt-3 grid gap-4">{children}</div>
    </Card>
  );
}

/**
 * Two-step destructive button. First click arms the action and renames the
 * button to "Tap again to confirm" for 4 seconds; second click within that
 * window fires the callback. Avoids browser confirm() jank without needing
 * an extra confirmation modal layer.
 */
function ConfirmDestructiveButton({
  label,
  confirmLabel = 'Tap again to confirm',
  onConfirm,
}: {
  label: string;
  confirmLabel?: string;
  onConfirm: () => void;
}) {
  const [armed, setArmed] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    },
    [],
  );

  const handleClick = useCallback(() => {
    if (armed) {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      setArmed(false);
      onConfirm();
      return;
    }
    setArmed(true);
    timeoutRef.current = window.setTimeout(() => {
      setArmed(false);
      timeoutRef.current = null;
    }, 4000);
  }, [armed, onConfirm]);

  return (
    <Button variant="destructive" onClick={handleClick} aria-live="polite">
      {armed ? confirmLabel : label}
    </Button>
  );
}

export function GameSettings({ isOpen, onClose, onOpenRoadmap }: GameSettingsProps) {
  const [apiKey, setApiKey] = useState('');
  const [hasSavedKey, setHasSavedKey] = useState(false);
  // serverEnvKeyAvailable is fetched from /api/realtime/health every time the
  // modal opens. When true, the local dev server has OPENAI_API_KEY set in
  // its .env / .env.local and that key acts as the default — the user does
  // not need to paste their own key, and the UI relaxes the "needs a key"
  // nag accordingly. A user-supplied key still overrides the env default if
  // they want to use their own account.
  const [serverEnvKeyAvailable, setServerEnvKeyAvailable] = useState(false);
  // 'local' = let the server use its loaded OPENAI_API_KEY (clears any stored
  // user key so no override header is sent). 'custom' = use the key the user
  // pasted into the input below. We default to 'local' whenever the server
  // reports a key and the user hasn't stored their own.
  const [keySource, setKeySource] = useState<KeySource>('custom');
  const [voiceJudgeMode, setVoiceJudgeMode] = useState<VoiceJudgeMode>('whisper');
  const [tutoringLevel, setTutoringLevel] = useState<TutoringLevel>('medium');
  const [soundSettings, setSoundSettings] = useState<SoundSettings>(() => getSoundSettings());
  const voiceServiceCheckId = useRef(0);
  const [voiceServiceStatus, setVoiceServiceStatus] = useState<VoiceServiceStatus>({
    realtime: 'Not checked yet.',
    whisper: 'Not checked yet.',
    isChecking: false,
  });

  // Danger Zone state — driven by the store so the Settings modal can bail
  // the player out of a stage or wipe their save without reloading the page.
  const currentScene = useCurrentScene();
  const hasSavedGame = useHasSavedGame();
  const returnToTitle = useGameStore((state) => state.returnToTitle);
  const clearAllProgress = useGameStore((state) => state.clearAllProgress);
  const isOnTitle = currentScene === 'title';

  useEffect(() => {
    if (!isOpen) return;
    const storedKey = getStoredOpenAiApiKey();
    setApiKey(storedKey);
    setHasSavedKey(hasStoredOpenAiApiKey());
    setVoiceJudgeMode(getVoiceJudgeMode());
    setTutoringLevel(getTutoringLevel());
    setSoundSettings(getSoundSettings());
    void checkVoiceServices();
    // Refresh the server env-key signal each time the modal opens so the
    // hint stays accurate if the dev restarted their server with a new
    // .env value mid-session. Once that resolves, snap the key-source
    // selector to whichever option matches reality: if a local .env key is
    // present and the user hasn't stored their own, default to 'local' so
    // they don't have to do anything; otherwise fall back to 'custom'.
    void fetchServerEnvKeyStatus().then((envKeyAvailable) => {
      setServerEnvKeyAvailable(envKeyAvailable);
      setKeySource(envKeyAvailable && !storedKey.trim() ? 'local' : 'custom');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  function saveSettings() {
    saveOpenAiApiKey(apiKey);
    saveVoiceJudgeMode(voiceJudgeMode);
    saveTutoringLevel(tutoringLevel);
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

  /**
   * Flip between using the server's local .env key and the user's pasted
   * key. Switching TO 'local' clears any stored user key so no override
   * header is sent on the next Realtime request (the server then falls
   * back to its env key). Switching TO 'custom' just shows the input —
   * the key isn't restored, since we cleared it on the previous flip;
   * the user types a new one (or leaves it blank to disable Realtime).
   */
  function updateKeySource(nextSource: KeySource) {
    setKeySource(nextSource);
    if (nextSource === 'local') {
      clearOpenAiApiKey();
      setApiKey('');
      setHasSavedKey(false);
      void checkVoiceServices('');
    }
  }

  function updateVoiceJudgeMode(nextMode: VoiceJudgeMode) {
    setVoiceJudgeMode(nextMode);
    saveVoiceJudgeMode(nextMode);
  }

  function updateTutoringLevel(nextLevel: TutoringLevel) {
    setTutoringLevel(nextLevel);
    saveTutoringLevel(nextLevel);
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

  // MVP 8 — Tester jump menu. Only visible when the URL has ?tester=1, so
  // end users never see it. The query check happens on render so toggling
  // it doesn't need a full reload. Useful for friends doing a quick demo
  // sanity check, or for reproducing bugs that only show up on stage N.
  const isTester =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tester') === '1';

  function jumpToStage(stageIndex: number) {
    // Reuse the existing debug-jump session storage handshake that App.tsx
    // already listens for on mount — avoids duplicating the save/state
    // setup logic in two places.
    window.sessionStorage.setItem('isekai-debug-stage-3d-index', String(stageIndex));
    window.location.reload();
  }

  async function readServiceStatus(url: string, serviceName: string, apiKeyForHealth = ''): Promise<string> {
    try {
      const headers: HeadersInit = {};
      if (apiKeyForHealth.trim()) {
        headers['X-OpenAI-API-Key'] = apiKeyForHealth.trim();
      }
      const response = await fetch(url, { headers });
      const payload = await response.json().catch(async () => ({ error: await response.text() }));
      if (!response.ok) return `${serviceName} error: HTTP ${response.status}.`;
      if (payload.requiresApiKey) return `${serviceName} is running, but needs an API key.`;
      const model = typeof payload.model === 'string' ? ` (${payload.model})` : '';
      // Disambiguate the "ready" message so devs can tell whether their own
      // pasted key is in use or the server is falling back to its .env key.
      // payload.serverEnvKeyAvailable is set on /api/realtime/health and is
      // intentionally absent on the Whisper health endpoint (Whisper is
      // fully local and doesn't need an OpenAI key at all).
      const userKey = apiKeyForHealth.trim();
      let keyHint = '';
      if (payload.serverEnvKeyAvailable === true) {
        keyHint = userKey ? ' (overriding local .env key)' : ' (using local .env key)';
      } else if (userKey) {
        keyHint = ' (using your saved key)';
      }
      return `${serviceName} is ready${model}${keyHint}.`;
    } catch {
      return `${serviceName} is not running.`;
    }
  }

  async function checkVoiceServices(nextApiKey = apiKey || getStoredOpenAiApiKey()) {
    const checkId = voiceServiceCheckId.current + 1;
    voiceServiceCheckId.current = checkId;
    setVoiceServiceStatus((currentStatus) => ({ ...currentStatus, isChecking: true }));
    if (isStaticGitHubPagesHost()) {
      setVoiceServiceStatus({
        realtime: 'Realtime relay is not available on GitHub Pages.',
        whisper: 'Whisper service is not available on GitHub Pages. Use No-mic mode for the static demo.',
        isChecking: false,
      });
      return;
    }
    const [realtime, whisper] = await Promise.all([
      readServiceStatus('/api/realtime/health', 'Realtime API', nextApiKey),
      readServiceStatus('/api/whisper/health', 'Whisper'),
    ]);
    if (checkId !== voiceServiceCheckId.current) return;
    setVoiceServiceStatus({ realtime, whisper, isChecking: false });
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      eyebrow="Game Settings"
      title="Audio & Voice Coach"
      footer={
        <>
          <Button variant="destructive" onClick={clearSettings}>
            Clear key
          </Button>
          <Button variant="primary" onClick={saveSettings}>
            Save settings
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Section eyebrow="Sound">
          <label className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium text-paper">Background music</span>
            <input
              type="checkbox"
              checked={soundSettings.musicEnabled}
              onChange={(event) => updateSoundSettings({ musicEnabled: event.target.checked })}
              className="h-5 w-5 accent-accent"
            />
          </label>
          <Field label={`Music volume — ${Math.round(soundSettings.musicVolume * 100)}%`}>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={soundSettings.musicVolume}
              onChange={(event) => updateSoundSettings({ musicVolume: Number(event.target.value) })}
              className="w-full accent-accent"
            />
          </Field>
          <label className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium text-paper">Guide audio</span>
            <input
              type="checkbox"
              checked={soundSettings.guideAudioEnabled}
              onChange={(event) => updateSoundSettings({ guideAudioEnabled: event.target.checked })}
              className="h-5 w-5 accent-accent"
            />
          </label>
          <Field label={`Guide volume — ${Math.round(soundSettings.guideAudioVolume * 100)}%`}>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={soundSettings.guideAudioVolume}
              onChange={(event) => updateSoundSettings({ guideAudioVolume: Number(event.target.value) })}
              className="w-full accent-accent"
            />
          </Field>
          <label className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium text-paper">
              Su captions
              <span className="ml-2 text-[0.65rem] font-medium uppercase tracking-[0.16em] text-paper-quiet">
                Show text while Su speaks
              </span>
            </span>
            <input
              type="checkbox"
              checked={soundSettings.captionsEnabled}
              onChange={(event) => updateSoundSettings({ captionsEnabled: event.target.checked })}
              className="h-5 w-5 accent-accent"
            />
          </label>
        </Section>

        <Section eyebrow="Voice Coach">
          {serverEnvKeyAvailable ? (
            <div className="grid gap-2">
              <p className="font-display text-[0.65rem] font-bold uppercase tracking-[0.22em] text-paper-muted">
                OpenAI key source
              </p>
              <SegmentedControl
                ariaLabel="OpenAI key source"
                options={KEY_SOURCES}
                value={keySource}
                onChange={updateKeySource}
              />
              <p className="text-xs font-medium leading-relaxed text-jade">
                A local <code className="font-mono">.env</code> key is loaded on the server. Pick &quot;Local
                .env key&quot; to use it as-is, or &quot;My own key&quot; to override with a personal key for
                this browser.
              </p>
            </div>
          ) : null}

          {keySource === 'custom' || !serverEnvKeyAvailable ? (
            <Field label="OpenAI API key (Realtime mode only)">
              <input
                type="password"
                value={apiKey}
                onChange={(event) => updateApiKey(event.target.value)}
                placeholder={
                  serverEnvKeyAvailable
                    ? 'Paste a key to override the local .env key'
                    : 'Only needed for Realtime mode'
                }
                className="w-full rounded-md border border-hairline bg-ink-elevated px-3 py-2 font-mono text-sm text-paper outline-none focus:border-accent"
                autoComplete="off"
                spellCheck={false}
              />
            </Field>
          ) : null}

          <div className="grid gap-2">
            <p className="font-display text-[0.65rem] font-bold uppercase tracking-[0.22em] text-paper-muted">
              Voice judge mode
            </p>
            <SegmentedControl
              ariaLabel="Voice judge mode"
              options={VOICE_MODES}
              value={voiceJudgeMode}
              onChange={updateVoiceJudgeMode}
            />
            <p className="text-xs font-medium leading-relaxed text-paper-muted">
              Whisper runs locally and is free. Realtime sends your key to the local Realtime service on this
              machine.
            </p>
          </div>

          <div className="grid gap-2">
            <p className="font-display text-[0.65rem] font-bold uppercase tracking-[0.22em] text-paper-muted">
              Tutor level
            </p>
            <SegmentedControl
              ariaLabel="Tutor level"
              options={TUTORING_LEVELS}
              value={tutoringLevel}
              onChange={updateTutoringLevel}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Active-source chip — answers "which key is the next Realtime
                request actually going to use?" at a glance. */}
            {keySource === 'local' && serverEnvKeyAvailable ? (
              <Chip tone="jade">Using local .env key</Chip>
            ) : hasSavedKey ? (
              <Chip tone="jade">Using your saved key</Chip>
            ) : (
              <Chip tone="default">No key set</Chip>
            )}
            {serverEnvKeyAvailable && keySource !== 'local' ? (
              <Chip tone="default">Local .env key available</Chip>
            ) : null}
          </div>

          <Card className="p-3" tone="none">
            <div className="flex items-center justify-between gap-3">
              <p className="font-display text-[0.65rem] font-bold uppercase tracking-[0.22em] text-paper-muted">
                Service status
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void checkVoiceServices()}
                disabled={voiceServiceStatus.isChecking}
              >
                {voiceServiceStatus.isChecking ? 'Checking…' : 'Refresh'}
              </Button>
            </div>
            <ul className="mt-2 grid gap-1 text-xs font-medium text-paper-muted">
              <li>{voiceServiceStatus.realtime}</li>
              <li>{voiceServiceStatus.whisper}</li>
            </ul>
          </Card>
        </Section>

        <Section eyebrow="Progress">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
            <p className="text-sm font-medium leading-relaxed text-paper-muted">
              View the full Thai Quest lesson route, phrase chunks, and rewards.
            </p>
            <Button variant="ghost" onClick={openRoadmap}>
              Open roadmap
            </Button>
          </div>
        </Section>

        {isTester ? (
          <Section
            eyebrow="Tester tools"
            description="Available because the URL includes ?tester=1. Hidden from regular players."
          >
            <p className="text-xs font-medium leading-relaxed text-paper-muted">
              Jump straight into any stage. Reloads the page with a debug save so the dispatcher mounts the
              chosen scene fresh.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => jumpToStage(0)}>
                → Stage 1 · Hotel Lobby
              </Button>
              <Button variant="ghost" onClick={() => jumpToStage(1)}>
                → Stage 2 · Front Desk
              </Button>
              <Button variant="ghost" onClick={() => jumpToStage(2)}>
                → Stage 3 · Night Market
              </Button>
            </div>
          </Section>
        ) : null}

        {/* Danger zone — only render the actions that make sense in context.
            Return to title is hidden when already on the title screen; Reset
            progress requires a save to be worth offering. */}
        {!isOnTitle || hasSavedGame ? (
          <Section
            eyebrow="Danger zone"
            description="These actions can't be undone. Sound and voice-coach settings are kept."
            tone="ember"
          >
            <div className="flex flex-wrap items-center gap-3">
              {!isOnTitle ? (
                <ConfirmDestructiveButton
                  label="Return to title"
                  confirmLabel="Tap again — leaves current stage"
                  onConfirm={() => {
                    returnToTitle();
                    onClose();
                  }}
                />
              ) : null}
              {hasSavedGame ? (
                <ConfirmDestructiveButton
                  label="Reset progress"
                  confirmLabel="Tap again — wipes save"
                  onConfirm={() => {
                    clearAllProgress();
                    onClose();
                  }}
                />
              ) : null}
            </div>
          </Section>
        ) : null}
      </div>
    </Modal>
  );
}
