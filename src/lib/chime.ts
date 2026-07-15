/**
 * Plays a short, pleasant "finished" chime using the Web Audio API so no audio
 * asset needs to be bundled. It synthesises a two-note bell-like arpeggio that
 * quickly fades out. Safe to call from anywhere; failures (e.g. no audio
 * support or a blocked AudioContext) are swallowed silently.
 */
export function playFinishedChime() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx: AudioContext = new Ctx();
    // Resuming is a no-op when already running; needed if the context starts
    // suspended until a user gesture (the Start button qualifies).
    void ctx.resume?.();

    const now = ctx.currentTime;
    // A rising two-note chime: E6 then B6 for a bright, "success" feel.
    const notes = [
      { freq: 1318.51, start: 0, dur: 0.35 },
      { freq: 1567.98, start: 0.16, dur: 0.45 },
    ];

    for (const n of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = n.freq;
      const t0 = now + n.start;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + n.dur + 0.05);
    }

    // Close the context shortly after the sound completes to free resources.
    window.setTimeout(() => { void ctx.close?.(); }, 1000);
  } catch {
    // Ignore — the chime is a nicety, never critical.
  }
}
