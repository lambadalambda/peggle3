# DEVLOG — Peggle 3

## 2026-07-03 — v0.7: four more levels (10 total)

Four new music-first levels, each geometry themed to its piece:

- **Papageno's Bells** — Mozart, Zauberflöte overture (Musopen Symphony,
  PD, FLAC→MP3). Glockenspiel bell-plate rows + two mallet rails.
- **The Bringer of Jollity** — Holst, Jupiter (Skidmore College Orchestra
  via Musopen, attribution license). A gas giant: core, cloud band, ring
  arcs, four moons. No rails in space.
- **Csárdás** — Brahms, Hungarian Dance No. 1 (USAF Strolling Strings, PD).
  Zigzag dance steps.
- **The Charge** — Suppé, Light Cavalry overture (US Marine Band, PD).
  Cavalry ranks in V formation.

All four passed the geometry/reachability audits on the first run — the
constraint pipeline has fully replaced manual level QA. Level-select
buttons now show numbers only (names on hover); ten labels don't fit.

## 2026-07-03 — v0.6: Venusberg + level select

New sixth level, Venusberg: organ-pipe peg columns rising toward center,
steep buttress rails, set to Wagner's Tannhäuser overture (US Marine Band,
public domain; Commons only had OGG, transcoded to MP3 with ffmpeg for
Safari's sake). The playability test suite covered the new level with zero
extra test code — LEVELS is data, the audits loop over it.
Also added an HTML level-select bar under the canvas; clicking a level jumps
straight in (total score is kept — it's a jukebox, not a save system).

## 2026-07-03 — v0.5: floaty physics

**Playtest-confirmed: these values are final** ("you nailed it"). Don't
retune without a new complaint.

Player feedback: falls felt harsh vs. the original's lazy drift. Tuned the
four feel constants together: gravity 900 → 650 px/s², launch speed
550 → 500, restitution 0.78 → 0.82 (bounces live longer), terminal speed cap
1100 → 900 (fast falls stay soft). Tests are parameterized on the constants
so TDD didn't apply — this was tune-and-verify (one test recalibrated: the
floatier ball now reaches the wall after a slope deflection, so it asserts
the path's rightmost excursion instead of the landing spot). Side effect:
flatter arcs reach more of the board — Fever Dream grew from 40 to 52 pegs
under the same reachability filter.

Player report: The Cascade was nearly unwinnable — its near-horizontal ramps
roofed the pegs beneath, and "reachable by at least one angle" (the old
filter) still allowed pegs only hittable by a single needle-thread shot.
Two changes:

- All rails redesigned steep (~45°+), hugging the sides like pinball lane
  guides instead of spanning the board like roofs.
- The reachability filter now requires every peg spot to be crossed by at
  least MIN_COVER=3 distinct simulated shot angles, and the test asserts the
  same. "Technically possible" is no longer good enough to ship a peg.

The stronger filter immediately flagged Fever Dream's wings too (level
dropped to 21 pegs) — shrunk them to short steep accents and added a bottom
wave row. Also swapped the Ode to Joy recording (it was the English-language
van Dyke hymn arrangement, not the symphony) for Chabrier's España —
USAF Strolling Strings, public domain.

Orange pegs per level reduced 25 → 20 (player feedback: too grindy). The
multiplier ladder was keyed to absolute orange counts, so it rescaled with
the same percentages: ×2/×3/×5/×10 at 8/12/16/20 cleared (40/60/80/100%).
Orange count is now a named constant (`ORANGE_COUNT` in levels.js) and the
title screen reads it from state instead of hardcoding the number.

## 2026-07-02 — v0.2: slopes, music, reachability

Round of player feedback (all five points):

1. **Unreachable pegs** — some high side pegs couldn't be hit by any direct
   shot (gravity: a near-horizontal shot still drops ~150px crossing the
   board). Fixed by construction, not tuning: `buildLevel` now sweeps the
   whole aim range with the real physics (`shotPath`, walls and slopes
   included) and drops any peg spot no arc passes through. A test asserts
   the property for every peg of every level.
2. **Music** — first sequenced Bach/Beethoven/Pachelbel by hand in WebAudio;
   user preferred real recordings, so switched to five MP3s from Wikimedia
   Commons with verified licenses (3 public domain — US military band
   performances; 2 CC BY 3.0 Kevin MacLeod). Attribution in CREDITS.md.
   The hand-sequenced version lives on in git history (`git log -- src/music.js`).
3. **Bucket** widened 90 → 130px.
4. **Slopes** — thick line-segment obstacles with round endcaps
   (circle-vs-segment collision in the physics core, TDD'd). Bullseye got
   corner deflectors, The Cascade got four pachinko ramps, Fever Dream got
   a split roof. Plus effects: ball trails, hit shockwave rings, screen
   shake, fever slow-mo (0.3× world speed while the fanfare plays), confetti.
   Gotcha: Fever Dream's first roof design shadowed the spiral core and the
   reachability filter culled the level to 23 pegs — a solid roof became two
   wings with a gap. The filter caught a level-design bug before any human did.
5. **Multiball economy** — a green-peg twin now increments ballsLeft the
   moment it spawns (it "counts for your balls left").

Slope V-pockets would re-introduce stuck balls (the stuck-ball rule only
dissolves *pegs*), so level slopes must never form closed funnels narrower
than a ball — current designs all shed balls off an open end.

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
