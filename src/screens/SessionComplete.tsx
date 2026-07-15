import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useProgressStore } from '@/store/progressStore';
import { Confetti } from '@/components/Confetti';
import { StreakFlame } from '@/components/StreakFlame';
import { Button } from '@/components/Button';

export function SessionComplete() {
  const [params] = useSearchParams();
  const mode = params.get('mode') ?? 'daily';
  const ms = Number(params.get('ms') ?? 0);
  const pts = Number(params.get('pts') ?? 0);
  const streak = useProgressStore((s) => s.progress.currentStreak);
  const points = useProgressStore((s) => s.progress.points);

  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
      <Confetti />
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 18 }}
        className="mb-6"
      >
        {mode === 'daily' ? (
          <>
            <p className="uppercase tracking-widest text-pitch-400 text-sm mb-2">Daily goal complete</p>
            <StreakFlame streak={streak} large />
          </>
        ) : (
          <p className="uppercase tracking-widest text-ice-400 text-sm">Extra time banked</p>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="rounded-3xl bg-ink-800 border border-ink-700 px-8 py-6 mb-6"
      >
        <div className="text-white/60 uppercase tracking-widest text-xs mb-1">Practice time</div>
        <div className="text-5xl font-black tabular">{minutes}<span className="text-white/40 text-2xl">m</span> {String(seconds).padStart(2, '0')}<span className="text-white/40 text-2xl">s</span></div>
        {mode !== 'daily' && (
          <div className="mt-3 text-flame-400 font-bold">+{pts} points (balance {points})</div>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="w-full max-w-sm space-y-3"
      >
        <Link to="/"><Button variant="primary" size="lg" fullWidth>Home</Button></Link>
        <Link to="/shop"><Button variant="ghost" size="md" fullWidth>Visit shop</Button></Link>
      </motion.div>
    </div>
  );
}
