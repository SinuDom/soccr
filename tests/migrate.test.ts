import { describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA_VERSION } from '@/lib/domain/types';
import { migrate } from '@/lib/storage/migrate';

describe('migrate', () => {
  it('a v0-style object (no schemaVersion) is upgraded losslessly', () => {
    const v0 = {
      currentStreak: 8,
      longestStreak: 12,
      points: 500,
      freezesHeld: 1,
      seenVideoIds: ['a', 'b'],
      lastCompletedDate: '2026-07-14',
      history: [{ date: '2026-07-14', startedAt: 1, mode: 'daily', practiceMs: 100, pointsEarned: 0, videoIds: ['a'] }],
      // no cycleNumber, no schemaVersion
    };
    const p = migrate(v0);
    expect(p.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(p.currentStreak).toBe(8);
    expect(p.longestStreak).toBe(12);
    expect(p.points).toBe(500);
    expect(p.freezesHeld).toBe(1);
    expect(p.seenVideoIds).toEqual(['a', 'b']);
    expect(p.lastCompletedDate).toBe('2026-07-14');
    expect(p.history).toEqual(v0.history);
    // Default filled in.
    expect(p.cycleNumber).toBe(1);
  });

  it('a well-formed current-version object is returned as-is (with defaults for any missing optional fields)', () => {
    const p = migrate({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      currentStreak: 3,
      longestStreak: 3,
      lastCompletedDate: null,
      points: 0,
      freezesHeld: 0,
      seenVideoIds: [],
      cycleNumber: 1,
      history: [],
    });
    expect(p.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(p.currentStreak).toBe(3);
  });

  it('a future-schema object keeps unknown fields and does not lose known ones', () => {
    const future = {
      schemaVersion: 99,
      currentStreak: 4,
      points: 20,
      seenVideoIds: ['x'],
      history: [],
      someFutureField: 'hi',
    };
    const p = migrate(future);
    expect(p.schemaVersion).toBe(99);
    expect(p.currentStreak).toBe(4);
    expect(p.points).toBe(20);
    expect((p as any).someFutureField).toBe('hi');
  });

  it('a totally broken object returns defaults instead of throwing', () => {
    const p = migrate(null);
    expect(p.currentStreak).toBe(0);
    expect(p.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });
});
