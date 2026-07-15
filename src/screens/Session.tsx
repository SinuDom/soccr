import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useContentStore, getUser } from '@/store/contentStore';
import { useProgressStore } from '@/store/progressStore';
import type { VideoRef, SessionMode, HistoryEntry } from '@/lib/domain/types';
import { markSeen as markSeenPure, pickNextVideo } from '@/lib/domain/selection';
import {
  endEarly,
  pressNext,
  setActiveMs,
  startSession,
  stopExtra,
  tickDaily,
  totalPracticeMs,
  videoIdsWatched,
  type Session,
} from '@/lib/domain/session';
import { toLocalDateString } from '@/lib/domain/streak';
import { PracticeClock } from '@/components/PracticeClock';
import { DrillTimers } from '@/components/DrillTimer';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { VideoPlayer } from '@/components/VideoPlayer';
import { isYouTubeShort } from '@/lib/content/url';

/** Deep-linked URL param — 'daily' or 'extra'. Manual (Mode C) uses ?video=. */
type Params = { mode: 'daily' | 'extra' };

export function SessionScreen() {
  const nav = useNavigate();
  const params = useParams<Params>();
  const mode: SessionMode = params.mode === 'daily' ? 'daily' : 'extra';
  const manualId = useMemo(() => new URLSearchParams(window.location.search).get('video') ?? null, []);
  // Library "play" links pass ?lib=1: just play the video, no drill timers.
  const libraryMode = useMemo(() => new URLSearchParams(window.location.search).get('lib') === '1', []);
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
  const [confirmNext, setConfirmNext] = useState(false);
  const [drillsAllDone, setDrillsAllDone] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
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

  // Play the start-of-session intro once, then reveal the practice screen.
  useEffect(() => {
    if (!session) return;
    const t = setTimeout(() => setShowIntro(false), 1100);
    return () => clearTimeout(t);
  }, [session === null]);


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

  // The session time is driven by the per-drill timers: as they count down (and
  // when they complete) they report their summed contribution, which we record
  // as the active video's practice time. In daily mode reaching the target then
  // auto-ends the session. This makes the progress bar update live, credits the
  // sum of all timers, and lets a reset subtract time again.
  const handleDrillElapsed = useCallback((ms: number) => {
    setSession((s) => {
      if (!s) return s;
      const ns = setActiveMs(s, ms);
      return ns.mode === 'daily' ? tickDaily(ns) : ns;
    });
  }, []);

  const handleAllDoneChange = useCallback((allDone: boolean) => {
    setDrillsAllDone(allDone);
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

  const proceedNext = useCallback(() => {
    if (!content || !session) return;
    setConfirmNext(false);
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
    setSession((s) => (s ? pressNext(s, r.videoId!).session : s));
  }, [content, session, libraryVideos, progress.seenVideoIds, progress.cycleNumber, advanceCycle, markSeenAction]);

  // If the active video has drill timers and the user hasn't finished all of
  // them at least once, confirm before moving on; otherwise proceed directly.
  const handleNext = useCallback(() => {
    if (!session) return;
    const v = libraryVideos.find((x) => x.id === session.activeVideoId);
    if (!libraryMode && v?.timer && !drillsAllDone) {
      setConfirmNext(true);
      return;
    }
    proceedNext();
  }, [session, libraryVideos, drillsAllDone, proceedNext, libraryMode]);

  // Reset the "all drills done" flag whenever we move to a new video.
  useEffect(() => {
    setDrillsAllDone(false);
  }, [session?.activeVideoId]);

  // Videos without a configured drill timer have nothing to drive the session
  // time, so fall back to a wall clock that runs for as long as the video is
  // the active drill (matching the previous auto-run behaviour).
  useEffect(() => {
    if (!session || session.phase !== 'practicing') return;
    const v = libraryVideos.find((x) => x.id === session.activeVideoId);
    // Library mode is "just play the video": it never tracks practice time, so
    // the wall clock stays off entirely. Otherwise it only drives the session
    // for videos that have no drill timer to report their own contribution.
    if (!v || v.timer || libraryMode) return;
    const start = Date.now();
    let raf = 0;
    const loop = () => {
      handleDrillElapsed(Date.now() - start);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.phase, session?.activeVideoId]);

  const handleStop = useCallback(() => {
    if (!session) return;
    setSession((s) => (s ? stopExtra(s) : s));
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

  const sessionProgress = targetMs ? Math.min(1, totalPracticeMs(session, Date.now()) / targetMs) : null;
  const startLabel = mode === 'daily' ? 'Daily practice' : effectiveMode === 'manual' ? 'Manual pick' : 'Extra time';

  return (
    <div className="h-dvh overflow-hidden lg:h-auto lg:min-h-dvh lg:overflow-visible flex flex-col p-3 sm:p-6 max-w-2xl lg:max-w-5xl mx-auto w-full">
      <SessionHeader
        session={session}
        targetMs={targetMs}
        sessionProgress={sessionProgress}
        userName={activeUser.name}
        onQuit={() => setConfirmEnd(true)}
      />

      <div className="mt-3 flex-1 min-h-0 flex flex-col overflow-hidden lg:mt-4 lg:block lg:overflow-visible">
        <AnimatePresence mode="wait" initial={false}>
          {session.phase === 'practicing' ? (
            <PracticeArea
              key={session.activeVideoId}
              session={session}
              targetMs={targetMs}
              onNext={handleNext}
              onStop={handleStop}
              onSkip={handleSkip}
              onDrillElapsedChange={handleDrillElapsed}
              onDrillAllDoneChange={handleAllDoneChange}
              onLoadError={handleLoadError}
              loadFailed={loadFailed}
              mode={effectiveMode}
              activeVideo={activeVideo}
              libraryMode={libraryMode}
            />
          ) : null}
        </AnimatePresence>
      </div>

      {/* One-shot start-of-session intro: a clean panel that wipes away. */}
      <AnimatePresence>
        {showIntro && (
          <motion.div
            key="intro"
            className="fixed inset-0 z-50 grid place-items-center bg-ink-950"
            initial={{ opacity: 1 }}
            exit={{ y: '-100%' }}
            transition={{ duration: 0.55, ease: [0.76, 0, 0.24, 1] }}
          >
            <motion.div
              className="text-center px-6"
              initial={{ scale: 0.8, opacity: 0, y: 14 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            >
              <div className="text-pitch-400 text-xs uppercase tracking-[0.3em] mb-3">{activeUser.name}</div>
              <div className="text-3xl sm:text-4xl font-black tracking-tight text-white">{startLabel}</div>
              <div className="mt-4 text-white/40 text-sm uppercase tracking-widest">Let’s go</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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

      <Modal
        open={confirmNext}
        onClose={() => setConfirmNext(false)}
        title="Move to the next video?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmNext(false)}>Keep drilling</Button>
            <Button variant="primary" onClick={proceedNext}>Next anyway</Button>
          </>
        }
      >
        You haven’t finished all of this drill’s timers yet. Are you sure you want to move on?
      </Modal>
    </div>
  );
}

function SessionHeader({
  session, targetMs, sessionProgress, userName, onQuit,
}: {
  session: Session;
  targetMs: number | null;
  sessionProgress: number | null;
  userName: string;
  onQuit: () => void;
}) {
  const modeLabel = session.mode === 'daily'
    ? `Daily · ${(targetMs ?? 0) / 60_000} min`
    : session.mode === 'extra' ? 'Extra time' : 'Manual pick';
  return (
    <header className="flex items-center gap-3">
      <Button
        variant="ghost"
        size="sm"
        iconOnly
        icon="close"
        onClick={onQuit}
        className="text-white/70 shrink-0"
      >
        End session
      </Button>

      {sessionProgress !== null ? (
        // Daily target as a slim progress bar sitting right next to the exit.
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-widest text-white/45">Session goal</span>
            <span className="text-[10px] uppercase tracking-widest text-white/45 tabular">
              {Math.round(sessionProgress * 100)}%
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-ink-700 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-pitch-500"
              animate={{ width: `${sessionProgress * 100}%` }}
              transition={{ type: 'tween', ease: 'linear', duration: 0.2 }}
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 text-center min-w-0">
          <div className="text-sm font-semibold leading-tight truncate">{userName}</div>
          <div className="text-[11px] uppercase tracking-widest text-white/45">{modeLabel}</div>
        </div>
      )}

      <div className="min-w-[3rem] text-right shrink-0">
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
  onDrillElapsedChange,
  onDrillAllDoneChange,
  onLoadError,
  loadFailed,
  mode,
  activeVideo,
  libraryMode,
}: {
  session: Session;
  targetMs: number | null;
  onNext: () => void;
  onStop: () => void;
  onSkip: () => void;
  onDrillElapsedChange: (elapsedMs: number) => void;
  onDrillAllDoneChange: (allDone: boolean) => void;
  onLoadError: () => void;
  loadFailed: boolean;
  mode: SessionMode;
  activeVideo: VideoRef;
  libraryMode: boolean;
}) {
  const total = totalPracticeMs(session);
  // Vertical Shorts get a narrower, portrait-friendly column so they don't sit
  // letterboxed inside a wide 16:9 slot like long-form clips.
  const isShort = isYouTubeShort(activeVideo.url);

  return (
    <motion.div
      // Drills wipe horizontally: the new clip slides in from the right while
      // the previous one slides off to the left.
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '-100%', opacity: 0 }}
      transition={{ type: 'tween', ease: [0.4, 0, 0.2, 1], duration: 0.35 }}
      className={[
        'flex h-full min-h-0 flex-col gap-3 lg:grid lg:h-auto lg:items-start lg:gap-10',
        isShort ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]' : 'lg:grid-cols-2',
      ].join(' ')}
    >
      {/* LEFT / TOP — the looping clip and what you’re drilling. On phones the
          clip flexes to fill leftover height so the whole drill fits one screen. */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 lg:flex-none lg:gap-4">
        {loadFailed ? (
          <div className="w-full rounded-2xl bg-red-500/10 border border-red-500/40 p-6 text-center">
            <p className="text-red-200 mb-4">This video didn’t load.</p>
            <Button variant="secondary" icon="skip" onClick={onSkip}>Skip to another</Button>
          </div>
        ) : (
          <div
            className={[
              'min-h-0 flex-1 lg:flex-none',
              isShort ? 'lg:h-[62vh]' : 'lg:aspect-video',
            ].join(' ')}
          >
            <VideoPlayer
              key={activeVideo.id}
              video={activeVideo}
              onLoadError={onLoadError}
              loop
              fit
            />
          </div>
        )}

        <div className="shrink-0 text-center lg:text-left px-1">
          <div className="text-white/45 text-[10px] lg:text-[11px] uppercase tracking-widest">Now drilling</div>
          <div className="font-bold text-white text-base lg:text-xl leading-snug line-clamp-1 lg:line-clamp-none">{activeVideo.title}</div>
          {activeVideo.description && (
            <p className="hidden lg:block text-white/60 text-sm mt-1 leading-relaxed">{activeVideo.description}</p>
          )}
        </div>
      </div>

      {/* RIGHT / BOTTOM — the primary drill timer(s), an optional non-daily
          session clock and the flow controls. Fixed height so the clip above
          can flex to fill the rest of a portrait screen. */}
      <div className="flex shrink-0 flex-col items-center gap-3 lg:gap-6">
        {/* Daily mode shows its goal as the top progress bar, so nothing here.
            Extra/manual keep the numberless practice clock. */}
        {!targetMs && !libraryMode && (
          <div className="opacity-70 scale-[0.6] -my-2 lg:my-0 lg:scale-75">
            <PracticeClock elapsedMs={total} running compact />
          </div>
        )}

        {/* Primary focus: the per-drill countdown timer(s). In library mode we
            only play the video, so the drill timers are not shown. */}
        {!libraryMode && (
          <DrillTimers
            seconds={activeVideo.timer}
            repetition={activeVideo.repetition}
            titles={activeVideo.timerTitles}
            onElapsedChange={onDrillElapsedChange}
            onAllDoneChange={onDrillAllDoneChange}
          />
        )}

        <div className="w-full max-w-sm space-y-2 lg:space-y-3 lg:pt-2">
          <Button variant="primary" size="lg" fullWidth iconRight="arrow-right" onClick={onNext}>
            Next video
          </Button>
          {mode !== 'daily' && !libraryMode && (
            <Button variant="ice" size="md" fullWidth icon="stop" onClick={onStop}>
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
