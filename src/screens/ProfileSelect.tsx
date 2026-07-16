import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { User } from '@/lib/domain/types';
import { avatarIconUrl } from '@/lib/domain/avatars';
import { useContentStore } from '@/store/contentStore';
import { useProgressStore } from '@/store/progressStore';
import { Icon } from '@/components/Icon';
import { IconPickerModal } from '@/components/IconPickerModal';

/**
 * Netflix / Prime-Video style profile selection. It's the app's start screen:
 * a grid of large rounded avatars with just the user's name underneath. No
 * extra chrome or copy — picking a profile switches the active user and heads
 * to Home. A pencil badge on each avatar opens a picker to swap the profile
 * icon for one from the avatar collection.
 */
export function ProfileSelect() {
  const nav = useNavigate();
  const content = useContentStore((s) => s.content);
  const activeUserId = useProgressStore((s) => s.activeUserId);
  const switchUser = useProgressStore((s) => s.switchUser);
  const vault = useProgressStore((s) => s.vault);
  const setAvatarIcon = useProgressStore((s) => s.setAvatarIcon);
  const users = content?.users ?? [];
  const [editingUser, setEditingUser] = useState<User | null>(null);

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
            iconId={vault.users[u.id]?.avatarIcon}
            onClick={() => pick(u)}
            onEdit={() => setEditingUser(u)}
          />
        ))}
      </div>

      <IconPickerModal
        open={editingUser !== null}
        onClose={() => setEditingUser(null)}
        userName={editingUser?.name ?? ''}
        currentIcon={editingUser ? vault.users[editingUser.id]?.avatarIcon : undefined}
        onSelect={(icon) => {
          if (editingUser) setAvatarIcon(editingUser.id, icon);
        }}
      />
    </div>
  );
}

function ProfileTile({
  user,
  active,
  delay,
  iconId,
  onClick,
  onEdit,
}: {
  user: User;
  active: boolean;
  delay: number;
  iconId?: string;
  onClick: () => void;
  onEdit: () => void;
}) {
  const initial = (user.name.trim()[0] ?? '?').toUpperCase();
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, type: 'spring', stiffness: 240, damping: 22 }}
      className="flex flex-col items-center gap-3"
    >
      <div className="relative">
        <motion.button
          type="button"
          onClick={onClick}
          aria-label={user.name}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.96 }}
          className={[
            'group grid place-items-center overflow-hidden rounded-full font-black text-ink-950',
            'h-28 w-28 sm:h-36 sm:w-36 text-5xl sm:text-6xl',
            'bg-pitch-500 transition-shadow duration-150',
            'ring-4 ring-transparent hover:ring-pitch-400 focus-visible:outline-none focus-visible:ring-pitch-400',
            active ? 'ring-pitch-400 shadow-glow' : '',
          ].join(' ')}
        >
          {iconId ? (
            <img
              src={avatarIconUrl(iconId)}
              alt=""
              className="h-full w-full object-cover"
              draggable={false}
            />
          ) : (
            initial
          )}
        </motion.button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          aria-label={`Change ${user.name}'s icon`}
          className="absolute -right-1 -top-1 grid h-9 w-9 place-items-center rounded-full border border-ink-600 bg-ink-800 text-white/80 shadow-md transition-colors hover:border-pitch-400 hover:text-pitch-400 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pitch-400"
        >
          <Icon name="edit" size={16} />
        </button>
      </div>
      <span className="text-base font-semibold sm:text-lg">{user.name}</span>
    </motion.div>
  );
}
