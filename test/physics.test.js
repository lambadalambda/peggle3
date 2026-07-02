import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  vec, add, sub, scale, len, norm, dot, reflect,
  integrate, circleHit, resolvePegHit, collideWalls, collideSegment,
  GRAVITY, RESTITUTION,
} from '../src/physics.js';

const approx = (a, b, eps = 1e-6) =>
  assert.ok(Math.abs(a - b) < eps, `expected ${a} ≈ ${b}`);

test('vector basics', () => {
  const v = add(vec(1, 2), vec(3, 4));
  assert.deepEqual(v, { x: 4, y: 6 });
  assert.deepEqual(sub(vec(3, 4), vec(1, 1)), { x: 2, y: 3 });
  assert.deepEqual(scale(vec(1, -2), 3), { x: 3, y: -6 });
  approx(len(vec(3, 4)), 5);
  approx(dot(vec(1, 2), vec(3, 4)), 11);
  const n = norm(vec(0, 7));
  approx(n.x, 0); approx(n.y, 1);
});

test('reflect bounces a vector about a normal', () => {
  // moving straight down, floor normal points up -> moving straight up
  const r = reflect(vec(0, 5), vec(0, -1));
  approx(r.x, 0); approx(r.y, -5);
  // 45° into a wall
  const r2 = reflect(vec(1, 1), vec(-1, 0));
  approx(r2.x, -1); approx(r2.y, 1);
});

test('integrate applies gravity and moves the ball', () => {
  const ball = { pos: vec(100, 100), vel: vec(50, 0), r: 8 };
  const next = integrate(ball, 0.5);
  approx(next.vel.y, GRAVITY * 0.5);
  approx(next.pos.x, 125);
  assert.ok(next.pos.y > 100, 'ball fell');
  // input untouched (pure function)
  assert.deepEqual(ball.pos, vec(100, 100));
});

test('circleHit detects overlap only when circles touch', () => {
  const ball = { pos: vec(0, 0), vel: vec(0, 0), r: 8 };
  assert.ok(circleHit(ball, { x: 15, y: 0, r: 10 }));
  assert.ok(!circleHit(ball, { x: 19, y: 0, r: 10 }));
});

test('resolvePegHit reflects velocity with restitution and separates', () => {
  // ball moving right, peg dead ahead
  const ball = { pos: vec(0, 0), vel: vec(100, 0), r: 8 };
  const peg = { x: 15, y: 0, r: 10 };
  const out = resolvePegHit(ball, peg);
  approx(out.vel.x, -100 * RESTITUTION, 1e-3);
  approx(out.vel.y, 0, 1e-3);
  // pushed out of penetration: distance >= sum of radii
  const d = len(sub(out.pos, vec(peg.x, peg.y)));
  assert.ok(d >= ball.r + peg.r - 1e-6, `separated (d=${d})`);
});

test('resolvePegHit leaves a receding ball alone', () => {
  // overlapping but already moving away: don't re-reflect (avoids jitter traps)
  const ball = { pos: vec(0, 0), vel: vec(-100, 0), r: 8 };
  const out = resolvePegHit(ball, { x: 15, y: 0, r: 10 });
  approx(out.vel.x, -100);
});

test('collideWalls bounces off left, right and top, never bottom', () => {
  const bounds = { w: 800, h: 600 };
  const left = collideWalls({ pos: vec(-2, 300), vel: vec(-50, 0), r: 8 }, bounds);
  assert.ok(left.vel.x > 0, 'left wall reverses vx');
  assert.ok(left.pos.x >= 8);

  const right = collideWalls({ pos: vec(805, 300), vel: vec(50, 0), r: 8 }, bounds);
  assert.ok(right.vel.x < 0, 'right wall reverses vx');

  const top = collideWalls({ pos: vec(400, -3), vel: vec(0, -50), r: 8 }, bounds);
  assert.ok(top.vel.y > 0, 'ceiling reverses vy');

  const bottom = collideWalls({ pos: vec(400, 700), vel: vec(0, 50), r: 8 }, bounds);
  assert.ok(bottom.vel.y > 0, 'bottom is open — ball keeps falling');
  approx(bottom.pos.y, 700);
});

test('collideSegment bounces a falling ball off a horizontal bar', () => {
  const seg = { x1: 0, y1: 100, x2: 100, y2: 100, r: 6 };
  const out = collideSegment({ pos: vec(50, 94), vel: vec(0, 100), r: 8 }, seg);
  assert.ok(out, 'contact detected');
  assert.ok(out.bounced, 'fast impact registers as a bounce');
  approx(out.ball.vel.y, -100 * RESTITUTION, 1e-3);
  approx(out.ball.pos.y, 100 - 14, 1e-3); // pushed to surface distance
});

test('collideSegment deflects along a 45° slope', () => {
  const seg = { x1: 0, y1: 0, x2: 100, y2: 100, r: 6 };
  const out = collideSegment({ pos: vec(58, 42), vel: vec(0, 100), r: 8 }, seg);
  assert.ok(out?.bounced);
  approx(out.ball.vel.x, 78, 1e-2); // straight drop leaves moving sideways
  approx(out.ball.vel.y, 0, 1e-2);
});

test('collideSegment misses, ignores receding balls, and handles endpoints', () => {
  const seg = { x1: 0, y1: 100, x2: 100, y2: 100, r: 6 };
  assert.equal(collideSegment({ pos: vec(50, 50), vel: vec(0, 100), r: 8 }, seg), null);
  const receding = collideSegment({ pos: vec(50, 94), vel: vec(0, -100), r: 8 }, seg);
  assert.ok(receding && !receding.bounced, 'contact but no re-reflection');
  approx(receding.ball.vel.y, -100);
  const cap = collideSegment({ pos: vec(110, 94), vel: vec(-50, 50), r: 8 }, seg);
  assert.ok(cap, 'round endcap collides');
  const d = Math.hypot(cap.ball.pos.x - 100, cap.ball.pos.y - 100);
  assert.ok(d >= 14 - 1e-6, 'separated from endpoint');
});
