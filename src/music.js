// Background music: public-domain classical pieces sequenced by hand and
// synthesized live with WebAudio — no audio files, no performance rights,
// just composers who have been dead for centuries.
//
// Notation: each track is a list of [noteName|null, beats]; null is a rest.
// beatSec sets the beat length per piece.

import { ac, toneAt } from './audio.js';

const SEMI = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
const freq = (name) => {
  const m = /^([A-G])(#|b)?(\d)$/.exec(name);
  const n = SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) - 4) * 12;
  return 440 * 2 ** (n / 12);
};

// Pachelbel — Canon in D (ground bass + first two violin entries)
const canon = {
  name: 'Canon in D',
  beatSec: 60 / 96,
  tracks: [
    {
      wave: 'triangle', gain: 0.085,
      notes: [
        ['F#5', 1], ['E5', 1], ['D5', 1], ['C#5', 1],
        ['B4', 1], ['A4', 1], ['B4', 1], ['C#5', 1],
        ['D5', 1], ['C#5', 1], ['B4', 1], ['A4', 1],
        ['G4', 1], ['F#4', 1], ['G4', 1], ['E4', 1],
        ['D4', 0.5], ['F#4', 0.5], ['A4', 0.5], ['G4', 0.5],
        ['F#4', 0.5], ['D4', 0.5], ['F#4', 0.5], ['E4', 0.5],
        ['D4', 0.5], ['B3', 0.5], ['D4', 0.5], ['A4', 0.5],
        ['G4', 0.5], ['B4', 0.5], ['A4', 0.5], ['G4', 0.5],
        ['F#4', 0.5], ['D4', 0.5], ['E4', 0.5], ['C#5', 0.5],
        ['D5', 0.5], ['F#5', 0.5], ['A5', 0.5], ['A4', 0.5],
        ['B4', 0.5], ['G4', 0.5], ['A4', 0.5], ['F#4', 0.5],
        ['D4', 0.5], ['D5', 0.5], ['D5', 0.5], ['C#5', 0.5],
      ],
    },
    {
      wave: 'sine', gain: 0.11,
      notes: [
        ['D3', 2], ['A2', 2], ['B2', 2], ['F#2', 2],
        ['G2', 2], ['D3', 2], ['G2', 2], ['A2', 2],
        ['D3', 2], ['A2', 2], ['B2', 2], ['F#2', 2],
        ['G2', 2], ['D3', 2], ['G2', 2], ['A2', 2],
      ],
    },
  ],
};

// Bach — Minuet in G major (BWV Anh. 114), first section
const minuet = {
  name: 'Minuet in G',
  beatSec: 60 / 116,
  tracks: [
    {
      wave: 'triangle', gain: 0.085,
      notes: [
        ['D5', 1], ['G4', 0.5], ['A4', 0.5], ['B4', 0.5], ['C5', 0.5],
        ['D5', 1], ['G4', 1], ['G4', 1],
        ['E5', 1], ['C5', 0.5], ['D5', 0.5], ['E5', 0.5], ['F#5', 0.5],
        ['G5', 1], ['G4', 1], ['G4', 1],
        ['C5', 1], ['D5', 0.5], ['C5', 0.5], ['B4', 0.5], ['A4', 0.5],
        ['B4', 1], ['C5', 0.5], ['B4', 0.5], ['A4', 0.5], ['G4', 0.5],
        ['F#4', 1], ['G4', 0.5], ['A4', 0.5], ['B4', 0.5], ['G4', 0.5],
        ['A4', 3],
      ],
    },
    {
      wave: 'sine', gain: 0.1,
      notes: [
        ['G2', 3], ['B2', 3], ['C3', 3], ['B2', 3],
        ['A2', 3], ['G2', 3], ['D3', 3], ['D2', 3],
      ],
    },
  ],
};

// Beethoven — Für Elise, A section
const elise = {
  name: 'Für Elise',
  beatSec: 60 / 270,
  tracks: [
    {
      wave: 'triangle', gain: 0.085,
      notes: [
        ['E5', 1], ['D#5', 1],
        ['E5', 1], ['D#5', 1], ['E5', 1], ['B4', 1], ['D5', 1], ['C5', 1],
        ['A4', 2], [null, 1], ['C4', 1], ['E4', 1], ['A4', 1],
        ['B4', 2], [null, 1], ['E4', 1], ['G#4', 1], ['B4', 1],
        ['C5', 2], [null, 1], ['E4', 1], ['E5', 1], ['D#5', 1],
        ['E5', 1], ['D#5', 1], ['E5', 1], ['B4', 1], ['D5', 1], ['C5', 1],
        ['A4', 2], [null, 1], ['C4', 1], ['E4', 1], ['A4', 1],
        ['B4', 2], [null, 1], ['E4', 1], ['C5', 1], ['B4', 1],
        ['A4', 2], [null, 2],
      ],
    },
  ],
};

export const PIECES = [canon, minuet, elise];

const compile = (piece) => {
  const events = [];
  let total = 0;
  for (const track of piece.tracks) {
    let t = 0;
    for (const [name, beats] of track.notes) {
      const dur = beats * piece.beatSec;
      if (name) {
        events.push({ t, f: freq(name), dur: dur * 0.92, wave: track.wave, gain: track.gain });
      }
      t += dur;
    }
    total = Math.max(total, t);
  }
  events.sort((a, b) => a.t - b.t);
  return { events, total };
};

let timer = null;
let muted = false;
let current = null; // { events, total, startAt, idx, pieceIdx }

const tick = () => {
  if (!current) return;
  const horizon = ac().currentTime + 0.8;
  while (current.startAt + current.events[current.idx].t < horizon) {
    const ev = current.events[current.idx];
    if (!muted) {
      toneAt(ev.f, current.startAt + ev.t, { type: ev.wave, dur: ev.dur, gain: ev.gain });
    }
    current.idx += 1;
    if (current.idx >= current.events.length) {
      current.idx = 0;
      current.startAt += current.total; // seamless loop
    }
  }
};

export const music = {
  play(pieceIdx) {
    this.stop();
    const { events, total } = compile(PIECES[pieceIdx % PIECES.length]);
    current = { events, total, startAt: ac().currentTime + 0.15, idx: 0, pieceIdx };
    timer = setInterval(tick, 200);
    tick();
  },
  stop() {
    if (timer) clearInterval(timer);
    timer = null;
    current = null;
  },
  toggleMute() {
    muted = !muted;
    return muted;
  },
};
