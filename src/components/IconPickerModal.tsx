import { Modal } from '@/components/Modal';
import { AVATAR_ICONS, avatarIconUrl } from '@/lib/domain/avatars';

interface Props {
  open: boolean;
  onClose: () => void;
  userName: string;
  currentIcon?: string;
  onSelect: (icon: string | null) => void;
}

/** Minimalistic grid for picking (or clearing) a user's profile icon. */
export function IconPickerModal({ open, onClose, userName, currentIcon, onSelect }: Props) {
  const choose = (icon: string | null) => {
    onSelect(icon);
    onClose();
  };
  const initial = (userName.trim()[0] ?? '?').toUpperCase();

  return (
    <Modal open={open} onClose={onClose} title={`Choose an icon for ${userName}`}>
      <div className="grid grid-cols-4 sm:grid-cols-5 gap-3 max-h-[55vh] overflow-y-auto pr-1 -mr-1">
        <button
          type="button"
          onClick={() => choose(null)}
          aria-label="Use initial letter"
          aria-pressed={!currentIcon}
          className={[
            'grid aspect-square place-items-center rounded-2xl bg-ink-700 text-xl font-black text-white/70',
            'ring-2 transition-shadow',
            !currentIcon ? 'ring-pitch-400' : 'ring-transparent hover:ring-pitch-400/60',
          ].join(' ')}
        >
          {initial}
        </button>
        {AVATAR_ICONS.map((icon) => (
          <button
            key={icon.id}
            type="button"
            onClick={() => choose(icon.id)}
            aria-label={icon.label}
            aria-pressed={currentIcon === icon.id}
            className={[
              'grid aspect-square place-items-center rounded-2xl bg-ink-700 p-2',
              'ring-2 transition-shadow',
              currentIcon === icon.id ? 'ring-pitch-400' : 'ring-transparent hover:ring-pitch-400/60',
            ].join(' ')}
          >
            <img
              src={avatarIconUrl(icon.id)}
              alt={icon.label}
              className="h-full w-full object-contain"
              draggable={false}
            />
          </button>
        ))}
      </div>
    </Modal>
  );
}
