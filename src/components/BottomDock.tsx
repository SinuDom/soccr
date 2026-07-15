import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Icon, type IconName } from './Icon';
import { useProgressStore } from '@/store/progressStore';
import { toLocalDateString } from '@/lib/domain/streak';

/**
 * App-style bottom navigation, shown on phones / vertically-held devices
 * (hidden from `lg` up, where the in-page buttons take over). Four flanking
 * icon tabs surround a raised central "Start" button that kicks off the daily
 * session. `disabled` reflects an empty library (nothing to practise).
 *
 * `extraLocked` can force the lock; when omitted it is derived from whether the
 * daily goal has been completed today (extra time is only unlocked afterwards).
 */
export function BottomDock({ disabled = false, extraLocked }: { disabled?: boolean; extraLocked?: boolean }) {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const progress = useProgressStore((s) => s.progress);
  const doneToday = progress.lastCompletedDate === toLocalDateString(new Date());
  const locked = extraLocked ?? !doneToday;

  return (
    <nav
      className="lg:hidden fixed inset-x-0 bottom-safe z-40 px-4 pointer-events-none"
      aria-label="Primary"
    >
      <div className="pointer-events-auto mx-auto flex max-w-md items-end justify-between rounded-3xl border border-ink-700 bg-ink-900/95 px-3 py-2 shadow-dock backdrop-blur">
        <Tab icon="home" label="Home" active={pathname === '/home'} onClick={() => nav('/home')} />
        <Tab icon="list" label="Library" active={pathname === '/library'} onClick={() => nav('/library')} />

        <StartButton
          disabled={disabled}
          onClick={() => nav('/session/daily')}
        />

        <ExtraTab
          disabled={disabled}
          locked={locked}
          onStart={() => nav('/session/extra')}
        />
        <Tab icon="bag" label="Shop" active={pathname === '/shop'} onClick={() => nav('/shop')} />
      </div>
    </nav>
  );
}

/**
 * The "Extra time" tab. Locked until the daily goal is done; pressing it while
 * locked flashes a "Locked" label with a lock icon and a short shake.
 */
function ExtraTab({ disabled, locked, onStart }: { disabled?: boolean; locked: boolean; onStart: () => void }) {
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(false), 1600);
    return () => clearTimeout(t);
  }, [flash]);

  useEffect(() => {
    if (!locked) setFlash(false);
  }, [locked]);

  const handleClick = () => {
    if (locked) { setFlash(true); return; }
    onStart();
  };

  return (
    <motion.button
      type="button"
      aria-label={locked ? 'Extra time locked' : 'Extra time'}
      disabled={disabled}
      onClick={handleClick}
      animate={flash ? { x: [0, -4, 4, -3, 3, 0] } : { x: 0 }}
      transition={{ duration: 0.4 }}
      className={[
        'flex w-16 flex-col items-center gap-1 rounded-2xl py-1.5',
        'transition-colors duration-150 active:scale-95 motion-reduce:transform-none',
        'disabled:opacity-40',
        flash ? 'text-red-300' : locked ? 'text-white/40 hover:text-white/60' : 'text-white/50 hover:text-white',
      ].join(' ')}
    >
      <Icon name={locked ? 'lock' : 'plus'} size={22} />
      <span className="text-[10px] font-semibold leading-none">{flash ? 'Locked' : 'Extra time'}</span>
    </motion.button>
  );
}

function Tab({
  icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: IconName;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      disabled={disabled}
      onClick={onClick}
      className={[
        'flex w-16 flex-col items-center gap-1 rounded-2xl py-1.5',
        'transition-colors duration-150 active:scale-95 motion-reduce:transform-none',
        'disabled:opacity-40',
        active ? 'text-pitch-400' : 'text-white/50 hover:text-white',
      ].join(' ')}
    >
      <Icon name={icon} size={22} />
      <span className="text-[10px] font-semibold leading-none">{label}</span>
    </button>
  );
}

function StartButton({ disabled, onClick }: { disabled?: boolean; onClick: () => void }) {
  return (
    <div className="relative -mt-8 flex w-16 flex-col items-center">
      <motion.button
        type="button"
        aria-label="Start daily session"
        disabled={disabled}
        onClick={onClick}
        whileTap={{ scale: 0.92 }}
        className={[
          'grid h-16 w-16 place-items-center rounded-full text-ink-950',
          'bg-pitch-500 shadow-raised ring-4 ring-ink-950',
          'transition-colors duration-150 hover:bg-pitch-400',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pitch-400',
        ].join(' ')}
      >
        <Icon name="play" size={28} />
      </motion.button>
      <span className="mt-1 text-[10px] font-bold uppercase tracking-wide text-pitch-400">Start</span>
    </div>
  );
}
