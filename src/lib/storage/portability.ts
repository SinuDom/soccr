import type { HistoryEntry, Progress } from '@/lib/domain/types';
import { DEFAULT_PROGRESS } from '@/lib/domain/types';
import { migrate } from './migrate';

export function exportToBlob(progress: Progress): { blob: Blob; filename: string } {
  const stamp = new Date().toISOString().slice(0, 10);
  return {
    blob: new Blob([JSON.stringify(progress, null, 2)], { type: 'application/json' }),
    filename: `soccr-progress-${stamp}.json`,
  };
}

export type ParseResult =
  | { ok: true; progress: Progress }
  | { ok: false; error: string };

/**
 * Parse + validate a user-supplied JSON file. The migrator handles unknown
 * schemas so this is quite forgiving; we only reject on shapes that clearly
 * aren't ours (missing all recognized fields).
 */
export function parseImportedText(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: `Not valid JSON: ${(e as Error).message}` };
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'JSON must be an object.' };
  }
  const known = ['currentStreak', 'longestStreak', 'points', 'seenVideoIds', 'history', 'schemaVersion'];
  const hits = known.filter((k) => k in (raw as Record<string, unknown>));
  if (hits.length < 2) {
    return { ok: false, error: "This doesn't look like a Soccr progress file." };
  }
  return { ok: true, progress: migrate(raw) };
}

/**
 * Non-destructive merge:
 *   currentStreak / longestStreak / points / freezesHeld / cycleNumber → max
 *   seenVideoIds → union
 *   history → concat, dedup by (date, mode, startedAt)
 *   lastCompletedDate → later of the two
 *   freezesHeld capped by maxFreezesHeld (passed in).
 * We take max rather than sum for points so re-importing the same file
 * cannot inflate a balance.
 */
export function mergeProgress(a: Progress, b: Progress, maxFreezes: number): Progress {
  const seen = new Set<string>([...a.seenVideoIds, ...b.seenVideoIds]);
  const historyMap = new Map<string, HistoryEntry>();
  const key = (h: HistoryEntry) => `${h.date}|${h.mode}|${h.startedAt}`;
  for (const h of [...a.history, ...b.history]) historyMap.set(key(h), h);
  const history = Array.from(historyMap.values()).sort((x, y) => x.startedAt - y.startedAt);

  const lastDate = laterDate(a.lastCompletedDate, b.lastCompletedDate);

  return {
    ...DEFAULT_PROGRESS,
    schemaVersion: Math.max(a.schemaVersion, b.schemaVersion),
    currentStreak: Math.max(a.currentStreak, b.currentStreak),
    longestStreak: Math.max(a.longestStreak, b.longestStreak, a.currentStreak, b.currentStreak),
    lastCompletedDate: lastDate,
    points: Math.max(a.points, b.points),
    freezesHeld: Math.min(maxFreezes, Math.max(a.freezesHeld, b.freezesHeld)),
    seenVideoIds: Array.from(seen),
    cycleNumber: Math.max(a.cycleNumber, b.cycleNumber),
    history,
  };
}

function laterDate(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b; // ISO YYYY-MM-DD is lexicographically ordered
}
