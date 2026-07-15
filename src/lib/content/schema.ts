import type { User, VideoRef } from '@/lib/domain/types';
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
 * Accepts either the new users[] shape or the legacy top-level videos[] shape
 * (in which case a single implicit user "Everyone" holds the whole library).
 */
export function validateContent(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, message: 'Top-level must be a JSON object.' };
  }
  const obj = raw as Partial<RawContentFile>;

  const s = obj.settings;
  if (!s || typeof s !== 'object') return { ok: false, message: 'Missing "settings" object.' };
  const requiredNums: string[] = [
    'sessionTargetMinutes', 'pointsPerExtraMinute', 'freezeCostPoints', 'maxFreezesHeld',
  ];
  for (const k of requiredNums) {
    const v = (s as unknown as Record<string, unknown>)[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
      return { ok: false, message: `settings.${k} must be a non-negative number.` };
    }
  }
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
        if (!Array.isArray((u as any).videos)) {
          throw new Error(`users[${i}].videos must be an array.`);
        }
        return {
          id,
          name: (u as any).name.trim(),
          videos: parseVideos((u as any).videos, `users[${i}].videos`),
        };
      });
    } else if (Array.isArray(obj.videos)) {
      users = [{
        id: 'everyone',
        name: 'Everyone',
        videos: parseVideos(obj.videos, 'videos'),
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
        sessionTargetMinutes: s.sessionTargetMinutes,
        pointsPerExtraMinute: s.pointsPerExtraMinute,
        freezeCostPoints: s.freezeCostPoints,
        maxFreezesHeld: s.maxFreezesHeld,
        recycleWhenLibraryExhausted: s.recycleWhenLibraryExhausted,
      },
      users,
    },
  };
}

function parseVideos(list: RawContentEntry[], where: string): VideoRef[] {
  const seenIds = new Set<string>();
  return list.map((entry, i) => {
    if (!entry || typeof entry !== 'object' || typeof (entry as any).url !== 'string') {
      throw new Error(`${where}[${i}] must be an object with a "url" string.`);
    }
    const url = (entry as any).url as string;
    const id = hashUrl(url);
    if (seenIds.has(id)) {
      throw new Error(`Duplicate video URL in ${where} at index ${i}: ${url}`);
    }
    seenIds.add(id);
    const title = typeof (entry as any).title === 'string' && (entry as any).title.trim().length > 0
      ? (entry as any).title.trim()
      : deriveTitle(url);
    const rawDescription = (entry as any).description;
    const description = typeof rawDescription === 'string' && rawDescription.trim().length > 0
      ? rawDescription.trim()
      : undefined;

    const rawTimer = (entry as any).timer;
    let timer: number | undefined;
    if (rawTimer !== undefined) {
      if (typeof rawTimer !== 'number' || !Number.isInteger(rawTimer) || rawTimer < 1) {
        throw new Error(`${where}[${i}].timer must be a positive integer number of seconds.`);
      }
      timer = rawTimer;
    }

    const rawRepetition = (entry as any).repetition;
    let repetition: number | undefined;
    if (rawRepetition !== undefined) {
      if (typeof rawRepetition !== 'number' || !Number.isInteger(rawRepetition) || rawRepetition < 1) {
        throw new Error(`${where}[${i}].repetition must be an integer >= 1.`);
      }
      repetition = rawRepetition;
    }

    const v: VideoRef = { id, url, title, platform: detectPlatform(url) };
    if (description) v.description = description;
    if (timer !== undefined) v.timer = timer;
    if (repetition !== undefined) v.repetition = repetition;
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
