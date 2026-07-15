import { Link, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useProgressStore } from '@/store/progressStore';
import { useContentStore, getUser } from '@/store/contentStore';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { StreakFlame } from '@/components/StreakFlame';
import { UserSwitcher } from '@/components/UserSwitcher';
import { BottomDock } from '@/components/BottomDock';
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
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-pitch-600 text-white shadow-glow">
            <Icon name="play" size={22} />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">Soccr</h1>
            <p className="text-slate-500 text-sm">Watch. Drill. Keep the streak.</p>
          </div>
        </div>
        <Link
          to="/settings"
          aria-label="Settings"
          className="grid place-items-center h-11 w-11 rounded-2xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
        >
          <Icon name="settings" size={22} />
        </Link>
      </motion.header>

      {content && content.users.length > 0 && (
        <div className="mb-4">
          <UserSwitcher users={content.users} />
        </div>
      )}

      {(freezeConsumedNotice || streakResetNotice) && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={[
            'mb-4 rounded-2xl px-4 py-3 border text-sm',
            freezeConsumedNotice
              ? 'bg-ice-500/10 border-ice-500/40 text-ice-600'
              : 'bg-red-500/10 border-red-500/40 text-red-600',
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
        className="rounded-4xl bg-white border border-slate-200 shadow-card p-6 mb-5"
      >
        <div className="flex items-center justify-between">
          <StreakFlame streak={progress.currentStreak} large />
          <div className="text-right">
            <div className="text-xs uppercase tracking-widest text-slate-400">Points</div>
            <div className="text-3xl font-black tabular text-slate-900">{progress.points}</div>
            <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-ice-600">
              <Icon name="snowflake" size={14} /> {progress.freezesHeld}
            </div>
          </div>
        </div>
        <div
          className={[
            'mt-5 flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-medium',
            doneToday ? 'bg-pitch-500/10 text-pitch-600' : 'bg-slate-100 text-slate-500',
          ].join(' ')}
        >
          <Icon name={doneToday ? 'check' : 'circle'} size={18} />
          {doneToday ? 'Daily goal completed today' : 'Daily goal not done yet'}
        </div>
      </motion.section>

      {/* Desktop / landscape actions. On phones the bottom dock takes over. */}
      <div className="hidden lg:grid grid-cols-1 gap-3">
        <Button variant="primary" size="xl" fullWidth icon="play" onClick={() => nav('/session/daily')} disabled={libSize === 0}>
          Start daily session
        </Button>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" size="lg" icon="plus" onClick={() => nav('/session/extra')} disabled={libSize === 0}>
            Extra time
          </Button>
          <Button variant="secondary" size="lg" icon="list" onClick={() => nav('/library')}>
            Library
          </Button>
        </div>
        <Button variant="ghost" size="lg" fullWidth icon="bag" onClick={() => nav('/shop')}>
          Shop
        </Button>
      </div>

      {libSize === 0 && (
        <div className="mt-6 rounded-2xl p-4 bg-amber-500/10 border border-amber-500/30 text-amber-800 text-sm">
          {activeUser
            ? <>No videos for {activeUser.name} yet. Add some under <code className="mx-1 rounded bg-slate-100 px-1">users</code> in <code className="rounded bg-slate-100 px-1">public/content.json</code> on GitHub.</>
            : <>Your library is empty. Edit <code className="mx-1 rounded bg-slate-100 px-1">public/content.json</code> on GitHub, then redeploy.</>}
        </div>
      )}

      <footer className="mt-auto pt-8 text-center text-slate-400 text-xs">
        {activeUser
          ? `${libSize} videos for ${activeUser.name} · cycle ${progress.cycleNumber}`
          : 'Loading library…'}
      </footer>

      <BottomDock disabled={libSize === 0} />
    </div>
  );
}
