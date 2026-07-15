import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useContentStore, getUser } from '@/store/contentStore';
import { useProgressStore } from '@/store/progressStore';
import type { VideoRef, SessionMode, HistoryEntry } from '@/lib/domain/types';
import { markSeen as markSeenPure, pickNextVideo } from '@/lib/domain/selection';
import {
  endEarly,
  pressNext,
  setDrillRunning,
  startSession,
  stopExtra,
  tickDaily,
  totalPracticeMs,
  videoIdsWatched,
  type Session,
} from '@/lib/domain/session';
import { toLocalDateString } from '@/lib/domain/streak';
import { elapsedNow, startClock } from '@/lib/domain/practiceClock';
import { PracticeClock } from '@/components/PracticeClock';
import { ProgressRing } from '@/components/ProgressRing';
import { DrillTimers } from '@/components/DrillTimer';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { VideoPlayer } from '@/components/VideoPlayer';

/** Deep-linked URL param — 'daily' or 'extra'. Manual (Mode C) uses ?video=. */
type Params = { mode: 'daily' | 'extra' };

export function SessionScreen() {
  const nav = useNavigate();
  const params = useParams<Params>();
  const mode: SessionMode = params.mode === 'daily' ? 'daily' : 'extra';
  const manualId = useMemo(() => new URLSearchParams(window.location.search).get('video') ?? null, []);
  const effectiveMode: SessionMode = manualId ? 'manual' : mode;

  const content = useContentStore((s) => s.content);
  const activeUserId = useProgressStore((s) => s.activeUserId);
  const progress = useProgressStore((s) => s.progress);
  const markSeenAction = useProgressStore((s) => s.markSeen);
  const advanceCycle = useProgressStore((s) => s.advanceCycle);
  const creditDaily = useProgressStore((s) => s.creditDaily);
  const bankExtraTime = useProgressStore((s) => s.bankExtraTime);

  const activeUser = getUser(content, activeUserId);
  const libraryVideos = activeUser?.videos ?? [];

  const [session, setSession] = useState<Session | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const startedAtRef = useRef<number>(0);
  const initedRef = useRef(false);

  const targetMs = mode === 'daily' && content ? content.settings.sessionTargetMinutes * 60_000 : null;

  // Bootstrap: pick the first video from the ACTIVE USER's library.
  useEffect(() => {
    if (!content || !activeUser || initedRef.current) return;
    initedRef.current = true;
    let firstId: string | null = null;
    if (manualId && libraryVideos.some((v) => v.id === manualId)) {
      firstId = manualId;
    } else {
      const libIds = libraryVideos.map((v) => v.id);
      const r = pickNextVideo({
        libraryIds: libIds,
        seenIds: progress.seenVideoIds,
        cycleNumber: progress.cycleNumber,
      });
      if (r.cycleAdvanced) advanceCycle(r.nextSeenIds, r.nextCycleNumber);
      firstId = r.videoId;
    }
    if (!firstId) return;
    const now = Date.now();
    startedAtRef.current = now;
    setSession(startSession({ mode: effectiveMode, firstVideoId: firstId, targetMs, now }));
  }, [content, activeUser, manualId, targetMs, progress.seenVideoIds, progress.cycleNumber, advanceCycle, effectiveMode, libraryVideos]);

  useEffect(() => {
    if (!session || session.phase !== 'practicing' || session.mode !== 'daily') return;
    let raf = 0;
    const loop = () => {
      setSession((s) => (s ? tickDaily(s, Date.now()) : s));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [session?.phase, session?.mode]);

  useEffect(() => {
    if (!session || session.phase !== 'done') return;
    if (session.discarded) {
      nav('/', { replace: true });
      return;
    }
    finalizeSession(session);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.phase]);

  const finalizeSession = useCallback((s: Session) => {
    if (!content) return;
    const now = Date.now();
    const practiceMs = totalPracticeMs(s, now);
    const videoIds = videoIdsWatched(s);
    for (const id of videoIds) markSeenAction(id);

    if (s.mode === 'daily' && s.autoEnded) {
      const today = toLocalDateString(new Date());
      const entry: Omit<HistoryEntry, 'completedDaily'> = {
        date: today,
        startedAt: startedAtRef.current,
        mode: 'daily',
        practiceMs,
        pointsEarned: 0,
        videoIds,
      };
      creditDaily(today, entry);
      nav(`/session/complete?mode=daily&ms=${practiceMs}`, { replace: true });
    } else {
      const entry: Omit<HistoryEntry, 'pointsEarned'> = {
        date: toLocalDateString(new Date()),
        startedAt: startedAtRef.current,
        mode: s.mode,
        practiceMs,
        videoIds,
      };
      const earned = bankExtraTime(content.settings, entry);
      nav(`/session/complete?mode=${s.mode}&ms=${practiceMs}&pts=${earned}`, { replace: true });
    }
  }, [content, creditDaily, bankExtraTime, markSeenAction, nav]);

  // The session clock is driven by the per-drill timers: it only runs while at
  // least one drill timer is counting down.
  const handleDrillRunningChange = useCallback((running: boolean) => {
    setSession((s) => (s ? setDrillRunning(s, running, Date.now()) : s));
  }, []);

  const handleLoadError = useCallback(() => { setLoadFailed(true); }, []);

  const handleSkip = useCallback(() => {
    if (!content || !session) return;
    const libIds = libraryVideos.map((v) => v.id);
    const r = pickNextVideo({
      libraryIds: libIds,
      seenIds: progress.seenVideoIds,
      cycleNumber: progress.cycleNumber,
    });
    if (r.cycleAdvanced) advanceCycle(r.nextSeenIds, r.nextCycleNumber);
    if (!r.videoId) return;
    setLoadFailed(false);
    setSession((s) => (s ? { ...s, activeVideoId: r.videoId!, phase: 'practicing' } : s));
  }, [content, session, libraryVideos, progress.seenVideoIds, progress.cycleNumber, advanceCycle]);

  const handleNext = useCallback(() => {
    if (!content || !session) return;
    setLoadFailed(false);
    markSeenAction(session.activeVideoId);
    const libIds = libraryVideos.map((v) => v.id);
    const r = pickNextVideo({
      libraryIds: libIds,
      seenIds: markSeenPure(progress.seenVideoIds, session.activeVideoId),
      cycleNumber: progress.cycleNumber,
    });
    if (r.cycleAdvanced) advanceCycle(r.nextSeenIds, r.nextCycleNumber);
    if (!r.videoId) return;
    setSession((s) => (s ? pressNext(s, r.videoId!, Date.now()).session : s));
  }, [content, session, libraryVideos, progress.seenVideoIds, progress.cycleNumber, advanceCycle, markSeenAction]);

  // Videos without a configured drill timer have nothing to drive the clock, so
  // fall back to auto-running it once the video finishes (previous behaviour).
  useEffect(() => {
    if (!session || session.phase !== 'practicing') return;
    const v = libraryVideos.find((x) => x.id === session.activeVideoId);
    if (v && !v.timer) {
      setSession((s) =>
        s && s.phase === 'practicing' && s.clock.status !== 'running'
          ? { ...s, clock: startClock(s.clock, Date.now()) }
          : s,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.phase, session?.activeVideoId]);

  const handleStop = useCallback(() => {
    if (!session) return;
    setSession((s) => (s ? stopExtra(s, Date.now()) : s));
  }, [session]);

  const handleEndEarly = useCallback(() => {
    setConfirmEnd(false);
    setSession((s) => (s ? endEarly(s) : s));
  }, []);

  if (!content) return null;
  if (!activeUser) {
    return (
      <div className="min-h-dvh grid place-items-center p-6 text-center">
        <div>
          <p className="mb-4">No user selected. Head home and pick one.</p>
          <Button onClick={() => nav('/', { replace: true })}>Home</Button>
        </div>
      </div>
    );
  }
  if (!session) {
    return <div className="min-h-dvh grid place-items-center text-white/70">Loading…</div>;
  }

  const activeVideo = libraryVideos.find((v) => v.id === session.activeVideoId) as VideoRef | undefined;
  if (!activeVideo) {
    return (
      <div className="min-h-dvh grid place-items-center p-6 text-center">
        <div>
          <p className="mb-4">That video isn’t in {activeUser.name}’s library anymore.</p>
          <Button onClick={() => nav('/', { replace: true })}>Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col p-4 sm:p-6 max-w-2xl lg:max-w-5xl mx-auto w-full">
      <SessionHeader
        session={session}
        targetMs={targetMs}
        userName={activeUser.name}
        onQuit={() => setConfirmEnd(true)}
      />

      <div className="mt-4">
        {session.phase === 'practicing' ? (
          <PracticeArea
            session={session}
            targetMs={targetMs}
            onNext={handleNext}
            onStop={handleStop}
            onSkip={handleSkip}
            onDrillRunningChange={handleDrillRunningChange}
            onLoadError={handleLoadError}
            loadFailed={loadFailed}
            mode={effectiveMode}
            activeVideo={activeVideo}
          />
        ) : null}
      </div>

      <Modal
        open={confirmEnd}
        onClose={() => setConfirmEnd(false)}
        title="End this session?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmEnd(false)}>Keep going</Button>
            <Button variant="danger" onClick={handleEndEarly}>End — discard progress</Button>
          </>
        }
      >
        {session.mode === 'daily'
          ? 'Ending early cancels this session — no streak credit, no points, this practice time won’t count.'
          : 'Ending early discards the current round. Use “Stop” instead if you want your practice time to bank into points.'}
      </Modal>
    </div>
  );
}

function SessionHeader({
  session, targetMs, userName, onQuit,
}: { session: Session; targetMs: number | null; userName: string; onQuit: () => void }) {
  const modeLabel = session.mode === 'daily'
    ? `Daily · ${(targetMs ?? 0) / 60_000} min`
    : session.mode === 'extra' ? 'Extra time' : 'Manual pick';
  return (
    <header className="flex items-center justify-between gap-3">
      <Button
        variant="ghost"
        size="sm"
        iconOnly
        icon="close"
        onClick={onQuit}
        className="text-white/70"
      >
        End session
      </Button>
      <div className="flex-1 text-center">
        <div className="text-sm font-semibold leading-tight">{userName}</div>
        <div className="text-[11px] uppercase tracking-widest text-white/45">{modeLabel}</div>
      </div>
      <div className="min-w-[3.5rem] text-right">
        <div className="text-lg font-black tabular leading-none">{session.rounds.length}</div>
        <div className="text-[10px] uppercase tracking-widest text-white/45">done</div>
      </div>
    </header>
  );
}

function PracticeArea({
  session,
  targetMs,
  onNext,
  onStop,
  onSkip,
  onDrillRunningChange,
  onLoadError,
  loadFailed,
  mode,
  activeVideo,
}: {
  session: Session;
  targetMs: number | null;
  onNext: () => void;
  onStop: () => void;
  onSkip: () => void;
  onDrillRunningChange: (running: boolean) => void;
  onLoadError: () => void;
  loadFailed: boolean;
  mode: SessionMode;
  activeVideo: VideoRef;
}) {
  const [, force] = useState(0);
  useEffect(() => {
    let raf = 0;
    const loop = () => { force((n) => (n + 1) & 0xffff); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const now = Date.now();
  const total = totalPracticeMs(session, now);
  const roundElapsed = elapsedNow(session.clock, now);
  const ringProgress = targetMs ? Math.min(1, total / targetMs) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 220, damping: 24 }}
      className="mt-4 grid gap-6 lg:grid-cols-2 lg:items-start lg:gap-10"
    >
      {/* LEFT COLUMN — the looping clip and what you're drilling. */}
      <div className="flex flex-col gap-4">
        {loadFailed ? (
          <div className="w-full rounded-2xl bg-red-500/10 border border-red-500/40 p-6 text-center">
            <p className="text-red-200 mb-4">This video didn’t load.</p>
            <Button variant="secondary" icon="skip" onClick={onSkip}>Skip to another</Button>
          </div>
        ) : (
          <VideoPlayer
            key={activeVideo.id}
            video={activeVideo}
            onLoadError={onLoadError}
            loop
          />
        )}

        <div className="text-center lg:text-left px-1">
          <div className="text-white/45 text-[11px] uppercase tracking-widest">Now drilling</div>
          <div className="font-bold text-white text-lg lg:text-xl leading-snug">{activeVideo.title}</div>
          {activeVideo.description && (
            <p className="text-white/60 text-sm mt-1 leading-relaxed">{activeVideo.description}</p>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN — the primary drill timer(s), plus a glanceable session
          indicator and the flow controls. */}
      <div className="flex flex-col items-center gap-6">
        {/* Secondary, glanceable session indicator — no numbers to focus on. */}
        {targetMs ? (
          <div className="flex items-center gap-2 text-white/40">
            <ProgressRing progress={ringProgress} size={40} stroke={5} color="#8b93a1" trackColor="#2a3444" />
            <span className="text-[10px] uppercase tracking-widest">session</span>
          </div>
        ) : (
          <div className="opacity-70 scale-75">
            <PracticeClock
              elapsedMs={roundElapsed + session.rounds.reduce((a, r) => a + r.practiceMs, 0)}
              running
              compact
            />
          </div>
        )}

        {/* Primary focus: the per-drill countdown timer(s). */}
        <DrillTimers
          seconds={activeVideo.timer}
          repetition={activeVideo.repetition}
          titles={activeVideo.timerTitles}
          onRunningChange={onDrillRunningChange}
        />

        <div className="w-full max-w-sm space-y-3 pt-2">
          <Button variant="primary" size="xl" fullWidth iconRight="arrow-right" onClick={onNext}>
            Next video
          </Button>
          {mode !== 'daily' && (
            <Button variant="ice" size="lg" fullWidth icon="stop" onClick={onStop}>
              Stop · bank {formatMin(total)}
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function formatMin(ms: number): string {
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${m}m ${String(s).padStart(2, '0')}s`;
}
