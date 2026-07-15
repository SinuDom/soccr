import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useContentStore } from '@/store/contentStore';
import { useProgressStore } from '@/store/progressStore';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { BottomDock } from '@/components/BottomDock';

export function Shop() {
  const content = useContentStore((s) => s.content);
  const progress = useProgressStore((s) => s.progress);
  const buy = useProgressStore((s) => s.buyFreeze);
  const [bought, setBought] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reduced = useReducedMotion();

  if (!content) return null;
  const cost = content.settings.freezeCostPoints;
  const atMax = progress.freezesHeld >= content.settings.maxFreezesHeld;
  const notEnough = progress.points < cost;

  return (
    <div className="min-h-dvh max-w-xl lg:max-w-2xl mx-auto p-5 pt-8 pb-28 lg:pb-8 w-full">
      <header className="flex items-center gap-3 mb-6">
        <Link
          to="/"
          aria-label="Back home"
          className="grid place-items-center h-10 w-10 rounded-2xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
        >
          <Icon name="arrow-left" size={20} />
        </Link>
        <h1 className="text-2xl font-black tracking-tight">Shop</h1>
      </header>

      <section className="rounded-4xl bg-white border border-slate-200 shadow-card p-6 mb-6 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-500">Points</div>
          <div className="text-4xl font-black tabular">{progress.points}</div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-widest text-slate-500">Freezes held</div>
          <div className="text-2xl font-bold">{progress.freezesHeld} / {content.settings.maxFreezesHeld}</div>
        </div>
      </section>

      <motion.section
        initial={false}
        animate={bought && !reduced ? { scale: [1, 1.04, 1], boxShadow: ['0 0 0 rgba(127,215,255,0)', '0 0 60px rgba(127,215,255,0.5)', '0 0 0 rgba(127,215,255,0)'] } : undefined}
        transition={{ duration: 0.8 }}
        className="rounded-4xl bg-white border border-ice-500/40 shadow-card p-6"
      >
        <div className="flex items-center gap-4 mb-4">
          <div className="grid place-items-center h-14 w-14 rounded-2xl bg-ice-500/15 text-ice-600">
            <Icon name="snowflake" size={30} />
          </div>
          <div>
            <h2 className="text-xl font-bold">Streak Freeze</h2>
            <p className="text-slate-500 text-sm">Saves your streak the next time you miss a day.</p>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-flame-600 font-bold">Cost: {cost} pts</div>
          <Button
            variant="ice"
            size="lg"
            icon={atMax ? undefined : 'plus'}
            disabled={atMax || notEnough}
            onClick={() => {
              setError(null);
              const r = buy(content.settings);
              if (r.ok) { setBought(true); setTimeout(() => setBought(false), 900); }
              else setError(r.reason === 'at_max_freezes' ? `You already hold ${content.settings.maxFreezesHeld}.` : 'Not enough points yet.');
            }}
          >
            {atMax ? `Max ${content.settings.maxFreezesHeld} held` : 'Buy freeze'}
          </Button>
        </div>
        {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
      </motion.section>

      <p className="text-slate-400 text-xs mt-8 text-center">
        Earn points by practicing in Extra Time or by hand-picking videos from the Library.
      </p>

      <BottomDock />
    </div>
  );
}
