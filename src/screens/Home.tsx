import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useProgressStore } from '@/store/progressStore';
import { useContentStore, getUser } from '@/store/contentStore';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Modal } from '@/components/Modal';
import { StreakFlame } from '@/components/StreakFlame';
import { BottomDock } from '@/components/BottomDock';
import { toLocalDateString } from '@/lib/domain/streak';
import { allVideos, dailyGoalProgress, extraMsToday, practiceableCategories } from '@/lib/domain/categories';

export function Home() {
  const nav = useNavigate();
  const { progress, activeUserId, freezeConsumedNotice, streakResetNotice, dismissNotices, markDayDone } =
    useProgressStore();
  const content = useContentStore((s) => s.content);
  const [confirmOutside, setConfirmOutside] = useState(false);
  const today = toLocalDateString(new Date());
  const doneToday = progress.lastCompletedDate === today;
  const activeUser = getUser(content, activeUserId);
  const libSize = activeUser ? allVideos(activeUser).length : 0;
  const categories = activeUser ? practiceableCategories(activeUser) : [];

  // Overall daily-goal progress: every category's credited drill time today,
  // weighted by its target, folded into ONE bar. Once the goal is completed
  // it reads as full.
  const dailyProgress = doneToday ? 1 : dailyGoalProgress(progress.drillDay, today, categories);
  const dailyPct = Math.round(dailyProgress * 100);
  // Practice beyond the goals: extra sessions + goal-session overshoot today.
  const extraMs = extraMsToday(progress.drillDay, today);

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
          <Link
            to="/streak"
            aria-label="Open streak calendar"
            className="group -m-2 rounded-2xl p-2 transition-colors hover:bg-ink-700/50"
          >
            <StreakFlame streak={progress.currentStreak} large />
            <span className="mt-1 inline-flex items-center gap-1 text-[11px] uppercase tracking-widest text-white/40 group-hover:text-white/70">
              <Icon name="calendar" size={13} /> Calendar
            </span>
          </Link>
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
        {extraMs > 0 && (
          <div className="mt-2 flex items-center gap-2 text-ice-400">
            <Icon name="plus" size={18} />
            <span>{formatExtra(extraMs)} extra time today</span>
          </div>
        )}
        {!doneToday && libSize > 0 && (
          <button
            type="button"
            onClick={() => setConfirmOutside(true)}
            className="mt-4 inline-flex items-center gap-2 text-sm text-white/60 underline decoration-white/30 underline-offset-4 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pitch-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-800 rounded"
          >
            <Icon name="check" size={16} />
            Trained outside the app? Mark today done
          </button>
        )}
      </motion.section>

      {/* Phones: the Start button lives in the bottom dock, so surface the daily
          practice progress as a separate bar here. */}
      <div className="lg:hidden mb-6">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] uppercase tracking-widest text-white/50">Daily practice</span>
          <span className="text-[11px] uppercase tracking-widest text-white/50 tabular">{dailyPct}%</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full border border-ink-700 bg-ink-800">
          <motion.div
            className="h-full rounded-full bg-pitch-500"
            initial={false}
            animate={{ width: `${dailyPct}%` }}
            transition={{ type: 'tween', ease: 'easeOut', duration: 0.4 }}
          />
        </div>
      </div>

      {/* Desktop / landscape actions. On phones the bottom dock takes over. */}
      <div className="hidden lg:grid grid-cols-1 gap-3">
        <StartDailyButton progress={dailyProgress} disabled={libSize === 0} onClick={() => nav('/session/daily')} />
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" size="lg" icon="list" onClick={() => nav('/library')}>
            Library
          </Button>
          <Button variant="ghost" size="lg" icon="bag" onClick={() => nav('/shop')}>
            Shop
          </Button>
        </div>
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
          ? `${libSize} videos in ${categories.length} categor${categories.length === 1 ? 'y' : 'ies'} for ${activeUser.name} · cycle ${progress.cycleNumber}`
          : 'Loading library…'}
      </footer>

      <BottomDock disabled={libSize === 0} />

      <Modal
        open={confirmOutside}
        onClose={() => setConfirmOutside(false)}
        title="Trained outside the app?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOutside(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              icon="check"
              onClick={() => {
                markDayDone(today, today, categories);
                setConfirmOutside(false);
              }}
            >
              Mark today done
            </Button>
          </>
        }
      >
        <p>
          This marks today's daily goal as complete and keeps your streak going — use it when you practiced elsewhere,
          like club training.
        </p>
      </Modal>
    </div>
  );
}

/** "12m 30s" (or "45s" under a minute) for the extra-time tally. */
function formatExtra(ms: number): string {
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return m > 0 ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`;
}

/**
 * The primary "Start daily session" button with the day's practice progress
 * rendered as a fill inside it (a subtle bar that grows toward the goal). Once
 * the goal is complete it reads full and relabels.
 */
function StartDailyButton({
  progress,
  disabled,
  onClick,
}: {
  progress: number;
  disabled?: boolean;
  onClick: () => void;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  const complete = progress >= 1;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={complete ? 'Start extra practice — daily goal complete' : `Start daily session — ${pct}% of today's goal done`}
      className={[
        'relative h-16 w-full overflow-hidden rounded-2xl text-xl font-semibold text-ink-950 select-none',
        'bg-pitch-600 shadow-glow',
        'transition-[transform] duration-150 ease-out active:scale-[0.97] motion-reduce:transform-none',
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pitch-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950',
      ].join(' ')}
    >
      {/* Practice-progress fill. */}
      <motion.span
        aria-hidden
        className="absolute inset-y-0 left-0 bg-pitch-400"
        initial={false}
        animate={{ width: `${pct}%` }}
        transition={{ type: 'tween', ease: 'easeOut', duration: 0.4 }}
      />
      <span className="relative z-10 flex items-center justify-center gap-3">
        <Icon name="play" size={22} />
        {complete ? 'Extra practice' : 'Start daily session'}
        <span className="tabular text-base font-bold opacity-80">{pct}%</span>
      </span>
    </button>
  );
}
