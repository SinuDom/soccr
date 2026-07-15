import { describe, expect, it } from 'vitest';
import { DEFAULT_PROGRESS, DEFAULT_VAULT, type Progress, type Vault } from '@/lib/domain/types';
import { exportToBlob, mergeProgress, mergeVault, parseImportedText } from '@/lib/storage/portability';

function makeP(overrides: Partial<Progress> = {}): Progress {
  return { ...DEFAULT_PROGRESS, ...overrides };
}
function makeV(overrides: Partial<Vault> = {}): Vault {
  return { ...DEFAULT_VAULT, ...overrides };
}

describe('export → import round-trip', () => {
  it('is lossless', () => {
    const vault = makeV({
      vaultVersion: 2,
      activeUserId: 'leon',
      users: {
        leon: makeP({ currentStreak: 9, longestStreak: 15, points: 420, freezesHeld: 1, seenVideoIds: ['a', 'b'], cycleNumber: 3, lastCompletedDate: '2026-07-15' }),
        anya: makeP({ currentStreak: 2, points: 30, seenVideoIds: ['y'] }),
      },
    });
    const { blob, filename } = exportToBlob(vault);
    expect(filename).toMatch(/^soccr-progress-\d{4}-\d{2}-\d{2}\.json$/);
    const text = JSON.stringify(vault, null, 2);
    expect(blob.size).toBe(new TextEncoder().encode(text).length);
    const parsed = parseImportedText(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.vault).toEqual(vault);
  });
});

describe('parseImportedText', () => {
  it('rejects non-JSON', () => {
    expect(parseImportedText('not json').ok).toBe(false);
  });
  it('rejects an array top-level', () => {
    expect(parseImportedText('[]').ok).toBe(false);
  });
  it('rejects an object that looks nothing like ours', () => {
    expect(parseImportedText(JSON.stringify({ hello: 'world' })).ok).toBe(false);
  });
  it('accepts a legacy single-user Progress and wraps it', () => {
    const r = parseImportedText(JSON.stringify({ currentStreak: 3, points: 40, schemaVersion: 1, seenVideoIds: [], history: [] }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      const ids = Object.keys(r.vault.users);
      expect(ids.length).toBe(1);
      expect(r.vault.users[ids[0]!]!.currentStreak).toBe(3);
      expect(r.vault.users[ids[0]!]!.points).toBe(40);
    }
  });
  it('accepts a vault', () => {
    const raw = { vaultVersion: 2, activeUserId: 'leon', users: { leon: { schemaVersion: 1, currentStreak: 5, longestStreak: 5, points: 0, freezesHeld: 0, seenVideoIds: [], cycleNumber: 1, lastCompletedDate: null, history: [] } } };
    const r = parseImportedText(JSON.stringify(raw));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.vault.users.leon!.currentStreak).toBe(5);
  });
});

describe('mergeProgress', () => {
  it('takes MAX of streak / points / longest / freezes (capped) / cycle', () => {
    const a = makeP({ currentStreak: 3, longestStreak: 8, points: 100, freezesHeld: 1, cycleNumber: 2 });
    const b = makeP({ currentStreak: 5, longestStreak: 5, points: 60, freezesHeld: 0, cycleNumber: 4 });
    const merged = mergeProgress(a, b, 1);
    expect(merged.currentStreak).toBe(5);
    expect(merged.longestStreak).toBe(8);
    expect(merged.points).toBe(100);
    expect(merged.freezesHeld).toBe(1);
    expect(merged.cycleNumber).toBe(4);
  });

  it('unions seenVideoIds', () => {
    const a = makeP({ seenVideoIds: ['x', 'y'] });
    const b = makeP({ seenVideoIds: ['y', 'z'] });
    const merged = mergeProgress(a, b, 1);
    expect(new Set(merged.seenVideoIds)).toEqual(new Set(['x', 'y', 'z']));
  });

  it('concats history and dedupes by (date, mode, startedAt)', () => {
    const shared = { date: '2026-07-15', startedAt: 100, mode: 'daily' as const, practiceMs: 60000, pointsEarned: 0, videoIds: ['a'] };
    const a = makeP({ history: [shared, { ...shared, startedAt: 200 }] });
    const b = makeP({ history: [shared, { ...shared, startedAt: 300 }] });
    const merged = mergeProgress(a, b, 1);
    expect(merged.history).toHaveLength(3);
    const stamps = merged.history.map((h) => h.startedAt).sort((x, y) => x - y);
    expect(stamps).toEqual([100, 200, 300]);
  });

  it('lastCompletedDate takes the later ISO date', () => {
    const a = makeP({ lastCompletedDate: '2026-07-10' });
    const b = makeP({ lastCompletedDate: '2026-07-14' });
    expect(mergeProgress(a, b, 1).lastCompletedDate).toBe('2026-07-14');
  });
});

describe('mergeVault', () => {
  it('per-user merges and preserves users only present in one side', () => {
    const a = makeV({
      activeUserId: 'leon',
      users: {
        leon: makeP({ currentStreak: 3, points: 100, seenVideoIds: ['a'] }),
      },
    });
    const b = makeV({
      activeUserId: 'anya',
      users: {
        leon: makeP({ currentStreak: 5, points: 60, seenVideoIds: ['b'] }),
        anya: makeP({ currentStreak: 2, points: 20 }),
      },
    });
    const merged = mergeVault(a, b, 1);
    expect(merged.users.leon!.currentStreak).toBe(5);
    expect(merged.users.leon!.points).toBe(100);
    expect(new Set(merged.users.leon!.seenVideoIds)).toEqual(new Set(['a', 'b']));
    expect(merged.users.anya!.currentStreak).toBe(2);
    // activeUserId keeps the LOCAL vault's setting.
    expect(merged.activeUserId).toBe('leon');
  });
});
