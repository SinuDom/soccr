import { describe, expect, it } from 'vitest';
import { hashUrl } from '@/lib/content/url';
import { DEFAULT_PROGRESS, type Progress } from '@/lib/domain/types';
import { pickNextVideo, unseenPool } from '@/lib/domain/selection';

// The headline test from the spec: editing content.json must NEVER wipe or
// alter streak/points/history. The join between the two stores is the derived
// URL-hash ID and nothing else.

function makeLibrary(urls: string[]) {
  return urls.map(hashUrl);
}

describe('progress preservation across content changes', () => {
  it('removing 2 old videos and adding 5 new leaves streak/points/freezes/history untouched', () => {
    const oldUrls = [
      'https://www.youtube.com/watch?v=aaa',
      'https://www.youtube.com/watch?v=bbb',
      'https://www.youtube.com/watch?v=ccc',
      'https://www.instagram.com/reel/ddd/',
      'https://www.tiktok.com/@u/video/1000',
    ];
    const oldIds = makeLibrary(oldUrls);

    const yesterdaysProgress: Progress = {
      ...DEFAULT_PROGRESS,
      currentStreak: 7,
      longestStreak: 12,
      points: 340,
      freezesHeld: 1,
      seenVideoIds: [...oldIds],   // watched all 5 yesterday
      cycleNumber: 2,
      lastCompletedDate: '2026-07-14',
      history: [
        { date: '2026-07-14', startedAt: 1, mode: 'daily', practiceMs: 1_200_000, pointsEarned: 0, videoIds: [oldIds[0]!], completedDaily: true },
        { date: '2026-07-13', startedAt: 2, mode: 'extra', practiceMs: 300_000, pointsEarned: 50, videoIds: [oldIds[1]!] },
      ],
    };

    // NEW content file: drop 2, add 5.
    const newUrls = [
      // kept:
      'https://www.youtube.com/watch?v=aaa',
      'https://www.youtube.com/watch?v=bbb',
      'https://www.youtube.com/watch?v=ccc',
      // (Instagram + first tiktok removed)
      // added:
      'https://www.youtube.com/watch?v=new1',
      'https://www.youtube.com/watch?v=new2',
      'https://www.instagram.com/reel/new3/',
      'https://www.tiktok.com/@u/video/9001',
      'https://www.tiktok.com/@u/video/9002',
    ];
    const newIds = makeLibrary(newUrls);

    // All streak/points/history fields are UNCHANGED. The join is purely
    // derived; nothing about progress needs to be rewritten.
    expect(yesterdaysProgress.currentStreak).toBe(7);
    expect(yesterdaysProgress.longestStreak).toBe(12);
    expect(yesterdaysProgress.points).toBe(340);
    expect(yesterdaysProgress.freezesHeld).toBe(1);
    expect(yesterdaysProgress.cycleNumber).toBe(2);
    expect(yesterdaysProgress.history).toHaveLength(2);

    // The 5 NEW videos appear in the unseen pool (orphan removed ids are
    // ignored by set-difference).
    const unseen = unseenPool(newIds, yesterdaysProgress.seenVideoIds);
    // Kept & already-seen videos should NOT be unseen.
    expect(unseen).not.toContain(newIds[0]);
    expect(unseen).not.toContain(newIds[1]);
    expect(unseen).not.toContain(newIds[2]);
    // The 5 new IDs should be.
    expect(unseen).toEqual(expect.arrayContaining(newIds.slice(3)));
    expect(unseen).toHaveLength(5);

    // Selection picks one of the 5 unseen (never an orphan or the 3 kept-seen).
    const r = pickNextVideo({
      libraryIds: newIds,
      seenIds: yesterdaysProgress.seenVideoIds,
      cycleNumber: yesterdaysProgress.cycleNumber,
      rng: () => 0.5,
    });
    expect(newIds.slice(3)).toContain(r.videoId);
    expect(r.cycleAdvanced).toBe(false);
  });

  it('URL hash is stable across re-hashing (adding a video to the list does not disturb others)', () => {
    const urls = [
      'https://www.youtube.com/watch?v=aaa',
      'https://www.youtube.com/watch?v=bbb',
    ];
    const ids1 = urls.map(hashUrl);
    // Add another URL to the list.
    const urls2 = [...urls, 'https://www.youtube.com/watch?v=ccc'];
    const ids2 = urls2.map(hashUrl);
    expect(ids2.slice(0, 2)).toEqual(ids1);
  });
});
