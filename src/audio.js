// WebAudio bleeps — no asset files. The signature move: every peg hit in a
// single shot rises another semitone, just like you-know-what.

let ctx = null;
const ac = () => {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
};

const blip = (freq, { type = 'triangle', dur = 0.12, gain = 0.22, when = 0, slide = 0 } = {}) => {
  const a = ac();
  const t = a.currentTime + when;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
};

const N = { C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, C5: 523.25, E5: 659.25, G5: 783.99 };

// Ode to Joy, first phrase — Beethoven doesn't charge royalties.
const ODE = [
  [N.E4, 0.28], [N.E4, 0.28], [N.F4, 0.28], [N.G4, 0.28],
  [N.G4, 0.28], [N.F4, 0.28], [N.E4, 0.28], [N.D4, 0.28],
  [N.C4, 0.28], [N.C4, 0.28], [N.D4, 0.28], [N.E4, 0.28],
  [N.E4, 0.42], [N.D4, 0.14], [N.D4, 0.56],
];

export const sounds = {
  unlock: () => ac(),
  fire: () => blip(220, { type: 'square', dur: 0.08, gain: 0.12, slide: 240 }),
  peg: (hits, kind) => {
    const step = Math.min(hits - 1, 24);
    blip(392 * 2 ** (step / 12), { dur: 0.14, gain: 0.2 });
    if (kind === 'orange') blip(392 * 2 ** (step / 12) * 1.5, { dur: 0.1, gain: 0.08 });
  },
  dissolve: () => blip(N.C4, { type: 'sine', dur: 0.3, gain: 0.1, slide: -120 }),
  slope: () => blip(130, { type: 'triangle', dur: 0.07, gain: 0.14, slide: -50 }),
  powerup: () => { blip(N.C5, { dur: 0.1 }); blip(N.E5, { dur: 0.1, when: 0.09 }); blip(N.G5, { dur: 0.18, when: 0.18 }); },
  freeball: () => { blip(N.G4, { dur: 0.12 }); blip(N.C5, { dur: 0.25, when: 0.11 }); },
  fever: () => {
    let when = 0.15;
    for (const [f, d] of ODE) { blip(f, { type: 'triangle', dur: d * 0.95, gain: 0.25, when }); when += d; }
  },
  win: () => { [N.C4, N.E4, N.G4, N.C5, N.E5].forEach((f, i) => blip(f, { dur: 0.3, when: i * 0.09, gain: 0.2 })); },
  lose: () => { [N.E4, N.D4, N.C4].forEach((f, i) => blip(f, { type: 'sawtooth', dur: 0.35, when: i * 0.3, gain: 0.12 })); },
};
