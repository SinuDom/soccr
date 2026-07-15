import { describe, expect, it } from 'vitest';
import { elapsedNow, newClock, startClock, stopClock } from '@/lib/domain/practiceClock';

describe('practiceClock', () => {
  it('idle → 0 elapsed', () => {
    expect(elapsedNow(newClock(), 1_000_000)).toBe(0);
  });

  it('accrues only between start and stop', () => {
    const t0 = 1_000_000;
    let c = newClock();
    c = startClock(c, t0);
    // 5 seconds later: elapsed 5s while running.
    expect(elapsedNow(c, t0 + 5_000)).toBe(5_000);
    c = stopClock(c, t0 + 5_000);
    // Time keeps passing but banked stays at 5s.
    expect(elapsedNow(c, t0 + 30_000)).toBe(5_000);
  });

  it('stays accurate across a backgrounded tab (no intermediate reads)', () => {
    const t0 = 1_000_000;
    let c = newClock();
    c = startClock(c, t0);
    // Simulate 60s where the tab was throttled — no calls to elapsedNow.
    const now = t0 + 60_000;
    expect(elapsedNow(c, now)).toBe(60_000);
    c = stopClock(c, now);
    expect(c.banked).toBe(60_000);
  });

  it('start is idempotent (calling start twice while running does not reset)', () => {
    let c = newClock();
    c = startClock(c, 1_000);
    c = startClock(c, 5_000); // second start ignored
    expect(elapsedNow(c, 10_000)).toBe(9_000);
  });

  it('multiple start/stop cycles accumulate banked time', () => {
    let c = newClock();
    c = startClock(c, 1_000);
    c = stopClock(c, 4_000);       // +3s
    c = startClock(c, 10_000);
    c = stopClock(c, 12_000);      // +2s
    expect(c.banked).toBe(5_000);
    expect(elapsedNow(c, 20_000)).toBe(5_000);
  });
});
