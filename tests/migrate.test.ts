import { describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA_VERSION, CURRENT_VAULT_VERSION } from '@/lib/domain/types';
import { migrateProgress, migrateVault, LEGACY_USER_ID } from '@/lib/storage/migrate';

describe('migrateProgress (inner, per-user)', () => {
  it('a v0-style object (no schemaVersion) is upgraded losslessly', () => {
    const v0 = {
      currentStreak: 8,
      longestStreak: 12,
      points: 500,
      freezesHeld: 1,
      seenVideoIds: ['a', 'b'],
      lastCompletedDate: '2026-07-14',
      history: [{ date: '2026-07-14', startedAt: 1, mode: 'daily', practiceMs: 100, pointsEarned: 0, videoIds: ['a'] }],
    };
    const p = migrateProgress(v0);
    expect(p.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(p.currentStreak).toBe(8);
    expect(p.longestStreak).toBe(12);
    expect(p.points).toBe(500);
    expect(p.freezesHeld).toBe(1);
    expect(p.seenVideoIds).toEqual(['a', 'b']);
    expect(p.lastCompletedDate).toBe('2026-07-14');
    expect(p.history).toEqual(v0.history);
    expect(p.cycleNumber).toBe(1);
  });

  it('a future-schema object keeps unknown fields', () => {
    const future = { schemaVersion: 99, currentStreak: 4, points: 20, seenVideoIds: ['x'], history: [], someFutureField: 'hi' };
    const p = migrateProgress(future);
    expect(p.schemaVersion).toBe(99);
    expect(p.currentStreak).toBe(4);
    expect((p as any).someFutureField).toBe('hi');
  });

  it('a totally broken object returns defaults instead of throwing', () => {
    const p = migrateProgress(null);
    expect(p.currentStreak).toBe(0);
    expect(p.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('v1 → v2 seeds completedDates from history and the live streak', () => {
    const v1 = {
      schemaVersion: 1,
      currentStreak: 2,
      longestStreak: 5,
      lastCompletedDate: '2026-07-16',
      seenVideoIds: [],
      history: [
        { date: '2026-07-10', startedAt: 1, mode: 'daily', practiceMs: 1, pointsEarned: 0, videoIds: [], completedDaily: true },
        { date: '2026-07-11', startedAt: 2, mode: 'daily', practiceMs: 1, pointsEarned: 0, videoIds: [], completedDaily: false },
      ],
    };
    const p = migrateProgress(v1);
    expect(p.schemaVersion).toBe(2);
    // history completed day + the 2-day streak run ending 2026-07-16.
    expect(p.completedDates).toEqual(['2026-07-10', '2026-07-15', '2026-07-16']);
  });

  it('an already-migrated v2 record keeps its completedDates', () => {
    const v2 = {
      schemaVersion: 2, currentStreak: 1, seenVideoIds: [], history: [],
      completedDates: ['2026-07-01', '2026-07-02'],
    };
    expect(migrateProgress(v2).completedDates).toEqual(['2026-07-01', '2026-07-02']);
  });

  it('the chosen avatar icon survives migration from every schema version', () => {
    // Regression: a new app version must never lose the profile icon.
    const v0 = { currentStreak: 1, seenVideoIds: [], history: [], avatarIcon: '003-lion.png' };
    expect(migrateProgress(v0).avatarIcon).toBe('003-lion.png');
    const current = { schemaVersion: CURRENT_SCHEMA_VERSION, currentStreak: 1, seenVideoIds: [], history: [], avatarIcon: '007-fox.png' };
    expect(migrateProgress(current).avatarIcon).toBe('007-fox.png');
    const future = { schemaVersion: 99, currentStreak: 1, seenVideoIds: [], history: [], avatarIcon: '010-whale.png' };
    expect(migrateProgress(future).avatarIcon).toBe('010-whale.png');
  });
});

describe('migrateVault (outer, multi-user)', () => {
  it('a raw v1 Progress object (no vault wrapper) is wrapped under the legacy user id — ALL data intact', () => {
    const raw = {
      schemaVersion: 1,
      currentStreak: 7,
      longestStreak: 12,
      points: 340,
      freezesHeld: 1,
      lastCompletedDate: '2026-07-14',
      seenVideoIds: ['id1', 'id2'],
      cycleNumber: 3,
      history: [{ date: '2026-07-14', startedAt: 1, mode: 'daily', practiceMs: 999, pointsEarned: 0, videoIds: ['id1'], completedDaily: true }],
    };
    const v = migrateVault(raw);
    expect(v.vaultVersion).toBe(CURRENT_VAULT_VERSION);
    expect(v.activeUserId).toBe(LEGACY_USER_ID);
    const p = v.users[LEGACY_USER_ID]!;
    expect(p.currentStreak).toBe(7);
    expect(p.longestStreak).toBe(12);
    expect(p.points).toBe(340);
    expect(p.freezesHeld).toBe(1);
    expect(p.seenVideoIds).toEqual(['id1', 'id2']);
    expect(p.cycleNumber).toBe(3);
    expect(p.history).toEqual(raw.history);
    expect(p.lastCompletedDate).toBe('2026-07-14');
  });

  it('an existing vault is returned with each inner Progress re-migrated', () => {
    const raw = {
      vaultVersion: 2,
      activeUserId: 'leon',
      users: {
        leon: { schemaVersion: 1, currentStreak: 3, longestStreak: 3, points: 30, freezesHeld: 0, seenVideoIds: [], history: [], cycleNumber: 1, lastCompletedDate: null },
        anya: { schemaVersion: 1, currentStreak: 9, longestStreak: 9, points: 90, freezesHeld: 1, seenVideoIds: ['x'], history: [], cycleNumber: 2, lastCompletedDate: '2026-07-15' },
      },
    };
    const v = migrateVault(raw);
    expect(v.activeUserId).toBe('leon');
    expect(v.users.leon!.currentStreak).toBe(3);
    expect(v.users.anya!.currentStreak).toBe(9);
    expect(v.users.anya!.seenVideoIds).toEqual(['x']);
  });

  it('null / non-object input returns an empty vault (no throw)', () => {
    const v = migrateVault(null);
    expect(v.activeUserId).toBe('');
    expect(v.users).toEqual({});
  });

  it('avatar icons survive a vault reload round-trip', () => {
    const raw = {
      vaultVersion: 2,
      activeUserId: 'leon',
      users: {
        leon: { schemaVersion: 1, currentStreak: 3, seenVideoIds: [], history: [], avatarIcon: '003-lion.png' },
        anya: { schemaVersion: 1, currentStreak: 9, seenVideoIds: [], history: [], avatarIcon: '021-hen.png' },
      },
    };
    const v = migrateVault(raw);
    expect(v.users.leon!.avatarIcon).toBe('003-lion.png');
    expect(v.users.anya!.avatarIcon).toBe('021-hen.png');
  });
});
