// Shell: owns the canvas, the mouse, the clock, and all the sparkle.
// All game logic lives in the pure modules; this file just orchestrates.

import { LEVELS, buildLevel } from './levels.js';
import { initGame, fireBall, stepGame, multiplier, POINTS, MAX_ANGLE } from './game.js';
import { draw } from './render.js';
import { sounds } from './audio.js';

const BOUNDS = { w: 720, h: 640 };
const SPARK_COLORS = { blue: '#93c5fd', orange: '#fdba74', green: '#86efac', purple: '#d8b4fe' };

const canvas = document.getElementById('game');
const dpr = window.devicePixelRatio || 1;
canvas.width = BOUNDS.w * dpr;
canvas.height = BOUNDS.h * dpr;
canvas.style.width = `${BOUNDS.w}px`;
canvas.style.height = `${BOUNDS.h}px`;
const ctx = canvas.getContext('2d');
ctx.scale(dpr, dpr);

const loadLevel = (i) => initGame(buildLevel(LEVELS[i], BOUNDS), { bounds: BOUNDS });

const ui = {
  screen: 'title', // title | play | won | lost | end
  aim: 0,
  particles: [],
  popups: [],
  flash: 0,
  transition: null, // { screen, t } — short pause before overlay screens
  levelIndex: 0,
  levelCount: LEVELS.length,
  totalScore: 0,
};
let game = loadLevel(0);

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const spawnSparks = (x, y, color, n = 12, speed = 190) => {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.4 + Math.random() * 0.6);
    ui.particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - 60,
      size: 2 + Math.random() * 2.5,
      life: 1,
      color,
    });
  }
};

const popup = (x, y, text, color, big = false) =>
  ui.popups.push({ x, y: y - 14, text, color, big, life: 1.2 });

const currentMult = () =>
  multiplier(game.totalOranges - game.pegs.filter((p) => p.kind === 'orange' && !p.lit).length);

const handleEvents = (events) => {
  for (const ev of events) {
    if (ev.type === 'fire') sounds.fire();
    if (ev.type === 'peg') {
      sounds.peg(ev.hits, ev.kind);
      spawnSparks(ev.x, ev.y, SPARK_COLORS[ev.kind]);
      popup(ev.x, ev.y, `+${POINTS[ev.kind] * currentMult()}`, SPARK_COLORS[ev.kind]);
    }
    if (ev.type === 'powerup') {
      sounds.powerup();
      spawnSparks(ev.x, ev.y, '#86efac', 26, 260);
      popup(ev.x, ev.y - 20, 'MULTIBALL!', '#86efac', true);
    }
    if (ev.type === 'freeball') {
      sounds.freeball();
      spawnSparks(ev.x, ev.y, '#fde68a', 20, 220);
      popup(ev.x, ev.y - 30, 'FREE BALL!', '#fde68a', true);
    }
    if (ev.type === 'dissolve') {
      sounds.dissolve();
      spawnSparks(ev.x, ev.y, '#cbd5e1', 16, 150);
    }
    if (ev.type === 'fever') {
      sounds.fever();
      ui.flash = 1;
      spawnSparks(ev.x, ev.y, '#fdba74', 60, 380);
      popup(ev.x, ev.y - 30, '+25,000', '#fef08a', true);
    }
    if (ev.type === 'resolve') {
      if (ev.phase === 'won') { sounds.win(); ui.transition = { screen: 'won', t: 1.1 }; }
      if (ev.phase === 'lost') { sounds.lose(); ui.transition = { screen: 'lost', t: 1.1 }; }
    }
  }
};

const updateFx = (dt) => {
  for (const p of ui.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 620 * dt;
    p.life -= dt * 1.5;
  }
  ui.particles = ui.particles.filter((p) => p.life > 0);
  for (const p of ui.popups) {
    p.y -= 42 * dt;
    p.life -= dt;
  }
  ui.popups = ui.popups.filter((p) => p.life > 0);
  ui.flash = Math.max(0, ui.flash - dt * 1.2);
  if (ui.transition) {
    ui.transition.t -= dt;
    if (ui.transition.t <= 0) {
      ui.screen = ui.transition.screen;
      ui.transition = null;
    }
  }
};

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = ((e.clientX - rect.left) / rect.width) * BOUNDS.w;
  const my = ((e.clientY - rect.top) / rect.height) * BOUNDS.h;
  ui.aim = clamp(Math.atan2(mx - BOUNDS.w / 2, my - 24), -MAX_ANGLE, MAX_ANGLE);
});

canvas.addEventListener('click', () => {
  sounds.unlock();
  if (ui.screen === 'title') {
    ui.screen = 'play';
  } else if (ui.screen === 'play' && game.phase === 'aiming') {
    game = fireBall(game, ui.aim);
    handleEvents(game.events);
  } else if (ui.screen === 'won') {
    ui.totalScore += game.score;
    if (ui.levelIndex + 1 >= ui.levelCount) {
      ui.screen = 'end';
    } else {
      ui.levelIndex += 1;
      game = loadLevel(ui.levelIndex);
      ui.screen = 'play';
    }
  } else if (ui.screen === 'lost') {
    game = loadLevel(ui.levelIndex);
    ui.screen = 'play';
  } else if (ui.screen === 'end') {
    ui.levelIndex = 0;
    ui.totalScore = 0;
    game = loadLevel(0);
    ui.screen = 'play';
  }
});

let last = performance.now();
const frame = (t) => {
  const dt = Math.min(0.033, (t - last) / 1000);
  last = t;
  game = stepGame(game, dt);
  handleEvents(game.events);
  updateFx(dt);
  draw(ctx, game, ui, t);
  requestAnimationFrame(frame);
};
requestAnimationFrame(frame);
