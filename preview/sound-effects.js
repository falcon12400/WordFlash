// Short answer sounds made with the Web Audio API (no sound files, no
// licences). Call playAnswerSound() from a tap handler: iPhone and iPad only
// allow audio to start inside a user gesture. Turn off with
// localStorage "wordflash_sound_effects_v1" = "off".

export const SOUND_EFFECTS_KEY = "wordflash_sound_effects_v1";

let context = null;

const audio = () => {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!context) context = new AudioContextClass();
  if (context.state === "suspended") context.resume().catch(() => {});
  return context;
};

const tone = (ctx, { frequency, endFrequency = frequency, start, duration, type = "sine", volume = 0.18 }) => {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  if (endFrequency !== frequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
  // Soft attack and release so the sound never clicks.
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
};

export const soundEffectsEnabled = () => localStorage.getItem(SOUND_EFFECTS_KEY) !== "off";

export function playAnswerSound(correct) {
  if (!soundEffectsEnabled()) return;
  try {
    const ctx = audio();
    if (!ctx) return;
    const now = ctx.currentTime + 0.01;
    if (correct) {
      // Bright rising "ding-ding".
      tone(ctx, { frequency: 784, start: now, duration: 0.16 });
      tone(ctx, { frequency: 1175, start: now + 0.11, duration: 0.28 });
    } else {
      // Gentle low "boop", not a harsh buzzer.
      tone(ctx, { frequency: 330, endFrequency: 220, start: now, duration: 0.32, type: "triangle", volume: 0.2 });
    }
  } catch (error) {
    console.warn("WordFlash sound effect failed", error);
  }
}
