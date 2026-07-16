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
      gain.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + n.dur + 0.05);
    }
    // The shared context stays open — it is reused for every later chime.
  } catch {
    // Ignore — the chime is a nicety, never critical.
  }
}
