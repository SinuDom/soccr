import type { Vault } from '@/lib/domain/types';
import { DEFAULT_VAULT } from '@/lib/domain/types';
import { LEGACY_KEYS, PROGRESS_KEY } from './keys';
import { migrateVault } from './migrate';

export interface LoadResult {
  vault: Vault;
  corrupted: boolean;
  loadedFromLegacy: boolean;
}

/**
 * Load the vault from localStorage. NEVER throws. Corrupt data returns an
 * empty vault with `corrupted: true` so the UI can offer recovery instead of
 * silently wiping the user's history.
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
    return { vault: { ...DEFAULT_VAULT }, corrupted: false, loadedFromLegacy: false };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { vault: { ...DEFAULT_VAULT }, corrupted: true, loadedFromLegacy: false };
  }
  return { vault: migrateVault(parsed), corrupted: false, loadedFromLegacy };
}

/**
 * Save the vault. Returns { ok, quotaExceeded }. On quota-exceeded we retry
 * once with each user's history trimmed to the most recent 200 entries.
 */
export function save(vault: Vault, storage: Storage = safeStorage()): { ok: boolean; quotaExceeded: boolean } {
  const json = JSON.stringify(vault);
  try {
    storage.setItem(PROGRESS_KEY, json);
    return { ok: true, quotaExceeded: false };
  } catch (err) {
    if (isQuotaError(err)) {
      try {
        const trimmed: Vault = {
          ...vault,
          users: Object.fromEntries(
            Object.entries(vault.users).map(([id, p]) => [
              id,
              { ...p, history: p.history.slice(-200) },
            ]),
          ),
        };
        storage.setItem(PROGRESS_KEY, JSON.stringify(trimmed));
        return { ok: true, quotaExceeded: true };
      } catch {
        return { ok: false, quotaExceeded: true };
      }
    }
    return { ok: false, quotaExceeded: false };
  }
}

export function reset(storage: Storage = safeStorage()): void {
  try { storage.removeItem(PROGRESS_KEY); } catch { /* ignore */ }
}

function isQuotaError(e: unknown): boolean {
  return !!e && typeof e === 'object' &&
    ('name' in e ? (e as any).name === 'QuotaExceededError' : false);
}

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
