export type SessionMode = 'daily' | 'extra' | 'manual';
export type Platform = 'youtube' | 'instagram' | 'tiktok' | 'other';

export interface VideoRef {
  id: string;
  url: string;
  title: string;
  platform: Platform;
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
}

export const CURRENT_SCHEMA_VERSION = 1;

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
