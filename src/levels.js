// Level layouts. Each definition is a pure point-cloud generator; buildLevel
// filters out-of-bounds/overlapping points and deals peg colors from an rng.

const PEG_R = 10;
const MIN_GAP = PEG_R * 2 + 6;

const pt = (x, y) => ({ x, y });

const line = (x0, y0, x1, y1, n) =>
  Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0 : i / (n - 1);
    return pt(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
  });

const arc = (cx, cy, r, a0, a1, n) =>
  Array.from({ length: n }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / (n - 1);
    return pt(cx + r * Math.cos(a), cy + r * Math.sin(a));
  });

const ring = (cx, cy, r, n, phase = 0) =>
  Array.from({ length: n }, (_, i) =>
    pt(cx + r * Math.cos(phase + (2 * Math.PI * i) / n),
       cy + r * Math.sin(phase + (2 * Math.PI * i) / n)));

const wave = (w, y, amp, cycles, n, phase = 0) =>
  Array.from({ length: n }, (_, i) => {
    const x = 40 + ((w - 80) * i) / (n - 1);
    return pt(x, y + amp * Math.sin(phase + (cycles * 2 * Math.PI * i) / (n - 1)));
  });

const spiral = (cx, cy, r0, r1, turns, n) =>
  Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    const a = turns * 2 * Math.PI * t;
    const r = r0 + (r1 - r0) * t;
    return pt(cx + r * Math.cos(a), cy + r * Math.sin(a));
  });

export const LEVELS = [
  {
    name: 'Peg Sunrise',
    points: ({ w }) => [
      ...arc(w / 2, 60, 150, 0.35, Math.PI - 0.35, 12),
      ...arc(w / 2, 60, 215, 0.25, Math.PI - 0.25, 16),
      ...arc(w / 2, 60, 280, 0.18, Math.PI - 0.18, 20),
      ...wave(w, 420, 24, 2, 16),
      ...line(80, 500, w - 80, 500, 12),
    ],
  },
  {
    name: 'Double Helix',
    points: ({ w }) => [
      ...wave(w, 190, 55, 2, 17, 0),
      ...wave(w, 190, 55, 2, 17, Math.PI),
      ...wave(w, 340, 55, 2, 17, Math.PI / 2),
      ...wave(w, 340, 55, 2, 17, (3 * Math.PI) / 2),
      ...wave(w, 490, 40, 2, 15, 0),
    ],
  },
  {
    name: 'Bullseye',
    points: ({ w }) => [
      ...ring(w / 2, 330, 60, 8),
      ...ring(w / 2, 330, 115, 15, 0.2),
      ...ring(w / 2, 330, 170, 21, 0.45),
      ...line(45, 140, 200, 220, 6),
      ...line(w - 45, 140, w - 200, 220, 6),
      ...line(45, 540, 200, 480, 6),
      ...line(w - 45, 540, w - 200, 480, 6),
    ],
  },
  {
    name: 'The Cascade',
    points: ({ w }) => [
      ...line(60, 150, w / 2 - 30, 260, 9),
      ...line(w - 60, 150, w / 2 + 30, 260, 9),
      ...line(60, 320, w / 2 - 30, 430, 9),
      ...line(w - 60, 320, w / 2 + 30, 430, 9),
      ...line(60, 490, w - 60, 490, 14),
      ...ring(w / 2, 200, 45, 6),
      ...wave(w, 545, 0, 1, 10),
    ],
  },
  {
    name: 'Fever Dream',
    points: ({ w }) => [
      ...spiral(w / 2, 330, 40, 200, 2.2, 42),
      ...arc(w / 2, 330, 245, -0.4, Math.PI + 0.4, 20),
    ],
  },
];

const dedupe = (points, bounds) => {
  const kept = [];
  for (const p of points) {
    if (p.x < 24 || p.x > bounds.w - 24) continue;
    if (p.y < 110 || p.y > bounds.h - 90) continue;
    if (kept.some((k) => Math.hypot(k.x - p.x, k.y - p.y) < MIN_GAP)) continue;
    kept.push(p);
  }
  return kept;
};

const shuffle = (arr, rng) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export const buildLevel = (def, bounds, rng = Math.random) => {
  const spots = dedupe(def.points(bounds), bounds);
  const order = shuffle(spots.map((_, i) => i), rng);
  const kindOf = new Map();
  order.slice(0, 25).forEach((i) => kindOf.set(i, 'orange'));
  order.slice(25, 27).forEach((i) => kindOf.set(i, 'green'));
  order.slice(27, 28).forEach((i) => kindOf.set(i, 'purple'));
  return {
    name: def.name,
    pegs: spots.map((p, i) => ({
      id: `p${i}`,
      x: p.x,
      y: p.y,
      r: PEG_R,
      kind: kindOf.get(i) ?? 'blue',
      lit: false,
    })),
  };
};
