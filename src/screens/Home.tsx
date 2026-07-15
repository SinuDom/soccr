import { Link, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useProgressStore } from '@/store/progressStore';
import { useContentStore } from '@/store/contentStore';
import { Button } from '@/components/Button';
import { StreakFlame } from '@/components/StreakFlame';
import { toLocalDateString } from '@/lib/domain/streak';

export function Home() {
  const nav = useNavigate();
  const { progress, freezeConsumedNotice, streakResetNotice, dismissNotices } = useProgressStore();
  const content = useContentStore((s) => s.content);
  const today = toLocalDateString(new Date());
  const doneToday = progress.lastCompletedDate === today;
  const libSize = content?.videos.length ?? 0;

  useEffect(() => {
    // Auto-dismiss notices after the user has seen the Home screen for 6s.
    if (freezeConsumedNotice || streakResetNotice) {
      const t = setTimeout(dismissNotices, 6000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [freezeConsumedNotice, streakResetNotice, dismissNotices]);

  return (
    <div className="min-h-dvh flex flex-col p-5 pt-8 max-w-xl mx-auto w-full">
      <motion.header
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        className="flex items-center justify-between mb-8"
      >
        <div>
          <h1 className="text-3xl font-black tracking-tight">Soccr</h1>
          <p className="text-white/60 text-sm">Watch. Drill. Keep the streak.</p>
        </div>
        <Link to="/settings" className="text-white/70 hover:text-white text-2xl" aria-label="Settings">⚙︎</Link>
      </motion.header>

      {(freezeConsumedNotice || streakResetNotice) && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={[
            'mb-4 rounded-2xl px-4 py-3 border text-sm',
            freezeConsumedNotice
              ? 'bg-ice-500/10 border-ice-500/40 text-ice-400'
              : 'bg-red-500/10 border-red-500/40 text-red-300',
          ].join(' ')}
        >
          {freezeConsumedNotice
            ? '❄︎ A freeze saved your streak. Back to it today!'
            : 'Your streak reset. Fresh start today.'}
        </motion.div>
      )}

      <motion.section
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.05, type: 'spring', stiffness: 200, damping: 22 }}
        className="rounded-3xl bg-ink-800 border border-ink-700 p-6 mb-6"
      >
        <div className="flex items-center justify-between">
          <StreakFlame streak={progress.currentStreak} large />
          <div className="text-right">
            <div className="text-xs uppercase tracking-widest text-white/60">Points</div>
            <div className="text-3xl font-black tabular">{progress.points}</div>
            <div className="mt-2 text-xs uppercase tracking-widest text-white/60">
              ❄︎ Freeze: {progress.freezesHeld}
            </div>
          </div>
        </div>
        <div className="mt-4">
          <span className={doneToday ? 'text-pitch-400' : 'text-white/70'}>
            {doneToday ? '✓ Daily goal completed today' : '○ Daily goal not done yet'}
          </span>
        </div>
      </motion.section>

      <div className="grid grid-cols-1 gap-3">
        <Button variant="primary" size="xl" fullWidth onClick={() => nav('/session/daily')} disabled={libSize === 0}>
          Start Daily Session
        </Button>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" size="lg" onClick={() => nav('/session/extra')} disabled={libSize === 0}>
            Extra Time
          </Button>
          <Button variant="secondary" size="lg" onClick={() => nav('/library')}>
            Library
          </Button>
        </div>
        <Button variant="ghost" size="lg" fullWidth onClick={() => nav('/shop')}>
          Shop — buy a freeze
        </Button>
      </div>

      {libSize === 0 && (
        <div className="mt-6 rounded-2xl p-4 bg-amber-500/10 border border-amber-500/30 text-amber-100 text-sm">
          Your library is empty. Add YouTube / Instagram / TikTok links to
          <code className="mx-1 rounded bg-black/30 px-1">public/content.json</code>
          on GitHub, then redeploy.
        </div>
      )}

      <footer className="mt-auto pt-8 text-center text-white/40 text-xs">
        {content ? `${libSize} videos in library · cycle ${progress.cycleNumber}` : 'Loading library…'}
      </footer>
    </div>
  );
}
