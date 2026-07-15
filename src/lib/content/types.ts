import type { Settings, VideoRef } from '@/lib/domain/types';

export interface RawContentEntry {
  url: string;
  title?: string;
}

export interface RawContentFile {
  settings: Settings;
  videos: RawContentEntry[];
}

export interface Content {
  settings: Settings;
  videos: VideoRef[];
}

export type ContentError =
  | { kind: 'network'; message: string }
  | { kind: 'parse'; message: string }
  | { kind: 'schema'; message: string };

export type ContentResult =
  | { ok: true; content: Content }
  | { ok: false; error: ContentError };
