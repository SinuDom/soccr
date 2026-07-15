import { useCallback, useEffect, useRef, useState } from 'react';
import { ProgressRing } from './ProgressRing';
import { formatClock } from './PracticeClock';
import { Icon, type IconName } from './Icon';

type Phase = 'idle' | 'running' | 'paused' | 'done';

interface Props {
  /** Duration of the drill, in seconds. */
  seconds: number;
  /** 1-based label index when several timers are shown next to each other. */
  index?: number;
  /** Custom label for this individual timer; overrides the default "Set N"/"Drill". */
  label?: string;
  /**
   * Fired whenever this timer's contribution changes. `elapsedMs` is the amount
   * of drill time this timer currently contributes to the session (0 while idle
   * or after a reset, the elapsed portion while running/paused, the full
   * duration once done). `completedOnce` is true once it has reached zero at
   * least once (it stays true even after a reset).
   */
  onChange?: (elapsedMs: number, completedOnce: boolean) => void;
  /** Diameter of the countdown ring in px (shrinks on small screens). */
  size?: number;
}

/**
 * A single drill countdown. Starts on demand via its own Start button, shows
 * the remaining time as big numbers, and a ring that visually indicates how
 * much time is left. It can be paused/resumed while running and, when it
 * reaches zero, flips to a "done" state and can be run again.
 */
export function DrillTimer({ seconds, index, label: customLabel, onChange, size = 132 }: Props) {
  const totalMs = Math.max(1, Math.round(seconds * 1000));
  const [phase, setPhase] = useState<Phase>('idle');
  const [remainingMs, setRemainingMs] = useState(totalMs);
  const [completedOnce, setCompletedOnce] = useState(false);
  const endAtRef = useRef<number>(0);

  // Reset if the drill duration changes (e.g. moving to another video).
  useEffect(() => {
    setPhase('idle');
    setRemainingMs(totalMs);
    setCompletedOnce(false);
  }, [totalMs]);

  // Report this timer's contribution to the session. Idle/reset contributes
  // nothing; running/paused contributes the elapsed portion; done contributes
  // the full duration. This drives the live session progress bar and lets a
  // reset subtract its time again.
  useEffect(() => {
    const elapsed = phase === 'idle' ? 0 : totalMs - remainingMs;
    onChange?.(Math.max(0, elapsed), completedOnce);
  }, [remainingMs, phase, completedOnce, totalMs, onChange]);

  useEffect(() => {
    if (phase !== 'running') return;
    let raf = 0;
    const loop = () => {
      const left = endAtRef.current - Date.now();
      if (left <= 0) {
        setRemainingMs(0);
        setPhase('done');
        setCompletedOnce(true);
        return;
      }
      setRemainingMs(left);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  const start = useCallback(() => {
    endAtRef.current = Date.now() + totalMs;
    setRemainingMs(totalMs);
    setPhase('running');
  }, [totalMs]);

  const pause = useCallback(() => {
    // Freeze the remaining time; the running loop reads endAtRef so capture it.
    const left = Math.max(0, endAtRef.current - Date.now());
    setRemainingMs(left);
    setPhase('paused');
  }, []);

  const resume = useCallback(() => {
    endAtRef.current = Date.now() + remainingMs;
    setPhase('running');
  }, [remainingMs]);

  const reset = useCallback(() => {
    setPhase('idle');
    setRemainingMs(totalMs);
  }, [totalMs]);

  const progress = 1 - remainingMs / totalMs;
  const label = customLabel ?? (index != null ? `Set ${index}` : 'Drill');

  return (
    <div className="flex flex-col items-center gap-2 sm:gap-3">
      <div className="text-white/50 text-[10px] sm:text-[11px] uppercase tracking-widest">{label}</div>
      <ProgressRing
        progress={progress}
        size={size}
        stroke={size < 120 ? 7 : 8}
        color={phase === 'done' ? '#22d17a' : '#4aa8ff'}
      >
        <div
          className={[
            'font-mono tabular font-black leading-none tracking-tight transition-colors',
            size < 120 ? 'text-2xl' : 'text-3xl',
            phase === 'done' ? 'text-pitch-400' : 'text-white',
          ].join(' ')}
        >
          {formatClock(remainingMs)}
        </div>
      </ProgressRing>
      <div className="flex gap-2">
        {phase === 'idle' && (
          <ControlButton kind="primary" icon="play" label="Start drill" onClick={start} />
        )}
        {phase === 'running' && (
          <ControlButton kind="muted" icon="pause" label="Pause" onClick={pause} />
        )}
        {phase === 'paused' && (
          <>
            <ControlButton kind="primary" icon="play" label="Resume" onClick={resume} />
            <ControlButton kind="muted" icon="rotate" label="Reset" onClick={reset} />
          </>
        )}
        {phase === 'done' && (
          <ControlButton kind="primary" icon="rotate" label="Run again" onClick={start} />
        )}
      </div>
    </div>
  );
}

/** Round, minimalistic icon control used for the drill timer transport. */
function ControlButton({
  kind,
  icon,
  label,
  onClick,
}: {
  kind: 'primary' | 'muted';
  icon: IconName;
  label: string;
  onClick: () => void;
}) {
  const tone =
    kind === 'primary'
      ? 'bg-pitch-500 hover:bg-pitch-400 active:bg-pitch-600 text-ink-950 shadow-glow'
      : 'bg-ink-700 hover:bg-ink-600 text-white border border-ink-600';
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={[
        'grid place-items-center h-12 w-12 rounded-full',
        'transition-[transform,background-color] duration-150 ease-out',
        'active:scale-90 motion-reduce:transform-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pitch-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950',
        tone,
      ].join(' ')}
    >
      <Icon name={icon} size={20} />
    </button>
  );
}

/**
 * Renders one DrillTimer per repetition, laid out next to each other. Returns
 * null when the active drill has no timer configured.
 *
 * It aggregates the child timers and reports:
 *  - `onElapsedChange`: the summed drill time contributed by all timers (so
 *    completing every timer credits the sum of their durations, and a reset
 *    subtracts that timer's time again).
 *  - `onAllDoneChange`: whether every timer has been finished at least once.
 */
export function DrillTimers({
  seconds,
  repetition,
  titles,
  onElapsedChange,
  onAllDoneChange,
}: {
  seconds?: number;
  repetition?: number;
  titles?: string[];
  onElapsedChange?: (elapsedMs: number) => void;
  onAllDoneChange?: (allDone: boolean) => void;
}) {
  const count = seconds && seconds >= 1 ? Math.max(1, Math.floor(repetition ?? 1)) : 0;

  const elapsedRef = useRef<number[]>([]);
  const doneRef = useRef<boolean[]>([]);

  // Reset the per-timer bookkeeping whenever the drill layout changes (e.g.
  // moving to another video) so stale contributions don't leak across drills.
  useEffect(() => {
    elapsedRef.current = Array(count).fill(0);
    doneRef.current = Array(count).fill(false);
    onElapsedChange?.(0);
    onAllDoneChange?.(count === 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, seconds]);

  // Rings are large on desktop/iPad but shrink on phones so a full drill (video
  // + timers + controls) fits one portrait screen without scrolling.
  const [ringSize, setRingSize] = useState(132);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const apply = () => setRingSize(mq.matches ? 132 : 96);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const handleChildChange = useCallback(
    (i: number, elapsedMs: number, completedOnce: boolean) => {
      elapsedRef.current[i] = elapsedMs;
      doneRef.current[i] = completedOnce;
      const sum = elapsedRef.current.reduce((a, b) => a + b, 0);
      onElapsedChange?.(sum);
      const allDone = doneRef.current.length > 0 && doneRef.current.every(Boolean);
      onAllDoneChange?.(allDone);
    },
    [onElapsedChange, onAllDoneChange],
  );

  if (count === 0) return null;
  const heading = count > 1 ? `${count} × ${formatClock((seconds ?? 0) * 1000)} drill` : 'Drill timer';

  return (
    <div className="w-full flex flex-col items-center gap-3 sm:gap-4">
      <div className="text-white/60 text-xs sm:text-sm uppercase tracking-widest">{heading}</div>
      <div className="flex flex-wrap items-start justify-center gap-3 sm:gap-6 lg:gap-8">
        {Array.from({ length: count }, (_, i) => (
          <DrillTimer
            key={i}
            seconds={seconds!}
            index={count > 1 ? i + 1 : undefined}
            label={titles?.[i]}
            size={ringSize}
            onChange={(elapsedMs, completedOnce) => handleChildChange(i, elapsedMs, completedOnce)}
          />
        ))}
      </div>
    </div>
  );
}
