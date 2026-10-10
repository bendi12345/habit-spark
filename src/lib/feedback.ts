// Completion feedback (sound, vibration, motion) driven by the device-local preferences saved in Settings.
const preferenceKey = "habit-shift-preferences";

export function readFeedbackPrefs(): { sound: boolean; reducedMotion: boolean } {
  let sound = false;
  let reducedMotion = false;
  try {
    const saved = JSON.parse(window.localStorage.getItem(preferenceKey) ?? "{}");
    sound = saved.sound === true;
    reducedMotion = saved.reducedMotion === true;
  } catch {
    /* ignore */
  }
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) reducedMotion = true;
  return { sound, reducedMotion };
}

function playChime(big: boolean) {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const notes = big ? [523.25, 659.25, 783.99, 1046.5] : [659.25, 987.77];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.11;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch {
    /* audio unavailable */
  }
}

export function celebrateFeedback(big: boolean) {
  const prefs = readFeedbackPrefs();
  if (prefs.sound) playChime(big);
  if (!prefs.reducedMotion) navigator.vibrate?.(big ? [60, 40, 60, 40, 120] : [50]);
  return prefs;
}
