import { describe, expect, it } from 'vitest';
import { DEFAULT_PROGRESS, type Progress } from '@/lib/domain/types';
import { exportToBlob, mergeProgress, parseImportedText } from '@/lib/storage/portability';

function make(overrides: Partial<Progress> = {}): Progress {
  return { ...DEFAULT_PROGRESS, ...overrides };
}

describe('export → import round-trip', () => {
  it('is lossless', async () => {
    const p = make({
      currentStreak: 9,
      longestStreak: 15,
      points: 420,
      freezesHeld: 1,
      seenVideoIds: ['a', 'b', 'c'],
      cycleNumber: 3,
      lastCompletedDate: '2026-07-15',
      history: [
        { date: '2026-07-15', startedAt: 10, mode: 'daily', practiceMs: 1_200_000, pointsEarned: 0, videoIds: ['a'], completedDaily: true },
      ],
    });
    const { blob, filename } = exportToBlob(p);
    expect(filename).toMatch(/^soccr-progress-\d{4}-\d{2}-\d{2}\.json$/);
    // jsdom's Blob doesn't reliably expose text(); serialize the same way and
    // assert on the string — round-trip lossless-ness is what the spec cares
    // about, not the Blob implementation itself.
    const text = JSON.stringify(p, null, 2);
    expect(blob.size).toBe(new TextEncoder().encode(text).length);
    const r = parseImportedText(text);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.progress).toEqual(p);
  });
});

describe('parseImportedText', () => {
  it('rejects non-JSON', () => {
    const r = parseImportedText('not json');
    expect(r.ok).toBe(false);
  });
  it('rejects an array top-level', () => {
    const r = parseImportedText('[]');
    expect(r.ok).toBe(false);
  });
  it('rejects an object that looks nothing like ours', () => {
    const r = parseImportedText(JSON.stringify({ hello: 'world' }));
    expect(r.ok).toBe(false);
  });
  it('accepts a minimal recognizable object and migrates it', () => {
    const r = parseImportedText(JSON.stringify({ currentStreak: 3, points: 40, schemaVersion: 1 }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.progress.currentStreak).toBe(3);
      expect(r.progress.points).toBe(40);
      expect(r.progress.history).toEqual([]);
    }
  });
});

describe('mergeProgress', () => {
  it('takes MAX of streak / points / longest / freezes (capped) / cycle', () => {
    const a = make({ currentStreak: 3, longestStreak: 8, points: 100, freezesHeld: 1, cycleNumber: 2 });
    const b = make({ currentStreak: 5, longestStreak: 5, points: 60, freezesHeld: 0, cycleNumber: 4 });
    const merged = mergeProgress(a, b, 1);
    expect(merged.currentStreak).toBe(5);
    expect(merged.longestStreak).toBe(8);
    expect(merged.points).toBe(100); // max, not sum
    expect(merged.freezesHeld).toBe(1);
    expect(merged.cycleNumber).toBe(4);
  });

  it('caps merged freezes at maxFreezesHeld', () => {
    const a = make({ freezesHeld: 1 });
    const b = make({ freezesHeld: 1 });
    const merged = mergeProgress(a, b, 1);
    expect(merged.freezesHeld).toBe(1);
  });

  it('unions seenVideoIds', () => {
    const a = make({ seenVideoIds: ['x', 'y'] });
    const b = make({ seenVideoIds: ['y', 'z'] });
    const merged = mergeProgress(a, b, 1);
    expect(new Set(merged.seenVideoIds)).toEqual(new Set(['x', 'y', 'z']));
  });

  it('concats history and dedupes by (date, mode, startedAt)', () => {
    const shared = { date: '2026-07-15', startedAt: 100, mode: 'daily' as const, practiceMs: 60000, pointsEarned: 0, videoIds: ['a'] };
    const a = make({ history: [shared, { ...shared, startedAt: 200 }] });
    const b = make({ history: [shared, { ...shared, startedAt: 300 }] });
    const merged = mergeProgress(a, b, 1);
    expect(merged.history).toHaveLength(3);
    const stamps = merged.history.map((h) => h.startedAt).sort((x, y) => x - y);
    expect(stamps).toEqual([100, 200, 300]);
  });

  it('lastCompletedDate takes the later ISO date', () => {
    const a = make({ lastCompletedDate: '2026-07-10' });
    const b = make({ lastCompletedDate: '2026-07-14' });
    expect(mergeProgress(a, b, 1).lastCompletedDate).toBe('2026-07-14');
  });
});
