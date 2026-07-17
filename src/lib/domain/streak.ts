import type { Progress, Settings } from './types';

/** Format a Date as local YYYY-MM-DD. */
export function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse a YYYY-MM-DD string into a local-midnight Date. */
export function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map((x) => Number(x));
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

/** Whole-day difference between two local YYYY-MM-DD strings (b - a). */
export function daysBetween(a: string, b: string): number {
  const da = parseLocalDate(a).getTime();
  const db = parseLocalDate(b).getTime();
  return Math.round((db - da) / (1000 * 60 * 60 * 24));
}

/** `dateISO` shifted by `delta` whole days (local calendar). */
export function addDays(dateISO: string, delta: number): string {
  return toLocalDateString(new Date(parseLocalDate(dateISO).getTime() + delta * 24 * 60 * 60 * 1000));
}

/** Add a completed day to the set, returned deduped and sorted ascending. */
export function addCompletedDate(dates: string[] | undefined, dateISO: string): string[] {
  const set = new Set(dates ?? []);
  set.add(dateISO);
  return [...set].sort();
}

/**
 * Derive streak facts purely from the set of completed days:
 *  - longestStreak: the longest consecutive run anywhere in the set.
 *  - lastCompletedDate: the most recent completed day on or before today.
 *  - currentStreak: the run ending at lastCompletedDate, but only while that
 *    day is today or yesterday (older than that, the streak is no longer live).
 * Future dates are ignored. This is the basis for retroactively marking past
 * days done: recompute from the full set rather than mutating a running count.
 */
export function recomputeStreak(
  dates: string[],
  todayISO: string,
): { currentStreak: number; longestStreak: number; lastCompletedDate: string | null } {
  const sorted = [...new Set(dates)].filter((d) => d <= todayISO).sort();
  if (sorted.length === 0) return { currentStreak: 0, longestStreak: 0, lastCompletedDate: null };

  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    run = daysBetween(sorted[i - 1]!, sorted[i]!) === 1 ? run + 1 : 1;
    if (run > longest) longest = run;
  }

  const last = sorted[sorted.length - 1]!;
  let current = 0;
  if (daysBetween(last, todayISO) <= 1) {
    current = 1;
    for (let i = sorted.length - 2; i >= 0; i--) {
      if (daysBetween(sorted[i]!, sorted[i + 1]!) === 1) current++;
      else break;
    }
  }
  return { currentStreak: current, longestStreak: longest, lastCompletedDate: last };
}

/**
 * Seed the completed-days set for a Progress record persisted before the set
 * existed: every day a history entry credited the daily goal, plus the days
 * that make up the current streak (which may include freeze-covered days that
 * never produced a history entry). Used once by the schema migration so old
 * users see their real calendar.
 */
export function seedCompletedDates(raw: {
  history?: unknown;
  currentStreak?: unknown;
  lastCompletedDate?: unknown;
}): string[] {
  const set = new Set<string>();
  if (Array.isArray(raw.history)) {
    for (const h of raw.history) {
      if (h && typeof h === 'object' && (h as any).completedDaily && typeof (h as any).date === 'string') {
        set.add((h as any).date);
      }
    }
  }
  const streak = Number.isFinite(raw.currentStreak) ? (raw.currentStreak as number) : 0;
  const last = typeof raw.lastCompletedDate === 'string' ? raw.lastCompletedDate : null;
  if (last && streak > 0) {
    for (let i = 0; i < streak; i++) set.add(addDays(last, -i));
  }
  return [...set].sort();
}

export interface EvaluationResult {
  progress: Progress;
  freezeConsumed: boolean;
  streakReset: boolean;
}

/**
 * Called on app launch. Decides whether the streak survives, dies, or gets
 * saved by a freeze — based on the local-calendar gap since lastCompletedDate.
 *
 *   gap = 0  → same day, no-op.
 *   gap = 1  → completed yesterday, today is fresh — nothing to do (they still
 *              have all of today to complete).
 *   gap = 2  → skipped yesterday. If freezesHeld > 0, consume one and pretend
 *              yesterday was completed. Otherwise streak resets.
 *   gap ≥ 3  → too many missed days; freezes do NOT rescue this.
 */
export function evaluateOnLaunch(progress: Progress, todayISO: string): EvaluationResult {
  if (progress.lastCompletedDate == null) {
    return { progress, freezeConsumed: false, streakReset: false };
  }
  const gap = daysBetween(progress.lastCompletedDate, todayISO);
  if (gap <= 1) {
    return { progress, freezeConsumed: false, streakReset: false };
  }
  if (gap === 2 && progress.freezesHeld > 0) {
    const yesterdayISO = addDays(todayISO, -1);
    return {
      progress: {
        ...progress,
        freezesHeld: progress.freezesHeld - 1,
        lastCompletedDate: yesterdayISO,
        // Record the freeze-covered day so the calendar shows it filled and a
        // later backfill recompute keeps the run intact…
        completedDates: addCompletedDate(progress.completedDates, yesterdayISO),
        // …and mark it frozen so the calendar renders it distinctly.
        frozenDates: addCompletedDate(progress.frozenDates, yesterdayISO),
      },
      freezeConsumed: true,
      streakReset: false,
    };
  }
  // Streak dies.
  return {
    progress: { ...progress, currentStreak: 0 },
    freezeConsumed: false,
    streakReset: true,
  };
}

/** Credit the daily streak for `todayISO`. Idempotent per day. */
export function applyDailyCompletion(progress: Progress, todayISO: string): Progress {
  if (progress.lastCompletedDate === todayISO) return progress;
  const nextStreak = progress.currentStreak + 1;
  return {
    ...progress,
    currentStreak: nextStreak,
    longestStreak: Math.max(progress.longestStreak, nextStreak),
    lastCompletedDate: todayISO,
    completedDates: addCompletedDate(progress.completedDates, todayISO),
  };
}

export function awardPoints(progress: Progress, minutes: number, pointsPerMinute: number): { progress: Progress; earned: number } {
  const earned = Math.max(0, Math.floor(minutes * pointsPerMinute));
  return { progress: { ...progress, points: progress.points + earned }, earned };
}

export type PurchaseResult =
  | { ok: true; progress: Progress }
  | { ok: false; reason: 'not_enough_points' | 'at_max_freezes' };

export function buyFreeze(progress: Progress, settings: Settings): PurchaseResult {
  if (progress.freezesHeld >= settings.maxFreezesHeld) {
    return { ok: false, reason: 'at_max_freezes' };
  }
  if (progress.points < settings.freezeCostPoints) {
    return { ok: false, reason: 'not_enough_points' };
  }
  return {
    ok: true,
    progress: {
      ...progress,
      points: progress.points - settings.freezeCostPoints,
      freezesHeld: progress.freezesHeld + 1,
    },
  };
}
