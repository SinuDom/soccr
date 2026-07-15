import type { Settings, User } from '@/lib/domain/types';

export interface RawContentEntry {
  url: string;
  title?: string;
  description?: string;
  /** How long to perform one drill, in seconds. */
  timer?: number;
  /** How many identical drill timers to run, shown next to each other. */
  repetition?: number;
}

export interface RawContentUser {
  name: string;
  videos: RawContentEntry[];
}

export interface RawContentFile {
  settings: Settings;
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
