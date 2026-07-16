import type { Category, DrillDayProgress, User, VideoRef } from './types';

/** Flat list of every video across a user's categories, in content order. */
export function allVideos(user: User): VideoRef[] {
  return user.categories.flatMap((c) => c.videos);
}

/** Categories that can actually be practiced (they have at least one video). */
export function practiceableCategories(user: User): Category[] {
  return user.categories.filter((c) => c.videos.length > 0);
}

/** The drill-day record iff it belongs to `todayISO`, else null (stale day). */
function dayFor(drillDay: DrillDayProgress | undefined, todayISO: string): DrillDayProgress | null {
  return drillDay && drillDay.date === todayISO ? drillDay : null;
}

/** Today's drill-day record, rolling a stale/missing one over to a fresh day. */
export function drillDayFor(drillDay: DrillDayProgress | undefined, todayISO: string): DrillDayProgress {
  return dayFor(drillDay, todayISO) ?? { date: todayISO, practiceMs: 0, finished: {} };
}

/** Extra practice time recorded today (beyond the daily goals). */
export function extraMsToday(drillDay: DrillDayProgress | undefined, todayISO: string): number {
  return dayFor(drillDay, todayISO)?.extraMs ?? 0;
}

/**
 * Practice time credited to one category today, derived from the persisted
 * finished-timer map: each finished timer of a video contributes that video's
 * timer duration. (`drillDay.practiceMs` stores the same sum across ALL
 * categories; deriving the per-category share from `finished` avoids
 * persisting a second, category-keyed counter — and old drill days from
 * builds without categories split correctly for free.)
 */
export function categoryPracticeMs(
  drillDay: DrillDayProgress | undefined,
  todayISO: string,
  category: Category,
): number {
  const day = dayFor(drillDay, todayISO);
  if (!day) return 0;
  let ms = 0;
  for (const v of category.videos) {
    const finished = day.finished[v.id];
    if (finished && v.timer) ms += finished.length * v.timer * 1000;
  }
  return ms;
}

/**
 * A category counts as complete today when its daily session auto-ended (it
 * was marked in completedCategories) or the persisted finished-timer time
 * reached its target on its own.
 */
export function isCategoryComplete(
  drillDay: DrillDayProgress | undefined,
  todayISO: string,
  category: Category,
): boolean {
  const day = dayFor(drillDay, todayISO);
  if (day?.completedCategories?.includes(category.id)) return true;
  return categoryPracticeMs(drillDay, todayISO, category) >= category.targetMinutes * 60_000;
}

/** The daily goal is earned once EVERY practiceable category is complete. */
export function allCategoriesComplete(
  drillDay: DrillDayProgress | undefined,
  todayISO: string,
  categories: Category[],
): boolean {
  const practiceable = categories.filter((c) => c.videos.length > 0);
  if (practiceable.length === 0) return false;
  return practiceable.every((c) => isCategoryComplete(drillDay, todayISO, c));
}

/**
 * Overall progress toward today's daily goal in [0, 1]: each category
 * contributes its (capped) credited practice time, weighted by its target —
 * so the single Home progress bar reflects all categories together.
 */
export function dailyGoalProgress(
  drillDay: DrillDayProgress | undefined,
  todayISO: string,
  categories: Category[],
): number {
  const practiceable = categories.filter((c) => c.videos.length > 0);
  const totalTargetMs = practiceable.reduce((a, c) => a + c.targetMinutes * 60_000, 0);
  if (totalTargetMs <= 0) return 0;
  let credited = 0;
  for (const c of practiceable) {
    const targetMs = c.targetMinutes * 60_000;
    credited += isCategoryComplete(drillDay, todayISO, c)
      ? targetMs
      : Math.min(targetMs, categoryPracticeMs(drillDay, todayISO, c));
  }
  return Math.min(1, credited / totalTargetMs);
}

/**
 * Mark a category's daily target as hit today. Idempotent; a stale drill day
 * rolls over to a fresh record for `todayISO`.
 */
export function markCategoryCompleted(
  drillDay: DrillDayProgress | undefined,
  todayISO: string,
  categoryId: string,
): DrillDayProgress {
  const day = drillDayFor(drillDay, todayISO);
  const completed = day.completedCategories ?? [];
  if (completed.includes(categoryId)) return day;
  return { ...day, completedCategories: [...completed, categoryId] };
}
