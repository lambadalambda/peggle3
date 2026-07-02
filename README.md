# Peggle 3

*The unofficial threequel.* A Peggle-style peg shooter for the browser —
vanilla JS, canvas, WebAudio, zero dependencies, no build step.

## Play

```sh
npm run serve        # then open http://localhost:8377
```

(Any static file server works; ESM modules just need `http://`, not `file://`.)

- **Mouse** aims, **click** fires. You get 10 balls per level.
- **Orange pegs (25)** — clear them all to win the level.
- **Blue pegs** — points. **Purple peg** — 500 points, hops to a new peg
  every shot. **Green pegs** — MULTIBALL.
- The moving **bucket** at the bottom catches balls and gives them back.
- Clearing oranges ramps your score multiplier up to ×10; the last one
  triggers **EXTREME FEVER** (+25,000).

## Test

```sh
npm test             # node:test over the pure core — physics, rules, levels
```

The physics, game rules, and level generation are pure functions shared
between Node and the browser; the canvas/audio shell is the only untested
part. See `DEVLOG.md` for design notes.
