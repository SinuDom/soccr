import { describe, expect, it } from 'vitest';
import {
  endEarly,
  pressNext,
  setActiveMs,
  startSession,
  stopExtra,
  tickDaily,
  totalPracticeMs,
  videoIdsWatched,
} from '@/lib/domain/session';

describe('session engine — practice-time accumulation', () => {
  it('starts directly in the practicing phase', () => {
    const now = 1_000_000;
    const s = startSession({ mode: 'daily', firstVideoId: 'v1', targetMs: 60_000, now });
    expect(s.phase).toBe('practicing');
  });

  it('practice time is ZERO until a drill reports elapsed time', () => {
    const now = 1_000_000;
    const s = startSession({ mode: 'daily', firstVideoId: 'v1', targetMs: 60_000, now });
    expect(totalPracticeMs(s)).toBe(0);
  });

  it('practice time reflects the reported drill contribution', () => {
    const now = 1_000_000;
    let s = startSession({ mode: 'daily', firstVideoId: 'v1', targetMs: 60_000, now });
    s = setActiveMs(s, 10_000);
    expect(totalPracticeMs(s)).toBe(10_000);
    s = setActiveMs(s, 25_000);
    expect(totalPracticeMs(s)).toBe(25_000);
  });

  it('a reset lowers the reported contribution again', () => {
    const now = 1_000_000;
    let s = startSession({ mode: 'daily', firstVideoId: 'v1', targetMs: 60_000, now });
    s = setActiveMs(s, 30_000);
    expect(totalPracticeMs(s)).toBe(30_000);
    // Resetting a drill timer removes its time from the total.
    s = setActiveMs(s, 10_000);
    expect(totalPracticeMs(s)).toBe(10_000);
  });

  it('completing multiple drills credits the sum of their durations', () => {
    const now = 1_000_000;
    let s = startSession({ mode: 'extra', firstVideoId: 'v1', targetMs: null, now });
    // Three 120s drills all completed → 360s credited.
    s = setActiveMs(s, 360_000);
    expect(totalPracticeMs(s)).toBe(360_000);
  });

  it('pressNext banks the round and starts a fresh practicing phase', () => {
    const now = 1_000_000;
    let s = startSession({ mode: 'extra', firstVideoId: 'v1', targetMs: null, now });
    s = setActiveMs(s, 10_000);
    const { session: s2, roundMs } = pressNext(s, 'v2');
    expect(roundMs).toBe(10_000);
    expect(s2.phase).toBe('practicing');
    expect(s2.activeVideoId).toBe('v2');
    expect(s2.rounds).toEqual([{ videoId: 'v1', practiceMs: 10_000 }]);
    // The fresh round starts at zero — total still 10_000.
    expect(totalPracticeMs(s2)).toBe(10_000);
    // A new contribution adds on top of the banked round.
    const s3 = setActiveMs(s2, 5_000);
    expect(totalPracticeMs(s3)).toBe(15_000);
  });
});

describe('session engine — carried-over baseline', () => {
  it('seeds total practice time with the baseline (finished drills from earlier today)', () => {
    const now = 1_000_000;
    const s = startSession({ mode: 'daily', firstVideoId: 'v1', targetMs: 60_000, now, baselineMs: 20_000 });
    // Baseline counts even before any live drill contribution.
    expect(totalPracticeMs(s)).toBe(20_000);
  });

  it('baseline plus live contribution reaches the daily target', () => {
    const now = 1_000_000;
    let s = startSession({ mode: 'daily', firstVideoId: 'v1', targetMs: 60_000, now, baselineMs: 40_000 });
    // 40s carried over + 20s live = 60s target.
    s = setActiveMs(s, 20_000);
    s = tickDaily(s);
    expect(totalPracticeMs(s)).toBe(60_000);
    expect(s.phase).toBe('done');
    expect(s.autoEnded).toBe(true);
  });

  it('defaults the baseline to zero when not provided', () => {
    const s = startSession({ mode: 'daily', firstVideoId: 'v1', targetMs: 60_000, now: 0 });
    expect(s.baselineMs).toBe(0);
    expect(totalPracticeMs(s)).toBe(0);
  });
});

describe('session engine — daily auto-end', () => {
  it('tickDaily auto-ends the instant total reaches target', () => {
    const now = 1_000_000;
    let s = startSession({ mode: 'daily', firstVideoId: 'v1', targetMs: 60_000, now });
    // Just below the target.
    s = setActiveMs(s, 59_999);
    s = tickDaily(s);
    expect(s.phase).toBe('practicing');
    expect(s.autoEnded).toBe(false);
    // Reach the target.
    s = setActiveMs(s, 60_000);
    s = tickDaily(s);
    expect(s.phase).toBe('done');
    expect(s.autoEnded).toBe(true);
    // Banked round exists.
    expect(s.rounds).toHaveLength(1);
    expect(s.rounds[0]!.practiceMs).toBe(60_000);
  });

  it('tickDaily does nothing when not in daily mode', () => {
    const now = 1_000_000;
    let s = startSession({ mode: 'extra', firstVideoId: 'v1', targetMs: null, now });
    s = setActiveMs(s, 999_999);
    const s2 = tickDaily(s);
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
    s = setActiveMs(s, 10_000);
    const s2 = stopExtra(s);
    expect(s2.phase).toBe('done');
    expect(s2.rounds).toEqual([{ videoId: 'v1', practiceMs: 10_000 }]);
  });
});

describe('videoIdsWatched', () => {
  it('includes completed rounds and the current active video', () => {
    const now = 1_000_000;
    const s = startSession({ mode: 'extra', firstVideoId: 'v1', targetMs: null, now });
    // Only the active video so far.
    expect(videoIdsWatched(s)).toEqual(['v1']);
    const { session: s2 } = pressNext(s, 'v2');
    // v1 banked as a round, v2 is now the active (drilling) video.
    expect(videoIdsWatched(s2)).toEqual(['v1', 'v2']);
  });
});
