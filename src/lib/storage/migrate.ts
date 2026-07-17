import type { Progress, Vault } from '@/lib/domain/types';
import {
  CURRENT_SCHEMA_VERSION,
  CURRENT_VAULT_VERSION,
  DEFAULT_PROGRESS,
  DEFAULT_VAULT,
} from '@/lib/domain/types';
import { seedCompletedDates } from '@/lib/domain/streak';

// -----------------------------------------------------------------------------
// Per-user Progress migrations.
// Rules:
//   * NEVER discard user data. If a field is removed, migrate its value into
//     the replacement, but never touch streak/points/history.
//   * Migrators run in order from `from` up to CURRENT_SCHEMA_VERSION.
// -----------------------------------------------------------------------------

interface ProgressMigrator {
  from: number;
  to: number;
  migrate(input: any): any;
}

const progressMigrators: ProgressMigrator[] = [
  {
    from: 0,
    to: 1,
    migrate: (raw: any) => ({
      ...DEFAULT_PROGRESS,
      ...raw,
      schemaVersion: 1,
      seenVideoIds: Array.isArray(raw?.seenVideoIds) ? raw.seenVideoIds : [],
      history: Array.isArray(raw?.history) ? raw.history : [],
      currentStreak: Number.isFinite(raw?.currentStreak) ? raw.currentStreak : 0,
      longestStreak: Number.isFinite(raw?.longestStreak) ? raw.longestStreak : 0,
      points: Number.isFinite(raw?.points) ? raw.points : 0,
      freezesHeld: Number.isFinite(raw?.freezesHeld) ? raw.freezesHeld : 0,
      cycleNumber: Number.isFinite(raw?.cycleNumber) && raw.cycleNumber >= 1 ? raw.cycleNumber : 1,
      lastCompletedDate: typeof raw?.lastCompletedDate === 'string' ? raw.lastCompletedDate : null,
    }),
  },
  {
    // v1 → v2: introduce the completed-days set backing the streak calendar.
    // Seed it from history and the live streak so existing users keep their
    // real calendar (and their streak survives a later backfill recompute).
    from: 1,
    to: 2,
    migrate: (raw: any) => ({
      ...raw,
      schemaVersion: 2,
      completedDates: Array.isArray(raw?.completedDates)
        ? raw.completedDates
        : seedCompletedDates(raw),
    }),
  },
  {
    // v2 → v3: track which completed days were freeze-covered so the calendar
    // can render them as frozen. Past freezes weren't recorded, so this starts
    // empty and fills going forward.
    from: 2,
    to: 3,
    migrate: (raw: any) => ({
      ...raw,
      schemaVersion: 3,
      frozenDates: Array.isArray(raw?.frozenDates) ? raw.frozenDates : [],
    }),
  },
];

export function migrateProgress(raw: any): Progress {
  let cur = raw && typeof raw === 'object' ? raw : {};
  let ver = Number.isFinite(cur.schemaVersion) ? cur.schemaVersion : 0;

  while (ver < CURRENT_SCHEMA_VERSION) {
    const m = progressMigrators.find((x) => x.from === ver);
    if (!m) {
      ver = CURRENT_SCHEMA_VERSION;
      cur = { ...DEFAULT_PROGRESS, ...cur, schemaVersion: CURRENT_SCHEMA_VERSION };
      break;
    }
    cur = m.migrate(cur);
    ver = m.to;
  }

  return { ...DEFAULT_PROGRESS, ...cur, schemaVersion: Math.max(ver, cur.schemaVersion ?? ver) };
}

/** Back-compat alias — external callers still import `migrate`. */
export const migrate = migrateProgress;

// -----------------------------------------------------------------------------
// Vault (outer, multi-user) migration.
// v1 → v2: a v1 object *was* a single Progress. Wrap it inside a vault under
// the id 'default'. The active-user resolution step (in the store) will rename
// 'default' to a real user id transparently when the content file loads.
// -----------------------------------------------------------------------------

const LEGACY_USER_ID = 'default';

function looksLikeProgress(raw: any): boolean {
  return raw && typeof raw === 'object' &&
    ('currentStreak' in raw || 'seenVideoIds' in raw || 'lastCompletedDate' in raw || 'history' in raw);
}

function looksLikeVault(raw: any): boolean {
  return raw && typeof raw === 'object' && raw.users && typeof raw.users === 'object' && !Array.isArray(raw.users);
}

export function migrateVault(raw: any): Vault {
  if (raw == null || typeof raw !== 'object') {
    return { ...DEFAULT_VAULT };
  }
  if (looksLikeVault(raw)) {
    const users: Record<string, Progress> = {};
    for (const [id, p] of Object.entries(raw.users as Record<string, unknown>)) {
      users[id] = migrateProgress(p);
    }
    return {
      vaultVersion: CURRENT_VAULT_VERSION,
      activeUserId: typeof raw.activeUserId === 'string' ? raw.activeUserId : '',
      users,
    };
  }
  if (looksLikeProgress(raw)) {
    // Legacy single-user progress — wrap it, preserving ALL data.
    return {
      vaultVersion: CURRENT_VAULT_VERSION,
      activeUserId: LEGACY_USER_ID,
      users: { [LEGACY_USER_ID]: migrateProgress(raw) },
    };
  }
  return { ...DEFAULT_VAULT };
}

export { LEGACY_USER_ID };
