export type SessionMode = 'daily' | 'extra' | 'manual';
export type Platform = 'youtube' | 'instagram' | 'tiktok' | 'other';

export interface VideoRef {
  id: string;
  url: string;
  title: string;
  description?: string;
  platform: Platform;
  /**
   * Individual titles for each drill timer/set. The nth string labels the nth
   * timer, and the array length determines how many drill timers are shown.
   */
  timerTitles?: string[];
  /** How long to perform one drill, in seconds. */
  timer?: number;
}

export interface User {
  id: string;                 // slug derived from name
  name: string;               // display name
  videos: VideoRef[];         // this user's library
}

export interface Settings {
  sessionTargetMinutes: number;
  pointsPerExtraMinute: number;
  freezeCostPoints: number;
  maxFreezesHeld: number;
  recycleWhenLibraryExhausted: boolean;
}

export interface HistoryEntry {
  date: string;              // YYYY-MM-DD (local)
  startedAt: number;         // epoch ms
  mode: SessionMode;
  practiceMs: number;
  pointsEarned: number;
  videoIds: string[];
  completedDaily?: boolean;  // true iff daily-mode session credited the streak
}

/**
 * Persisted per-day drill progress. Lets a user leave a daily session and
 * continue later: every drill timer that has been finished at least once is
 * recorded here (per video), and the credited practice time from those
 * finished timers is accumulated so it still counts toward the daily goal when
 * they come back. It is scoped to a single local day (`date`); a new day starts
 * fresh.
 */
export interface DrillDayProgress {
  date: string;                          // YYYY-MM-DD local this progress applies to
  practiceMs: number;                    // credited daily practice time from finished timers today
  finished: Record<string, number[]>;    // videoId -> finished timer indices (0-based)
}

export interface Progress {
  schemaVersion: number;
  currentStreak: number;
  longestStreak: number;
  lastCompletedDate: string | null; // YYYY-MM-DD local
  points: number;
  freezesHeld: number;
  seenVideoIds: string[];
  cycleNumber: number;
  history: HistoryEntry[];
  /** Persisted finished-drill progress for the current local day (optional). */
  drillDay?: DrillDayProgress;
  /** Chosen profile-picture filename from the avatar collection (undefined = show initial letter). */
  avatarIcon?: string;
}

/** Version of the inner per-user Progress object. */
export const CURRENT_SCHEMA_VERSION = 1;

/**
 * Vault: the outer, multi-user object stored in localStorage. Each user gets
 * their own Progress record — streaks, points, seen-videos, and history are
 * strictly per-user. Videos are also per-user in content.json.
 */
export interface Vault {
  vaultVersion: number;                // outer schema version (currently 2)
  activeUserId: string;                // which user's slot is currently shown
  users: Record<string, Progress>;     // keyed by user id (slug of name)
}

export const CURRENT_VAULT_VERSION = 2;

export const DEFAULT_VAULT: Vault = {
  vaultVersion: CURRENT_VAULT_VERSION,
  activeUserId: '',
  users: {},
};

export const DEFAULT_PROGRESS: Progress = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  currentStreak: 0,
  longestStreak: 0,
  lastCompletedDate: null,
  points: 0,
  freezesHeld: 0,
  seenVideoIds: [],
  cycleNumber: 1,
  history: [],
};
