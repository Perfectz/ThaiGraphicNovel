import { useEffect } from 'react';
import { buildScenarioDialogue } from '../data/dialogue';
import { lessonScenarios } from '../data/lessonScenarios';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { useSoundSettings } from '../hooks/useSoundSettings';
import { getDialogueAudioSrc } from '../services/conversationAudio';
import { speakSuInstruction, stopSuInstructionSpeech } from '../services/suSpeech';
import { useGameStore } from '../store/gameStore';
import { DialoguePanel } from './ui';

/**
 * VN dialogue surface — wraps the unified DialoguePanel primitive with the
 * scenario-store wiring (line lookup, audio playback, advance).
 */
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <DialoguePanel
      speaker={line.speaker}
      hasVoice={hasGeneratedSuVoice}
      body={line.text}
      thai={line.thai}
      translation={line.translation}
      onAdvance={advanceDialogueWithAudioStop}
      continueLabel={isLastLine ? 'Tap to start lesson' : 'Tap to continue'}
    />
  );
}
