/** Serializable learning state. Recognition, recall, and spoken practice stay separate. */
export type SkillRecord = {
  seen: number;
  recalled: number;
  spoken: number;
  interval: number;
  due: string;
  lastRecall?: string;
};
export type AttemptKind = 'study' | 'choice' | 'recall' | 'spoken' | 'coach';
export type TrainingSave = {
  version: 1;
  day: number;
  xp: number;
  records: Record<string, SkillRecord>;
  fieldReviews?: Record<string, string>;
  completed: Record<string, number[]>;
  minutes: Record<string, number>;
  dailyPractice: Record<string, { seconds: number; spoken: number; recalls: number }>;
  session: { day: number; activity: number; index: number; queue: string[]; correct: number } | null;
};
export const TRAINING_KEY = 'bangkok-rift-training-v1';
export const freshTraining = (): TrainingSave => ({
  version: 1,
  day: 1,
  xp: 0,
  records: {},
  completed: {},
  minutes: {},
  dailyPractice: {},
  session: null,
});
export function addPracticeTime(save: TrainingSave, seconds: number, today = localDate()): TrainingSave {
  if (!Number.isFinite(seconds) || seconds <= 0) return save;
  const daily = save.dailyPractice[today] ?? { seconds: 0, spoken: 0, recalls: 0 };
  return {
    ...save,
    dailyPractice: {
      ...save.dailyPractice,
      [today]: { ...daily, seconds: Math.min(86400, daily.seconds + seconds) },
    },
  };
}
export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return localDate(new Date(y, m - 1, d + days, 12));
}
export function recordAttempt(
  save: TrainingSave,
  id: string,
  kind: AttemptKind,
  success: boolean,
  today = localDate(),
): TrainingSave {
  const old = save.records[id] ?? { seen: 0, recalled: 0, spoken: 0, interval: 0, due: today };
  const item = { ...old, seen: old.seen + 1 };
  if ((kind === 'spoken' || kind === 'coach') && success) item.spoken += 1;
  // Multiple same-day repeats cannot turn one successful recall into weeks of mastery.
  if (kind === 'recall') {
    if (!success) {
      item.interval = 0;
      item.due = today;
    } else if (item.lastRecall !== today) {
      item.recalled += 1;
      item.interval = old.interval === 0 ? 1 : Math.min(14, old.interval * 2 + 1);
      item.due = addDays(today, item.interval);
      item.lastRecall = today;
    }
  }
  const xp = success ? (kind === 'recall' ? 12 : kind === 'spoken' || kind === 'coach' ? 10 : 5) : 0;
  const daily = save.dailyPractice[today] ?? { seconds: 0, spoken: 0, recalls: 0 };
  return {
    ...save,
    xp: save.xp + xp,
    records: { ...save.records, [id]: item },
    dailyPractice: {
      ...save.dailyPractice,
      [today]: {
        ...daily,
        spoken: daily.spoken + (success && (kind === 'spoken' || kind === 'coach') ? 1 : 0),
        recalls: daily.recalls + (kind === 'recall' ? 1 : 0),
      },
    },
  };
}
export function duePhrases(save: TrainingSave, allowed: string[], today = localDate()): string[] {
  return allowed
    .filter((id) => save.records[id] && save.records[id].due <= today)
    .sort(
      (a, b) =>
        save.records[a].due.localeCompare(save.records[b].due) ||
        save.records[a].recalled - save.records[b].recalled,
    );
}
export function normalizeTraining(value: unknown): TrainingSave {
  if (!value || typeof value !== 'object') return freshTraining();
  const v = value as Partial<TrainingSave>;
  if (v.version !== 1) return freshTraining();
  const next = freshTraining();
  next.day = Number.isInteger(v.day) ? Math.max(1, Math.min(30, v.day!)) : 1;
  next.xp = Number.isFinite(v.xp) ? Math.max(0, v.xp!) : 0;
  if (v.fieldReviews && typeof v.fieldReviews === 'object') {
    next.fieldReviews = Object.fromEntries(
      Object.entries(v.fieldReviews).filter(
        ([id, date]) =>
          /^[a-z-]{1,50}$/.test(id) && typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date),
      ),
    );
  }
  for (const [id, r] of Object.entries(v.records ?? {})) {
    if (
      r &&
      [r.seen, r.recalled, r.spoken, r.interval].every((n) => Number.isFinite(n) && n >= 0) &&
      /^\d{4}-\d{2}-\d{2}$/.test(r.due)
    )
      next.records[id] = r;
  }
  for (const [day, ids] of Object.entries(v.completed ?? {})) {
    if (Array.isArray(ids))
      next.completed[day] = [...new Set(ids.filter((i) => Number.isInteger(i) && i >= 0 && i < 6))];
  }
  for (const [date, seconds] of Object.entries(v.minutes ?? {}))
    if (Number.isFinite(seconds) && seconds >= 0) next.minutes[date] = seconds;
  for (const [date, daily] of Object.entries(v.dailyPractice ?? {})) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !daily ||
      ![daily.seconds, daily.spoken, daily.recalls].every((n) => Number.isFinite(n) && n >= 0)
    )
      continue;
    next.dailyPractice[date] = {
      seconds: Math.min(86400, daily.seconds),
      spoken: Math.floor(daily.spoken),
      recalls: Math.floor(daily.recalls),
    };
  }
  const s = v.session;
  if (
    s &&
    Number.isInteger(s.day) &&
    s.day >= 1 &&
    s.day <= 30 &&
    Number.isInteger(s.activity) &&
    s.activity >= 0 &&
    s.activity < 6 &&
    Array.isArray(s.queue) &&
    s.queue.length > 0 &&
    s.queue.every((id) => typeof id === 'string') &&
    Number.isInteger(s.index) &&
    s.index >= 0 &&
    s.index < s.queue.length &&
    Number.isFinite(s.correct) &&
    s.correct >= 0
  )
    next.session = s;
  return next;
}
export function readTraining(): TrainingSave {
  try {
    return normalizeTraining(JSON.parse(localStorage.getItem(TRAINING_KEY) ?? 'null'));
  } catch {
    return freshTraining();
  }
}
export function persistTraining(save: TrainingSave): boolean {
  try {
    localStorage.setItem(TRAINING_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}
export function finishActivity(save: TrainingSave): TrainingSave {
  if (!save.session) return save;
  const { day, activity } = save.session;
  return {
    ...save,
    session: null,
    completed: { ...save.completed, [day]: [...new Set([...(save.completed[day] ?? []), activity])] },
  };
}
