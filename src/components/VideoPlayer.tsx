import { useEffect, useMemo, useRef, useState } from 'react';
import type { VideoRef } from '@/lib/domain/types';
import { extractInstagramCode, extractTikTokId, extractYouTubeId } from '@/lib/content/url';
import { Button } from './Button';

interface Props {
  video: VideoRef;
  /** Fired when playback ends (YouTube: auto; others: user presses "Done watching"). */
  onEnded?: () => void;
  /** Fired when the embed clearly cannot load — parent shows a Skip UI. */
  onLoadError: () => void;
  /** When true, the clip loops continuously (used while drilling). */
  loop?: boolean;
}

/** Dispatch by platform. All embeds are official; we never scrape or re-host. */
export function VideoPlayer({ video, onEnded, onLoadError, loop }: Props) {
  switch (video.platform) {
    case 'youtube':  return <YouTubePlayer video={video} onEnded={onEnded} onLoadError={onLoadError} loop={loop} />;
    case 'instagram': return <IframeEmbedPlayer video={video} src={instagramEmbedUrl(video.url)} onEnded={onEnded} onLoadError={onLoadError} loop={loop} />;
    case 'tiktok':    return <IframeEmbedPlayer video={video} src={tiktokEmbedUrl(video.url)} onEnded={onEnded} onLoadError={onLoadError} loop={loop} />;
    default:          return <IframeEmbedPlayer video={video} src={video.url} onEnded={onEnded} onLoadError={onLoadError} loop={loop} />;
  }
}

// ---------- YouTube (IFrame Player API) ----------

// Declare the global YT namespace loaded by the IFrame API.
declare global {
  interface Window {
    YT?: {
      Player: new (el: HTMLElement | string, cfg: any) => any;
      PlayerState: { ENDED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytApiPromise: Promise<void> | null = null;
function loadYouTubeApi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise<void>((resolve) => {
    const prior = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prior?.(); resolve(); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    document.head.appendChild(s);
  });
  return ytApiPromise;
}

function YouTubePlayer({ video, onEnded, onLoadError, loop }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const videoId = useMemo(() => extractYouTubeId(video.url), [video.url]);

  useEffect(() => {
    if (!videoId) { onLoadError(); return; }
    let cancelled = false;
    const watchdog = setTimeout(() => { if (!cancelled && !playerRef.current) onLoadError(); }, 8000);

    loadYouTubeApi().then(() => {
      if (cancelled || !containerRef.current || !window.YT) return;
      // `loop: 1` requires `playlist` to be the same id for a single video.
      const loopVars = loop ? { loop: 1, playlist: videoId, autoplay: 1 } : {};
      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1, controls: 1, ...loopVars },
        events: {
          onReady: () => { clearTimeout(watchdog); },
          onStateChange: (e: any) => {
            if (window.YT && e.data === window.YT.PlayerState.ENDED) onEnded?.();
          },
          onError: () => onLoadError(),
        },
      });
    });

    return () => {
      cancelled = true;
      clearTimeout(watchdog);
      try { playerRef.current?.destroy?.(); } catch { /* ignore */ }
      playerRef.current = null;
    };
    // videoId is the only thing that matters for player identity; onEnded /
    // onLoadError are stable enough (parent memoizes where needed).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="aspect-video rounded-2xl overflow-hidden bg-black shadow-lg">
        <div ref={containerRef} className="w-full h-full" />
      </div>
    </div>
  );
}

// ---------- Instagram / TikTok / other (iframe + "Done watching") ----------

function IframeEmbedPlayer({ video, src, onEnded, onLoadError, loop }: Props & { src: string | null }) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    if (!src) { onLoadError(); return; }
    const t = setTimeout(() => { if (!loaded) onLoadError(); }, 8000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  if (!src) return null;
  const isPortraitLikely = video.platform === 'instagram' || video.platform === 'tiktok';

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center gap-4">
      <div
        className={[
          'w-full rounded-2xl overflow-hidden bg-black shadow-lg',
          isPortraitLikely ? 'aspect-[9/16]' : 'aspect-video',
        ].join(' ')}
      >
        {!errored ? (
          <iframe
            src={src}
            title={video.title}
            className="w-full h-full"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={() => setLoaded(true)}
            onError={() => { setErrored(true); onLoadError(); }}
          />
        ) : (
          <div className="w-full h-full grid place-items-center text-slate-500">Couldn’t load embed.</div>
        )}
      </div>
      {!loop && onEnded && (
        <>
          <p className="text-sm text-slate-500 text-center px-4">
            This platform doesn’t report when a clip finishes. Watch it, then tap:
          </p>
          <Button variant="ice" size="lg" fullWidth onClick={onEnded}>
            Done watching → start practice
          </Button>
        </>
      )}
    </div>
  );
}

function instagramEmbedUrl(url: string): string | null {
  const code = extractInstagramCode(url);
  if (!code) return null;
  return `https://www.instagram.com/p/${code}/embed/`;
}
function tiktokEmbedUrl(url: string): string | null {
  const id = extractTikTokId(url);
  if (!id) return null;
  return `https://www.tiktok.com/embed/v2/${id}`;
}
