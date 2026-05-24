import { useEffect } from 'react';
import { buildScenarioDialogue } from '../data/dialogue';
import { lessonScenarios } from '../data/lessonScenarios';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { useSoundSettings } from '../hooks/useSoundSettings';
import { getDialogueAudioSrc } from '../services/conversationAudio';
import { speakSuInstruction, stopSuInstructionSpeech } from '../services/suSpeech';
import { useGameStore } from '../store/gameStore';

export function DialogueBox() {
  const dialogueIndex = useGameStore((state) => state.dialogueIndex);
  const activeScenarioIndex = useGameStore((state) => state.activeScenarioIndex);
  const advanceDialogue = useGameStore((state) => state.advanceDialogue);
  const soundSettings = useSoundSettings();
  const dialogueAudio = useAudioPlayer();
  const activeScenario = lessonScenarios[activeScenarioIndex] ?? lessonScenarios[0];
  const scenarioDialogue = buildScenarioDialogue(activeScenario);
  const line = scenarioDialogue[dialogueIndex] ?? scenarioDialogue[0];
  const isLastLine = dialogueIndex === scenarioDialogue.length - 1;
  const dialogueAudioSrc = getDialogueAudioSrc(activeScenario.id, dialogueIndex);
  const hasGeneratedSuVoice = line.speaker === 'Su' && Boolean(dialogueAudioSrc);

  useEffect(() => {
    dialogueAudio.stop();
    stopSuInstructionSpeech();
    if (!soundSettings.guideAudioEnabled) return;
    if (dialogueAudioSrc) {
      void dialogueAudio.play(dialogueAudioSrc, soundSettings.guideAudioVolume);
      return;
    }
    if (line.spokenText) speakSuInstruction(line.spokenText);
  }, [dialogueAudioSrc, line.spokenText, soundSettings.guideAudioEnabled, soundSettings.guideAudioVolume]);

  useEffect(() => {
    return () => stopSuInstructionSpeech();
  }, []);

  function advanceDialogueWithAudioStop() {
    dialogueAudio.stop();
    stopSuInstructionSpeech();
    advanceDialogue();
  }

  return (
    <section className="pointer-events-auto absolute inset-x-3 bottom-[var(--vn-panel-bottom)] z-50 h-[var(--vn-panel-height)] sm:inset-x-10 lg:inset-x-16">
      <button
        type="button"
        onClick={advanceDialogueWithAudioStop}
        className="vn-glass-panel h-full w-full overflow-y-auto p-3 text-left sm:px-5 sm:py-4"
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="vn-status-chip px-3 py-1 font-display text-xs font-black uppercase tracking-[0.18em] sm:text-sm">
              {line.speaker}
            </span>
            {hasGeneratedSuVoice ? (
              <span className="vn-voice-chip px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em]">
                Su Voice
              </span>
            ) : null}
          </div>
          <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-600 sm:text-xs">
            {isLastLine ? 'Start lesson' : 'Next'}
          </span>
        </div>
        <p className="max-w-5xl text-base font-black leading-snug text-slate-950 sm:text-xl">{line.text}</p>
        {line.thai ? (
          <div className="mt-2 grid gap-1 rounded-xl border border-emerald-900/25 bg-emerald-100/90 px-3 py-2 sm:grid-cols-[auto_1fr] sm:items-end sm:gap-3">
            <p className="text-xl font-black leading-none text-emerald-950 sm:text-2xl">{line.thai}</p>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-900 sm:text-sm">{line.translation}</p>
          </div>
        ) : null}
      </button>
    </section>
  );
}
