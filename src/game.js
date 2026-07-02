// Game rules for Peggle 3. Pure state-in/state-out: the shell calls
// fireBall/stepGame and reads state.events for sound & sparkle cues.

import {
  vec, add, scale, len, integrate, circleHit, resolvePegHit, collideWalls,
} from './physics.js';

export const BALL_R = 8;
export const BALL_SPEED = 550;
export const POINTS = { blue: 25, orange: 100, green: 100, purple: 500 };
export const FEVER_BONUS = 25000;
export const MAX_ANGLE = 1.45; // radians either side of straight down

const LAUNCH_Y = 24;
const SUBSTEP = 1 / 240;
const MAX_SPEED = 1100;
const BUCKET = { w: 90, speed: 150, lip: 8 };

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const launchPos = (bounds) => vec(bounds.w / 2, LAUNCH_Y);
export const bucketY = (bounds) => bounds.h - 26;

export const multiplier = (orangesGone) =>
  orangesGone >= 25 ? 10 :
  orangesGone >= 20 ? 5 :
  orangesGone >= 15 ? 3 :
  orangesGone >= 10 ? 2 : 1;

// Purple is restless: each turn it hops to a random unlit blue peg.
export const assignPurple = (pegs, rng = Math.random) => {
  const demoted = pegs.map((p) => (p.kind === 'purple' ? { ...p, kind: 'blue' } : p));
  const pool = demoted.filter((p) => p.kind === 'blue' && !p.lit);
  if (pool.length === 0) return demoted;
  const pick = pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
  return demoted.map((p) => (p.id === pick.id ? { ...p, kind: 'purple' } : p));
};

export const initGame = (level, { bounds, ballsLeft = 10, rng = Math.random } = {}) => ({
  levelName: level.name,
  pegs: level.pegs.map((p) => ({ ...p, lit: false })),
  totalOranges: level.pegs.filter((p) => p.kind === 'orange').length,
  balls: [],
  ballsLeft,
  score: 0,
  phase: 'aiming', // aiming | flight | won | lost
  fever: false,
  shotHits: 0,
  bounds,
  bucket: { x: bounds.w / 2 - BUCKET.w / 2, w: BUCKET.w, speed: BUCKET.speed, dir: 1 },
  rng,
  events: [],
});

const aimDir = (angle) => {
  const a = clamp(angle, -MAX_ANGLE, MAX_ANGLE);
  return vec(Math.sin(a), Math.cos(a));
};

export const fireBall = (state, angle) => {
  if (state.phase !== 'aiming' || state.ballsLeft <= 0) return state;
  const ball = {
    pos: launchPos(state.bounds),
    vel: scale(aimDir(angle), BALL_SPEED),
    r: BALL_R,
    slow: 0,
  };
  return {
    ...state,
    phase: 'flight',
    ballsLeft: state.ballsLeft - 1,
    balls: [ball],
    shotHits: 0,
    events: [{ type: 'fire' }],
  };
};

const moveBucket = (bucket, bounds, dt) => {
  let x = bucket.x + bucket.dir * bucket.speed * dt;
  let dir = bucket.dir;
  if (x < 0) { x = 0; dir = 1; }
  if (x > bounds.w - bucket.w) { x = bounds.w - bucket.w; dir = -1; }
  return { ...bucket, x, dir };
};

const clampSpeed = (ball) => {
  const s = len(ball.vel);
  return s > MAX_SPEED ? { ...ball, vel: scale(ball.vel, MAX_SPEED / s) } : ball;
};

// Nudge a ball that's balanced dead-center on a peg so shots always resolve.
const antiStall = (ball, h, rng) => {
  const slow = len(ball.vel) < 50 ? (ball.slow ?? 0) + h : 0;
  if (slow < 1.2) return { ...ball, slow };
  return {
    ...ball,
    slow: 0,
    vel: add(ball.vel, vec((rng() - 0.5) * 160, -60)),
  };
};

const orangesGone = (s) =>
  s.totalOranges - s.pegs.filter((p) => p.kind === 'orange' && !p.lit).length;

const nearestHitPeg = (ball, pegs) => {
  let best = null;
  let bestD = Infinity;
  for (const p of pegs) {
    if (!circleHit(ball, p)) continue;
    const d = len(vec(ball.pos.x - p.x, ball.pos.y - p.y));
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
};

const lightPeg = (s, peg, ball) => {
  const mult = multiplier(orangesGone(s));
  const pegs = s.pegs.map((p) => (p.id === peg.id ? { ...p, lit: true } : p));
  const shotHits = s.shotHits + 1;
  const events = [...s.events, { type: 'peg', kind: peg.kind, hits: shotHits, x: peg.x, y: peg.y }];
  let score = s.score + POINTS[peg.kind] * mult;
  let fever = s.fever;
  let balls = s.balls;

  if (peg.kind === 'green') {
    // Multiball! A twin appears, veering the other way.
    const twin = {
      pos: ball.pos,
      vel: vec(ball.vel.x !== 0 ? -ball.vel.x : 90, ball.vel.y),
      r: BALL_R,
      slow: 0,
    };
    balls = [...balls, twin];
    events.push({ type: 'powerup', x: peg.x, y: peg.y });
  }
  if (!fever && peg.kind === 'orange' && !pegs.some((p) => p.kind === 'orange' && !p.lit)) {
    fever = true;
    score += FEVER_BONUS;
    events.push({ type: 'fever', x: peg.x, y: peg.y });
  }
  return { ...s, pegs, score, fever, shotHits, balls, events };
};

const inBucket = (ball, bucket, bounds) => {
  const y = bucketY(bounds);
  return ball.vel.y > 0 &&
    ball.pos.y > y - 6 && ball.pos.y < y + 14 &&
    ball.pos.x > bucket.x + BUCKET.lip &&
    ball.pos.x < bucket.x + bucket.w - BUCKET.lip;
};

const resolveShot = (s) => {
  const pegs = assignPurple(s.pegs.filter((p) => !p.lit), s.rng);
  const noOrange = !pegs.some((p) => p.kind === 'orange');
  const phase = noOrange ? 'won' : s.ballsLeft <= 0 ? 'lost' : 'aiming';
  return { ...s, pegs, phase, events: [...s.events, { type: 'resolve', phase }] };
};

const substep = (s0, h) => {
  let s = { ...s0, bucket: moveBucket(s0.bucket, s0.bounds, h) };
  const survivors = [];
  // s.balls can grow mid-loop (multiball), so iterate by index over a queue.
  const queue = [...s.balls];
  for (let i = 0; i < queue.length; i++) {
    let ball = clampSpeed(collideWalls(integrate(queue[i], h), s.bounds));
    const peg = nearestHitPeg(ball, s.pegs);
    if (peg) {
      ball = resolvePegHit(ball, peg);
      if (!peg.lit) {
        const ballsBefore = s.balls.length;
        s = lightPeg(s, peg, ball);
        // a green peg appended a twin to s.balls; move it onto our queue
        for (const extra of s.balls.slice(ballsBefore)) queue.push(extra);
      }
    }
    ball = antiStall(ball, h, s.rng);
    if (inBucket(ball, s.bucket, s.bounds)) {
      s = {
        ...s,
        ballsLeft: s.ballsLeft + 1,
        events: [...s.events, { type: 'freeball', x: ball.pos.x, y: ball.pos.y }],
      };
      continue; // caught: ball leaves play
    }
    if (ball.pos.y - ball.r > s.bounds.h + 20) continue; // fell out
    survivors.push(ball);
  }
  s = { ...s, balls: survivors };
  return survivors.length === 0 ? resolveShot(s) : s;
};

export const stepGame = (state, dt) => {
  if (state.phase !== 'flight') {
    return { ...state, events: [], bucket: moveBucket(state.bucket, state.bounds, dt) };
  }
  let s = { ...state, events: [] };
  const n = Math.max(1, Math.ceil(dt / SUBSTEP));
  for (let i = 0; i < n && s.phase === 'flight'; i++) s = substep(s, dt / n);
  return s;
};

// Aim guide: the arc a shot would take, cut off at the first peg it would hit.
export const previewPath = (state, angle) => {
  let ball = { pos: launchPos(state.bounds), vel: scale(aimDir(angle), BALL_SPEED), r: BALL_R };
  const pts = [ball.pos];
  for (let i = 0; i < 120; i++) {
    ball = collideWalls(integrate(ball, 1 / 120), state.bounds);
    pts.push(ball.pos);
    if (state.pegs.some((p) => !p.lit && circleHit(ball, p))) break;
    if (ball.pos.y > state.bounds.h) break;
  }
  return pts;
};
