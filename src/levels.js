// Level layouts. Each definition is a pure point-cloud generator plus
// optional slope obstacles; buildLevel filters out-of-bounds, overlapping,
// slope-blocked and HARD-TO-REACH points (a peg only makes the cut if at
// least MIN_COVER distinct direct shots' simulated arcs — walls and slopes
// included — pass through it), then deals peg colors from an rng.

import { shotPath, MAX_ANGLE } from './game.js';

const PEG_R = 10;
const MIN_GAP = PEG_R * 2 + 6;
export const ORANGE_COUNT = 20;
const GREEN_COUNT = 4; // doubled: multiball is the fun button
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

// What we learned from studying the classics: curves beat straight rows,
// bricks trace the big shapes, and a little organic jitter kills the grid.

const bez = (x0, y0, cx, cy, x1, y1, n) =>
  Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    const u = 1 - t;
    return pt(u * u * x0 + 2 * u * t * cx + t * t * x1,
              u * u * y0 + 2 * u * t * cy + t * t * y1);
  });

// bricks laid tangent along an arc — Peggle's signature curve-builder
const brickArc = (cx, cy, r, a0, a1, n, len = 34) =>
  Array.from({ length: n }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / (n - 1);
    return {
      ...pt(cx + r * Math.cos(a), cy + r * Math.sin(a)),
      brick: { angle: a + Math.PI / 2, len },
    };
  });

// deterministic hash noise: same board every load, no Math.random in layout
const hashNoise = (n) => {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
};
const jitter = (pts, amt) =>
  pts.map((p, i) => ({
    ...p,
    x: p.x + (hashNoise(i * 2 + 1) - 0.5) * amt,
    y: p.y + (hashNoise(i * 2 + 2) - 0.5) * amt,
  }));

const effR = (p) => (p.brick ? p.brick.len / 2 : PEG_R);

export const LEVELS = [
  {
    name: 'Peg Sunrise',
    // sun rays fanning out, brick rim on the sun, jittered rolling hills
    points: ({ w }) => [
      ...brickArc(w / 2, 60, 105, 0.5, Math.PI - 0.5, 5),
      ...arc(w / 2, 60, 160, 0.35, Math.PI - 0.35, 12),
      ...arc(w / 2, 60, 222, 0.25, Math.PI - 0.25, 16),
      ...arc(w / 2, 60, 285, 0.18, Math.PI - 0.18, 20),
      ...jitter(wave(w, 425, 26, 2, 15), 14),
      ...jitter(wave(w, 505, 18, 2.5, 13), 14),
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
    // peg rings inside brick orbit fragments — dense target, open channels
    points: ({ w }) => [
      ...ring(w / 2, 330, 60, 8),
      ...ring(w / 2, 330, 115, 15, 0.2),
      ...ring(w / 2, 330, 170, 21, 0.45),
      ...brickArc(w / 2, 330, 228, Math.PI - 0.85, Math.PI + 0.45, 7),
      ...brickArc(w / 2, 330, 228, -0.45, 0.85, 7),
      ...jitter(bez(50, 545, 130, 500, 210, 475, 6), 10),
      ...jitter(bez(w - 50, 545, w - 130, 500, w - 210, 475, 6), 10),
    ],
    // steep corner deflectors funnel wild shots back toward the rings
    slopes: ({ w }) => [
      slope(35, 130, 130, 225),
      slope(w - 35, 130, w - 130, 225),
    ],
  },
  {
    name: 'The Cascade',
    // water spilling between the rails: everything sags, nothing is straight
    points: ({ w }) => [
      ...bez(245, 205, w / 2, 155, w - 245, 205, 7),
      ...bez(75, 300, 195, 365, 305, 290, 8),
      ...bez(w - 75, 300, w - 195, 365, w - 305, 290, 8),
      ...ring(w / 2, 300, 45, 8),
      ...bez(75, 465, w / 2, 545, w - 75, 465, 13),
      ...jitter(wave(w, 542, 4, 1, 9), 8),
      ...arc(w / 2, 430, 70, Math.PI + 0.5, 2 * Math.PI - 0.5, 7),
    ],
    // steep side rails (~47°): they guide balls inward without roofing the
    // pegs below — near-horizontal ramps made the level a pixel-hunt
    slopes: ({ w }) => [
      slope(70, 140, 185, 265),
      slope(w - 70, 140, w - 185, 265),
      slope(110, 350, 225, 475),
      slope(w - 110, 350, w - 225, 475),
    ],
  },
  {
    name: 'Fever Dream',
    points: ({ w }) => [
      ...spiral(w / 2, 330, 40, 200, 2.2, 42),
      ...arc(w / 2, 330, 245, -0.4, Math.PI + 0.4, 20),
      ...wave(w, 520, 14, 2, 12),
    ],
    // two short steep wings flanking the spiral; balls slide off them inward
    slopes: ({ w }) => [
      slope(w / 2 - 140, 150, w / 2 - 85, 205),
      slope(w / 2 + 85, 205, w / 2 + 140, 150),
    ],
  },
  {
    name: 'Venusberg',
    // organ pipes: peg columns rising toward the center
    points: ({ w }) => [
      ...line(120, 270, 120, 480, 7),
      ...line(200, 240, 200, 480, 8),
      ...line(280, 205, 280, 480, 9),
      ...line(360, 175, 360, 480, 10),
      ...line(440, 205, 440, 480, 9),
      ...line(520, 240, 520, 480, 8),
      ...line(600, 270, 600, 480, 7),
      ...wave(w, 535, 10, 2, 10),
    ],
    // steep buttresses guide wild shots back onto the pipes
    slopes: ({ w }) => [
      slope(40, 160, 115, 235),
      slope(w - 40, 160, w - 115, 235),
    ],
  },
  {
    name: "Papageno's Bells",
    // a glockenspiel: bell-plate rows shrinking with depth, gently staggered
    points: ({ w }) => [
      ...line(w / 2 - 290 + 20, 170, w / 2 + 290 + 20, 170, 15),
      ...line(w / 2 - 250 - 20, 245, w / 2 + 250 - 20, 245, 13),
      ...line(w / 2 - 210 + 20, 320, w / 2 + 210 + 20, 320, 11),
      ...line(w / 2 - 170 - 20, 395, w / 2 + 170 - 20, 395, 9),
      ...line(w / 2 - 130 + 20, 470, w / 2 + 130 + 20, 470, 7),
      ...wave(w, 535, 8, 2, 8),
    ],
    // two mallets poised above the bells
    slopes: ({ w }) => [
      slope(45, 130, 120, 205),
      slope(w - 45, 130, w - 120, 205),
    ],
  },
  {
    name: 'The Bringer of Jollity',
    // a gas giant: core, cloud band, wide rings, and four moons — no rails
    // in space
    points: ({ w }) => [
      ...ring(w / 2, 330, 55, 8),
      ...ring(w / 2, 330, 110, 14, 0.3),
      ...brickArc(w / 2, 330, 190, -0.35, 0.75, 6),
      ...brickArc(w / 2, 330, 190, Math.PI - 0.75, Math.PI + 0.35, 6),
      ...ring(120, 180, 28, 5),
      ...ring(w - 120, 180, 28, 5),
      ...ring(120, 480, 28, 5),
      ...ring(w - 120, 480, 28, 5),
    ],
    slopes: () => [],
  },
  {
    name: 'Csárdás',
    // zigzag dance steps, slow then fast — friss!
    points: ({ w }) => [
      ...line(60, 200, 240, 280, 5),
      ...line(240, 280, 420, 200, 5),
      ...line(420, 200, 600, 280, 5),
      ...line(120, 400, 300, 480, 5),
      ...line(300, 480, 480, 400, 5),
      ...line(480, 400, 660, 480, 5),
      ...wave(w, 320, 12, 3, 9, Math.PI / 3),
      ...wave(w, 545, 6, 2, 8),
    ],
    // a pair of dancers' legs, mid-kick
    slopes: ({ w }) => [
      slope(45, 300, 115, 380),
      slope(w - 45, 300, w - 115, 380),
    ],
  },
  {
    name: 'The Charge',
    // cavalry ranks sweeping downhill in curved swoops, banner overhead
    points: ({ w }) => [
      ...brickArc(w / 2, 235, 95, Math.PI + 0.55, 2 * Math.PI - 0.55, 5),
      ...bez(70, 140, 230, 330, w / 2, 310, 8),
      ...bez(w - 70, 140, w - 230, 330, w / 2, 310, 8),
      ...bez(70, 265, 230, 455, w / 2, 435, 8),
      ...bez(w - 70, 265, w - 230, 455, w / 2, 435, 8),
      ...bez(70, 390, 230, 565, w / 2, 540, 8),
      ...bez(w - 70, 390, w - 230, 565, w / 2, 540, 8),
    ],
    slopes: () => [],
  },
  {
    name: 'Swan Lake',
    // two swans neck-to-neck forming a heart over moonlit water
    points: ({ w }) => [
      ...brickArc(285, 245, 80, Math.PI * 0.85, 2 * Math.PI, 7),
      ...brickArc(435, 245, 80, Math.PI, Math.PI * 2.15, 7),
      ...bez(230, 330, 260, 400, 355, 440, 5),
      ...bez(490, 330, 460, 400, 365, 440, 5),
      ...wave(w, 495, 12, 3, 12),
      ...wave(w, 545, 5, 3, 10, 1),
      ...ring(115, 160, 30, 5),
      ...ring(605, 165, 26, 4),
    ],
    slopes: () => [], // open water
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
    const r = effR(p);
    if (p.x < 14 + r || p.x > bounds.w - 14 - r) continue;
    if (p.y < 110 || p.y > bounds.h - 90) continue;
    if (slopes.some((s) => segDist(p, s) < r + s.r + 8)) continue;
    if (kept.some((k) => Math.hypot(k.x - p.x, k.y - p.y) < effR(k) + r + 6)) continue;
    kept.push(p);
  }
  return kept;
};

// Sweep the whole aim range and keep only spots that several distinct direct
// shots pass through. One covering angle means the peg is a pixel-hunt
// behind a rail; demanding a few keeps every board honestly clearable.
const MIN_COVER = 3;
const reachableSpots = (spots, slopes, bounds) => {
  const cover = new Array(spots.length).fill(0);
  for (let a = -MAX_ANGLE; a <= MAX_ANGLE; a += 0.02) {
    const seen = new Set();
    for (const p of shotPath(bounds, slopes, a)) {
      for (let i = 0; i < spots.length; i++) {
        if (seen.has(i)) continue;
        if (Math.hypot(p.x - spots[i].x, p.y - spots[i].y) < HIT_SLACK) {
          seen.add(i);
          cover[i] += 1;
        }
      }
    }
  }
  return spots.filter((_, i) => cover[i] >= MIN_COVER);
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
  order.slice(0, ORANGE_COUNT).forEach((i) => kindOf.set(i, 'orange'));
  order.slice(ORANGE_COUNT, ORANGE_COUNT + GREEN_COUNT).forEach((i) => kindOf.set(i, 'green'));
  order.slice(ORANGE_COUNT + GREEN_COUNT, ORANGE_COUNT + GREEN_COUNT + 1).forEach((i) => kindOf.set(i, 'purple'));
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
      ...(p.brick ? { brick: p.brick } : {}),
    })),
  };
};
