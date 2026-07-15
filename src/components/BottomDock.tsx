import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Icon, type IconName } from './Icon';

/**
 * App-style bottom navigation, shown on phones / vertically-held devices
 * (hidden from `lg` up, where the in-page buttons take over). Four flanking
 * icon tabs surround a raised central "Start" button that kicks off the daily
 * session. `disabled` reflects an empty library (nothing to practise).
 */
export function BottomDock({ disabled = false }: { disabled?: boolean }) {
  const nav = useNavigate();
  const { pathname } = useLocation();

  return (
    <nav
      className="lg:hidden fixed inset-x-0 bottom-safe z-40 px-4 pointer-events-none"
      aria-label="Primary"
    >
      <div className="pointer-events-auto mx-auto flex max-w-md items-end justify-between rounded-3xl border border-slate-200 bg-white/95 px-3 py-2 shadow-dock backdrop-blur">
        <Tab icon="home" label="Home" active={pathname === '/'} onClick={() => nav('/')} />
        <Tab icon="list" label="Library" active={pathname === '/library'} onClick={() => nav('/library')} />

        <StartButton
          disabled={disabled}
          onClick={() => nav('/session/daily')}
        />

        <Tab
          icon="plus"
          label="Extra time"
          disabled={disabled}
          onClick={() => nav('/session/extra')}
        />
        <Tab icon="bag" label="Shop" active={pathname === '/shop'} onClick={() => nav('/shop')} />
      </div>
    </nav>
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
        active ? 'text-pitch-600' : 'text-slate-500 hover:text-slate-800',
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
          'grid h-16 w-16 place-items-center rounded-full text-white',
          'bg-pitch-600 shadow-raised ring-4 ring-white',
          'transition-colors duration-150 hover:bg-pitch-500',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pitch-400',
        ].join(' ')}
      >
        <Icon name="play" size={28} />
      </motion.button>
      <span className="mt-1 text-[10px] font-bold uppercase tracking-wide text-pitch-600">Start</span>
    </div>
  );
}
