import { motion, useReducedMotion } from 'framer-motion';

interface Props {
  streak: number;
  large?: boolean;
}

export function StreakFlame({ streak, large }: Props) {
  const reduced = useReducedMotion();
  const size = large ? 96 : 40;
  const numClass = large ? 'text-6xl font-black' : 'text-2xl font-bold';

  return (
    <div className="flex items-center gap-3">
      <motion.div
        initial={false}
        animate={reduced ? undefined : { scale: [1, 1.15, 1] }}
        transition={{ duration: 1.6, repeat: streak > 0 ? Infinity : 0, ease: 'easeInOut' }}
        aria-hidden
      >
        <FlameIcon size={size} lit={streak > 0} />
      </motion.div>
      <div className="flex items-baseline gap-2">
        <span className={`tabular ${numClass}`}>{streak}</span>
        <span className="text-white/60 uppercase tracking-widest text-xs">day{streak === 1 ? '' : 's'}</span>
      </div>
    </div>
  );
}

function FlameIcon({ size, lit }: { size: number; lit: boolean }) {
  const primary = lit ? '#ff8a1f' : '#4a5364';
  const secondary = lit ? '#ffb84d' : '#6b7280';
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <path
        d="M24 3 C 27 12, 38 15, 38 27 C 38 36, 32 43, 24 43 C 16 43, 10 36, 10 28 C 10 22, 14 20, 16 16 C 18 21, 20 22, 21 22 C 22 19, 20 14, 24 3 Z"
        fill={primary}
      />
      <path
        d="M24 15 C 26 20, 32 22, 32 29 C 32 34, 28.5 38, 24 38 C 19 38, 15.5 33.5, 15.5 29 C 15.5 25, 19 24, 20 21 C 21 24, 22 25, 22.7 24.5 C 23 22, 22.5 20, 24 15 Z"
        fill={secondary}
      />
    </svg>
  );
}
