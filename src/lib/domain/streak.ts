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
    const yesterdayISO = toLocalDateString(
      new Date(parseLocalDate(todayISO).getTime() - 24 * 60 * 60 * 1000),
    );
    return {
      progress: {
        ...progress,
        freezesHeld: progress.freezesHeld - 1,
        lastCompletedDate: yesterdayISO,
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
