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
  /** Fired whenever this timer starts/stops counting down. */
  onRunningChange?: (running: boolean) => void;
}

/**
 * A single drill countdown. Starts on demand via its own Start button, shows
 * the remaining time as big numbers, and a ring that visually indicates how
 * much time is left. It can be paused/resumed while running and, when it
 * reaches zero, flips to a "done" state and can be run again.
 */
export function DrillTimer({ seconds, index, label: customLabel, onRunningChange }: Props) {
  const totalMs = Math.max(1, Math.round(seconds * 1000));
  const [phase, setPhase] = useState<Phase>('idle');
  const [remainingMs, setRemainingMs] = useState(totalMs);
  const endAtRef = useRef<number>(0);

  // Reset if the drill duration changes (e.g. moving to another video).
  useEffect(() => {
    setPhase('idle');
    setRemainingMs(totalMs);
  }, [totalMs]);

  // Let the parent know whether this timer is actively counting down.
  useEffect(() => {
    onRunningChange?.(phase === 'running');
  }, [phase, onRunningChange]);

  useEffect(() => {
    if (phase !== 'running') return;
    let raf = 0;
    const loop = () => {
      const left = endAtRef.current - Date.now();
      if (left <= 0) {
        setRemainingMs(0);
        setPhase('done');
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
    <div className="flex flex-col items-center gap-4">
      <div className="text-slate-500 text-xs font-semibold uppercase tracking-widest">{label}</div>
      <ProgressRing
        progress={progress}
        size={168}
        stroke={10}
        color={phase === 'done' ? '#12b866' : '#3fb8ee'}
        trackColor="#e2e8f0"
      >
        <div
          className={[
            'font-mono tabular font-black leading-none tracking-tight text-4xl transition-colors',
            phase === 'done' ? 'text-pitch-600' : 'text-slate-900',
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
      ? 'bg-pitch-600 hover:bg-pitch-500 active:bg-pitch-700 text-white shadow-glow'
      : 'bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 border border-slate-200 shadow-card';
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={[
        'grid place-items-center h-14 w-14 rounded-full',
        'transition-[transform,background-color] duration-150 ease-out',
        'active:scale-90 motion-reduce:transform-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pitch-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
        tone,
      ].join(' ')}
    >
      <Icon name={icon} size={22} />
    </button>
  );
}

/**
 * Renders one DrillTimer per repetition, laid out next to each other. Returns
 * null when the active drill has no timer configured. Reports whether any of
 * the child timers is currently counting down via `onRunningChange`.
 */
export function DrillTimers({
  seconds,
  repetition,
  titles,
  onRunningChange,
}: {
  seconds?: number;
  repetition?: number;
  titles?: string[];
  onRunningChange?: (running: boolean) => void;
}) {
  const runningCountRef = useRef(0);

  const handleChildRunning = useCallback(
    (running: boolean) => {
      runningCountRef.current = Math.max(0, runningCountRef.current + (running ? 1 : -1));
      onRunningChange?.(runningCountRef.current > 0);
    },
    [onRunningChange],
  );

  if (!seconds || seconds < 1) return null;
  const count = Math.max(1, Math.floor(repetition ?? 1));
  const heading = count > 1 ? `${count} × ${formatClock(seconds * 1000)} drill` : 'Drill timer';

  return (
    <div className="w-full flex flex-col items-center gap-4">
      <div className="text-slate-500 text-xs font-semibold uppercase tracking-widest">{heading}</div>
      <div className="flex flex-wrap items-start justify-center gap-6 sm:gap-10">
        {Array.from({ length: count }, (_, i) => (
          <DrillTimer
            key={i}
            seconds={seconds}
            index={count > 1 ? i + 1 : undefined}
            label={titles?.[i]}
            onRunningChange={handleChildRunning}
          />
        ))}
      </div>
    </div>
  );
}
