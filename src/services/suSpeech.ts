let activeUtterance: SpeechSynthesisUtterance | null = null;

export function speakSuInstruction(text: string): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    setSpeechState('unsupported');
    return;
  }

  stopSuInstructionSpeech();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.pitch = 1.18;
  utterance.rate = 1.04;
  utterance.volume = 1;
  activeUtterance = utterance;
  setSpeechState('speaking');
  utterance.addEventListener('end', clearActiveUtterance, { once: true });
  utterance.addEventListener('error', clearActiveUtterance, { once: true });
  window.speechSynthesis.speak(utterance);
}

export function stopSuInstructionSpeech(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  if (!activeUtterance && !window.speechSynthesis.speaking && !window.speechSynthesis.pending) return;
  window.speechSynthesis.cancel();
  activeUtterance = null;
  setSpeechState('idle');
}

function clearActiveUtterance(): void {
  activeUtterance = null;
  setSpeechState('idle');
}

function setSpeechState(state: 'idle' | 'speaking' | 'unsupported'): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.suSpeech = state;
}
