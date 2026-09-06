import { lessonScenarios } from '../data/lessonScenarios';
import type { ThaiPhrase } from '../data/thaiPhrases';
import { duePhrases, type TrainingSave } from './learning';

export const phrases: Record<string, ThaiPhrase> = Object.fromEntries(lessonScenarios.slice(0, 9).flatMap(s => s.chunks.flatMap(c => c.phrases)).map(p => [p.id, p]));
export type District = 'hotel' | 'market' | 'river';
const locations = ['Riverside hotel', 'The reception desk', 'Talat Noi night market', 'The taxi pier', 'The floating market', 'Neighbourhood pharmacy', 'Riverside café', 'Finding your way', 'Getting assistance'];
export type TrainingDay = { day: number; title: string; location: string; objective: string; phraseIds: string[]; district: District; chapter: string };
export const days: TrainingDay[] = lessonScenarios.slice(0, 9).flatMap((s, i) => s.chunks.map((c, j) => ({
  day: i * 3 + j + 1, title: c.title, location: locations[i], objective: c.objective,
  phraseIds: c.phrases.map(p => p.id), district: (i < 2 ? 'hotel' : i === 2 || i === 4 || i === 5 ? 'market' : 'river') as District,
  chapter: ['A stranger in Bangkok', 'A room for the night', 'The city tastes like this', 'Across the river', 'A fair exchange', 'A little help', 'New friends', 'Find your way home', 'Words open doors'][i],
}))).concat([
  { day: 28, title: 'Arrival rehearsal', location: 'Riverside hotel', objective: 'Greet someone, check in, ask for clarification, and find your room.', phraseIds: ['hello', 'reservation-have', 'under-name', 'speak-slowly', 'key-where', 'thank-you'], district: 'hotel', chapter: 'Ready for Thailand' },
  { day: 29, title: 'A day in Bangkok', location: 'Talat Noi night market', objective: 'Order a meal, choose the spice level, request water, and pay.', phraseIds: ['hello', 'want-this', 'one-plate', 'not-spicy', 'water-please', 'bill-please', 'delicious'], district: 'market', chapter: 'Ready for Thailand' },
  { day: 30, title: 'Departure trial', location: 'The river of words', objective: 'Recall your essential travel phrases without a script. Revisit anything that still feels difficult.', phraseIds: ['hello', 'sorry', 'how-much', 'bathroom-where', 'say-again', 'thank-you'], district: 'river', chapter: 'Your journey begins' },
]);
export const activities = [
  { name: 'Campfire review', short: 'Review', minutes: 5, icon: '✦', description: 'Bring yesterday’s words back. Due phrases come first.', mode: 'recall' },
  { name: 'Listen & echo', short: 'Listen', minutes: 10, icon: '♫', description: 'Hear each phrase. Say it slowly, then at a natural pace.', mode: 'study' },
  { name: 'City quest', short: 'Quest', minutes: 15, icon: '◇', description: 'Choose useful Thai for a real travel situation.', mode: 'choice' },
  { name: 'Speaking dojo', short: 'Speak', minutes: 15, icon: '◉', description: 'Record, listen back, and compare. Try the voice coach if you like.', mode: 'spoken' },
  { name: 'Rift trial', short: 'Recall', minutes: 10, icon: '⚡', description: 'Say the answer before revealing it. Your memory powers the party.', mode: 'recall' },
  { name: 'Travel journal', short: 'Reflect', minutes: 5, icon: '▤', description: 'Rehearse the phrases you will use tomorrow. Save what needs work.', mode: 'recall' },
] as const;
export function queueFor(save: TrainingSave, day: TrainingDay, activity: number): string[] {
  const learned = days.filter(d => d.day <= day.day).flatMap(d => d.phraseIds);
  // City conversations can introduce phrases ahead of the camp's current day.
  const due = duePhrases(save, [...new Set([...learned, ...Object.keys(save.records).filter(id => phrases[id])])]).slice(0, 8);
  const all = [...new Set([...day.phraseIds, ...due])];
  if (activity === 0) return due.length ? due : day.phraseIds;
  if (activity === 1) return [...day.phraseIds, ...day.phraseIds];
  if (activity === 2) return [...day.phraseIds, ...day.phraseIds.slice().reverse()];
  if (activity === 3) return [...all, ...day.phraseIds];
  if (activity === 4) return all.slice().reverse();
  return all.filter(id => (save.records[id]?.interval ?? 0) < 3).slice(0, 6).concat(day.phraseIds.slice(0, 1));
}
export function choicesFor(id: string, day: TrainingDay, index: number): ThaiPhrase[] {
  const pool = [...day.phraseIds, ...Object.keys(phrases)].filter((p, i, a) => p !== id && a.indexOf(p) === i);
  const distractors = [pool[index % pool.length], pool[(index + 1) % pool.length]];
  const ids = [...distractors]; ids.splice(index % 3, 0, id);
  return ids.map(p => phrases[p]);
}
export function situationFor(id: string, variant: number): string {
  const situations: Record<string, string[]> = {
    hello: ['Su waves from the lantern-lit terrace. Greet her.', 'You step up to a new counter. Open politely.'],
    'my-name-is-patrick': ['“And what should I call you?” Su asks.', 'The receptionist needs your name. Introduce yourself.'],
    'nice-to-meet-you': ['“I’m Su. Welcome to Bangkok.” Reply warmly.', 'You have just been introduced to your guide.'],
    'thank-you': ['Su hands you a little travel notebook. Thank her.', 'Someone has just helped you find your way.'],
    sorry: ['You brush against someone’s luggage. Apologise.', 'Get a busy shopkeeper’s attention politely.'],
    'reservation-have': ['The receptionist asks whether you booked ahead.', 'Explain that you already have a reservation.'],
    'speak-slowly': ['The room directions came too quickly. Ask for slower speech.', 'You caught a few words, but the speaker is going too fast.'],
    'not-spicy': ['The cook reaches for the chillies. You want your meal without heat.', 'Make your spice preference clear before the food is cooked.'],
    'say-again': ['You missed the last thing the clerk said. Ask to hear it again.', 'A passing boat drowned out the answer.'],
    'water-please': ['Your food has arrived. Ask for plain water.', 'You are thirsty after walking around the market.'],
    'bill-please': ['Dinner is finished. Ask to pay.', 'You need to settle up before catching the ferry.'],
  };
  return situations[id]?.[variant % 2] ?? `${phrases[id].context} Your intention: “${phrases[id].translation}”.`;
}
