import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from './Button';

/**
 * "Extra time" action that is locked until the daily goal has been reached.
 * While locked, pressing it flashes a "Locked" label with a lock icon and a
 * short shake instead of starting an extra-time session.
 */
export function ExtraTimeButton({
  locked,
  disabled,
  onStart,
}: {
  locked: boolean;
  disabled?: boolean;
  onStart: () => void;
}) {
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(false), 1600);
    return () => clearTimeout(t);
  }, [flash]);

  // Unlocking (finishing the daily goal) clears any lingering locked flash.
  useEffect(() => {
    if (!locked) setFlash(false);
  }, [locked]);

  const handleClick = () => {
    if (locked) {
      setFlash(true);
      return;
    }
    onStart();
  };

  const showLocked = locked && flash;

  return (
    <motion.div
      className="w-full"
      animate={showLocked ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Button
        variant="secondary"
        size="lg"
        fullWidth
        icon={locked ? 'lock' : 'plus'}
        onClick={handleClick}
        disabled={disabled}
        aria-disabled={locked}
        title={locked ? 'Reach your daily goal to unlock extra time' : undefined}
        className={locked ? 'opacity-70' : ''}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={showLocked ? 'locked' : 'extra'}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            {showLocked ? 'Locked' : 'Extra time'}
          </motion.span>
        </AnimatePresence>
      </Button>
    </motion.div>
  );
}
