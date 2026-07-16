export interface SelectionInput {
  libraryIds: string[];
  seenIds: string[];
  cycleNumber: number;
  rng?: () => number;
}

export interface SelectionResult {
  videoId: string | null;
  cycleAdvanced: boolean;
  nextCycleNumber: number;
  nextSeenIds: string[];
}

/**
 * Pick a random video ID from the unseen pool. If exhausted, advance the cycle
 * and pick from the full library. The seen list is NEVER persisted directly
 * from this function — callers merge the returned nextSeenIds into progress.
 *
 * Orphan IDs (things in seenIds that are no longer in libraryIds) are ignored
 * naturally by the set-difference — they neither block selection nor reset
 * anything.
 */
export function pickNextVideo(input: SelectionInput): SelectionResult {
  const rng = input.rng ?? Math.random;
  const libSet = new Set(input.libraryIds);
  if (libSet.size === 0) {
    return {
      videoId: null,
      cycleAdvanced: false,
      nextCycleNumber: input.cycleNumber,
      nextSeenIds: input.seenIds,
    };
  }
  const seenInLib = input.seenIds.filter((id) => libSet.has(id));
  const unseen = input.libraryIds.filter((id) => !seenInLib.includes(id));

  if (unseen.length > 0) {
    const idx = Math.floor(rng() * unseen.length);
    const clamped = Math.min(unseen.length - 1, Math.max(0, idx));
    const picked = unseen[clamped]!;
    return {
      videoId: picked,
      cycleAdvanced: false,
      nextCycleNumber: input.cycleNumber,
      nextSeenIds: input.seenIds, // caller decides when to mark seen
    };
  }

  // Recycle: cycle advances and the seen entries for THIS library clear, then
  // pick fresh from the full library. Ids outside the library (e.g. other
  // categories' videos) are kept so recycling one category never resets the
  // others.
  const idx = Math.floor(rng() * input.libraryIds.length);
  const clamped = Math.min(input.libraryIds.length - 1, Math.max(0, idx));
  const picked = input.libraryIds[clamped]!;
  return {
    videoId: picked,
    cycleAdvanced: true,
    nextCycleNumber: input.cycleNumber + 1,
    nextSeenIds: input.seenIds.filter((id) => !libSet.has(id)), // caller will add `picked` via markSeen()
  };
}

export function markSeen(seenIds: string[], id: string): string[] {
  if (seenIds.includes(id)) return seenIds;
  return [...seenIds, id];
}

/** Compute the current unseen pool for UI display (never persisted). */
export function unseenPool(libraryIds: string[], seenIds: string[]): string[] {
  const seenSet = new Set(seenIds);
  return libraryIds.filter((id) => !seenSet.has(id));
}

/** Prune orphaned IDs (safely — only optional cleanup; not required for correctness). */
export function pruneOrphans(libraryIds: string[], seenIds: string[]): string[] {
  const libSet = new Set(libraryIds);
  return seenIds.filter((id) => libSet.has(id));
}
