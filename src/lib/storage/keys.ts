// Versioned localStorage key. NEVER change this without a migration path —
// changing the key strands users' progress. Bump schemaVersion inside the
// stored object and add a migrator instead.
export const PROGRESS_KEY = 'football.progress.v1';

// Legacy keys to check for on load, in order (oldest first).
// A found legacy key is read + migrated + written under PROGRESS_KEY.
export const LEGACY_KEYS: string[] = [];
