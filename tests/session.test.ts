import { describe, expect, it } from 'vitest';
import {
  endEarly,
  onVideoEnded,
  pressNext,
  startSession,
  stopExtra,
  tickDaily,
  totalPracticeMs,
  videoIdsWatched,
} from '@/lib/domain/session';

describe('session engine — practice-time accumulation', () => {
  it('practice time is ZERO during video playback (phase=watching)', () => {
    const now = 1_000_000;
    const s = startSession({ mode: 'daily', firstVideoId: 'v1', targetMs: 60_000, now });
    // 30 seconds of "watching" — no clock started.
    expect(totalPracticeMs(s, now + 30_000)).toBe(0);
  });

  it('practice time accrues only after onVideoEnded', () => {
    const now = 1_000_000;
    let s = startSession({ mode: 'daily', firstVideoId: 'v1', targetMs: 60_000, now });
    // Simulate 20s of watching.
    s = onVideoEnded(s, now + 20_000);
    // 10s of practicing.
    expect(totalPracticeMs(s, now + 30_000)).toBe(10_000);
    expect(totalPracticeMs(s, now + 45_000)).toBe(25_000);
  });

  it('pressNext banks the round and starts a fresh watching phase', () => {
    const now = 1_000_000;
    let s = startSession({ mode: 'extra', firstVideoId: 'v1', targetMs: null, now });
    s = onVideoEnded(s, now + 5_000);          // 5s of watching
    const { session: s2, roundMs } = pressNext(s, 'v2', now + 15_000); // +10s practice
    expect(roundMs).toBe(10_000);
    expect(s2.phase).toBe('watching');
    expect(s2.activeVideoId).toBe('v2');
    expect(s2.rounds).toEqual([{ videoId: 'v1', practiceMs: 10_000 }]);
    // Now watching v2 for 3s — total still 10_000.
    expect(totalPracticeMs(s2, now + 18_000)).toBe(10_000);
  });
});

describe('session engine — daily auto-end', () => {
  it('tickDaily auto-ends the instant total reaches target', () => {
    const now = 1_000_000;
    let s = startSession({ mode: 'daily', firstVideoId: 'v1', targetMs: 60_000, now });
    s = onVideoEnded(s, now + 5_000);
    // Just below the target.
    s = tickDaily(s, now + 5_000 + 59_999);
    expect(s.phase).toBe('practicing');
    expect(s.autoEnded).toBe(false);
    // Reach the target.
    s = tickDaily(s, now + 5_000 + 60_000);
    expect(s.phase).toBe('done');
    expect(s.autoEnded).toBe(true);
    // Banked round exists.
    expect(s.rounds).toHaveLength(1);
    expect(s.rounds[0]!.practiceMs).toBe(60_000);
  });

  it('tickDaily does nothing when not in daily mode', () => {
    const now = 1_000_000;
    let s = startSession({ mode: 'extra', firstVideoId: 'v1', targetMs: null, now });
    s = onVideoEnded(s, now + 1_000);
    const s2 = tickDaily(s, now + 999_999);
    expect(s2).toBe(s);
  });
});

describe('session engine — end / stop paths', () => {
  it('endEarly marks discarded and does not credit', () => {
    const s = startSession({ mode: 'daily', firstVideoId: 'v1', targetMs: 60_000, now: 0 });
    const s2 = endEarly(s);
    expect(s2.phase).toBe('done');
    expect(s2.discarded).toBe(true);
    expect(s2.autoEnded).toBe(false);
  });

  it('stopExtra banks the current round', () => {
    const now = 1_000_000;
    let s = startSession({ mode: 'extra', firstVideoId: 'v1', targetMs: null, now });
    s = onVideoEnded(s, now + 2_000);
    const s2 = stopExtra(s, now + 12_000);
    expect(s2.phase).toBe('done');
    expect(s2.rounds).toEqual([{ videoId: 'v1', practiceMs: 10_000 }]);
  });
});

describe('videoIdsWatched', () => {
  it('includes completed rounds and the current active video (unless still watching)', () => {
    const now = 1_000_000;
    let s = startSession({ mode: 'extra', firstVideoId: 'v1', targetMs: null, now });
    s = onVideoEnded(s, now + 1_000);
    const { session: s2 } = pressNext(s, 'v2', now + 2_000);
    // Currently watching v2 → shouldn't count v2 yet.
    expect(videoIdsWatched(s2)).toEqual(['v1']);
    const s3 = onVideoEnded(s2, now + 3_000);
    expect(videoIdsWatched(s3)).toEqual(['v1', 'v2']);
  });
});
