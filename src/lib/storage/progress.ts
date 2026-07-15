import type { Progress } from '@/lib/domain/types';
import { DEFAULT_PROGRESS } from '@/lib/domain/types';
import { LEGACY_KEYS, PROGRESS_KEY } from './keys';
import { migrate } from './migrate';

export interface LoadResult {
  progress: Progress;
  corrupted: boolean; // true iff the stored JSON was unparseable
  loadedFromLegacy: boolean;
}

/**
 * Load progress from localStorage. NEVER throws. Corrupt data returns defaults
 * with `corrupted: true` so the UI can offer recovery (import from backup)
 * instead of silently wiping the user's history.
 *
 * IMPORTANT: this function does not write. Callers that want to persist a
 * successful load call save() explicitly. This lets us load-without-touch for
 * schema previews and, more importantly, avoids clobbering a corrupt-but-
 * -parseable-elsewhere file with defaults.
 */
export function load(storage: Storage = safeStorage()): LoadResult {
  let raw = storage.getItem(PROGRESS_KEY);
  let loadedFromLegacy = false;

  if (!raw) {
    for (const legacy of LEGACY_KEYS) {
      const v = storage.getItem(legacy);
      if (v) { raw = v; loadedFromLegacy = true; break; }
    }
  }

  if (!raw) {
    return { progress: { ...DEFAULT_PROGRESS }, corrupted: false, loadedFromLegacy: false };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { progress: { ...DEFAULT_PROGRESS }, corrupted: true, loadedFromLegacy: false };
  }
  const progress = migrate(parsed);
  return { progress, corrupted: false, loadedFromLegacy };
}

/**
 * Save. Returns { ok, quotaExceeded }. Never throws. On quota-exceeded we
 * retry once with the history trimmed to the most recent 200 entries — losing
 * old history entries is far better than losing streak/points.
 */
export function save(progress: Progress, storage: Storage = safeStorage()): { ok: boolean; quotaExceeded: boolean } {
  const json = JSON.stringify(progress);
  try {
    storage.setItem(PROGRESS_KEY, json);
    return { ok: true, quotaExceeded: false };
  } catch (err) {
    if (isQuotaError(err) && progress.history.length > 200) {
      try {
        const trimmed = { ...progress, history: progress.history.slice(-200) };
        storage.setItem(PROGRESS_KEY, JSON.stringify(trimmed));
        return { ok: true, quotaExceeded: true };
      } catch {
        return { ok: false, quotaExceeded: true };
      }
    }
    return { ok: false, quotaExceeded: isQuotaError(err) };
  }
}

/** Reset (only used from the Settings "reset progress" confirm). */
export function reset(storage: Storage = safeStorage()): void {
  try { storage.removeItem(PROGRESS_KEY); } catch { /* ignore */ }
}

function isQuotaError(e: unknown): boolean {
  return !!e && typeof e === 'object' &&
    ('name' in e ? (e as any).name === 'QuotaExceededError' : false);
}

// In SSR/no-window environments (Vite build, tests without jsdom), return an
// in-memory shim so imports never explode.
function safeStorage(): Storage {
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  const mem = new Map<string, string>();
  return {
    get length() { return mem.size; },
    clear: () => mem.clear(),
    getItem: (k) => mem.get(k) ?? null,
    key: (i) => Array.from(mem.keys())[i] ?? null,
    removeItem: (k) => { mem.delete(k); },
    setItem: (k, v) => { mem.set(k, v); },
  } satisfies Storage;
}
