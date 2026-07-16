import type { Category, User, VideoRef } from '@/lib/domain/types';
import type { Content, RawContentEntry, RawContentFile } from './types';
import { detectPlatform, hashUrl } from './url';

export type ValidationResult =
  | { ok: true; content: Content }
  | { ok: false; message: string };

/** Slugify a display name into a stable user id — 'Anya' → 'anya'. */
export function slugifyUserId(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Validate a parsed content.json and derive the internal Content object.
 * Accepts the users[] shape (each user holding categories[] with per-category
 * daily targets, or a legacy flat videos[] that becomes one implicit
 * category), or the legacy top-level videos[] shape (in which case a single
 * implicit user "Everyone" holds the whole library).
 */
export function validateContent(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, message: 'Top-level must be a JSON object.' };
  }
  const obj = raw as Partial<RawContentFile>;

  const s = obj.settings;
  if (!s || typeof s !== 'object') return { ok: false, message: 'Missing "settings" object.' };
  const requiredNums: string[] = [
    'defaultCategoryTargetMinutes', 'pointsPerExtraMinute', 'freezeCostPoints', 'maxFreezesHeld',
  ];
  for (const k of requiredNums) {
    const v = (s as unknown as Record<string, unknown>)[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
      return { ok: false, message: `settings.${k} must be a non-negative number.` };
    }
  }
  const defaultTargetMinutes = s.defaultCategoryTargetMinutes;
  if (typeof s.recycleWhenLibraryExhausted !== 'boolean') {
    return { ok: false, message: 'settings.recycleWhenLibraryExhausted must be true or false.' };
  }

  let users: User[];
  try {
    if (Array.isArray(obj.users)) {
      if (obj.users.length === 0) return { ok: false, message: '"users" must not be empty.' };
      const seenIds = new Set<string>();
      users = obj.users.map((u, i) => {
        if (!u || typeof u !== 'object' || typeof (u as any).name !== 'string') {
          throw new Error(`users[${i}] must be an object with a "name" string.`);
        }
        const id = slugifyUserId((u as any).name);
        if (!id) throw new Error(`users[${i}].name is empty after slugifying.`);
        if (seenIds.has(id)) throw new Error(`Duplicate user id "${id}" (from name "${(u as any).name}").`);
        seenIds.add(id);
        return {
          id,
          name: (u as any).name.trim(),
          categories: parseCategories(u, defaultTargetMinutes, `users[${i}]`),
        };
      });
    } else if (Array.isArray(obj.videos)) {
      users = [{
        id: 'everyone',
        name: 'Everyone',
        categories: [implicitCategory(parseVideos(obj.videos, 'videos'), defaultTargetMinutes)],
      }];
    } else {
      return { ok: false, message: 'Missing "users" array (or legacy "videos" array).' };
    }
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }

  return {
    ok: true,
    content: {
      settings: {
        defaultCategoryTargetMinutes: defaultTargetMinutes,
        pointsPerExtraMinute: s.pointsPerExtraMinute,
        freezeCostPoints: s.freezeCostPoints,
        maxFreezesHeld: s.maxFreezesHeld,
        recycleWhenLibraryExhausted: s.recycleWhenLibraryExhausted,
      },
      users,
    },
  };
}

/** The single category a legacy flat video list collapses into. */
function implicitCategory(videos: VideoRef[], defaultTargetMinutes: number): Category {
  return { id: 'practice', name: 'Practice', targetMinutes: defaultTargetMinutes, videos };
}

/**
 * Parse one user's library: either categories[] (each with an optional
 * per-category daily target falling back to settings.defaultCategoryTargetMinutes) or
 * a legacy flat videos[] that becomes one implicit category. Video URLs must
 * be unique across the WHOLE user, not just within a category.
 */
function parseCategories(u: unknown, defaultTargetMinutes: number, where: string): Category[] {
  const rawCategories = (u as any).categories;
  const rawVideos = (u as any).videos;

  if (rawCategories === undefined) {
    if (!Array.isArray(rawVideos)) {
      throw new Error(`${where} must have a "categories" (or legacy "videos") array.`);
    }
    return [implicitCategory(parseVideos(rawVideos, `${where}.videos`), defaultTargetMinutes)];
  }

  if (!Array.isArray(rawCategories) || rawCategories.length === 0) {
    throw new Error(`${where}.categories must be a non-empty array.`);
  }
  const seenCategoryIds = new Set<string>();
  const seenVideoIds = new Set<string>();
  return rawCategories.map((c, i) => {
    const at = `${where}.categories[${i}]`;
    if (!c || typeof c !== 'object' || typeof (c as any).name !== 'string' || !(c as any).name.trim()) {
      throw new Error(`${at} must be an object with a non-empty "name" string.`);
    }
    const rawId = (c as any).id;
    if (rawId !== undefined && typeof rawId !== 'string') {
      throw new Error(`${at}.id must be a string.`);
    }
    const id = slugifyUserId(rawId ?? (c as any).name);
    if (!id) throw new Error(`${at} id is empty after slugifying.`);
    if (seenCategoryIds.has(id)) throw new Error(`Duplicate category id "${id}" in ${where}.`);
    seenCategoryIds.add(id);

    const rawTarget = (c as any).targetMinutes;
    let targetMinutes = defaultTargetMinutes;
    if (rawTarget !== undefined) {
      if (typeof rawTarget !== 'number' || !Number.isInteger(rawTarget) || rawTarget < 1) {
        throw new Error(`${at}.targetMinutes must be a positive integer number of minutes.`);
      }
      targetMinutes = rawTarget;
    }

    if (!Array.isArray((c as any).videos)) {
      throw new Error(`${at}.videos must be an array.`);
    }
    return {
      id,
      name: (c as any).name.trim(),
      targetMinutes,
      videos: parseVideos((c as any).videos, `${at}.videos`, seenVideoIds),
    };
  });
}

function parseVideos(list: RawContentEntry[], where: string, seenIds = new Set<string>()): VideoRef[] {
  return list.map((entry, i) => {
    if (!entry || typeof entry !== 'object' || typeof (entry as any).url !== 'string') {
      throw new Error(`${where}[${i}] must be an object with a "url" string.`);
    }
    const url = (entry as any).url as string;
    const id = hashUrl(url);
    if (seenIds.has(id)) {
      throw new Error(`Duplicate video URL at ${where}[${i}]: ${url} (URLs must be unique per user, across categories).`);
    }
    seenIds.add(id);
    const title = typeof (entry as any).title === 'string' && (entry as any).title.trim().length > 0
      ? (entry as any).title.trim()
      : deriveTitle(url);
    const rawDescription = (entry as any).description;
    const description = typeof rawDescription === 'string' && rawDescription.trim().length > 0
      ? rawDescription.trim()
      : undefined;

    const rawTimerTitles = (entry as any).timerTitles;
    let timerTitles: string[] | undefined;
    if (rawTimerTitles !== undefined) {
      if (!Array.isArray(rawTimerTitles) || rawTimerTitles.some((t) => typeof t !== 'string')) {
        throw new Error(`${where}[${i}].timerTitles must be an array of strings.`);
      }
      const cleaned = rawTimerTitles.map((t) => (t as string).trim());
      if (cleaned.length > 0) timerTitles = cleaned;
    }

    const rawTimer = (entry as any).timer;
    let timer: number | undefined;
    if (rawTimer !== undefined) {
      if (typeof rawTimer !== 'number' || !Number.isInteger(rawTimer) || rawTimer < 1) {
        throw new Error(`${where}[${i}].timer must be a positive integer number of seconds.`);
      }
      timer = rawTimer;
    }

    const v: VideoRef = { id, url, title, platform: detectPlatform(url) };
    if (description) v.description = description;
    if (timerTitles) v.timerTitles = timerTitles;
    if (timer !== undefined) v.timer = timer;
    return v;
  });
}

function deriveTitle(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}`;
  } catch {
    return url;
  }
}
