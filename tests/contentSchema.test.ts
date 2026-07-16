import { describe, expect, it } from 'vitest';
import { validateContent } from '@/lib/content/schema';

const SETTINGS = {
  defaultCategoryTargetMinutes: 15,
  pointsPerExtraMinute: 9,
  freezeCostPoints: 100,
  maxFreezesHeld: 1,
  recycleWhenLibraryExhausted: true,
};

const vid = (n: string) => ({ url: `https://www.youtube.com/watch?v=${n}`, title: n });

describe('validateContent — categories', () => {
  it('parses per-user category blocks with per-category targets', () => {
    const r = validateContent({
      settings: SETTINGS,
      users: [{
        name: 'Leon',
        categories: [
          { id: 'ball', name: 'Ball control', targetMinutes: 10, videos: [vid('a'), vid('b')] },
          { name: 'Speed', videos: [vid('c')] }, // id + target defaulted
        ],
      }],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const u = r.content.users[0]!;
    expect(u.categories.map((c) => c.id)).toEqual(['ball', 'speed']);
    expect(u.categories[0]!.targetMinutes).toBe(10);
    expect(u.categories[0]!.videos).toHaveLength(2);
    // Missing targetMinutes falls back to settings.defaultCategoryTargetMinutes.
    expect(u.categories[1]!.name).toBe('Speed');
    expect(u.categories[1]!.targetMinutes).toBe(15);
  });

  it('legacy flat user videos become one implicit category with the default target', () => {
    const r = validateContent({
      settings: SETTINGS,
      users: [{ name: 'Anya', videos: [vid('a'), vid('b')] }],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const u = r.content.users[0]!;
    expect(u.categories).toHaveLength(1);
    expect(u.categories[0]!.id).toBe('practice');
    expect(u.categories[0]!.targetMinutes).toBe(15);
    expect(u.categories[0]!.videos).toHaveLength(2);
  });

  it('legacy top-level videos become the implicit "Everyone" user with one category', () => {
    const r = validateContent({ settings: SETTINGS, videos: [vid('a')] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.content.users[0]!.id).toBe('everyone');
    expect(r.content.users[0]!.categories[0]!.id).toBe('practice');
  });

  it('rejects a user with neither categories nor videos', () => {
    const r = validateContent({ settings: SETTINGS, users: [{ name: 'X' }] });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.message).toMatch(/categories/);
  });

  it('rejects empty categories arrays', () => {
    const r = validateContent({ settings: SETTINGS, users: [{ name: 'X', categories: [] }] });
    expect(r.ok).toBe(false);
  });

  it('rejects duplicate category ids within a user', () => {
    const r = validateContent({
      settings: SETTINGS,
      users: [{
        name: 'X',
        categories: [
          { name: 'Ball', videos: [vid('a')] },
          { id: 'ball', name: 'Ball again', videos: [vid('b')] },
        ],
      }],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.message).toMatch(/Duplicate category id "ball"/);
  });

  it('rejects the same video URL appearing in two categories of one user', () => {
    const r = validateContent({
      settings: SETTINGS,
      users: [{
        name: 'X',
        categories: [
          { name: 'Ball', videos: [vid('a')] },
          { name: 'Speed', videos: [vid('a')] },
        ],
      }],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.message).toMatch(/Duplicate video URL/);
  });

  it('allows the same video URL for two different users', () => {
    const r = validateContent({
      settings: SETTINGS,
      users: [
        { name: 'A', categories: [{ name: 'Ball', videos: [vid('a')] }] },
        { name: 'B', categories: [{ name: 'Ball', videos: [vid('a')] }] },
      ],
    });
    expect(r.ok).toBe(true);
  });

  it('rejects the removed legacy sessionTargetMinutes name', () => {
    const { defaultCategoryTargetMinutes: _renamed, ...rest } = SETTINGS;
    const r = validateContent({
      settings: { ...rest, sessionTargetMinutes: 20 },
      users: [{ name: 'X', categories: [{ name: 'Ball', videos: [vid('a')] }] }],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.message).toMatch(/defaultCategoryTargetMinutes/);
  });

  it('rejects settings without defaultCategoryTargetMinutes', () => {
    const { defaultCategoryTargetMinutes: _renamed, ...rest } = SETTINGS;
    const r = validateContent({
      settings: rest,
      users: [{ name: 'X', categories: [{ name: 'Ball', videos: [vid('a')] }] }],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.message).toMatch(/defaultCategoryTargetMinutes/);
  });

  it('rejects non-positive or fractional targetMinutes', () => {
    for (const target of [0, -5, 2.5]) {
      const r = validateContent({
        settings: SETTINGS,
        users: [{ name: 'X', categories: [{ name: 'Ball', targetMinutes: target, videos: [vid('a')] }] }],
      });
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.message).toMatch(/targetMinutes/);
    }
  });
});
