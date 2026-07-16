import { describe, expect, it } from 'vitest';
import { DEFAULT_PROGRESS, type Progress, type Settings } from '@/lib/domain/types';
import { applyDailyCompletion, awardPoints, buyFreeze, daysBetween, evaluateOnLaunch } from '@/lib/domain/streak';

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
