// Tiny synthesized sound effects: no audio files, everything is an oscillator
// through the Web Audio API, created on the first user gesture. M toggles mute.
export function createAudio() {
  let context = null;
  let muted = false;

  function ensure() {
    if (context) return context;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      context = new AudioContext();
    } catch {
      context = null;
    }
    return context;
  }

  function tone(freq, seconds, type, gain, when) {
    if (muted) return;
    const ctx = ensure();
    if (!ctx) return;
    const start = ctx.currentTime + (when || 0);
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + 0.015);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    osc.connect(amp);
    amp.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + seconds + 0.05);
  }

  return {
    unlock() {
      const ctx = ensure();
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    pickup() {
      tone(660, 0.09, 'sine', 0.16, 0);
      tone(990, 0.14, 'sine', 0.16, 0.07);
    },
    coin() {
      tone(1320, 0.06, 'triangle', 0.10, 0);
      tone(1760, 0.08, 'triangle', 0.08, 0.05);
    },
    spotted() {
      tone(220, 0.28, 'sawtooth', 0.14, 0);
      tone(233, 0.28, 'sawtooth', 0.14, 0.02);
    },
    caught() {
      tone(110, 0.5, 'sawtooth', 0.18, 0);
      tone(82, 0.6, 'sine', 0.18, 0.05);
    },
    win() {
      [523, 659, 784, 1047].forEach((freq, i) => tone(freq, 0.22, 'sine', 0.15, i * 0.11));
    },
  };
}
