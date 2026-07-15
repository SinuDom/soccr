import { create } from 'zustand';
import type { HistoryEntry, Progress, Settings, User, Vault } from '@/lib/domain/types';
import { DEFAULT_PROGRESS, DEFAULT_VAULT } from '@/lib/domain/types';
import { load, save } from '@/lib/storage/progress';
import { LEGACY_USER_ID } from '@/lib/storage/migrate';
import {
  applyDailyCompletion,
  awardPoints,
  buyFreeze,
  evaluateOnLaunch,
  toLocalDateString,
  type PurchaseResult,
} from '@/lib/domain/streak';
import { markSeen } from '@/lib/domain/selection';
import { mergeVault } from '@/lib/storage/portability';

interface ProgressState {
  vault: Vault;
  activeUserId: string;
  progress: Progress;                  // view onto vault.users[activeUserId]
  corrupted: boolean;
  freezeConsumedNotice: boolean;
  streakResetNotice: boolean;
  quotaWarning: boolean;

  /** Called once on mount to load the vault (before content is known). */
  hydrate: () => void;

  /**
   * Reconcile the loaded vault with the user list from content.json:
   *  - Ensure a Progress slot exists for every known user.
   *  - If the current activeUserId is 'default' (from legacy v1 data) and it
   *    doesn't map to a real content user, rename it to the first content
   *    user's id — preserving all streak/points/history for that user.
   *  - If activeUserId is missing from content, switch to the first user.
   *  - Run the daily-gap evaluation on the (now resolved) active Progress.
   */
  reconcileWithContent: (users: User[]) => void;

  switchUser: (userId: string) => void;
  dismissNotices: () => void;

  markSeen: (videoId: string) => void;
  advanceCycle: (nextSeenIds: string[], nextCycleNumber: number) => void;

  creditDaily: (todayISO: string, entry: Omit<HistoryEntry, 'completedDaily'>) => void;
  bankExtraTime: (settings: Settings, entry: Omit<HistoryEntry, 'pointsEarned'>) => number;

  buyFreeze: (settings: Settings) => PurchaseResult;

  replaceVault: (v: Vault) => void;
  mergeVault: (v: Vault, maxFreezes: number) => void;
  resetActiveUser: () => void;
}

export const useProgressStore = create<ProgressState>((set, get) => ({
  vault: { ...DEFAULT_VAULT },
  activeUserId: '',
  progress: { ...DEFAULT_PROGRESS },
  corrupted: false,
  freezeConsumedNotice: false,
  streakResetNotice: false,
  quotaWarning: false,

  hydrate: () => {
    const { vault, corrupted } = load();
    set({
      vault,
      activeUserId: vault.activeUserId,
      progress: vault.users[vault.activeUserId] ?? { ...DEFAULT_PROGRESS },
      corrupted,
    });
  },

  reconcileWithContent: (users) => {
    if (users.length === 0) return;
    const { vault } = get();
    const nextUsers = { ...vault.users };
    let nextActive = vault.activeUserId;

    // Rename legacy 'default' slot into the first real user, once, if we can.
    if (nextActive === LEGACY_USER_ID && !users.some((u) => u.id === LEGACY_USER_ID) && nextUsers[LEGACY_USER_ID]) {
      const target = users[0]!.id;
      // Only rename if the target slot is empty (won't clobber existing data).
      if (!nextUsers[target]) {
        nextUsers[target] = nextUsers[LEGACY_USER_ID]!;
        delete nextUsers[LEGACY_USER_ID];
        nextActive = target;
      } else {
        nextActive = target;
      }
    }

    // Ensure every content user has a Progress slot.
    for (const u of users) {
      if (!nextUsers[u.id]) nextUsers[u.id] = { ...DEFAULT_PROGRESS };
    }

    // If active user is not in content (or empty), pick the first one.
    if (!nextActive || !users.some((u) => u.id === nextActive)) {
      nextActive = users[0]!.id;
    }

    // Run the daily-gap evaluation on the active user's Progress.
    const today = toLocalDateString(new Date());
    const activeSlot = nextUsers[nextActive] ?? { ...DEFAULT_PROGRESS };
    const evaluated = evaluateOnLaunch(activeSlot, today);
    nextUsers[nextActive] = evaluated.progress;

    const newVault: Vault = { ...vault, users: nextUsers, activeUserId: nextActive };
    persistVault(set, newVault);
    set({
      activeUserId: nextActive,
      progress: newVault.users[nextActive]!,
      freezeConsumedNotice: evaluated.freezeConsumed,
      streakResetNotice: evaluated.streakReset,
    });
  },

  switchUser: (userId) => {
    const { vault } = get();
    if (!vault.users[userId]) return;
    const today = toLocalDateString(new Date());
    // Run gap eval when switching users too — otherwise a user you haven't
    // touched in days would show a stale streak until the next launch.
    const evaluated = evaluateOnLaunch(vault.users[userId], today);
    const newUsers = { ...vault.users, [userId]: evaluated.progress };
    const newVault: Vault = { ...vault, users: newUsers, activeUserId: userId };
    persistVault(set, newVault);
    set({
      activeUserId: userId,
      progress: evaluated.progress,
      freezeConsumedNotice: evaluated.freezeConsumed,
      streakResetNotice: evaluated.streakReset,
    });
  },

  dismissNotices: () => set({ freezeConsumedNotice: false, streakResetNotice: false }),

  markSeen: (videoId) => {
    const p = get().progress;
    const next = { ...p, seenVideoIds: markSeen(p.seenVideoIds, videoId) };
    commitActive(set, get, next);
  },

  advanceCycle: (nextSeenIds, nextCycleNumber) => {
    const p = get().progress;
    commitActive(set, get, { ...p, seenVideoIds: nextSeenIds, cycleNumber: nextCycleNumber });
  },

  creditDaily: (todayISO, entry) => {
    const p = get().progress;
    const after = applyDailyCompletion(p, todayISO);
    const history = [...after.history, { ...entry, completedDaily: true }];
    commitActive(set, get, { ...after, history });
  },

  bankExtraTime: (settings, entry) => {
    const p = get().progress;
    const minutes = entry.practiceMs / 60_000;
    const { progress: withPoints, earned } = awardPoints(p, minutes, settings.pointsPerExtraMinute);
    const history = [...withPoints.history, { ...entry, pointsEarned: earned }];
    commitActive(set, get, { ...withPoints, history });
    return earned;
  },

  buyFreeze: (settings) => {
    const p = get().progress;
    const r = buyFreeze(p, settings);
    if (r.ok) commitActive(set, get, r.progress);
    return r;
  },

  replaceVault: (v) => {
    persistVault(set, v);
    set({
      activeUserId: v.activeUserId,
      progress: v.users[v.activeUserId] ?? { ...DEFAULT_PROGRESS },
    });
  },
  mergeVault: (v, maxFreezes) => {
    const merged = mergeVault(get().vault, v, maxFreezes);
    persistVault(set, merged);
    set({
      activeUserId: merged.activeUserId,
      progress: merged.users[merged.activeUserId] ?? { ...DEFAULT_PROGRESS },
    });
  },
  resetActiveUser: () => {
    const { vault, activeUserId } = get();
    if (!activeUserId) return;
    const newVault: Vault = {
      ...vault,
      users: { ...vault.users, [activeUserId]: { ...DEFAULT_PROGRESS } },
    };
    persistVault(set, newVault);
    set({ progress: { ...DEFAULT_PROGRESS } });
  },
}));

function commitActive(
  set: (partial: Partial<ProgressState>) => void,
  get: () => ProgressState,
  next: Progress,
) {
  const { vault, activeUserId } = get();
  const newVault: Vault = {
    ...vault,
    users: { ...vault.users, [activeUserId]: next },
  };
  persistVault(set, newVault);
  set({ progress: next });
}

function persistVault(set: (partial: Partial<ProgressState>) => void, next: Vault) {
  const r = save(next);
  set({ vault: next, quotaWarning: r.quotaExceeded && !r.ok });
}
