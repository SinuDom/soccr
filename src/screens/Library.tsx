import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useContentStore, getUser } from '@/store/contentStore';
import { useProgressStore } from '@/store/progressStore';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';

export function Library() {
  const nav = useNavigate();
  const content = useContentStore((s) => s.content);
  const activeUserId = useProgressStore((s) => s.activeUserId);
  const seen = useProgressStore((s) => s.progress.seenVideoIds);
  const seenSet = new Set(seen);

  if (!content) return null;
  const activeUser = getUser(content, activeUserId);
  const videos = activeUser?.videos ?? [];

  return (
    <div className="min-h-dvh max-w-2xl lg:max-w-4xl mx-auto p-5 pt-8 w-full flex flex-col">
      <header className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            aria-label="Back home"
            className="grid place-items-center h-10 w-10 rounded-2xl text-white/70 hover:text-white hover:bg-ink-800 transition-colors"
          >
            <Icon name="arrow-left" size={20} />
          </Link>
          <h1 className="text-2xl font-black tracking-tight">
            {activeUser ? `${activeUser.name}'s library` : 'Library'}
          </h1>
        </div>
        <div className="text-xs text-white/50">{videos.length} videos</div>
      </header>

      <p className="text-white/60 text-sm mb-4">
        Read-only. Add or remove videos by editing this user's block under
        <code className="mx-1 rounded bg-black/30 px-1">users</code> in
        <code className="mx-1 rounded bg-black/30 px-1">public/content.json</code>
        on GitHub, then redeploy.
      </p>

      {videos.length === 0 ? (
        <div className="rounded-2xl p-6 bg-ink-800 border border-ink-700 text-white/70 text-center">
          No videos for {activeUser?.name ?? 'this user'} yet.
        </div>
      ) : (
        <ul className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-2 lg:space-y-0">
          {videos.map((v, i) => {
            const isSeen = seenSet.has(v.id);
            return (
              <motion.li
                key={v.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.4) }}
                className="rounded-2xl bg-ink-800 border border-ink-700 p-4 flex items-center gap-3"
              >
                <PlatformBadge platform={v.platform} />
                <div className="flex-1 min-w-0">
                  <div className="truncate font-semibold">{v.title}</div>
                  {v.description && (
                    <div className="text-xs text-white/60 line-clamp-2 mt-0.5">{v.description}</div>
                  )}
                  <a href={v.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-white/40 max-w-full hover:text-white/70 hover:underline mt-0.5">
                    <Icon name="external" size={12} /> <span className="truncate">{v.url}</span>
                  </a>
                </div>
                {isSeen ? (
                  <span className="inline-flex items-center gap-1 text-xs text-pitch-400"><Icon name="check" size={13} /> seen</span>
                ) : (
                  <span className="text-[10px] uppercase tracking-widest font-bold text-flame-400">new</span>
                )}
                <Button
                  size="md"
                  iconOnly
                  icon="play"
                  onClick={() => nav(`/session/extra?video=${encodeURIComponent(v.id)}`)}
                >
                  Play {v.title}
                </Button>
              </motion.li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function PlatformBadge({ platform }: { platform: string }) {
  const map: Record<string, string> = {
    youtube: 'bg-red-500/20 text-red-300',
    instagram: 'bg-fuchsia-500/20 text-fuchsia-300',
    tiktok: 'bg-white/10 text-white',
    other: 'bg-white/10 text-white',
  };
  const short = platform === 'youtube' ? 'YT'
    : platform === 'instagram' ? 'IG'
    : platform === 'tiktok' ? 'TT' : '•';
  return (
    <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-md ${map[platform] ?? map.other}`}>
      {short}
    </span>
  );
}
