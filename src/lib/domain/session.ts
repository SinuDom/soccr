import type { SessionMode } from './types';

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
  activeMs: number;           // practice time accumulated for the active video
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
    activeMs: 0,
    discarded: false,
    autoEnded: false,
    startedAt: params.now,
  };
}

/**
 * Record the practice time accumulated for the ACTIVE video. This value is
 * driven by the per-drill timers: completing every timer credits the sum of
 * their durations, and resetting a timer subtracts its time again. It updates
 * live, so the session progress reflects the drills in real time.
 */
export function setActiveMs(session: Session, ms: number): Session {
  if (session.phase !== 'practicing') return session;
  const activeMs = Math.max(0, ms);
  if (activeMs === session.activeMs) return session;
  return { ...session, activeMs };
}

/**
 * Bank the active video's practice time and roll to the next video. Returns
 * the banked ms for the caller to display in a "round complete" toast if they
 * want.
 */
export function pressNext(
  session: Session,
  nextVideoId: string,
  _now?: number,
): { session: Session; roundMs: number } {
  const banked = session.activeMs;
  const rounds = [...session.rounds, { videoId: session.activeVideoId, practiceMs: banked }];
  return {
    session: {
      ...session,
      rounds,
      activeVideoId: nextVideoId,
      phase: 'practicing',
      activeMs: 0,
    },
    roundMs: banked,
  };
}

/** Total practice time — banked rounds plus the active video's current time. */
export function totalPracticeMs(session: Session, _now?: number): number {
  const past = session.rounds.reduce((a, r) => a + r.practiceMs, 0);
  return past + session.activeMs;
}

/**
 * Called whenever the active practice time changes in Daily mode. If total
 * practice ≥ target, this closes the current round, banks its time, and marks
 * the session done+auto.
 */
export function tickDaily(session: Session, _now?: number): Session {
  if (session.mode !== 'daily' || session.phase === 'done' || session.targetMs == null) return session;
  const total = totalPracticeMs(session);
  if (total < session.targetMs) return session;

  const rounds = [...session.rounds, { videoId: session.activeVideoId, practiceMs: session.activeMs }];
  return {
    ...session,
    rounds,
    activeMs: 0,
    phase: 'done',
    autoEnded: true,
  };
}

export function endEarly(session: Session): Session {
  return { ...session, phase: 'done', discarded: true };
}

/** Extra Time mode: user hits Stop. Banks current round, marks done, no auto. */
export function stopExtra(session: Session, _now?: number): Session {
  if (session.mode === 'daily') return session; // caller error, but be safe
  const rounds = session.phase === 'practicing'
    ? [...session.rounds, { videoId: session.activeVideoId, practiceMs: session.activeMs }]
    : session.rounds;
  return {
    ...session,
    rounds,
    activeMs: 0,
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
