import { beforeEach, describe, expect, it } from 'vitest';
import { useProgressStore } from '@/store/progressStore';
import type { Category, HistoryEntry, VideoRef } from '@/lib/domain/types';
import { DEFAULT_PROGRESS } from '@/lib/domain/types';

const TODAY = '2026-07-16';

const video = (id: string, timer: number): VideoRef => ({
  id, url: `https://example.com/${id}`, title: id, platform: 'other', timer,
});

// Ball needs 600s but its videos only persist 90s per finished timer, so its
// completion relies on the completedCategories marker, not derived time.
const ball: Category = { id: 'ball', name: 'Ball', targetMinutes: 10, videos: [video('b1', 90)] };
const speed: Category = { id: 'speed', name: 'Speed', targetMinutes: 2, videos: [video('s1', 120)] };
const CATS = [ball, speed];

const entry = (categoryId: string): Omit<HistoryEntry, 'completedDaily'> => ({
  date: TODAY, startedAt: 1, mode: 'daily', practiceMs: 0, pointsEarned: 0, videoIds: [], categoryId,
});

const SETTINGS_FIXTURE = {
  defaultCategoryTargetMinutes: 15,
  pointsPerExtraMinute: 10,
  freezeCostPoints: 100,
  maxFreezesHeld: 1,
  recycleWhenLibraryExhausted: true,
};

beforeEach(() => {
  localStorage.clear();
  useProgressStore.setState({
    vault: { vaultVersion: 2, activeUserId: 'leon', users: { leon: { ...DEFAULT_PROGRESS } } },
    activeUserId: 'leon',
    progress: { ...DEFAULT_PROGRESS },
  });
});

describe('creditDailyCategory', () => {
  it('marks the category but withholds the streak until every category is done', () => {
    const first = useProgressStore.getState().creditDailyCategory(TODAY, ball, CATS, entry('ball'));
    expect(first).toBe(false);
    let p = useProgressStore.getState().progress;
    expect(p.drillDay?.completedCategories).toEqual(['ball']);
    expect(p.currentStreak).toBe(0);
    expect(p.lastCompletedDate).toBeNull();
    expect(p.history[p.history.length - 1]).toMatchObject({ categoryId: 'ball', completedDaily: false });

    const second = useProgressStore.getState().creditDailyCategory(TODAY, speed, CATS, entry('speed'));
    expect(second).toBe(true);
    p = useProgressStore.getState().progress;
    expect(p.drillDay?.completedCategories).toEqual(['ball', 'speed']);
    expect(p.currentStreak).toBe(1);
    expect(p.lastCompletedDate).toBe(TODAY);
    expect(p.history[p.history.length - 1]).toMatchObject({ categoryId: 'speed', completedDaily: true });
  });
});

describe('markDayDone', () => {
  it('credits today and marks every category complete without drilling', () => {
    useProgressStore.getState().markDayDone(TODAY, TODAY, CATS);
    const p = useProgressStore.getState().progress;
    expect(p.currentStreak).toBe(1);
    expect(p.longestStreak).toBe(1);
    expect(p.lastCompletedDate).toBe(TODAY);
    expect(p.completedDates).toEqual([TODAY]);
    expect(p.drillDay?.completedCategories).toEqual(['ball', 'speed']);
    expect(p.history[p.history.length - 1]).toMatchObject({
      mode: 'manual', completedDaily: true, practiceMs: 0,
    });
  });

  it('is idempotent for a day already done — no double streak, no duplicate entry', () => {
    useProgressStore.getState().markDayDone(TODAY, TODAY, CATS);
    useProgressStore.getState().markDayDone(TODAY, TODAY, CATS);
    const p = useProgressStore.getState().progress;
    expect(p.currentStreak).toBe(1);
    expect(p.history.filter((h) => h.mode === 'manual')).toHaveLength(1);
  });

  it('backfills a past day and extends the streak by bridging a gap', () => {
    // Live streak with a hole: 14th done, 15th missing, 16th (today) done.
    const twoAgo = '2026-07-14';
    const yesterday = '2026-07-15';
    useProgressStore.setState({
      vault: { vaultVersion: 2, activeUserId: 'leon', users: { leon: { ...DEFAULT_PROGRESS } } },
      activeUserId: 'leon',
      progress: { ...DEFAULT_PROGRESS, currentStreak: 1, longestStreak: 2, lastCompletedDate: TODAY, completedDates: [twoAgo, TODAY] },
    });
    // Backfill yesterday → 14th, 15th, 16th are now consecutive.
    useProgressStore.getState().markDayDone(yesterday, TODAY, CATS);
    const p = useProgressStore.getState().progress;
    expect(p.completedDates).toEqual([twoAgo, yesterday, TODAY]);
    expect(p.currentStreak).toBe(3);
    expect(p.longestStreak).toBe(3);
    expect(p.lastCompletedDate).toBe(TODAY);
    // Past days don't touch today's drill/category record.
    expect(p.drillDay).toBeUndefined();
  });

  it('ignores future days', () => {
    useProgressStore.getState().markDayDone('2026-07-20', TODAY, CATS);
    const p = useProgressStore.getState().progress;
    expect(p.currentStreak).toBe(0);
    expect(p.completedDates).toEqual([]);
  });
});

describe('extra-time tally', () => {
  it('bankExtraTime awards points and adds to today\'s extra tally', () => {
    const earned = useProgressStore.getState().bankExtraTime(SETTINGS_FIXTURE, {
      date: TODAY, startedAt: 1, mode: 'extra', practiceMs: 150_000, videoIds: [], categoryId: 'ball',
    });
    expect(earned).toBe(25); // 2.5 min × 10 pts
    const p = useProgressStore.getState().progress;
    expect(p.points).toBe(25);
    expect(p.drillDay?.extraMs).toBe(150_000);
    // A second banking on the same day accumulates.
    useProgressStore.getState().bankExtraTime(SETTINGS_FIXTURE, {
      date: TODAY, startedAt: 2, mode: 'extra', practiceMs: 30_000, videoIds: [],
    });
    expect(useProgressStore.getState().progress.drillDay?.extraMs).toBe(180_000);
  });

  it('creditDailyCategory records goal-session overshoot as extra time', () => {
    useProgressStore.getState().creditDailyCategory(TODAY, ball, CATS, entry('ball'), 42_000);
    const p = useProgressStore.getState().progress;
    expect(p.drillDay?.completedCategories).toEqual(['ball']);
    expect(p.drillDay?.extraMs).toBe(42_000);
    // No overshoot leaves the tally untouched.
    useProgressStore.getState().creditDailyCategory(TODAY, speed, CATS, entry('speed'), 0);
    expect(useProgressStore.getState().progress.drillDay?.extraMs).toBe(42_000);
  });
});

describe('recordDrillFinished', () => {
  it('preserves completedCategories when a later drill timer is persisted', () => {
    // Complete ball (marker only — derived time stays below its target)…
    useProgressStore.getState().creditDailyCategory(TODAY, ball, CATS, entry('ball'));
    // …then finish a speed timer. The ball marker must survive.
    useProgressStore.getState().recordDrillFinished(TODAY, 's1', 0, 120_000);
    const p = useProgressStore.getState().progress;
    expect(p.drillDay?.completedCategories).toEqual(['ball']);
    expect(p.drillDay?.finished).toEqual({ s1: [0] });
    // With the marker intact, completing speed now credits the streak.
    const allDone = useProgressStore.getState().creditDailyCategory(TODAY, speed, CATS, entry('speed'));
    expect(allDone).toBe(true);
    expect(useProgressStore.getState().progress.currentStreak).toBe(1);
  });

  it('preserves the extra-time tally when a drill timer is persisted', () => {
    useProgressStore.getState().bankExtraTime(SETTINGS_FIXTURE, {
      date: TODAY, startedAt: 1, mode: 'extra', practiceMs: 90_000, videoIds: [],
    });
    useProgressStore.getState().recordDrillFinished(TODAY, 'b1', 0, 90_000);
    expect(useProgressStore.getState().progress.drillDay?.extraMs).toBe(90_000);
  });

  it('is idempotent per timer index and accumulates practiceMs', () => {
    const s = useProgressStore.getState();
    s.recordDrillFinished(TODAY, 'b1', 0, 90_000);
    useProgressStore.getState().recordDrillFinished(TODAY, 'b1', 0, 90_000);
    useProgressStore.getState().recordDrillFinished(TODAY, 'b1', 1, 90_000);
    const p = useProgressStore.getState().progress;
    expect(p.drillDay?.practiceMs).toBe(180_000);
    expect(p.drillDay?.finished).toEqual({ b1: [0, 1] });
  });
});
