import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  initGame, fireBall, stepGame, multiplier, assignPurple, previewPath,
  BALL_SPEED, POINTS,
} from '../src/game.js';

// Tiny hand-built levels so shots are deterministic. The launcher sits at
// top-center; angle 0 fires straight down.
const BOUNDS = { w: 720, h: 640 };
const peg = (x, y, kind, id) => ({ id, x, y, r: 10, kind, lit: false });
const level = (pegs) => ({ name: 'test', pegs });

// Park the bucket in the corner, frozen, so it never rescues a ball.
const noBucket = (s) => ({ ...s, bucket: { ...s.bucket, x: 0, speed: 0 } });

const runShot = (state, angle, maxSteps = 3000) => {
  let s = fireBall(state, angle);
  const seen = [];
  for (let i = 0; i < maxSteps && s.phase === 'flight'; i++) {
    s = stepGame(s, 1 / 60);
    seen.push(...s.events);
  }
  assert.notEqual(s.phase, 'flight', 'shot resolved within step budget');
  return { state: s, events: seen };
};

test('initGame sets up a fresh state', () => {
  const s = initGame(level([peg(360, 300, 'orange', 'p1')]), { bounds: BOUNDS });
  assert.equal(s.phase, 'aiming');
  assert.equal(s.ballsLeft, 10);
  assert.equal(s.score, 0);
  assert.equal(s.pegs.length, 1);
  assert.equal(s.balls.length, 0);
});

test('fireBall spends a ball and launches at full speed', () => {
  const s0 = initGame(level([peg(100, 500, 'blue', 'p1')]), { bounds: BOUNDS });
  const s = fireBall(s0, 0.3);
  assert.equal(s.phase, 'flight');
  assert.equal(s.ballsLeft, 9);
  assert.equal(s.balls.length, 1);
  const speed = Math.hypot(s.balls[0].vel.x, s.balls[0].vel.y);
  assert.ok(Math.abs(speed - BALL_SPEED) < 1e-6);
  assert.ok(s.balls[0].vel.y > 0, 'launched downward');
});

test('firing while a ball is in flight is a no-op', () => {
  const s0 = initGame(level([]), { bounds: BOUNDS });
  const s1 = fireBall(s0, 0);
  const s2 = fireBall(s1, 0.5);
  assert.equal(s2.ballsLeft, s1.ballsLeft);
  assert.equal(s2.balls.length, 1);
});

test('a peg in the path gets lit and scores; lit pegs vanish on resolve', () => {
  const pegs = [peg(360, 300, 'blue', 'hitme'), peg(60, 300, 'orange', 'faraway')];
  const s0 = noBucket(initGame(level(pegs), { bounds: BOUNDS }));
  const { state, events } = runShot(s0, 0); // straight down onto 'hitme'
  assert.ok(events.some((e) => e.type === 'peg' && e.kind === 'blue'));
  assert.equal(state.score, POINTS.blue * 1);
  assert.ok(!state.pegs.some((p) => p.id === 'hitme'), 'lit peg removed');
  assert.ok(state.pegs.some((p) => p.id === 'faraway'), 'unhit peg stays');
  assert.equal(state.phase, 'aiming');
});

test('lighting the last orange peg triggers fever and wins the level', () => {
  const s0 = noBucket(initGame(level([peg(360, 300, 'orange', 'last')]), { bounds: BOUNDS }));
  const { state, events } = runShot(s0, 0);
  assert.ok(events.some((e) => e.type === 'fever'));
  assert.equal(state.phase, 'won');
  assert.ok(state.score >= POINTS.orange + 25000, 'fever bonus granted');
});

test('missing everything with the last ball loses the game', () => {
  const s0 = noBucket(initGame(level([peg(60, 300, 'orange', 'p1')]), { bounds: BOUNDS, ballsLeft: 1 }));
  const { state } = runShot(s0, 0); // straight down, peg is far left
  assert.equal(state.phase, 'lost');
});

test('the bucket catches a straight drop and refunds the ball', () => {
  const s0 = initGame(level([]), { bounds: BOUNDS });
  // freeze the bucket directly under the launcher
  const s1 = { ...s0, bucket: { ...s0.bucket, x: BOUNDS.w / 2 - s0.bucket.w / 2, speed: 0 } };
  const { state, events } = runShot(s1, 0);
  assert.ok(events.some((e) => e.type === 'freeball'));
  assert.equal(state.ballsLeft, 10, 'fired one, caught one');
});

test('green peg spawns a second ball (multiball)', () => {
  const s0 = noBucket(initGame(level([peg(360, 300, 'green', 'g1')]), { bounds: BOUNDS }));
  let s = fireBall(s0, 0);
  let sawTwo = false;
  for (let i = 0; i < 3000 && s.phase === 'flight'; i++) {
    s = stepGame(s, 1 / 60);
    if (s.balls.length === 2) sawTwo = true;
  }
  assert.ok(sawTwo, 'two balls were in flight at once');
});

test('score multiplier ramps with cleared oranges', () => {
  assert.equal(multiplier(0), 1);
  assert.equal(multiplier(9), 1);
  assert.equal(multiplier(10), 2);
  assert.equal(multiplier(15), 3);
  assert.equal(multiplier(20), 5);
  assert.equal(multiplier(25), 10);
});

test('assignPurple promotes one unlit blue peg and demotes the old purple', () => {
  const pegs = [
    peg(0, 0, 'purple', 'a'),
    peg(0, 0, 'blue', 'b'),
    peg(0, 0, 'blue', 'c'),
  ];
  const out = assignPurple(pegs, () => 0.99); // rng → last candidate
  assert.equal(out.filter((p) => p.kind === 'purple').length, 1);
  assert.equal(out.find((p) => p.id === 'a').kind, 'blue');
  assert.equal(out.find((p) => p.id === 'c').kind, 'purple');
});

test('previewPath yields a sane arc from the launcher', () => {
  const s = initGame(level([]), { bounds: BOUNDS });
  const pts = previewPath(s, 0.4);
  assert.ok(pts.length > 5);
  assert.ok(pts.every((p) => p.x >= 0 && p.x <= BOUNDS.w));
  assert.ok(pts[0].y < 60, 'starts near the launcher');
});

test('a ball cradled between lit pegs dissolves them and resolves (stuck-ball rule)', () => {
  // two pegs 26px apart: the 16px ball cannot fall between them
  const pegs = [
    peg(348, 300, 'blue', 'l'), peg(374, 300, 'blue', 'r'),
    peg(60, 200, 'orange', 'far'),
  ];
  const s0 = noBucket(initGame(level(pegs), { bounds: BOUNDS, rng: () => 0.5 }));
  // drop a dead ball straight into the cradle
  let s = {
    ...s0,
    phase: 'flight',
    ballsLeft: s0.ballsLeft - 1,
    balls: [{ pos: { x: 361, y: 282 }, vel: { x: 0, y: 0 }, r: 8, slow: 0 }],
  };
  for (let i = 0; i < 3000 && s.phase === 'flight'; i++) s = stepGame(s, 1 / 60);
  assert.notEqual(s.phase, 'flight', 'stuck ball was freed and the shot resolved');
  assert.ok(!s.pegs.some((p) => p.id === 'l' || p.id === 'r'), 'cradle pegs dissolved');
});
