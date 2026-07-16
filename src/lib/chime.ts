/**
 * Plays a short, pleasant "finished" chime using the Web Audio API so no audio
 * asset needs to be bundled. It synthesises a two-note bell-like arpeggio that
 * quickly fades out. Safe to call from anywhere; failures (e.g. no audio
 * support or a blocked AudioContext) are swallowed silently.
 *
 * Browsers only allow audio that is rooted in a user gesture: an AudioContext
 * created (or resumed) outside one starts/stays `suspended`, and a drill timer
 * finishes long after the last tap. So a SINGLE shared context is created and
 * unlocked inside the Start-drill tap via unlockChime(), then reused when the
 * timer fires.
 */

let sharedCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedCtx || sharedCtx.state === 'closed') sharedCtx = new Ctx();
  return sharedCtx;
}

/**
 * Create/resume the shared AudioContext. MUST be called from a user-gesture
 * handler (the drill Start/Resume tap) — that is what entitles the chime to
 * actually sound when the timer finishes minutes later. Cheap and idempotent.
 */
export function unlockChime() {
  try {
    const ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();
    // iOS needs a (silent) sound played inside the gesture to fully unlock.
    const buffer = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    src.start(0);
  } catch {
    // Ignore — the chime is a nicety, never critical.
  }
}

export function playFinishedChime() {
  try {
    const ctx = getCtx();
    if (!ctx) return;
    // Resuming is a no-op when already running; a context never unlocked by a
    // gesture stays suspended and the chime is skipped silently.
    void ctx.resume?.();

    const now = ctx.currentTime;

    // Loud enough for a phone lying on the grass: the notes drive near full
    // scale into a compressor, which tames the overlap instead of clipping.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.knee.value = 12;
    comp.ratio.value = 6;
    comp.attack.value = 0.002;
    comp.release.value = 0.25;
    comp.connect(ctx.destination);

    // A rising four-note major arpeggio (G5 C6 E6 G6) with long ringing
    // tails — a clear, ~2s "you're done" bell instead of a short blip.
    const notes = [
      { freq: 783.99, start: 0.0, dur: 0.9 },
      { freq: 1046.5, start: 0.18, dur: 0.9 },
      { freq: 1318.51, start: 0.36, dur: 1.0 },
      { freq: 1567.98, start: 0.54, dur: 1.5 },
    ];

    for (const n of notes) {
      const t0 = now + n.start;
      // Each note is a fundamental plus a quieter octave partial for a
      // brighter, bell-like timbre that carries better on small speakers.
      for (const [mult, peak] of [[1, 0.85], [2, 0.3]] as const) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = n.freq * mult;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.dur);
        osc.connect(gain).connect(comp);
        osc.start(t0);
        osc.stop(t0 + n.dur + 0.05);
      }
    }
    // The shared context stays open — it is reused for every later chime.
  } catch {
    // Ignore — the chime is a nicety, never critical.
  }
}
