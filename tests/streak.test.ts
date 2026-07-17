import { describe, expect, it } from 'vitest';
import { DEFAULT_PROGRESS, type Progress, type Settings } from '@/lib/domain/types';
import {
  addCompletedDate,
  addDays,
  applyDailyCompletion,
  awardPoints,
  buyFreeze,
  daysBetween,
  evaluateOnLaunch,
  recomputeStreak,
  seedCompletedDates,
} from '@/lib/domain/streak';

const settings: Settings = {
  defaultCategoryTargetMinutes: 20,
  pointsPerExtraMinute: 10,
  freezeCostPoints: 100,
  maxFreezesHeld: 1,
  recycleWhenLibraryExhausted: true,
};

function make(overrides: Partial<Progress> = {}): Progress {
  return { ...DEFAULT_PROGRESS, ...overrides };
}

describe('daysBetween', () => {
  it('handles day boundaries', () => {
    expect(daysBetween('2026-07-14', '2026-07-15')).toBe(1);
    expect(daysBetween('2026-07-15', '2026-07-15')).toBe(0);
    expect(daysBetween('2026-07-10', '2026-07-15')).toBe(5);
  });
});

describe('evaluateOnLaunch', () => {
  it('lastCompletedDate=null → no-op', () => {
    const r = evaluateOnLaunch(make(), '2026-07-15');
    expect(r.freezeConsumed).toBe(false);
    expect(r.streakReset).toBe(false);
    expect(r.progress).toEqual(make());
  });

  it('same day → no change, no freeze consumed', () => {
    const p = make({ currentStreak: 5, lastCompletedDate: '2026-07-15', freezesHeld: 1 });
    const r = evaluateOnLaunch(p, '2026-07-15');
    expect(r.progress).toEqual(p);
    expect(r.freezeConsumed).toBe(false);
  });

  it('completed yesterday (gap=1) → nothing to do, streak intact', () => {
    const p = make({ currentStreak: 5, lastCompletedDate: '2026-07-14', freezesHeld: 1 });
    const r = evaluateOnLaunch(p, '2026-07-15');
    expect(r.progress).toEqual(p);
    expect(r.freezeConsumed).toBe(false);
    expect(r.streakReset).toBe(false);
  });

  it('missed yesterday (gap=2) with freeze → consume freeze, preserve streak, roll lastCompletedDate to yesterday', () => {
    const p = make({ currentStreak: 5, lastCompletedDate: '2026-07-13', freezesHeld: 1 });
    const r = evaluateOnLaunch(p, '2026-07-15');
    expect(r.freezeConsumed).toBe(true);
    expect(r.streakReset).toBe(false);
    expect(r.progress.currentStreak).toBe(5);
    expect(r.progress.freezesHeld).toBe(0);
    expect(r.progress.lastCompletedDate).toBe('2026-07-14');
    // The freeze-covered day is recorded, and flagged frozen for the calendar.
    expect(r.progress.completedDates).toContain('2026-07-14');
    expect(r.progress.frozenDates).toEqual(['2026-07-14']);
  });

  it('missed yesterday with no freeze → streak resets', () => {
    const p = make({ currentStreak: 5, lastCompletedDate: '2026-07-13', freezesHeld: 0 });
    const r = evaluateOnLaunch(p, '2026-07-15');
    expect(r.streakReset).toBe(true);
    expect(r.freezeConsumed).toBe(false);
    expect(r.progress.currentStreak).toBe(0);
  });

  it('two-day gap with a freeze → freeze does NOT rescue, streak resets', () => {
    const p = make({ currentStreak: 5, lastCompletedDate: '2026-07-12', freezesHeld: 1 });
    const r = evaluateOnLaunch(p, '2026-07-15');
    expect(r.streakReset).toBe(true);
    expect(r.freezeConsumed).toBe(false);
    expect(r.progress.currentStreak).toBe(0);
    expect(r.progress.freezesHeld).toBe(1); // untouched
  });
});

describe('applyDailyCompletion', () => {
  it('increments streak and updates longest', () => {
    const p = make({ currentStreak: 4, longestStreak: 4 });
    const p2 = applyDailyCompletion(p, '2026-07-15');
    expect(p2.currentStreak).toBe(5);
    expect(p2.longestStreak).toBe(5);
    expect(p2.lastCompletedDate).toBe('2026-07-15');
  });
  it('idempotent within the same day', () => {
    const p = make({ currentStreak: 4, lastCompletedDate: '2026-07-15' });
    expect(applyDailyCompletion(p, '2026-07-15')).toEqual(p);
  });
  it('does not reduce longest', () => {
    const p = make({ currentStreak: 2, longestStreak: 20 });
    const p2 = applyDailyCompletion(p, '2026-07-15');
    expect(p2.longestStreak).toBe(20);
  });
});

describe('addDays / addCompletedDate', () => {
  it('shifts dates across month boundaries', () => {
    expect(addDays('2026-07-01', -1)).toBe('2026-06-30');
    expect(addDays('2026-07-31', 1)).toBe('2026-08-01');
  });
  it('dedupes and sorts the completed set', () => {
    expect(addCompletedDate(['2026-07-15', '2026-07-13'], '2026-07-14')).toEqual([
      '2026-07-13', '2026-07-14', '2026-07-15',
    ]);
    expect(addCompletedDate(['2026-07-15'], '2026-07-15')).toEqual(['2026-07-15']);
  });
});

describe('recomputeStreak', () => {
  it('empty set → all zero', () => {
    expect(recomputeStreak([], '2026-07-16')).toEqual({ currentStreak: 0, longestStreak: 0, lastCompletedDate: null });
  });
  it('counts the live run ending today', () => {
    const r = recomputeStreak(['2026-07-14', '2026-07-15', '2026-07-16'], '2026-07-16');
    expect(r).toEqual({ currentStreak: 3, longestStreak: 3, lastCompletedDate: '2026-07-16' });
  });
  it('keeps the streak live when the last day is yesterday', () => {
    const r = recomputeStreak(['2026-07-14', '2026-07-15'], '2026-07-16');
    expect(r.currentStreak).toBe(2);
    expect(r.lastCompletedDate).toBe('2026-07-15');
  });
  it('current streak is 0 when the last completed day is too old, but longest survives', () => {
    const r = recomputeStreak(['2026-07-10', '2026-07-11', '2026-07-12'], '2026-07-16');
    expect(r.currentStreak).toBe(0);
    expect(r.longestStreak).toBe(3);
    expect(r.lastCompletedDate).toBe('2026-07-12');
  });
  it('only the run adjacent to today counts as current; earlier runs feed longest', () => {
    const r = recomputeStreak(
      ['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-15', '2026-07-16'],
      '2026-07-16',
    );
    expect(r.currentStreak).toBe(2);
    expect(r.longestStreak).toBe(4);
  });
  it('ignores future dates', () => {
    const r = recomputeStreak(['2026-07-16', '2026-07-17'], '2026-07-16');
    expect(r.lastCompletedDate).toBe('2026-07-16');
    expect(r.currentStreak).toBe(1);
  });
});

describe('seedCompletedDates', () => {
  it('unions completed-daily history with the current streak run', () => {
    const seeded = seedCompletedDates({
      history: [
        { date: '2026-07-01', completedDaily: true },
        { date: '2026-07-02', completedDaily: false },
        { date: '2026-07-10', completedDaily: true },
      ],
      currentStreak: 2,
      lastCompletedDate: '2026-07-16',
    });
    // history-derived days + the 2-day run ending 2026-07-16 (15th & 16th).
    expect(seeded).toEqual(['2026-07-01', '2026-07-10', '2026-07-15', '2026-07-16']);
  });
  it('handles missing history and zero streak', () => {
    expect(seedCompletedDates({ currentStreak: 0, lastCompletedDate: null })).toEqual([]);
  });
});

describe('awardPoints', () => {
  it('floors fractional minutes', () => {
    const { progress, earned } = awardPoints(make(), 2.7, 10);
    expect(earned).toBe(27);
    expect(progress.points).toBe(27);
  });
});

describe('buyFreeze', () => {
  it('enforces maxFreezesHeld', () => {
    const p = make({ points: 999, freezesHeld: 1 });
    const r = buyFreeze(p, settings);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('at_max_freezes');
  });
  it('enforces cost', () => {
    const p = make({ points: 50, freezesHeld: 0 });
    const r = buyFreeze(p, settings);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not_enough_points');
  });
  it('purchase: subtracts points and adds a freeze', () => {
    const p = make({ points: 250, freezesHeld: 0 });
    const r = buyFreeze(p, settings);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.progress.points).toBe(150);
      expect(r.progress.freezesHeld).toBe(1);
    }
  });
});
