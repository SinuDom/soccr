import type { ContentResult } from './types';
import { validateContent } from './schema';

/**
 * Fetch /content.json with a cache-busting query. The service worker uses
 * NetworkFirst for this path, so hand-edits show up after redeploy without
 * being pinned by the SW. On offline, the SW's cache handles fallback — we
 * just receive whatever the network layer returns.
 */
export async function fetchContent(): Promise<ContentResult> {
  let res: Response;
  try {
    res = await fetch(`/content.json?t=${Date.now()}`, { cache: 'no-store' });
  } catch (e) {
    return { ok: false, error: { kind: 'network', message: (e as Error).message } };
  }
  if (!res.ok) {
    return { ok: false, error: { kind: 'network', message: `HTTP ${res.status}` } };
  }
  let text: string;
  try {
    text = await res.text();
  } catch (e) {
    return { ok: false, error: { kind: 'network', message: (e as Error).message } };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: { kind: 'parse', message: (e as Error).message } };
  }
  const v = validateContent(parsed);
  if (!v.ok) return { ok: false, error: { kind: 'schema', message: v.message } };
  return { ok: true, content: v.content };
}
