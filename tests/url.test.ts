import { describe, expect, it } from 'vitest';
import { detectPlatform, extractInstagramCode, extractTikTokId, extractYouTubeId, hashUrl, isYouTubeShort, normalizeUrl } from '@/lib/content/url';

describe('isYouTubeShort', () => {
  it('is true for /shorts/ URLs', () => {
    expect(isYouTubeShort('https://www.youtube.com/shorts/--llBGWd4JA')).toBe(true);
    expect(isYouTubeShort('https://youtube.com/shorts/abc?si=x')).toBe(true);
  });
  it('is false for watch/embed/other URLs', () => {
    expect(isYouTubeShort('https://www.youtube.com/watch?v=abc')).toBe(false);
    expect(isYouTubeShort('https://youtu.be/abc')).toBe(false);
    expect(isYouTubeShort('https://www.instagram.com/reel/abc/')).toBe(false);
    expect(isYouTubeShort('not a url')).toBe(false);
  });
});

describe('normalizeUrl', () => {
  it('trims and lowercases host', () => {
    expect(normalizeUrl('  https://WWW.YouTube.COM/watch?v=abc  ')).toBe('https://www.youtube.com/watch?v=abc');
  });
  it('strips tracking params (utm_*, fbclid, igshid, si)', () => {
    const a = normalizeUrl('https://www.youtube.com/watch?v=abc&utm_source=x&utm_medium=y');
    const b = normalizeUrl('https://www.youtube.com/watch?v=abc&fbclid=999');
    const c = normalizeUrl('https://www.youtube.com/watch?v=abc');
    expect(a).toBe(c);
    expect(b).toBe(c);
  });
  it('strips YouTube t (timestamp) — same video', () => {
    const a = normalizeUrl('https://www.youtube.com/watch?v=abc&t=120');
    const b = normalizeUrl('https://www.youtube.com/watch?v=abc');
    expect(a).toBe(b);
  });
  it('drops trailing slash from pathname', () => {
    expect(normalizeUrl('https://www.instagram.com/reel/xyz/')).toBe('https://www.instagram.com/reel/xyz');
  });
  it('sorts remaining query params so order does not affect the ID', () => {
    const a = normalizeUrl('https://example.com/page?b=2&a=1');
    const b = normalizeUrl('https://example.com/page?a=1&b=2');
    expect(a).toBe(b);
  });
  it('handles unparseable URLs deterministically', () => {
    expect(normalizeUrl('not a url')).toBe('not a url');
    expect(hashUrl('not a url')).toBe(hashUrl('  not a url  '));
  });
});

describe('hashUrl', () => {
  it('same URL → same hash', () => {
    expect(hashUrl('https://youtu.be/abc')).toBe(hashUrl('https://youtu.be/abc'));
  });
  it('URLs differing only in tracking params share a hash', () => {
    expect(hashUrl('https://youtu.be/abc?utm_source=x'))
      .toBe(hashUrl('https://youtu.be/abc?fbclid=q'));
  });
  it('different videos → different hashes', () => {
    expect(hashUrl('https://youtu.be/abc')).not.toBe(hashUrl('https://youtu.be/xyz'));
  });
  it('reordering the list does not change any individual URL hash', () => {
    const urls = [
      'https://www.youtube.com/watch?v=abc',
      'https://www.instagram.com/reel/xyz/',
      'https://www.tiktok.com/@u/video/12345',
    ];
    const ids1 = urls.map(hashUrl);
    const ids2 = [...urls].reverse().map(hashUrl);
    // Each URL's hash is identical regardless of position:
    for (let i = 0; i < urls.length; i++) {
      expect(ids1[i]).toBe(hashUrl(urls[i]!));
    }
    expect(new Set(ids1)).toEqual(new Set(ids2));
  });
});

describe('detectPlatform', () => {
  it.each([
    ['https://www.youtube.com/watch?v=abc', 'youtube'],
    ['https://youtu.be/abc', 'youtube'],
    ['https://www.instagram.com/reel/xyz/', 'instagram'],
    ['https://www.tiktok.com/@u/video/12345', 'tiktok'],
    ['https://example.com/vid', 'other'],
    ['garbage', 'other'],
  ] as const)('%s → %s', (url, p) => {
    expect(detectPlatform(url)).toBe(p);
  });
});

describe('platform id extractors', () => {
  it('extracts YouTube ids from watch, youtu.be, shorts, embed', () => {
    expect(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeId('https://www.youtube.com/shorts/xyz123')).toBe('xyz123');
    expect(extractYouTubeId('https://www.youtube.com/embed/xyz123')).toBe('xyz123');
  });
  it('extracts Instagram code from /reel/ and /p/', () => {
    expect(extractInstagramCode('https://www.instagram.com/reel/CxYz1_abc/')).toBe('CxYz1_abc');
    expect(extractInstagramCode('https://www.instagram.com/p/CxYz1_abc/?igshid=999')).toBe('CxYz1_abc');
  });
  it('extracts TikTok id from /video/ and /v/', () => {
    expect(extractTikTokId('https://www.tiktok.com/@user/video/1234567890')).toBe('1234567890');
    expect(extractTikTokId('https://www.tiktok.com/v/1234567890')).toBe('1234567890');
  });
});
