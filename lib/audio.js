let ctx = null;
let muted = false;
let master = null;

function ensure() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch (err) {
      ctx = null;
      return null;
    }
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

try {
  if (typeof window !== "undefined") muted = window.localStorage.getItem("spotkick.muted") === "1";
} catch (err) {
  muted = false;
}

function noiseBuffer(c, seconds) {
  const buffer = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function noise(c, { duration, type, freq, q = 1, gain = 0.5, attack = 0.005, release = duration }) {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, duration + 0.1);
  const filter = c.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const g = c.createGain();
  const t = c.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + release);
  src.connect(filter);
  filter.connect(g);
  g.connect(master);
  src.start(t);
  src.stop(t + duration + 0.1);
}

function tone(c, { freq, endFreq, duration, type = "sine", gain = 0.4, attack = 0.004 }) {
  const osc = c.createOscillator();
  osc.type = type;
  const t = c.currentTime;
  osc.frequency.setValueAtTime(freq, t);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t + duration);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(g);
  g.connect(master);
  osc.start(t);
  osc.stop(t + duration + 0.05);
}

const sounds = {
  kick(c) {
    tone(c, { freq: 140, endFreq: 50, duration: 0.18, gain: 0.7 });
    noise(c, { duration: 0.12, type: "lowpass", freq: 600, gain: 0.5 });
  },
  bounce(c) {
    tone(c, { freq: 110, endFreq: 70, duration: 0.1, gain: 0.25 });
  },
  post(c) {
    tone(c, { freq: 1240, duration: 0.7, type: "triangle", gain: 0.35 });
    tone(c, { freq: 1880, duration: 0.5, type: "sine", gain: 0.2 });
    tone(c, { freq: 180, endFreq: 90, duration: 0.15, gain: 0.5 });
  },
  bar(c) {
    tone(c, { freq: 880, duration: 0.8, type: "triangle", gain: 0.35 });
    tone(c, { freq: 1320, duration: 0.6, type: "sine", gain: 0.2 });
    tone(c, { freq: 150, endFreq: 80, duration: 0.15, gain: 0.5 });
  },
  save(c) {
    noise(c, { duration: 0.14, type: "bandpass", freq: 900, q: 0.8, gain: 0.6 });
    tone(c, { freq: 200, endFreq: 90, duration: 0.14, gain: 0.5 });
  },
  goal(c) {
    noise(c, { duration: 0.5, type: "highpass", freq: 3000, gain: 0.25, attack: 0.02 });
    noise(c, { duration: 2.4, type: "bandpass", freq: 900, q: 0.5, gain: 0.5, attack: 0.5, release: 2.4 });
  },
  miss(c) {
    noise(c, { duration: 1.2, type: "bandpass", freq: 500, q: 0.6, gain: 0.3, attack: 0.3, release: 1.2 });
  },
  beep(c) {
    tone(c, { freq: 880, duration: 0.16, type: "square", gain: 0.12 });
  },
  go(c) {
    tone(c, { freq: 1320, duration: 0.45, type: "square", gain: 0.14 });
    noise(c, { duration: 0.6, type: "bandpass", freq: 1600, q: 2, gain: 0.12 });
  },
  whistle(c) {
    tone(c, { freq: 2800, endFreq: 3100, duration: 0.5, gain: 0.15 });
  },
  click(c) {
    tone(c, { freq: 520, endFreq: 380, duration: 0.07, type: "triangle", gain: 0.18 });
  },
};

export const audio = {
  play(name) {
    if (muted) return;
    const c = ensure();
    if (!c || !sounds[name]) return;
    try {
      sounds[name](c);
    } catch (err) {
      return;
    }
  },
  unlock() {
    ensure();
  },
  isMuted() {
    return muted;
  },
  setMuted(value) {
    muted = value;
    try {
      window.localStorage.setItem("spotkick.muted", value ? "1" : "0");
    } catch (err) {
      return;
    }
  },
};
