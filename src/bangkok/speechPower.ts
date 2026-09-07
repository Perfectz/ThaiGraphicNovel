export const speechBands = ['developing', 'understandable', 'clear', 'excellent'] as const;
export type SpeechBand = (typeof speechBands)[number];
export type SpeechAssessment = {
  attemptId: string;
  turnKey: string;
  phraseId: 'hello';
  assessable: boolean;
  band: SpeechBand | null;
  heard: string;
  feedback: string;
  focus: string;
  correction: string;
};
export const speechPower = { developing: 0.7, understandable: 1, clear: 1.2, excellent: 1.4 };
export const speechLabel = { developing: 'Building clarity', understandable: 'Understandable', clear: 'Clear', excellent: 'Very clear' };
export function readSpeechAssessment(value: unknown): SpeechAssessment | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (v.phraseId !== 'hello' || typeof v.assessable !== 'boolean' ||
    typeof v.attemptId !== 'string' || !/^[\w-]{8,100}$/.test(v.attemptId) ||
    typeof v.turnKey !== 'string' || v.turnKey.length > 180 || !v.turnKey) return null;
  if (v.assessable ? !speechBands.includes(v.band as SpeechBand) : v.band !== null) return null;
  for (const key of ['heard', 'feedback', 'focus', 'correction']) {
    if (typeof v[key] !== 'string' || (v[key] as string).length > 600) return null;
  }
  return v as SpeechAssessment;
}
export function speechTurnKey(b: { id: string; round: number; turn: number; event: { seq: number } }, target: string) {
  return `${b.id}:${b.round}:${b.turn}:${b.event.seq}:${target}`;
}
export function bestSpeech(a: SpeechAssessment | null, b: SpeechAssessment) {
  if (!b.assessable || !b.band) return a;
  if (!a || a.turnKey !== b.turnKey || !a.band) return b;
  return speechPower[b.band] > speechPower[a.band] ? b : a;
}
