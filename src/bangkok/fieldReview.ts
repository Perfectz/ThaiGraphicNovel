import { discoveries, discoveryFor, type DiscoveryId } from './discoveries.ts';
import { localDate, recordAttempt, type TrainingSave } from './learning.ts';
import type { JourneyResult } from './cityJourneys.ts';

export function fieldReviewDue(flags: string[], training: TrainingSave, today = localDate()) {
  return discoveries.filter(
    (d) =>
      flags.includes(d.id) &&
      training.fieldReviews?.[d.id] !== today &&
      (!training.records[d.phrase] || training.records[d.phrase].due <= today),
  );
}
/** A confirmed self-check updates learning only. Discovery rewards and story flags never change. */
export function recordFieldReview(
  training: TrainingSave,
  flags: string[],
  site: DiscoveryId,
  result: JourneyResult,
  today = localDate(),
) {
  const d = discoveryFor(site);
  if (!d || !flags.includes(site)) return training;
  let next = recordAttempt(training, d.phrase, 'recall', !!result.recalled && !result.hinted, today);
  if (result.spoken) next = recordAttempt(next, d.phrase, 'spoken', true, today);
  return { ...next, fieldReviews: { ...next.fieldReviews, [site]: today } };
}
