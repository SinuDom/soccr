import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
  footer?: ReactNode;
}

export function Modal({ open, onClose, title, children, footer }: Props) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="backdrop"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            key="panel"
            className="w-full sm:max-w-md bg-ink-800 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl border border-ink-700"
            initial={{ y: 40, opacity: 0.5 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <h2 className="text-xl font-bold mb-3">{title}</h2>
            <div className="text-white/90">{children}</div>
            {footer ? <div className="mt-6 flex gap-3 justify-end flex-wrap">{footer}</div> : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
