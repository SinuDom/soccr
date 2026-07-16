import type { Settings, User } from '@/lib/domain/types';

export interface RawContentEntry {
  url: string;
  title?: string;
  description?: string;
  /**
   * Individual titles for each drill timer/set. The nth string labels the nth
   * timer, and the array length determines how many drill timers are shown.
   */
  timerTitles?: string[];
  /** How long to perform one drill, in seconds. */
  timer?: number;
}

export interface RawContentSettings {
  /** Default daily target for categories without their own targetMinutes. */
  defaultCategoryTargetMinutes: number;
  pointsPerExtraMinute: number;
  freezeCostPoints: number;
  maxFreezesHeld: number;
  recycleWhenLibraryExhausted: boolean;
}

export interface RawContentCategory {
  /** Stable id; defaults to a slug of the name. */
  id?: string;
  name: string;
  /** Daily practice target in minutes; defaults to settings.defaultCategoryTargetMinutes. */
  targetMinutes?: number;
  videos: RawContentEntry[];
}

export interface RawContentUser {
  name: string;
  /** Videos grouped into categories, each with its own daily target. */
  categories?: RawContentCategory[];
  /** Legacy flat list — becomes a single implicit category. */
  videos?: RawContentEntry[];
}

export interface RawContentFile {
  settings: RawContentSettings;
  users?: RawContentUser[];
  /** Legacy top-level list (single-user); still accepted. */
  videos?: RawContentEntry[];
}

export interface Content {
  settings: Settings;
  users: User[];
}

export type ContentError =
  | { kind: 'network'; message: string }
  | { kind: 'parse'; message: string }
  | { kind: 'schema'; message: string };

export type ContentResult =
  | { ok: true; content: Content }
  | { ok: false; error: ContentError };
