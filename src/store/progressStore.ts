import { create } from 'zustand';
import type { HistoryEntry, Progress, Settings } from '@/lib/domain/types';
import { load, save } from '@/lib/storage/progress';
import {
  applyDailyCompletion,
  awardPoints,
  buyFreeze,
  evaluateOnLaunch,
  toLocalDateString,
  type PurchaseResult,
} from '@/lib/domain/streak';
import { markSeen } from '@/lib/domain/selection';
import { mergeProgress } from '@/lib/storage/portability';

interface ProgressState {
  progress: Progress;
  corrupted: boolean;
  freezeConsumedNotice: boolean;
  streakResetNotice: boolean;
  quotaWarning: boolean;

  /** Called once on mount to (a) load, (b) apply gap logic. */
  hydrate: () => void;
  dismissNotices: () => void;

  markSeen: (videoId: string) => void;
  advanceCycle: (nextSeenIds: string[], nextCycleNumber: number) => void;

  creditDaily: (todayISO: string, entry: Omit<HistoryEntry, 'completedDaily'>) => void;
  bankExtraTime: (settings: Settings, entry: Omit<HistoryEntry, 'pointsEarned'>) => number;

  buyFreeze: (settings: Settings) => PurchaseResult;

  replace: (p: Progress) => void;
  merge: (p: Progress, maxFreezes: number) => void;
  reset: () => void;
}

const initial: Progress = {
  schemaVersion: 1,
  currentStreak: 0,
  longestStreak: 0,
  lastCompletedDate: null,
  points: 0,
  freezesHeld: 0,
  seenVideoIds: [],
  cycleNumber: 1,
  history: [],
};

export const useProgressStore = create<ProgressState>((set, get) => ({
  progress: initial,
  corrupted: false,
  freezeConsumedNotice: false,
  streakResetNotice: false,
  quotaWarning: false,

  hydrate: () => {
    const { progress, corrupted } = load();
    const today = toLocalDateString(new Date());
    const evaluated = evaluateOnLaunch(progress, today);
    persist(set, evaluated.progress);
    set({
      corrupted,
      freezeConsumedNotice: evaluated.freezeConsumed,
      streakResetNotice: evaluated.streakReset,
    });
  },

  dismissNotices: () => set({ freezeConsumedNotice: false, streakResetNotice: false }),

  markSeen: (videoId) => {
    const next = { ...get().progress, seenVideoIds: markSeen(get().progress.seenVideoIds, videoId) };
    persist(set, next);
  },

  advanceCycle: (nextSeenIds, nextCycleNumber) => {
    const next = { ...get().progress, seenVideoIds: nextSeenIds, cycleNumber: nextCycleNumber };
    persist(set, next);
  },

  creditDaily: (todayISO, entry) => {
    const cur = get().progress;
    const after = applyDailyCompletion(cur, todayISO);
    const history = [...after.history, { ...entry, completedDaily: true }];
    persist(set, { ...after, history });
  },

  bankExtraTime: (settings, entry) => {
    const cur = get().progress;
    const minutes = entry.practiceMs / 60_000;
    const { progress: withPoints, earned } = awardPoints(cur, minutes, settings.pointsPerExtraMinute);
    const history = [...withPoints.history, { ...entry, pointsEarned: earned }];
    persist(set, { ...withPoints, history });
    return earned;
  },

  buyFreeze: (settings) => {
    const r = buyFreeze(get().progress, settings);
    if (r.ok) persist(set, r.progress);
    return r;
  },

  replace: (p) => persist(set, p),
  merge: (p, maxFreezes) => persist(set, mergeProgress(get().progress, p, maxFreezes)),
  reset: () => persist(set, initial),
}));

function persist(set: (partial: Partial<ProgressState>) => void, next: Progress) {
  const r = save(next);
  set({ progress: next, quotaWarning: r.quotaExceeded && !r.ok });
}
