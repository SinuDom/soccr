import { create } from 'zustand';
import type { Content, ContentError } from '@/lib/content/types';
import type { User } from '@/lib/domain/types';
import { fetchContent } from '@/lib/content/fetchContent';

type Status = 'idle' | 'loading' | 'ready' | 'error';

interface ContentState {
  status: Status;
  content: Content | null;
  error: ContentError | null;
  load: () => Promise<void>;
  refetch: () => Promise<void>;
}

async function doLoad(set: (partial: Partial<ContentState>) => void) {
  set({ status: 'loading', error: null });
  const r = await fetchContent();
  if (r.ok) set({ status: 'ready', content: r.content, error: null });
  else set({ status: 'error', content: null, error: r.error });
}

export const useContentStore = create<ContentState>((set) => ({
  status: 'idle',
  content: null,
  error: null,
  load: () => doLoad(set),
  refetch: () => doLoad(set),
}));

/** Look up a user by id in the current content, or return null. */
export function getUser(content: Content | null, userId: string): User | null {
  if (!content) return null;
  return content.users.find((u) => u.id === userId) ?? null;
}
