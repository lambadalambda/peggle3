// Level layouts. Each definition is a pure point-cloud generator plus
// optional slope obstacles; buildLevel filters out-of-bounds, overlapping,
// slope-blocked and UNREACHABLE points (a peg only makes the cut if some
// direct shot's simulated arc — walls and slopes included — passes through
// it), then deals peg colors from an rng.

import { shotPath, MAX_ANGLE } from './game.js';

const PEG_R = 10;
const MIN_GAP = PEG_R * 2 + 6;
const HIT_SLACK = 15; // a path point this close to a spot proves it hittable

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

const slope = (x1, y1, x2, y2) => ({ x1, y1, x2, y2, r: 6 });

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
    slopes: () => [],
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
    slopes: () => [],
  },
  {
    name: 'Bullseye',
    points: ({ w }) => [
      ...ring(w / 2, 330, 60, 8),
      ...ring(w / 2, 330, 115, 15, 0.2),
      ...ring(w / 2, 330, 170, 21, 0.45),
      ...line(45, 540, 200, 480, 6),
      ...line(w - 45, 540, w - 200, 480, 6),
      ...line(60, 300, 130, 260, 4),
      ...line(w - 60, 300, w - 130, 260, 4),
    ],
    // corner deflectors funnel wild shots back toward the rings
    slopes: ({ w }) => [
      slope(30, 140, 150, 200),
      slope(w - 30, 140, w - 150, 200),
    ],
  },
  {
    name: 'The Cascade',
    points: ({ w }) => [
      ...line(70, 285, 300, 285, 9),
      ...line(w - 70, 285, w - 300, 285, 9),
      ...ring(w / 2, 300, 45, 8),
      ...line(70, 475, w - 70, 475, 14),
      ...wave(w, 540, 0, 1, 11),
      ...arc(w / 2, 430, 70, Math.PI + 0.5, 2 * Math.PI - 0.5, 7),
    ],
    // staggered ramps: balls rattle down them pachinko-style
    slopes: ({ w }) => [
      slope(40, 170, 300, 235),
      slope(w - 40, 170, w - 300, 235),
      slope(40, 360, 260, 425),
      slope(w - 40, 360, w - 260, 425),
    ],
  },
  {
    name: 'Fever Dream',
    points: ({ w }) => [
      ...spiral(w / 2, 330, 40, 200, 2.2, 42),
      ...arc(w / 2, 330, 245, -0.4, Math.PI + 0.4, 20),
    ],
    // two roof wings over the spiral with a gap to thread the needle
    slopes: ({ w }) => [
      slope(w / 2 - 130, 190, w / 2 - 40, 152),
      slope(w / 2 + 40, 152, w / 2 + 130, 190),
    ],
  },
];

const segDist = (p, s) => {
  const abx = s.x2 - s.x1;
  const aby = s.y2 - s.y1;
  const t = Math.max(0, Math.min(1,
    ((p.x - s.x1) * abx + (p.y - s.y1) * aby) / (abx * abx + aby * aby)));
  return Math.hypot(p.x - (s.x1 + abx * t), p.y - (s.y1 + aby * t));
};

const dedupe = (points, slopes, bounds) => {
  const kept = [];
  for (const p of points) {
    if (p.x < 24 || p.x > bounds.w - 24) continue;
    if (p.y < 110 || p.y > bounds.h - 90) continue;
    if (slopes.some((s) => segDist(p, s) < PEG_R + s.r + 8)) continue;
    if (kept.some((k) => Math.hypot(k.x - p.x, k.y - p.y) < MIN_GAP)) continue;
    kept.push(p);
  }
  return kept;
};

// Sweep the whole aim range; keep only spots some direct shot passes through.
const reachableSpots = (spots, slopes, bounds) => {
  const hit = new Array(spots.length).fill(false);
  let remaining = spots.length;
  for (let a = -MAX_ANGLE; a <= MAX_ANGLE && remaining > 0; a += 0.02) {
    for (const p of shotPath(bounds, slopes, a)) {
      for (let i = 0; i < spots.length; i++) {
        if (hit[i]) continue;
        if (Math.hypot(p.x - spots[i].x, p.y - spots[i].y) < HIT_SLACK) {
          hit[i] = true;
          remaining -= 1;
        }
      }
    }
  }
  return spots.filter((_, i) => hit[i]);
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
  const slopes = def.slopes ? def.slopes(bounds) : [];
  const spots = reachableSpots(dedupe(def.points(bounds), slopes, bounds), slopes, bounds);
  const order = shuffle(spots.map((_, i) => i), rng);
  const kindOf = new Map();
  order.slice(0, 25).forEach((i) => kindOf.set(i, 'orange'));
  order.slice(25, 27).forEach((i) => kindOf.set(i, 'green'));
  order.slice(27, 28).forEach((i) => kindOf.set(i, 'purple'));
  return {
    name: def.name,
    slopes,
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
