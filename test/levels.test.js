import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, buildLevel } from '../src/levels.js';
import { shotPath, MAX_ANGLE } from '../src/game.js';

const BOUNDS = { w: 720, h: 640 };

const segDist = (px, py, s) => {
  const abx = s.x2 - s.x1;
  const aby = s.y2 - s.y1;
  const t = Math.max(0, Math.min(1,
    ((px - s.x1) * abx + (py - s.y1) * aby) / (abx * abx + aby * aby)));
  return Math.hypot(px - (s.x1 + abx * t), py - (s.y1 + aby * t));
};

test('every level is playable', () => {
  assert.ok(LEVELS.length >= 3, 'at least three levels');
  for (const def of LEVELS) {
    const lvl = buildLevel(def, BOUNDS, () => 0.5);
    assert.ok(lvl.name.length > 0);
    const kinds = lvl.pegs.map((p) => p.kind);
    assert.equal(kinds.filter((k) => k === 'orange').length, 25, `${lvl.name}: 25 orange pegs`);
    assert.ok(kinds.filter((k) => k === 'green').length >= 1, `${lvl.name}: has a green peg`);
    assert.equal(kinds.filter((k) => k === 'purple').length, 1, `${lvl.name}: one purple peg`);
    assert.ok(lvl.pegs.length >= 34, `${lvl.name}: enough pegs (${lvl.pegs.length})`);

    // all pegs on the board, below the launcher, above the bucket
    for (const p of lvl.pegs) {
      assert.ok(p.x > p.r && p.x < BOUNDS.w - p.r, `${lvl.name}: peg in x range`);
      assert.ok(p.y > 100 && p.y < BOUNDS.h - 80, `${lvl.name}: peg in y range`);
    }
    // no two pegs overlap (a ball must be able to pass between board features)
    for (let i = 0; i < lvl.pegs.length; i++) {
      for (let j = i + 1; j < lvl.pegs.length; j++) {
        const a = lvl.pegs[i]; const b = lvl.pegs[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        assert.ok(d >= a.r + b.r + 4, `${lvl.name}: pegs ${a.id}/${b.id} too close (${d.toFixed(1)})`);
      }
    }
    // unique ids
    assert.equal(new Set(lvl.pegs.map((p) => p.id)).size, lvl.pegs.length);

    // slopes stay on the board and clear of every peg
    for (const s of lvl.slopes) {
      for (const [x, y] of [[s.x1, s.y1], [s.x2, s.y2]]) {
        assert.ok(x >= 10 && x <= BOUNDS.w - 10 && y >= 60 && y <= BOUNDS.h - 100,
          `${lvl.name}: slope endpoint on board`);
      }
      for (const p of lvl.pegs) {
        assert.ok(segDist(p.x, p.y, s) >= p.r + s.r + 6,
          `${lvl.name}: peg ${p.id} too close to a slope`);
      }
    }
  }
});

test('every peg can be hit by a direct shot', () => {
  for (const def of LEVELS) {
    const lvl = buildLevel(def, BOUNDS, () => 0.5);
    const unhit = new Map(lvl.pegs.map((p) => [p.id, p]));
    for (let a = -MAX_ANGLE; a <= MAX_ANGLE && unhit.size; a += 0.02) {
      for (const pt of shotPath(BOUNDS, lvl.slopes, a)) {
        for (const [id, p] of unhit) {
          if (Math.hypot(pt.x - p.x, pt.y - p.y) < 15) unhit.delete(id);
        }
      }
    }
    assert.equal(unhit.size, 0,
      `${lvl.name}: unreachable pegs: ${[...unhit.values()].map((p) => `${p.id}@(${p.x | 0},${p.y | 0})`).join(' ')}`);
  }
});
