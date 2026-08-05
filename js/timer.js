// Sound / vibration / wake-lock helpers + a drift-proof countdown for EMOM/AMRAP.

let audioCtx = null;
export function unlockAudio() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
  } catch (e) {}
}
export function beep(freq = 880, dur = 0.15, vol = 0.35) {
  try {
    unlockAudio();
    if (!audioCtx) return;
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = "sine"; o.frequency.value = freq;
    o.connect(g); g.connect(audioCtx.destination);
    const t = audioCtx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.02);
  } catch (e) {}
}
export function vibrate(pattern) { try { navigator.vibrate && navigator.vibrate(pattern); } catch (e) {} }

export async function keepAwake() {
  try { if ("wakeLock" in navigator) return await navigator.wakeLock.request("screen"); } catch (e) {}
  return null;
}
export function releaseAwake(lock) { try { lock && lock.release && lock.release(); } catch (e) {} }

export const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;

// onTick(remainingSec, elapsedSec) called ~4×/s; onDone() at 0. Returns stop().
export function countdown(totalSec, onTick, onDone) {
  const start = Date.now();
  let stopped = false;
  onTick(totalSec, 0);
  const id = setInterval(() => {
    if (stopped) return;
    const elapsed = Math.floor((Date.now() - start) / 1000);
    const remaining = totalSec - elapsed;
    if (remaining <= 0) { clearInterval(id); onTick(0, totalSec); onDone && onDone(); return; }
    onTick(remaining, elapsed);
  }, 250);
  return () => { stopped = true; clearInterval(id); };
}
