import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, buildLevel } from '../src/levels.js';

const BOUNDS = { w: 720, h: 640 };

test('every level is playable', () => {
  assert.ok(LEVELS.length >= 3, 'at least three levels');
  for (const def of LEVELS) {
    const lvl = buildLevel(def, BOUNDS, () => 0.5);
    assert.ok(lvl.name.length > 0);
    const kinds = lvl.pegs.map((p) => p.kind);
    assert.equal(kinds.filter((k) => k === 'orange').length, 25, `${lvl.name}: 25 orange pegs`);
    assert.ok(kinds.filter((k) => k === 'green').length >= 1, `${lvl.name}: has a green peg`);
    assert.equal(kinds.filter((k) => k === 'purple').length, 1, `${lvl.name}: one purple peg`);

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
  }
});
