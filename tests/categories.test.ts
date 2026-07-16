import { describe, expect, it } from 'vitest';
import type { Category, DrillDayProgress, User, VideoRef } from '@/lib/domain/types';
import {
  allCategoriesComplete,
  allVideos,
  categoryPracticeMs,
  dailyGoalProgress,
  isCategoryComplete,
  markCategoryCompleted,
  practiceableCategories,
} from '@/lib/domain/categories';

const TODAY = '2026-07-16';

function video(id: string, timer?: number): VideoRef {
  const v: VideoRef = { id, url: `https://example.com/${id}`, title: id, platform: 'other' };
  if (timer !== undefined) v.timer = timer;
  return v;
}

function category(id: string, targetMinutes: number, videos: VideoRef[]): Category {
  return { id, name: id, targetMinutes, videos };
}

describe('allVideos / practiceableCategories', () => {
  const user: User = {
    id: 'u',
    name: 'U',
    categories: [
      category('ball', 10, [video('b1', 90), video('b2', 90)]),
      category('speed', 5, [video('s1', 120)]),
      category('empty', 5, []),
    ],
  };

  it('allVideos flattens every category in order', () => {
    expect(allVideos(user).map((v) => v.id)).toEqual(['b1', 'b2', 's1']);
  });

  it('practiceableCategories drops categories without videos', () => {
    expect(practiceableCategories(user).map((c) => c.id)).toEqual(['ball', 'speed']);
  });
});

describe('categoryPracticeMs', () => {
  const ball = category('ball', 10, [video('b1', 90), video('b2', 120)]);

  it('derives per-category time from the finished-timer map', () => {
    const day: DrillDayProgress = {
      date: TODAY,
      practiceMs: 90_000 * 2 + 120_000, // whole-day total (all categories)
      finished: { b1: [0, 1], b2: [2], other: [0] }, // `other` is another category's video
    };
    expect(categoryPracticeMs(day, TODAY, ball)).toBe(2 * 90_000 + 120_000);
  });

  it('a stale drill day (different date) contributes nothing', () => {
    const day: DrillDayProgress = { date: '2026-07-15', practiceMs: 500_000, finished: { b1: [0] } };
    expect(categoryPracticeMs(day, TODAY, ball)).toBe(0);
    expect(categoryPracticeMs(undefined, TODAY, ball)).toBe(0);
  });

  it('videos without a timer contribute nothing', () => {
    const cat = category('c', 10, [video('n1')]);
    const day: DrillDayProgress = { date: TODAY, practiceMs: 0, finished: { n1: [0, 1] } };
    expect(categoryPracticeMs(day, TODAY, cat)).toBe(0);
  });
});

describe('isCategoryComplete / allCategoriesComplete', () => {
  const ball = category('ball', 3, [video('b1', 90)]);   // 3 min = 2× the 90s timer
  const speed = category('speed', 2, [video('s1', 120)]); // 2 min = 1× the 120s timer

  it('complete via the completedCategories marker (auto-ended session)', () => {
    const day: DrillDayProgress = { date: TODAY, practiceMs: 0, finished: {}, completedCategories: ['ball'] };
    expect(isCategoryComplete(day, TODAY, ball)).toBe(true);
    expect(isCategoryComplete(day, TODAY, speed)).toBe(false);
  });

  it('complete once persisted finished-timer time reaches the target', () => {
    const day: DrillDayProgress = { date: TODAY, practiceMs: 180_000, finished: { b1: [0, 1] } };
    expect(isCategoryComplete(day, TODAY, ball)).toBe(true);
  });

  it('allCategoriesComplete requires every practiceable category', () => {
    const partial: DrillDayProgress = { date: TODAY, practiceMs: 0, finished: {}, completedCategories: ['ball'] };
    expect(allCategoriesComplete(partial, TODAY, [ball, speed])).toBe(false);
    const both: DrillDayProgress = { ...partial, completedCategories: ['ball', 'speed'] };
    expect(allCategoriesComplete(both, TODAY, [ball, speed])).toBe(true);
    // Empty categories are ignored; a user with no practiceable ones can't complete.
    expect(allCategoriesComplete(both, TODAY, [ball, speed, category('empty', 5, [])])).toBe(true);
    expect(allCategoriesComplete(both, TODAY, [])).toBe(false);
  });
});

describe('dailyGoalProgress', () => {
  const ball = category('ball', 10, [video('b1', 300)]);  // 10 min target
  const speed = category('speed', 5, [video('s1', 120)]); //  5 min target

  it('weights each category by its target and caps at 1', () => {
    // ball: one 5-min timer finished → 5/10; speed: marked complete → 5/5.
    const day: DrillDayProgress = {
      date: TODAY,
      practiceMs: 300_000,
      finished: { b1: [0] },
      completedCategories: ['speed'],
    };
    // (300000 + 300000) / 900000 = 2/3
    expect(dailyGoalProgress(day, TODAY, [ball, speed])).toBeCloseTo(2 / 3, 5);
  });

  it('is 0 with no drill day and 1 when everything is complete', () => {
    expect(dailyGoalProgress(undefined, TODAY, [ball, speed])).toBe(0);
    const done: DrillDayProgress = { date: TODAY, practiceMs: 0, finished: {}, completedCategories: ['ball', 'speed'] };
    expect(dailyGoalProgress(done, TODAY, [ball, speed])).toBe(1);
  });
});

describe('markCategoryCompleted', () => {
  it('marks idempotently and preserves the rest of the drill day', () => {
    const day: DrillDayProgress = { date: TODAY, practiceMs: 90_000, finished: { b1: [0] } };
    const once = markCategoryCompleted(day, TODAY, 'ball');
    expect(once.completedCategories).toEqual(['ball']);
    expect(once.practiceMs).toBe(90_000);
    expect(once.finished).toEqual({ b1: [0] });
    expect(markCategoryCompleted(once, TODAY, 'ball')).toBe(once);
  });

  it('rolls a stale drill day over to a fresh record for today', () => {
    const stale: DrillDayProgress = { date: '2026-07-15', practiceMs: 500_000, finished: { x: [0] }, completedCategories: ['ball'] };
    const next = markCategoryCompleted(stale, TODAY, 'speed');
    expect(next).toEqual({ date: TODAY, practiceMs: 0, finished: {}, completedCategories: ['speed'] });
  });
});
