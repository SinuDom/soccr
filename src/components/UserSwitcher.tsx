import { useState } from 'react';
import { motion } from 'framer-motion';
import type { User } from '@/lib/domain/types';
import { useProgressStore } from '@/store/progressStore';
import { Modal } from './Modal';
import { Button } from './Button';
import { Icon } from './Icon';

interface Props {
  users: User[];
}

/**
 * Pill button showing the active user's name; click to swap. Placed on Home.
 * Each user's progress (streak, points, seen-videos, history) is completely
 * separate — switching does not commingle any state.
 */
export function UserSwitcher({ users }: Props) {
  const activeUserId = useProgressStore((s) => s.activeUserId);
  const switchUser = useProgressStore((s) => s.switchUser);
  const vault = useProgressStore((s) => s.vault);
  const [open, setOpen] = useState(false);
  const active = users.find((u) => u.id === activeUserId);

  return (
    <>
      <button
        className="flex items-center gap-2 rounded-full bg-ink-700 hover:bg-ink-600 border border-ink-600 px-3 py-1.5 text-sm transition-colors active:scale-[0.98]"
        onClick={() => setOpen(true)}
        aria-label="Switch user"
      >
        <Avatar name={active?.name ?? '?'} />
        <span className="font-semibold">{active?.name ?? 'Pick a user'}</span>
        <Icon name="chevron-down" size={16} className="text-white/50" />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Who's practicing?">
        <ul className="space-y-2">
          {users.map((u) => {
            const isActive = u.id === activeUserId;
            const p = vault.users[u.id];
            return (
              <li key={u.id}>
                <button
                  onClick={() => { switchUser(u.id); setOpen(false); }}
                  className={[
                    'w-full flex items-center gap-3 rounded-2xl border p-3 transition-colors',
                    isActive
                      ? 'bg-pitch-500/15 border-pitch-500/50'
                      : 'bg-ink-700 hover:bg-ink-600 border-ink-600',
                  ].join(' ')}
                >
                  <Avatar name={u.name} large />
                  <div className="flex-1 text-left">
                    <div className="font-bold">{u.name}</div>
                    <div className="text-white/60 text-xs">
                      {u.videos.length} videos · streak {p?.currentStreak ?? 0} · {p?.points ?? 0} pts
                    </div>
                  </div>
                  {isActive && <Icon name="check" size={18} className="text-pitch-400" />}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 flex justify-end">
          <Button variant="ghost" onClick={() => setOpen(false)}>Close</Button>
        </div>
      </Modal>
    </>
  );
}

function Avatar({ name, large }: { name: string; large?: boolean }) {
  const initial = (name.trim()[0] ?? '?').toUpperCase();
  const size = large ? 'w-10 h-10 text-lg' : 'w-6 h-6 text-xs';
  return (
    <motion.div
      layout
      className={`grid place-items-center rounded-full bg-pitch-500 text-ink-950 font-black ${size}`}
      aria-hidden
    >
      {initial}
    </motion.div>
  );
}
