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
