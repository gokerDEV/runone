// Lightweight WebAudio sound effects — no asset files.
let ctx: AudioContext | null = null;
let muted = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const C =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function setMuted(v: boolean) {
  muted = v;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("pwm:muted", v ? "1" : "0");
    } catch {
      /* noop */
    }
  }
}
export function isMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem("pwm:muted") === "1";
  } catch {
    return muted;
  }
}

function tone(freq: number, dur: number, type: OscillatorType = "sine", gain = 0.15, delay = 0) {
  if (isMuted()) return;
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export const sfx = {
  move: () => tone(520, 0.08, "triangle", 0.12),
  opponentMove: () => tone(360, 0.08, "triangle", 0.1),
  join: () => {
    tone(523, 0.12, "sine", 0.15);
    tone(784, 0.16, "sine", 0.15, 0.1);
  },
  leave: () => {
    tone(440, 0.12, "sine", 0.12);
    tone(294, 0.18, "sine", 0.12, 0.1);
  },
  reconnect: () => {
    tone(660, 0.1, "sine", 0.13);
    tone(880, 0.12, "sine", 0.13, 0.08);
    tone(1175, 0.14, "sine", 0.14, 0.16);
  },
  disconnect: () => {
    tone(523, 0.1, "sawtooth", 0.1);
    tone(330, 0.15, "sawtooth", 0.1, 0.08);
    tone(196, 0.25, "sawtooth", 0.12, 0.18);
  },
  copy: () => {
    tone(1200, 0.05, "square", 0.08);
    tone(1600, 0.06, "square", 0.08, 0.05);
  },
  dice: () => {
    tone(180, 0.05, "square", 0.08);
    tone(240, 0.05, "square", 0.08, 0.04);
    tone(160, 0.05, "square", 0.08, 0.08);
    tone(220, 0.05, "square", 0.08, 0.12);
  },
  win: () => {
    tone(523, 0.12, "triangle", 0.15);
    tone(659, 0.12, "triangle", 0.15, 0.12);
    tone(784, 0.2, "triangle", 0.18, 0.24);
    tone(1046, 0.3, "triangle", 0.2, 0.36);
  },
  lose: () => {
    tone(392, 0.18, "sawtooth", 0.12);
    tone(311, 0.22, "sawtooth", 0.12, 0.18);
    tone(220, 0.4, "sawtooth", 0.14, 0.4);
  },
  draw: () => {
    tone(440, 0.15, "sine", 0.12);
    tone(440, 0.15, "sine", 0.12, 0.18);
  },
  notify: () => {
    tone(880, 0.08, "sine", 0.12);
    tone(1320, 0.1, "sine", 0.12, 0.08);
  },
  timeout: () => tone(180, 0.3, "square", 0.1),
};
