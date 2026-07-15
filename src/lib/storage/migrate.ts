import type { Progress } from '@/lib/domain/types';
import { CURRENT_SCHEMA_VERSION, DEFAULT_PROGRESS } from '@/lib/domain/types';

// Add migrators here as the schema evolves. Rules:
//   * NEVER discard user data. If a field is removed, migrate its value
//     into the replacement or drop it, but never touch streak/points/history.
//   * Migrators run in order from `from` up to CURRENT_SCHEMA_VERSION.
//   * If a stored object has no schemaVersion, treat it as v0.
interface Migrator {
  from: number;
  to: number;
  migrate(input: any): any;
}

const migrators: Migrator[] = [
  // v0 → v1: earliest known shape. Ensure every default field is present
  // without touching any existing values.
  {
    from: 0,
    to: 1,
    migrate: (raw: any) => ({
      ...DEFAULT_PROGRESS,
      ...raw,
      schemaVersion: 1,
      // Coerce shapes for safety without discarding data.
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
];

export function migrate(raw: any): Progress {
  let cur = raw && typeof raw === 'object' ? raw : {};
  let ver = Number.isFinite(cur.schemaVersion) ? cur.schemaVersion : 0;

  while (ver < CURRENT_SCHEMA_VERSION) {
    const m = migrators.find((x) => x.from === ver);
    if (!m) {
      // No migrator defined — bump the version but keep every existing field
      // so we never destroy data on an unexpected/newer object.
      ver = CURRENT_SCHEMA_VERSION;
      cur = { ...DEFAULT_PROGRESS, ...cur, schemaVersion: CURRENT_SCHEMA_VERSION };
      break;
    }
    cur = m.migrate(cur);
    ver = m.to;
  }

  // Final defensive merge — if the stored file is FROM the future (newer than
  // our code knows), keep the unknown fields but ensure our required ones exist.
  return { ...DEFAULT_PROGRESS, ...cur, schemaVersion: Math.max(ver, cur.schemaVersion ?? ver) };
}
