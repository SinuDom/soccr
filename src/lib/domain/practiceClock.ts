// Wall-clock practice timer. All elapsed math is derived from Date.now()
// deltas so a backgrounded tab (where setInterval throttles or freezes)
// still reports the correct elapsed time when the tab becomes active again.

export type ClockStatus = 'idle' | 'running' | 'stopped';

export interface PracticeClock {
  status: ClockStatus;
  startedAt: number | null;
  banked: number;
}

export function newClock(): PracticeClock {
  return { status: 'idle', startedAt: null, banked: 0 };
}

export function startClock(clock: PracticeClock, now: number): PracticeClock {
  if (clock.status === 'running') return clock;
  return { status: 'running', startedAt: now, banked: clock.banked };
}

export function stopClock(clock: PracticeClock, now: number): PracticeClock {
  if (clock.status !== 'running' || clock.startedAt == null) {
    return { ...clock, status: 'stopped', startedAt: null };
  }
  return {
    status: 'stopped',
    startedAt: null,
    banked: clock.banked + Math.max(0, now - clock.startedAt),
  };
}

export function elapsedNow(clock: PracticeClock, now: number): number {
  if (clock.status === 'running' && clock.startedAt != null) {
    return clock.banked + Math.max(0, now - clock.startedAt);
  }
  return clock.banked;
}
