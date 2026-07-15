import type { SessionMode } from './types';
import { elapsedNow, newClock, startClock, stopClock, type PracticeClock } from './practiceClock';

export type SessionPhase = 'practicing' | 'done';

export interface RoundRecord {
  videoId: string;
  practiceMs: number;
}

export interface Session {
  mode: SessionMode;
  targetMs: number | null; // set for 'daily'; null for 'extra' / 'manual'
  activeVideoId: string;
  phase: SessionPhase;
  rounds: RoundRecord[];      // completed rounds; the active round is separate
  clock: PracticeClock;
  discarded: boolean;         // true iff endEarly() was called
  autoEnded: boolean;         // true iff target hit (Mode A)
  startedAt: number;
}

export function startSession(params: {
  mode: SessionMode;
  firstVideoId: string;
  targetMs: number | null;
  now: number;
}): Session {
  return {
    mode: params.mode,
    targetMs: params.targetMs,
    activeVideoId: params.firstVideoId,
    phase: 'practicing',
    rounds: [],
    clock: newClock(),
    discarded: false,
    autoEnded: false,
    startedAt: params.now,
  };
}


/**
 * Start or stop the session practice clock based on whether any drill timer is
 * currently counting down. This replaces the previous auto-start behaviour so
 * the session time is accumulated from the drill timers.
 */
export function setDrillRunning(session: Session, running: boolean, now: number): Session {
  if (session.phase !== 'practicing') return session;
  const clock = running ? startClock(session.clock, now) : stopClock(session.clock, now);
  return { ...session, clock };
}

/**
 * Bank current-round practice time and roll to the next video. Callers pass
 * the newly selected video id in — selection is a separate concern. Returns
 * the banked ms for the caller to display in a "round complete" toast if
 * they want.
 */
export function pressNext(
  session: Session,
  nextVideoId: string,
  now: number,
): { session: Session; roundMs: number } {
  const stoppedClock = stopClock(session.clock, now);
  const banked = stoppedClock.banked;
  const rounds = [...session.rounds, { videoId: session.activeVideoId, practiceMs: banked }];
  return {
    session: {
      ...session,
      rounds,
      activeVideoId: nextVideoId,
      phase: 'practicing',
      clock: newClock(),
    },
    roundMs: banked,
  };
}

/** Total practice time — includes the currently running round if any. */
export function totalPracticeMs(session: Session, now: number): number {
  const past = session.rounds.reduce((a, r) => a + r.practiceMs, 0);
  const current = elapsedNow(session.clock, now);
  return past + current;
}

/**
 * Called each animation frame in Daily mode. If total practice ≥ target, this
 * closes the current round, banks its time, and marks the session done+auto.
 */
export function tickDaily(session: Session, now: number): Session {
  if (session.mode !== 'daily' || session.phase === 'done' || session.targetMs == null) return session;
  const total = totalPracticeMs(session, now);
  if (total < session.targetMs) return session;

  // Stop the clock; the caller (or session-complete flow) will read total.
  const stoppedClock = stopClock(session.clock, now);
  const banked = stoppedClock.banked;
  const rounds = session.phase === 'practicing'
    ? [...session.rounds, { videoId: session.activeVideoId, practiceMs: banked }]
    : session.rounds;
  return {
    ...session,
    rounds,
    clock: stoppedClock,
    phase: 'done',
    autoEnded: true,
  };
}

export function endEarly(session: Session): Session {
  return { ...session, phase: 'done', discarded: true };
}

/** Extra Time mode: user hits Stop. Banks current round, marks done, no auto. */
export function stopExtra(session: Session, now: number): Session {
  if (session.mode === 'daily') return session; // caller error, but be safe
  const stoppedClock = stopClock(session.clock, now);
  const banked = stoppedClock.banked;
  const rounds = session.phase === 'practicing'
    ? [...session.rounds, { videoId: session.activeVideoId, practiceMs: banked }]
    : session.rounds;
  return {
    ...session,
    rounds,
    clock: stoppedClock,
    phase: 'done',
  };
}

/** IDs of every video watched during this session (dedup, order preserved). */
export function videoIdsWatched(session: Session): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of session.rounds) {
    if (!seen.has(r.videoId)) { seen.add(r.videoId); out.push(r.videoId); }
  }
  // The active video is drilled too, so count it once it's the active one.
  if (!seen.has(session.activeVideoId)) {
    out.push(session.activeVideoId);
  }
  return out;
}
