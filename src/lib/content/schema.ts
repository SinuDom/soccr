import type { Content, RawContentFile } from './types';
import { detectPlatform, hashUrl } from './url';

export type ValidationResult =
  | { ok: true; content: Content }
  | { ok: false; message: string };

/**
 * Validate a parsed content.json and derive the internal Content object
 * (adds derived id + platform to each video). Never throws.
 */
export function validateContent(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, message: 'Top-level must be a JSON object.' };
  }
  const obj = raw as Partial<RawContentFile>;

  const s = obj.settings;
  if (!s || typeof s !== 'object') return { ok: false, message: 'Missing "settings" object.' };
  const requiredNums: (keyof typeof s)[] = [
    'sessionTargetMinutes', 'pointsPerExtraMinute', 'freezeCostPoints', 'maxFreezesHeld',
  ];
  for (const k of requiredNums) {
    const v = (s as unknown as Record<string, unknown>)[k as string];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
      return { ok: false, message: `settings.${String(k)} must be a non-negative number.` };
    }
  }
  if (typeof s.recycleWhenLibraryExhausted !== 'boolean') {
    return { ok: false, message: 'settings.recycleWhenLibraryExhausted must be true or false.' };
  }

  if (!Array.isArray(obj.videos)) {
    return { ok: false, message: 'Missing "videos" array.' };
  }

  const seenIds = new Set<string>();
  let videos;
  try {
    videos = obj.videos.map((entry, i) => {
      if (!entry || typeof entry !== 'object' || typeof (entry as any).url !== 'string') {
        throw new Error(`videos[${i}] must be an object with a "url" string.`);
      }
      const url = (entry as any).url as string;
      const id = hashUrl(url);
      if (seenIds.has(id)) {
        throw new Error(`Duplicate video URL at index ${i}: ${url}`);
      }
      seenIds.add(id);
      const title = typeof (entry as any).title === 'string' && (entry as any).title.trim().length > 0
        ? (entry as any).title.trim()
        : deriveTitle(url);
      return { id, url, title, platform: detectPlatform(url) };
    });
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
      videos,
    },
  };
}

function deriveTitle(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}`;
  } catch {
    return url;
  }
}
