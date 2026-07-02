// Canvas renderer. Reads game + ui state, draws pixels, mutates nothing.

import { previewPath, launchPos, bucketY, multiplier } from './game.js';

const PEG_COLORS = {
  blue:   { base: '#2563eb', lit: '#7db9ff', glow: '#60a5fa' },
  orange: { base: '#ea580c', lit: '#ffc07a', glow: '#fb923c' },
  green:  { base: '#16a34a', lit: '#9dfab6', glow: '#4ade80' },
  purple: { base: '#9333ea', lit: '#e2c4ff', glow: '#c084fc' },
};

const circle = (ctx, x, y, r) => {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
};

const drawBackground = (ctx, { w, h }, t) => {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#241352');
  g.addColorStop(0.55, '#1a103c');
  g.addColorStop(1, '#0c0723');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // slow-drifting stars, positions from a cheap hash so they're stable
  for (let i = 0; i < 60; i++) {
    const x = ((i * 137.51) % 1) * w + ((i * 89.7) % 13);
    const y = ((i * 71.13) % 1) * h;
    const tw = 0.35 + 0.3 * Math.sin(t / 900 + i * 1.7);
    ctx.fillStyle = `rgba(200,210,255,${tw.toFixed(3)})`;
    circle(ctx, x % w, y, i % 3 === 0 ? 1.6 : 1);
  }
};

const drawPeg = (ctx, p, t) => {
  const c = PEG_COLORS[p.kind];
  if (p.lit) {
    const pulse = 1 + 0.08 * Math.sin(t / 90);
    ctx.save();
    ctx.shadowColor = c.glow;
    ctx.shadowBlur = 18;
    ctx.fillStyle = c.lit;
    circle(ctx, p.x, p.y, p.r * pulse);
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    circle(ctx, p.x, p.y, p.r * 0.45);
  } else {
    const g = ctx.createRadialGradient(p.x - 3, p.y - 4, 1, p.x, p.y, p.r);
    g.addColorStop(0, c.glow);
    g.addColorStop(1, c.base);
    ctx.fillStyle = g;
    circle(ctx, p.x, p.y, p.r);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r - 1, 0, Math.PI * 2);
    ctx.stroke();
  }
};

const drawSlope = (ctx, s) => {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = s.r * 2;
  ctx.beginPath();
  ctx.moveTo(s.x1, s.y1);
  ctx.lineTo(s.x2, s.y2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(203,213,225,0.7)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(s.x1, s.y1 - s.r + 2);
  ctx.lineTo(s.x2, s.y2 - s.r + 2);
  ctx.stroke();
  ctx.restore();
};

const drawBall = (ctx, b) => {
  ctx.save();
  ctx.shadowColor = 'rgba(255,255,255,0.7)';
  ctx.shadowBlur = 10;
  const g = ctx.createRadialGradient(b.pos.x - 3, b.pos.y - 3, 1, b.pos.x, b.pos.y, b.r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, '#8fa3bd');
  ctx.fillStyle = g;
  circle(ctx, b.pos.x, b.pos.y, b.r);
  ctx.restore();
};

const drawLauncher = (ctx, game, aim) => {
  const { x, y } = launchPos(game.bounds);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-aim); // aim 0 = straight down; canvas rotation is cw
  ctx.fillStyle = '#4b5563';
  ctx.strokeStyle = '#9ca3af';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-9, 0, 18, 34, 5);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#374151';
  circle(ctx, x, y, 14);
  ctx.fillStyle = '#6b7280';
  circle(ctx, x, y, 9);
};

const drawGuide = (ctx, game, aim) => {
  const pts = previewPath(game, aim);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  for (let i = 4; i < pts.length; i += 4) {
    const fade = 1 - i / pts.length;
    ctx.globalAlpha = 0.15 + 0.55 * fade;
    circle(ctx, pts[i].x, pts[i].y, 2.5);
  }
  ctx.globalAlpha = 1;
};

const drawBucket = (ctx, game, t) => {
  const y = bucketY(game.bounds);
  const { x, w } = game.bucket;
  ctx.save();
  ctx.fillStyle = '#b45309';
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y - 6);
  ctx.lineTo(x + 10, y + 20);
  ctx.lineTo(x + w - 10, y + 20);
  ctx.lineTo(x + w, y - 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fde68a';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('FREE BALL', x + w / 2, y + 12);
  ctx.restore();
};

const drawHud = (ctx, game, ui) => {
  const { w } = game.bounds;
  ctx.save();
  ctx.fillStyle = 'rgba(10,6,30,0.55)';
  ctx.fillRect(0, 0, w, 34);
  ctx.font = 'bold 14px "Trebuchet MS", sans-serif';
  ctx.textBaseline = 'middle';

  ctx.textAlign = 'left';
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText(`Balls`, 12, 17);
  for (let i = 0; i < game.ballsLeft; i++) {
    ctx.fillStyle = i < 10 ? '#e2e8f0' : '#facc15';
    circle(ctx, 58 + (i % 12) * 13, 17, 4.5);
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#a5b4fc';
  ctx.fillText(`${game.levelName}  ·  ${ui.levelIndex + 1}/${ui.levelCount}`, w / 2, 17);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#fef08a';
  ctx.fillText(`${(ui.totalScore + game.score).toLocaleString('en-US')}`, w - 12, 17);
  const gone = game.totalOranges - game.pegs.filter((p) => p.kind === 'orange' && !p.lit).length;
  const mult = multiplier(gone);
  if (mult > 1) {
    ctx.fillStyle = '#fb923c';
    ctx.fillText(`×${mult}`, w - 12, 48);
  }
  const orangeLeft = game.pegs.filter((p) => p.kind === 'orange' && !p.lit).length;
  ctx.fillStyle = '#fdba74';
  ctx.textAlign = 'left';
  ctx.fillText(`◉ ${orangeLeft}`, 12, 48);
  ctx.restore();
};

const drawTrails = (ctx, trails) => {
  for (const tr of trails) {
    ctx.globalAlpha = tr.life * 0.28;
    ctx.fillStyle = '#bcd3ff';
    circle(ctx, tr.x, tr.y, tr.r * tr.life);
  }
  ctx.globalAlpha = 1;
};

const drawRings = (ctx, rings) => {
  for (const r of rings) {
    ctx.globalAlpha = Math.max(0, r.life * 2);
    ctx.strokeStyle = r.color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
};

const drawParticles = (ctx, particles) => {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    circle(ctx, p.x, p.y, p.size * Math.max(0.2, p.life));
  }
  ctx.globalAlpha = 1;
};

const drawPopups = (ctx, popups) => {
  ctx.save();
  ctx.textAlign = 'center';
  for (const p of popups) {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2));
    ctx.font = `bold ${p.big ? 26 : 14}px "Trebuchet MS", sans-serif`;
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, p.x, p.y);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
};

const overlay = (ctx, { w, h }, alpha = 0.66) => {
  ctx.fillStyle = `rgba(8,5,24,${alpha})`;
  ctx.fillRect(0, 0, w, h);
};

const bigText = (ctx, w, y, text, size, color) => {
  ctx.textAlign = 'center';
  ctx.font = `bold ${size}px "Trebuchet MS", sans-serif`;
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 24;
  ctx.fillStyle = color;
  ctx.fillText(text, w / 2, y);
  ctx.restore();
};

const drawScreens = (ctx, game, ui, t) => {
  const { w, h } = game.bounds;
  if (ui.screen === 'title') {
    overlay(ctx, game.bounds, 0.5);
    const bob = 6 * Math.sin(t / 500);
    bigText(ctx, w, h / 2 - 60 + bob, 'PEGGLE 3', 72, '#fb923c');
    bigText(ctx, w, h / 2 - 10, 'the unofficial threequel', 18, '#a5b4fc');
    bigText(ctx, w, h / 2 + 70, 'Clear all 25 orange pegs · Mouse to aim · Click to fire', 16, '#e2e8f0');
    bigText(ctx, w, h / 2 + 110, '— click to start —', 18, '#fef08a');
  } else if (ui.screen === 'won') {
    overlay(ctx, game.bounds);
    bigText(ctx, w, h / 2 - 50, 'EXTREME FEVER!', 54, '#fb923c');
    bigText(ctx, w, h / 2 + 10, `Level score: ${game.score.toLocaleString('en-US')}`, 22, '#fef08a');
    const last = ui.levelIndex >= ui.levelCount - 1;
    bigText(ctx, w, h / 2 + 60, last ? 'That was the last level…' : `Next: level ${ui.levelIndex + 2}`, 16, '#e2e8f0');
    bigText(ctx, w, h / 2 + 95, '— click to continue —', 16, '#a5b4fc');
  } else if (ui.screen === 'end') {
    overlay(ctx, game.bounds);
    bigText(ctx, w, h / 2 - 60, 'YOU BEAT PEGGLE 3', 50, '#4ade80');
    bigText(ctx, w, h / 2, `Total score: ${ui.totalScore.toLocaleString('en-US')}`, 26, '#fef08a');
    bigText(ctx, w, h / 2 + 60, '— click to play again —', 16, '#a5b4fc');
  } else if (ui.screen === 'lost') {
    overlay(ctx, game.bounds);
    bigText(ctx, w, h / 2 - 40, 'OUT OF BALLS', 50, '#f87171');
    bigText(ctx, w, h / 2 + 15, `${game.pegs.filter((p) => p.kind === 'orange').length} orange pegs survived you`, 18, '#e2e8f0');
    bigText(ctx, w, h / 2 + 60, '— click to retry —', 16, '#a5b4fc');
  }
  if (ui.flash > 0) {
    ctx.fillStyle = `rgba(255,240,180,${(ui.flash * 0.5).toFixed(3)})`;
    ctx.fillRect(0, 0, w, h);
  }
  if (game.fever && ui.screen === 'play') {
    bigText(ctx, w, 90, 'EXTREME FEVER!', 40 + 4 * Math.sin(t / 80), '#fb923c');
  }
};

export const draw = (ctx, game, ui, t) => {
  ctx.save();
  if (ui.shake > 0) {
    ctx.translate((Math.random() - 0.5) * ui.shake, (Math.random() - 0.5) * ui.shake);
  }
  drawBackground(ctx, game.bounds, t);
  drawBucket(ctx, game, t);
  for (const s of game.slopes) drawSlope(ctx, s);
  for (const p of game.pegs) drawPeg(ctx, p, t);
  if (ui.screen === 'play' && game.phase === 'aiming') drawGuide(ctx, game, ui.aim);
  drawLauncher(ctx, game, ui.aim);
  drawTrails(ctx, ui.trails);
  for (const b of game.balls) drawBall(ctx, b);
  drawRings(ctx, ui.rings);
  drawParticles(ctx, ui.particles);
  drawPopups(ctx, ui.popups);
  drawHud(ctx, game, ui);
  drawScreens(ctx, game, ui, t);
  ctx.restore();
};
