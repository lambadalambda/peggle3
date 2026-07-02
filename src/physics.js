// Pure 2D physics for a Peggle-style peg shooter. No mutation anywhere:
// every function takes state and returns new state.

export const GRAVITY = 900;      // px/s²
export const RESTITUTION = 0.78; // energy kept on a peg bounce

export const vec = (x, y) => ({ x, y });
export const add = (a, b) => vec(a.x + b.x, a.y + b.y);
export const sub = (a, b) => vec(a.x - b.x, a.y - b.y);
export const scale = (a, s) => vec(a.x * s, a.y * s);
export const dot = (a, b) => a.x * b.x + a.y * b.y;
export const len = (a) => Math.hypot(a.x, a.y);
export const norm = (a) => {
  const l = len(a);
  return l === 0 ? vec(0, 0) : scale(a, 1 / l);
};
export const reflect = (v, n) => sub(v, scale(n, 2 * dot(v, n)));

export const integrate = (ball, dt) => {
  const vel = vec(ball.vel.x, ball.vel.y + GRAVITY * dt);
  return { ...ball, vel, pos: add(ball.pos, scale(vel, dt)) };
};

export const circleHit = (ball, peg) => {
  const d = sub(ball.pos, vec(peg.x, peg.y));
  const rr = ball.r + peg.r;
  return dot(d, d) < rr * rr;
};

export const resolvePegHit = (ball, peg) => {
  const n = norm(sub(ball.pos, vec(peg.x, peg.y)));
  // push the ball just outside the peg so it can't tunnel or re-trigger
  const pos = add(vec(peg.x, peg.y), scale(n, ball.r + peg.r));
  // only reflect if the ball is actually moving into the peg
  const vel = dot(ball.vel, n) < 0
    ? scale(reflect(ball.vel, n), RESTITUTION)
    : ball.vel;
  return { ...ball, pos, vel };
};

// Circle vs. thick line segment (a slope/bar obstacle with round endcaps).
// Returns null on no contact, else the updated ball plus whether this was a
// real impact (fast approach) as opposed to rolling contact — callers use
// `bounced` to fire sound/vfx without spamming on every rolling substep.
const BOUNCE_SPEED = 80;
export const collideSegment = (ball, seg) => {
  const a = vec(seg.x1, seg.y1);
  const ab = sub(vec(seg.x2, seg.y2), a);
  const t = Math.max(0, Math.min(1, dot(sub(ball.pos, a), ab) / dot(ab, ab)));
  const closest = add(a, scale(ab, t));
  const d = sub(ball.pos, closest);
  const dist = len(d);
  const rr = ball.r + (seg.r ?? 6);
  if (dist >= rr) return null;
  const n = dist === 0 ? vec(0, -1) : scale(d, 1 / dist);
  const vn = dot(ball.vel, n);
  const pos = add(closest, scale(n, rr));
  const vel = vn < 0 ? scale(reflect(ball.vel, n), RESTITUTION) : ball.vel;
  return { ball: { ...ball, pos, vel }, bounced: vn < -BOUNCE_SPEED };
};

// Side walls and ceiling bounce; the bottom is open (that's where balls die).
export const collideWalls = (ball, { w }) => {
  let { x, y } = ball.pos;
  let { x: vx, y: vy } = ball.vel;
  if (x < ball.r) { x = ball.r; vx = Math.abs(vx) * RESTITUTION; }
  if (x > w - ball.r) { x = w - ball.r; vx = -Math.abs(vx) * RESTITUTION; }
  if (y < ball.r) { y = ball.r; vy = Math.abs(vy) * RESTITUTION; }
  return { ...ball, pos: vec(x, y), vel: vec(vx, vy) };
};
