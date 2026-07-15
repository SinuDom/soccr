import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { User } from '@/lib/domain/types';
import { useContentStore } from '@/store/contentStore';
import { useProgressStore } from '@/store/progressStore';

/**
 * Netflix / Prime-Video style profile selection. It's the app's start screen:
 * a grid of large rounded avatars with just the user's name underneath. No
 * extra chrome or copy — picking a profile switches the active user and heads
 * to Home.
 */
export function ProfileSelect() {
  const nav = useNavigate();
  const content = useContentStore((s) => s.content);
  const activeUserId = useProgressStore((s) => s.activeUserId);
  const switchUser = useProgressStore((s) => s.switchUser);
  const users = content?.users ?? [];

  const pick = (u: User) => {
    switchUser(u.id);
    nav('/home');
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-6">
      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 240, damping: 24 }}
        className="mb-10 text-center text-2xl font-black tracking-tight sm:text-3xl"
      >
        Who's practicing?
      </motion.h1>

      <div className="flex flex-wrap items-start justify-center gap-6 sm:gap-10">
        {users.map((u, i) => (
          <ProfileTile
            key={u.id}
            user={u}
            active={u.id === activeUserId}
            delay={i * 0.06}
            onClick={() => pick(u)}
          />
        ))}
      </div>
    </div>
  );
}

function ProfileTile({
  user,
  active,
  delay,
  onClick,
}: {
  user: User;
  active: boolean;
  delay: number;
  onClick: () => void;
}) {
  const initial = (user.name.trim()[0] ?? '?').toUpperCase();
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={user.name}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, type: 'spring', stiffness: 240, damping: 22 }}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.96 }}
      className="group flex flex-col items-center gap-3 focus-visible:outline-none"
    >
      <span
        className={[
          'grid place-items-center rounded-full font-black text-ink-950',
          'h-28 w-28 sm:h-36 sm:w-36 text-5xl sm:text-6xl',
          'bg-pitch-500 transition-shadow duration-150',
          'ring-4 ring-transparent group-hover:ring-pitch-400 group-focus-visible:ring-pitch-400',
          active ? 'ring-pitch-400 shadow-glow' : '',
        ].join(' ')}
      >
        {initial}
      </span>
      <span className="text-base font-semibold sm:text-lg">{user.name}</span>
    </motion.button>
  );
}
