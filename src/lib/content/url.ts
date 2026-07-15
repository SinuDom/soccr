import type { Platform } from '@/lib/domain/types';

// Tracking / non-identity params that should never affect the derived ID.
const TRACKING_PARAM_EXACT = new Set([
  'fbclid',
  'igshid',
  'si',
  'feature',
  't',                // YouTube timestamp — same video
  '_r',
  'is_from_webapp',
  'sender_device',
  'igsh',
  'ref',
  'ref_src',
  'ref_url',
  'source',
]);
const TRACKING_PARAM_PREFIX = ['utm_'];

function isTrackingParam(name: string): boolean {
  if (TRACKING_PARAM_EXACT.has(name)) return true;
  return TRACKING_PARAM_PREFIX.some((p) => name.startsWith(p));
}

/**
 * Normalize a URL so that meaningless differences (tracking params, casing of
 * host, trailing slash, query order) do not change the derived hash ID.
 * Falls back to the trimmed raw string when the URL is unparseable — the goal
 * is a stable, deterministic key, not correctness of the URL itself.
 */
export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    return trimmed.toLowerCase();
  }
  u.host = u.host.toLowerCase();
  u.hash = '';
  // Strip trailing slash from pathname (but keep the root "/").
  if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
    u.pathname = u.pathname.replace(/\/+$/, '');
  }
  const kept: [string, string][] = [];
  for (const [k, v] of u.searchParams.entries()) {
    if (!isTrackingParam(k)) kept.push([k, v]);
  }
  kept.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const params = new URLSearchParams();
  for (const [k, v] of kept) params.append(k, v);
  u.search = params.toString() ? `?${params.toString()}` : '';
  return u.toString();
}

// FNV-1a 32-bit — sync, deterministic fallback when Web Crypto isn't available
// (e.g. some test environments, or an ad-block that neuters `crypto.subtle`).
function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * Deterministic ID for a URL. We call this synchronously on library load;
 * SHA-256 (async, via Web Crypto) is preferable but a sync fallback is worth
 * more than perfect entropy here — 32 bits collides with p ≈ 1e-5 at 10k URLs,
 * which is far more than any hand-curated content file will ever hold.
 */
export function hashUrl(rawUrl: string): string {
  const normalized = normalizeUrl(rawUrl);
  return `v_${fnv1a(normalized)}`;
}

export function detectPlatform(url: string): Platform {
  let host = '';
  try {
    host = new URL(url.trim()).host.toLowerCase();
  } catch {
    return 'other';
  }
  if (host.includes('youtube.com') || host === 'youtu.be' || host.endsWith('.youtu.be')) return 'youtube';
  if (host.includes('instagram.com')) return 'instagram';
  if (host.includes('tiktok.com')) return 'tiktok';
  return 'other';
}

/** Extract a YouTube video id (or `null` if this isn't a YouTube URL we can parse). */
export function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url.trim());
    const host = u.host.toLowerCase();
    if (host === 'youtu.be' || host.endsWith('.youtu.be')) {
      return u.pathname.slice(1).split('/')[0] || null;
    }
    if (host.includes('youtube.com')) {
      if (u.pathname === '/watch') return u.searchParams.get('v');
      const shortsMatch = u.pathname.match(/^\/shorts\/([^/?#]+)/);
      if (shortsMatch && shortsMatch[1]) return shortsMatch[1];
      const embedMatch = u.pathname.match(/^\/embed\/([^/?#]+)/);
      if (embedMatch && embedMatch[1]) return embedMatch[1];
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * True when the URL is a YouTube Short (vertical clip). Shorts live under the
 * `/shorts/` path; we render them in a portrait frame instead of a 16:9 box.
 */
export function isYouTubeShort(url: string): boolean {
  try {
    const u = new URL(url.trim());
    const host = u.host.toLowerCase();
    if (!host.includes('youtube.com')) return false;
    return /^\/shorts\//.test(u.pathname);
  } catch {
    return false;
  }
}

/** Extract an Instagram short-code from /reel/{code} or /p/{code}. */
export function extractInstagramCode(url: string): string | null {
  try {
    const u = new URL(url.trim());
    const m = u.pathname.match(/\/(reel|reels|p|tv)\/([^/?#]+)/);
    return m && m[2] ? m[2] : null;
  } catch {
    return null;
  }
}

/** Extract a TikTok video id from /@user/video/{id} or /v/{id}. */
export function extractTikTokId(url: string): string | null {
  try {
    const u = new URL(url.trim());
    const m1 = u.pathname.match(/\/video\/(\d+)/);
    if (m1 && m1[1]) return m1[1];
    const m2 = u.pathname.match(/^\/v\/(\d+)/);
    if (m2 && m2[1]) return m2[1];
    return null;
  } catch {
    return null;
  }
}
