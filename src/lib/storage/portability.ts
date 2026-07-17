import type { HistoryEntry, Progress, Vault } from '@/lib/domain/types';
import { DEFAULT_PROGRESS, DEFAULT_VAULT } from '@/lib/domain/types';
import { migrateVault } from './migrate';

export function exportToBlob(vault: Vault): { blob: Blob; filename: string } {
  const stamp = new Date().toISOString().slice(0, 10);
  return {
    blob: new Blob([JSON.stringify(vault, null, 2)], { type: 'application/json' }),
    filename: `soccr-progress-${stamp}.json`,
  };
}

export type ParseResult =
  | { ok: true; vault: Vault }
  | { ok: false; error: string };

/**
 * Parse a user-supplied backup. Accepts either a Vault or a legacy single-user
 * Progress (the migrator wraps it). Very forgiving so that files exported by
 * older builds still work.
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
  const known = ['currentStreak', 'longestStreak', 'points', 'seenVideoIds', 'history', 'schemaVersion', 'users', 'vaultVersion', 'activeUserId'];
  const hits = known.filter((k) => k in (raw as Record<string, unknown>));
  if (hits.length < 2) {
    return { ok: false, error: "This doesn't look like a Soccr backup file." };
  }
  return { ok: true, vault: migrateVault(raw) };
}

/**
 * Non-destructive merge across two vaults:
 *   * activeUserId → taken from `a` (the local vault) so importing doesn't
 *     silently switch which user is shown.
 *   * users → per-user merge (see mergeProgress). Users only in one vault are
 *     copied over as-is.
 */
export function mergeVault(a: Vault, b: Vault, maxFreezes: number): Vault {
  const ids = new Set<string>([...Object.keys(a.users), ...Object.keys(b.users)]);
  const users: Record<string, Progress> = {};
  for (const id of ids) {
    const ap = a.users[id];
    const bp = b.users[id];
    if (ap && bp) users[id] = mergeProgress(ap, bp, maxFreezes);
    else users[id] = { ...(ap ?? bp ?? { ...DEFAULT_PROGRESS }) };
  }
  return {
    ...DEFAULT_VAULT,
    vaultVersion: Math.max(a.vaultVersion, b.vaultVersion),
    activeUserId: a.activeUserId || b.activeUserId,
    users,
  };
}

/** Per-user merge — same rules as before (max, not sum). */
export function mergeProgress(a: Progress, b: Progress, maxFreezes: number): Progress {
  const seen = new Set<string>([...a.seenVideoIds, ...b.seenVideoIds]);
  const completedDates = [...new Set<string>([...(a.completedDates ?? []), ...(b.completedDates ?? [])])].sort();
  const frozenDates = [...new Set<string>([...(a.frozenDates ?? []), ...(b.frozenDates ?? [])])].sort();
  const historyMap = new Map<string, HistoryEntry>();
  const key = (h: HistoryEntry) => `${h.date}|${h.mode}|${h.startedAt}`;
  for (const h of [...a.history, ...b.history]) historyMap.set(key(h), h);
  const history = Array.from(historyMap.values()).sort((x, y) => x.startedAt - y.startedAt);

  // Personalisation and same-day state must survive a merge too: the local
  // avatar choice wins (falling back to the import's), and the fresher
  // drill-day record (today's goal progress + extra tally) is kept — ties go
  // to the local one.
  const avatarIcon = a.avatarIcon ?? b.avatarIcon;
  const drillDay = !b.drillDay ? a.drillDay
    : !a.drillDay ? b.drillDay
    : a.drillDay.date >= b.drillDay.date ? a.drillDay : b.drillDay;

  return {
    ...DEFAULT_PROGRESS,
    schemaVersion: Math.max(a.schemaVersion, b.schemaVersion),
    currentStreak: Math.max(a.currentStreak, b.currentStreak),
    longestStreak: Math.max(a.longestStreak, b.longestStreak, a.currentStreak, b.currentStreak),
    lastCompletedDate: laterDate(a.lastCompletedDate, b.lastCompletedDate),
    points: Math.max(a.points, b.points),
    freezesHeld: Math.min(maxFreezes, Math.max(a.freezesHeld, b.freezesHeld)),
    seenVideoIds: Array.from(seen),
    cycleNumber: Math.max(a.cycleNumber, b.cycleNumber),
    history,
    completedDates,
    frozenDates,
    ...(avatarIcon !== undefined ? { avatarIcon } : {}),
    ...(drillDay !== undefined ? { drillDay } : {}),
  };
}

function laterDate(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}
