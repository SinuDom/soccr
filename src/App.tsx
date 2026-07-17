import { useEffect, useRef } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useContentStore } from '@/store/contentStore';
import { useProgressStore } from '@/store/progressStore';
import { Home } from '@/screens/Home';
import { ProfileSelect } from '@/screens/ProfileSelect';
import { SessionScreen } from '@/screens/Session';
import { SessionComplete } from '@/screens/SessionComplete';
import { Library } from '@/screens/Library';
import { Shop } from '@/screens/Shop';
import { Settings } from '@/screens/Settings';
import { StreakCalendar } from '@/screens/StreakCalendar';
import { ErrorScreen } from '@/screens/ErrorScreen';

export function App() {
  return (
    <BrowserRouter>
      <Boot />
      <VersionBadge />
    </BrowserRouter>
  );
}

function VersionBadge() {
  return (
    <span
      className="fixed bottom-2 left-2 z-50 select-none text-[10px] leading-none text-white/30 pointer-events-none"
      aria-label={`App version ${__APP_VERSION__}`}
    >
      v{__APP_VERSION__}
    </span>
  );
}

function Boot() {
  const status = useContentStore((s) => s.status);
  const content = useContentStore((s) => s.content);
  const error = useContentStore((s) => s.error);
  const load = useContentStore((s) => s.load);
  const hydrateProgress = useProgressStore((s) => s.hydrate);
  const reconcile = useProgressStore((s) => s.reconcileWithContent);
  const reconciled = useRef(false);

  useEffect(() => { hydrateProgress(); }, [hydrateProgress]);
  useEffect(() => { void load(); }, [load]);

  // Once content arrives, reconcile the vault with the user list exactly once.
  useEffect(() => {
    if (content && !reconciled.current) {
      reconciled.current = true;
      reconcile(content.users);
    }
  }, [content, reconcile]);

  if (status === 'idle' || status === 'loading') {
    return <div className="min-h-dvh grid place-items-center text-white/60">Loading…</div>;
  }
  if (status === 'error' && error) {
    return <ErrorScreen error={error} onRetry={() => void load()} />;
  }
  return <AppRoutes />;
}

function AppRoutes() {
  const location = useLocation();
  const reduced = useReducedMotion();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={reduced ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduced ? undefined : { opacity: 0, y: -8 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      >
        <Routes location={location}>
          <Route path="/" element={<ProfileSelect />} />
          <Route path="/home" element={<Home />} />
          <Route path="/session/:mode" element={<SessionScreen />} />
          <Route path="/session/complete" element={<SessionComplete />} />
          <Route path="/library" element={<Library />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/streak" element={<StreakCalendar />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}
