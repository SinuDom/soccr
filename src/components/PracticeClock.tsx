import { useEffect, useState } from 'react';

interface Props {
  /** Elapsed ms so far in this session. */
  elapsedMs: number;
  /** For daily mode: countdown target. Undefined → count up. */
  targetMs?: number | null;
  /** When true, we re-render on animation frames to keep the display live. */
  running: boolean;
  compact?: boolean;
}

/**
 * Huge, distance-readable practice clock. Countdown when a target is passed,
 * stopwatch otherwise. The clock never derives elapsed itself — it always
 * reflects the value passed in — but it does force re-renders on rAF so the
 * parent's wall-clock math shows up as live ticking numbers.
 */
export function PracticeClock({ elapsedMs, targetMs, running, compact }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    const loop = () => { setTick((n) => (n + 1) & 0xffff); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  const displayMs = targetMs != null ? Math.max(0, targetMs - elapsedMs) : elapsedMs;
  const overGoal = targetMs != null && elapsedMs >= targetMs;
  const negative = overGoal;

  return (
    <div className="flex flex-col items-center select-none">
      <div
        className={[
          'font-mono tabular font-black leading-none tracking-tight',
          compact ? 'text-clockSmall' : 'text-clock',
          negative ? 'text-pitch-600' : 'text-slate-900',
        ].join(' ')}
        aria-live="off"
      >
        {formatClock(displayMs)}
      </div>
      {targetMs != null ? (
        <div className="mt-2 text-slate-500 text-sm uppercase tracking-widest">
          {overGoal ? 'goal complete' : 'countdown'}
        </div>
      ) : (
        <div className="mt-2 text-slate-500 text-sm uppercase tracking-widest">extra time</div>
      )}
    </div>
  );
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
