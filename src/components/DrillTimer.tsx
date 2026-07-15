import { useCallback, useEffect, useRef, useState } from 'react';
import { ProgressRing } from './ProgressRing';
import { formatClock } from './PracticeClock';

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
    <div className="flex flex-col items-center gap-2">
      <div className="text-white/50 text-[11px] uppercase tracking-widest">{label}</div>
      <ProgressRing
        progress={progress}
        size={128}
        stroke={8}
        color={phase === 'done' ? '#22d17a' : '#4aa8ff'}
      >
        <div
          className={[
            'font-mono tabular font-black leading-none tracking-tight text-3xl',
            phase === 'done' ? 'text-pitch-400' : 'text-white',
          ].join(' ')}
        >
          {formatClock(remainingMs)}
        </div>
      </ProgressRing>
      {phase === 'idle' && (
        <button
          className="rounded-xl bg-pitch-500 hover:bg-pitch-400 active:bg-pitch-600 text-ink-950 font-semibold h-10 px-5"
          onClick={start}
        >
          Start
        </button>
      )}
      {phase === 'running' && (
        <button
          className="rounded-xl bg-ink-700 hover:bg-ink-600 text-white border border-ink-600 font-semibold h-10 px-5"
          onClick={pause}
        >
          Pause
        </button>
      )}
      {phase === 'paused' && (
        <div className="flex gap-2">
          <button
            className="rounded-xl bg-pitch-500 hover:bg-pitch-400 active:bg-pitch-600 text-ink-950 font-semibold h-10 px-5"
            onClick={resume}
          >
            Resume
          </button>
          <button
            className="rounded-xl bg-ink-700 hover:bg-ink-600 text-white border border-ink-600 font-semibold h-10 px-4"
            onClick={reset}
          >
            Reset
          </button>
        </div>
      )}
      {phase === 'done' && (
        <button
          className="rounded-xl bg-ink-700 hover:bg-ink-600 text-white border border-ink-600 font-semibold h-10 px-5"
          onClick={start}
        >
          Again
        </button>
      )}
    </div>
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
    <div className="w-full flex flex-col items-center gap-3">
      <div className="text-white/60 text-sm uppercase tracking-widest">{heading}</div>
      <div className="flex flex-wrap items-start justify-center gap-4">
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
