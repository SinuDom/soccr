import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useProgressStore } from '@/store/progressStore';
import { useContentStore, getUser } from '@/store/contentStore';
import { Button } from '@/components/Button';
import { Icon, type IconName } from '@/components/Icon';
import { Modal } from '@/components/Modal';
import { toLocalDateString } from '@/lib/domain/streak';
import { practiceableCategories } from '@/lib/domain/categories';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Streak calendar. Shows which days the daily goal was met and lets the user
 * retroactively mark past days done — for days they trained outside the app
 * (e.g. club training) but didn't open it, so the streak still reflects reality.
 */
export function StreakCalendar() {
  const nav = useNavigate();
  const { progress, activeUserId, markDayDone } = useProgressStore();
  const content = useContentStore((s) => s.content);
  const activeUser = getUser(content, activeUserId);
  const categories = activeUser ? practiceableCategories(activeUser) : [];

  const today = toLocalDateString(new Date());
  const now = new Date();
  const completed = useMemo(() => new Set(progress.completedDates ?? []), [progress.completedDates]);
  const frozen = useMemo(() => new Set(progress.frozenDates ?? []), [progress.frozenDates]);

  const [view, setView] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [confirmDate, setConfirmDate] = useState<string | null>(null);

  const currentIndex = now.getFullYear() * 12 + now.getMonth();
  const viewIndex = view.year * 12 + view.month;
  const canGoNext = viewIndex < currentIndex;

  const cells = useMemo(() => monthCells(view.year, view.month), [view.year, view.month]);
  const monthLabel = new Date(view.year, view.month, 1).toLocaleString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const step = (delta: number) => {
    if (delta > 0 && !canGoNext) return;
    const d = new Date(view.year, view.month + delta, 1);
    setView({ year: d.getFullYear(), month: d.getMonth() });
  };

  return (
    <div className="min-h-dvh flex flex-col p-5 pt-8 pb-10 sm:pt-12 max-w-xl mx-auto w-full">
      <motion.header
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        className="flex items-center gap-3 mb-6"
      >
        <button
          type="button"
          aria-label="Back"
          onClick={() => nav('/home')}
          className="grid place-items-center h-11 w-11 rounded-2xl text-white/70 hover:text-white hover:bg-ink-800 transition-colors"
        >
          <Icon name="arrow-left" size={22} />
        </button>
        <div>
          <h1 className="text-2xl font-black tracking-tight">Streak calendar</h1>
          <p className="text-white/60 text-sm">Trained elsewhere? Tap a day to keep the streak.</p>
        </div>
      </motion.header>

      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.04, type: 'spring', stiffness: 220, damping: 24 }}
        className="grid grid-cols-3 gap-3 mb-4"
      >
        <StatTile icon="flame" value={progress.currentStreak} label="day streak" accent />
        <StatTile icon="trophy" value={progress.longestStreak} label="best ever" />
        <StatTile icon="calendar" value={completed.size} label="total days" />
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, type: 'spring', stiffness: 220, damping: 24 }}
        className="rounded-3xl bg-ink-800 border border-ink-700 p-4 sm:p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => step(-1)}
            className="grid place-items-center h-10 w-10 rounded-xl text-white/70 hover:text-white hover:bg-ink-700 transition-colors"
          >
            <Icon name="arrow-left" size={20} />
          </button>
          <span className="text-lg font-bold tracking-tight">{monthLabel}</span>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => step(1)}
            disabled={!canGoNext}
            className="grid place-items-center h-10 w-10 rounded-xl text-white/70 hover:text-white hover:bg-ink-700 transition-colors disabled:opacity-25 disabled:hover:bg-transparent"
          >
            <Icon name="arrow-right" size={20} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-2">
          {WEEKDAYS.map((w) => (
            <div key={w} className="text-center text-[11px] font-semibold uppercase tracking-wide text-white/35">
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {cells.map((date, i) =>
            date == null ? (
              <div key={`pad-${i}`} />
            ) : (
              <DayCell
                key={date}
                date={date}
                dayNum={Number(date.slice(8))}
                completed={completed.has(date)}
                frozen={frozen.has(date)}
                isToday={date === today}
                isFuture={date > today}
                onMark={() => setConfirmDate(date)}
              />
            ),
          )}
        </div>

        <Legend />
      </motion.section>

      <Modal
        open={confirmDate != null}
        onClose={() => setConfirmDate(null)}
        title="Mark this day done?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDate(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              icon="check"
              onClick={() => {
                if (confirmDate) markDayDone(confirmDate, today, categories);
                setConfirmDate(null);
              }}
            >
              Mark done
            </Button>
          </>
        }
      >
        <p>
          {confirmDate && prettyDate(confirmDate)} will count toward your streak — use this when you practiced
          elsewhere, like club training.
        </p>
      </Modal>
    </div>
  );
}

function StatTile({
  icon,
  value,
  label,
  accent,
}: {
  icon: IconName;
  value: number;
  label: string;
  accent?: boolean;
}) {
  return (
    <div
      className={[
        'rounded-2xl border p-3.5 flex flex-col gap-1',
        accent ? 'border-pitch-500/40 bg-pitch-500/10' : 'border-ink-700 bg-ink-800',
      ].join(' ')}
    >
      <Icon name={icon} size={18} className={accent ? 'text-pitch-400' : 'text-white/50'} />
      <span className={['text-3xl font-black tabular leading-none', accent ? 'text-pitch-300' : ''].join(' ')}>
        {value}
      </span>
      <span className="text-[11px] uppercase tracking-wide text-white/45">{label}</span>
    </div>
  );
}

function DayCell({
  date,
  dayNum,
  completed,
  frozen,
  isToday,
  isFuture,
  onMark,
}: {
  date: string;
  dayNum: number;
  completed: boolean;
  frozen: boolean;
  isToday: boolean;
  isFuture: boolean;
  onMark: () => void;
}) {
  const base =
    'relative aspect-square rounded-2xl grid place-items-center text-sm font-bold select-none transition-all';

  // A freeze-saved day: read it as frozen (ice + snowflake), not practiced.
  if (frozen) {
    return (
      <div
        aria-label={`${date} — streak freeze used`}
        className={[
          base,
          'bg-ice-500/25 text-ice-200 border border-ice-500/50 shadow-[0_2px_10px_-2px_rgba(56,189,248,0.4)]',
          isToday ? 'ring-2 ring-white/90' : '',
        ].join(' ')}
      >
        <span className="leading-none">{dayNum}</span>
        <Icon name="snowflake" size={12} className="absolute bottom-1 right-1 opacity-80" />
      </div>
    );
  }

  if (completed) {
    return (
      <div
        aria-label={`${date} — done`}
        className={[
          base,
          'bg-pitch-500 text-ink-950 shadow-[0_2px_10px_-2px_rgba(34,197,94,0.5)]',
          isToday ? 'ring-2 ring-white/90' : '',
        ].join(' ')}
      >
        <span className="leading-none">{dayNum}</span>
        <Icon name="check" size={12} className="absolute bottom-1 right-1 opacity-70" />
      </div>
    );
  }

  if (isFuture) {
    return <div className={[base, 'text-white/20'].join(' ')}>{dayNum}</div>;
  }

  // Past or today, not yet done → tap to mark.
  return (
    <button
      type="button"
      aria-label={`Mark ${date} done`}
      onClick={onMark}
      className={[
        base,
        'border text-white/70 hover:text-white hover:bg-pitch-500/10 active:scale-95 motion-reduce:transform-none',
        isToday ? 'border-pitch-400 ring-1 ring-pitch-400/60 text-white' : 'border-ink-600 hover:border-pitch-500',
      ].join(' ')}
    >
      {dayNum}
    </button>
  );
}

function Legend() {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-white/50">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3.5 w-3.5 rounded-md bg-pitch-500" /> Done
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="grid h-3.5 w-3.5 place-items-center rounded-md border border-ice-500/50 bg-ice-500/25 text-ice-200">
          <Icon name="snowflake" size={9} />
        </span>{' '}
        Freeze used
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3.5 w-3.5 rounded-md border border-ink-600" /> Tap to mark done
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3.5 w-3.5 rounded-md border border-pitch-400 ring-1 ring-pitch-400/60" /> Today
      </span>
    </div>
  );
}

/** Cells for a month grid, Monday-first: leading nulls then each day's ISO date. */
function monthCells(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7; // convert Sun=0 to Monday-first index
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(toLocalDateString(new Date(year, month, d)));
  return cells;
}

function prettyDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}
