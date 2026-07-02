// Shell: owns the canvas, the mouse, the clock, and all the sparkle.
// All game logic lives in the pure modules; this file just orchestrates.

import { LEVELS, buildLevel } from './levels.js';
import { initGame, fireBall, stepGame, multiplier, POINTS, MAX_ANGLE } from './game.js';
import { draw } from './render.js';
import { sounds } from './audio.js';
import { music } from './music.js';

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
  trails: [],
  rings: [],
  flash: 0,
  shake: 0,
  slowmo: 0,
  transition: null, // { screen, t } — short pause before overlay screens
  levelIndex: 0,
  levelCount: LEVELS.length,
  totalScore: 0,
};
// dev nicety: ?level=N jumps straight to a level (0-based)
const startLevel = Math.min(
  LEVELS.length - 1,
  Math.max(0, Number(new URLSearchParams(location.search).get('level')) || 0),
);
ui.levelIndex = startLevel;
let game = loadLevel(startLevel);
queueMicrotask(() => updateLevelBar());

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

const ring = (x, y, color) => ui.rings.push({ x, y, r: 12, color, life: 0.45 });

const CONFETTI = ['#f87171', '#fbbf24', '#4ade80', '#60a5fa', '#c084fc', '#f472b6'];
const spawnConfetti = () => {
  for (let i = 0; i < 140; i++) {
    ui.particles.push({
      x: Math.random() * BOUNDS.w,
      y: -20 - Math.random() * 120,
      vx: (Math.random() - 0.5) * 60,
      vy: 70 + Math.random() * 110,
      size: 2.5 + Math.random() * 2.5,
      life: 2.5 + Math.random() * 2,
      color: CONFETTI[i % CONFETTI.length],
      g: 30,
      sway: Math.random() * Math.PI * 2,
    });
  }
};

let lastSlopeSound = 0;

// level-select bar under the canvas
const levelBar = document.getElementById('levels');
LEVELS.forEach((def, i) => {
  const btn = document.createElement('button');
  btn.textContent = `${i + 1} · ${def.name}`;
  btn.addEventListener('click', () => selectLevel(i));
  levelBar.appendChild(btn);
});
const updateLevelBar = () => {
  [...levelBar.children].forEach((b, i) =>
    b.classList.toggle('active', i === ui.levelIndex));
};
const selectLevel = (i) => {
  sounds.unlock();
  ui.levelIndex = i;
  game = loadLevel(i);
  ui.screen = 'play';
  ui.transition = null;
  updateLevelBar();
  startMusic(i);
};

const startMusic = (i) => {
  music.play(i);
  ui.popups.push({
    x: BOUNDS.w / 2, y: BOUNDS.h - 70,
    text: `♫ ${music.nowPlaying(i)}`,
    color: '#a5b4fc', big: false, life: 3.5,
  });
};

const currentMult = () =>
  multiplier(game.totalOranges - game.pegs.filter((p) => p.kind === 'orange' && !p.lit).length);

const handleEvents = (events) => {
  for (const ev of events) {
    if (ev.type === 'fire') sounds.fire();
    if (ev.type === 'peg') {
      sounds.peg(ev.hits, ev.kind);
      spawnSparks(ev.x, ev.y, SPARK_COLORS[ev.kind]);
      ring(ev.x, ev.y, SPARK_COLORS[ev.kind]);
      popup(ev.x, ev.y, `+${POINTS[ev.kind] * currentMult()}`, SPARK_COLORS[ev.kind]);
      if (ev.kind === 'orange') ui.shake = Math.max(ui.shake, 3);
      if (ev.hits === 8) popup(ev.x, ev.y - 34, 'NICE!', '#fef08a', true);
      if (ev.hits === 14) popup(ev.x, ev.y - 34, 'EXTREME!', '#fb923c', true);
    }
    if (ev.type === 'slope') {
      const now = performance.now();
      if (now - lastSlopeSound > 90) {
        sounds.slope();
        spawnSparks(ev.x, ev.y, '#94a3b8', 4, 110);
        lastSlopeSound = now;
      }
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
      music.stop();
      sounds.fever();
      ui.flash = 1;
      ui.slowmo = 1.6;
      ui.shake = 10;
      spawnSparks(ev.x, ev.y, '#fdba74', 60, 380);
      popup(ev.x, ev.y - 30, '+25,000', '#fef08a', true);
    }
    if (ev.type === 'resolve') {
      if (ev.phase === 'won') { sounds.win(); ui.transition = { screen: 'won', t: 1.1 }; }
      if (ev.phase === 'lost') { music.stop(); sounds.lose(); ui.transition = { screen: 'lost', t: 1.1 }; }
    }
  }
};

const updateFx = (dt) => {
  for (const p of ui.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += (p.g ?? 620) * dt;
    if (p.sway !== undefined) p.x += Math.sin(p.life * 4 + p.sway) * 40 * dt;
    p.life -= p.g !== undefined ? dt * 0.5 : dt * 1.5;
  }
  ui.particles = ui.particles.filter((p) => p.life > 0);
  for (const p of ui.popups) {
    p.y -= 42 * dt;
    p.life -= dt;
  }
  ui.popups = ui.popups.filter((p) => p.life > 0);
  for (const tr of ui.trails) tr.life -= dt * 3;
  ui.trails = ui.trails.filter((tr) => tr.life > 0);
  for (const r of ui.rings) {
    r.r += 230 * dt;
    r.life -= dt;
  }
  ui.rings = ui.rings.filter((r) => r.life > 0);
  ui.flash = Math.max(0, ui.flash - dt * 1.2);
  ui.shake = Math.max(0, ui.shake - dt * 14);
  ui.slowmo = Math.max(0, ui.slowmo - dt);
  if (ui.transition) {
    ui.transition.t -= dt;
    if (ui.transition.t <= 0) {
      ui.screen = ui.transition.screen;
      ui.transition = null;
      if (ui.screen === 'won') spawnConfetti();
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
    startMusic(ui.levelIndex);
  } else if (ui.screen === 'play' && game.phase === 'aiming') {
    game = fireBall(game, ui.aim);
    handleEvents(game.events);
  } else if (ui.screen === 'won') {
    ui.totalScore += game.score;
    if (ui.levelIndex + 1 >= ui.levelCount) {
      ui.screen = 'end';
      spawnConfetti();
    } else {
      ui.levelIndex += 1;
      game = loadLevel(ui.levelIndex);
      ui.screen = 'play';
      updateLevelBar();
      startMusic(ui.levelIndex);
    }
  } else if (ui.screen === 'lost') {
    game = loadLevel(ui.levelIndex);
    ui.screen = 'play';
    startMusic(ui.levelIndex);
  } else if (ui.screen === 'end') {
    ui.levelIndex = 0;
    ui.totalScore = 0;
    game = loadLevel(0);
    ui.screen = 'play';
    updateLevelBar();
    startMusic(0);
  }
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'm' || e.key === 'M') {
    const muted = music.toggleMute();
    ui.popups.push({
      x: BOUNDS.w / 2, y: 80, text: muted ? 'MUSIC OFF' : 'MUSIC ON',
      color: '#a5b4fc', big: false, life: 1.2,
    });
  }
});

let last = performance.now();
const frame = (t) => {
  const dt = Math.min(0.033, (t - last) / 1000);
  last = t;
  // fever moment: the world slows down, the fanfare does not
  game = stepGame(game, ui.slowmo > 0 ? dt * 0.3 : dt);
  handleEvents(game.events);
  for (const b of game.balls) {
    ui.trails.push({ x: b.pos.x, y: b.pos.y, r: b.r * 0.75, life: 1 });
  }
  updateFx(dt);
  draw(ctx, game, ui, t);
  requestAnimationFrame(frame);
};
requestAnimationFrame(frame);
