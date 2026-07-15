import { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { useReducedMotion } from 'framer-motion';

/** Fires a celebratory burst on mount, once. */
export function Confetti() {
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    // Two bursts for a bit of layered richness.
    const end = Date.now() + 900;
    const colors = ['#22d17a', '#ffb84d', '#7fd7ff', '#ffffff'];
    const frame = () => {
      confetti({
        particleCount: 6,
        angle: 60,
        spread: 60,
        origin: { x: 0, y: 0.8 },
        colors,
        scalar: 0.9,
      });
      confetti({
        particleCount: 6,
        angle: 120,
        spread: 60,
        origin: { x: 1, y: 0.8 },
        colors,
        scalar: 0.9,
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
    return () => { confetti.reset(); };
  }, [reduced]);

  return null;
}
