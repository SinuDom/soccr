import { describe, expect, it } from 'vitest';
import { markSeen, pickNextVideo, pruneOrphans, unseenPool } from '@/lib/domain/selection';

function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

describe('pickNextVideo', () => {
  it('picks only from the unseen pool while any remain', () => {
    const lib = Array.from({ length: 10 }, (_, i) => `v${i}`);
    const seen = ['v0', 'v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7'];
    for (let i = 0; i < 20; i++) {
      const result = pickNextVideo({ libraryIds: lib, seenIds: seen, cycleNumber: 1, rng: seededRng(i) });
      expect(['v8', 'v9']).toContain(result.videoId);
      expect(result.cycleAdvanced).toBe(false);
    }
  });

  it('200 videos, 180 seen: the next 20 picks cover exactly the unseen 20, then recycles', () => {
    const lib = Array.from({ length: 200 }, (_, i) => `v${i}`);
    let seen: string[] = lib.slice(0, 180);
    let cycle = 1;
    const rng = seededRng(42);

    const pickedThisCycle = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const r = pickNextVideo({ libraryIds: lib, seenIds: seen, cycleNumber: cycle, rng });
      expect(r.cycleAdvanced).toBe(false);
      expect(lib.slice(180)).toContain(r.videoId);
      pickedThisCycle.add(r.videoId!);
      seen = markSeen(seen, r.videoId!);
    }
    expect(pickedThisCycle.size).toBe(20);

    // 21st pick: unseen pool is now empty → recycle.
    const r21 = pickNextVideo({ libraryIds: lib, seenIds: seen, cycleNumber: cycle, rng });
    expect(r21.cycleAdvanced).toBe(true);
    expect(r21.nextCycleNumber).toBe(cycle + 1);
    expect(r21.nextSeenIds).toEqual([]);
    expect(lib).toContain(r21.videoId);
  });

  it('empty library returns null videoId, does not throw or advance cycle', () => {
    const r = pickNextVideo({ libraryIds: [], seenIds: ['ghost'], cycleNumber: 3 });
    expect(r.videoId).toBeNull();
    expect(r.nextCycleNumber).toBe(3);
    expect(r.cycleAdvanced).toBe(false);
  });

  it('orphan IDs in seen (no longer in library) do not block selection', () => {
    const lib = ['a', 'b'];
    const seen = ['orphan1', 'orphan2']; // no overlap with library
    const r = pickNextVideo({ libraryIds: lib, seenIds: seen, cycleNumber: 1, rng: () => 0 });
    expect(['a', 'b']).toContain(r.videoId);
    expect(r.cycleAdvanced).toBe(false);
  });

  it('is deterministic under a fixed RNG', () => {
    const lib = ['a', 'b', 'c', 'd'];
    const r1 = pickNextVideo({ libraryIds: lib, seenIds: [], cycleNumber: 1, rng: seededRng(7) });
    const r2 = pickNextVideo({ libraryIds: lib, seenIds: [], cycleNumber: 1, rng: seededRng(7) });
    expect(r1.videoId).toBe(r2.videoId);
  });
});

describe('unseenPool + pruneOrphans', () => {
  it('unseenPool = library − seen', () => {
    expect(unseenPool(['a', 'b', 'c'], ['b'])).toEqual(['a', 'c']);
  });
  it('pruneOrphans strips ids no longer in library', () => {
    expect(pruneOrphans(['a', 'b'], ['a', 'ghost', 'b'])).toEqual(['a', 'b']);
  });
});
