import { Link, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useProgressStore } from '@/store/progressStore';
import { useContentStore, getUser } from '@/store/contentStore';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { StreakFlame } from '@/components/StreakFlame';
import { BottomDock } from '@/components/BottomDock';
import { ExtraTimeButton } from '@/components/ExtraTimeButton';
import { toLocalDateString } from '@/lib/domain/streak';

export function Home() {
  const nav = useNavigate();
  const { progress, activeUserId, freezeConsumedNotice, streakResetNotice, dismissNotices } = useProgressStore();
  const content = useContentStore((s) => s.content);
  const today = toLocalDateString(new Date());
  const doneToday = progress.lastCompletedDate === today;
  const activeUser = getUser(content, activeUserId);
  const libSize = activeUser?.videos.length ?? 0;

  useEffect(() => {
    if (freezeConsumedNotice || streakResetNotice) {
      const t = setTimeout(dismissNotices, 6000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [freezeConsumedNotice, streakResetNotice, dismissNotices]);

  return (
    <div className="min-h-dvh flex flex-col p-5 pt-8 pb-28 sm:pt-12 lg:pb-10 max-w-xl lg:max-w-2xl mx-auto w-full">
      <motion.header
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        className="flex items-center justify-between mb-6"
      >
        <div>
          <h1 className="text-3xl font-black tracking-tight">Soccr</h1>
          <p className="text-white/60 text-sm">Watch. Drill. Keep the streak.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/"
            aria-label="Switch profile"
            className="grid place-items-center h-11 w-11 rounded-2xl text-white/70 hover:text-white hover:bg-ink-800 transition-colors"
          >
            <Icon name="user" size={22} />
          </Link>
          <Link
            to="/settings"
            aria-label="Settings"
            className="grid place-items-center h-11 w-11 rounded-2xl text-white/70 hover:text-white hover:bg-ink-800 transition-colors"
          >
            <Icon name="settings" size={22} />
          </Link>
        </div>
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
          <span className="inline-flex items-center gap-2">
            {freezeConsumedNotice && <Icon name="snowflake" size={16} />}
            {freezeConsumedNotice
              ? 'A freeze saved your streak. Back to it today!'
              : 'Your streak reset. Fresh start today.'}
          </span>
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
            <div className="mt-2 inline-flex items-center gap-1.5 text-xs uppercase tracking-widest text-ice-400">
              <Icon name="snowflake" size={14} /> {progress.freezesHeld}
            </div>
          </div>
        </div>
        <div className="mt-4 inline-flex items-center gap-2">
          <span className={doneToday ? 'text-pitch-400' : 'text-white/40'}>
            <Icon name={doneToday ? 'check' : 'circle'} size={18} />
          </span>
          <span className={doneToday ? 'text-pitch-400' : 'text-white/70'}>
            {doneToday ? 'Daily goal completed today' : 'Daily goal not done yet'}
          </span>
        </div>
      </motion.section>

      {/* Desktop / landscape actions. On phones the bottom dock takes over. */}
      <div className="hidden lg:grid grid-cols-1 gap-3">
        <Button variant="primary" size="xl" fullWidth icon="play" onClick={() => nav('/session/daily')} disabled={libSize === 0}>
          Start daily session
        </Button>
        <div className="grid grid-cols-2 gap-3">
          <ExtraTimeButton
            locked={!doneToday}
            disabled={libSize === 0}
            onStart={() => nav('/session/extra')}
          />
          <Button variant="secondary" size="lg" icon="list" onClick={() => nav('/library')}>
            Library
          </Button>
        </div>
        <Button variant="ghost" size="lg" fullWidth icon="bag" onClick={() => nav('/shop')}>
          Shop
        </Button>
      </div>

      {libSize === 0 && (
        <div className="mt-6 rounded-2xl p-4 bg-amber-500/10 border border-amber-500/30 text-amber-100 text-sm">
          {activeUser
            ? <>No videos for {activeUser.name} yet. Add some under <code className="mx-1 rounded bg-black/30 px-1">users</code> in <code className="rounded bg-black/30 px-1">public/content.json</code> on GitHub.</>
            : <>Your library is empty. Edit <code className="mx-1 rounded bg-black/30 px-1">public/content.json</code> on GitHub, then redeploy.</>}
        </div>
      )}

      <footer className="mt-auto pt-8 text-center text-white/40 text-xs">
        {activeUser
          ? `${libSize} videos for ${activeUser.name} · cycle ${progress.cycleNumber}`
          : 'Loading library…'}
      </footer>

      <BottomDock disabled={libSize === 0} extraLocked={!doneToday} />
    </div>
  );
}
