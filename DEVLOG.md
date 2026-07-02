# DEVLOG — Peggle 3

## 2026-07-02 — v0.1: the whole game

Built a Peggle-style peg shooter from scratch: vanilla JS + Canvas, zero
dependencies, ESM modules shared verbatim between Node (tests) and browser.

### Architecture

- `src/physics.js` — pure vectors, gravity integration, circle collision,
  wall bounces. No mutation anywhere.
- `src/game.js` — pure rules: firing, peg lighting, scoring/multipliers,
  fever, free-ball bucket, multiball, purple-peg hopping, win/lose. State-in,
  state-out; emits an `events` list each step that the shell turns into
  sound and particles.
- `src/levels.js` — parametric point-cloud generators (arcs, rings, waves,
  spiral) → dedupe/bounds filter → deal 25 orange / 2 green / 1 purple.
- `src/render.js`, `src/audio.js`, `src/main.js` — the untestable shell:
  canvas drawing, WebAudio bleeps, input, VFX. **TDD skipped here by design**
  (no DOM/AudioContext in node:test); everything decision-shaped lives in the
  pure modules instead, and the shell was verified by playing it in a real
  browser via agent-browser.

### Process

TDD (red → green) for physics, game rules, and levels: 20 tests, including a
geometry audit that every level has exactly 25 orange pegs, no overlapping
pegs, and everything inside the playfield.

### Findings

- **Node 26 quirk:** `node --test test/` (directory argument) fails with an
  opaque `'test failed'`; the glob form `node --test 'test/*.test.js'` works.
- **Stuck-ball bug, caught by browser verification, not unit tests:** level
  generators guarantee ≥26px between peg centers, i.e. as little as 6px
  between peg *surfaces* — a 16px ball can wedge into the V between two pegs
  with no geometric escape. A velocity nudge can't fix that. Implemented the
  actual Peggle rule: pegs a stalled ball rests on are necessarily already
  lit (contact lights them), so they dissolve after ~1.2s and the ball drops
  through. Regression test added (red first, then green).
- The iconic rising-semitone peg sound is just
  `440 × 2^(hits/12)` on a triangle oscillator. Fever plays Ode to Joy,
  which remains gloriously public domain.

### Scoring model (differs from PopCap's exact numbers, same shape)

blue 25 · orange 100 · green 100 · purple 500; multiplier ×1/×2/×3/×5/×10 at
0/10/15/20/25 cleared oranges; fever bonus 25,000; bucket catch refunds the
ball. 10 balls per level, 5 levels.
