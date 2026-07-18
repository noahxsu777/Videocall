// Tiny native-feel helpers: haptic vibration + a subtle click tick.
// Both are best-effort and no-op where unsupported, and never throw.

/** Short haptic buzz. `kind` picks an intensity/pattern. */
export function haptic(kind: 'tap' | 'medium' | 'success' | 'error' = 'tap'): void {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
      return;
    }
    const patterns: Record<string, number | number[]> = {
      tap: 8,
      medium: 16,
      success: [12, 40, 18],
      error: [30, 60, 30],
    };
    navigator.vibrate(patterns[kind]);
  } catch {
    // vibration blocked/unsupported — ignore
  }
}

// --- Subtle UI tick via Web Audio (no asset files) -----------------------
let audioCtx: AudioContext | null = null;
function ctx(): AudioContext | null {
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) {
      return null;
    }
    if (!audioCtx) {
      audioCtx = new AC();
    }
    if (audioCtx.state === 'suspended') {
      void audioCtx.resume();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/** A short, soft click. `freq` shifts the pitch (e.g. higher for a "pop"). */
export function playTick(freq = 520): void {
  try {
    const ac = ctx();
    if (!ac) {
      return;
    }
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.06, ac.currentTime + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.09);
    osc.connect(gain).connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + 0.1);
  } catch {
    // audio blocked (no user gesture yet) — ignore
  }
}
