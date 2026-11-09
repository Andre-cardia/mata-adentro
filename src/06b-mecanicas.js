// ============================================================ v2: mecânicas das fases novas (plataformas, zonas, tirolesa e perigos)
// Tudo aqui só age quando as listas do nível têm algo; a fase 1 roda exatamente como na v1.

// ---------------------------------------------------------- ciclos ligados ao relógio do jogo
const cyc = (t, per, phase = 0) => ((((t + phase) % per) + per) % per);
function tideLevel(z, t) { // y da superfície da água (maior = mais baixa)
  const k = 0.5 - 0.5 * Math.cos(2 * Math.PI * cyc(t, z.period, z.phase) / z.period);
  return lerp(z.low, z.high, k);
}
function tideRising(z, t) { return cyc(t, z.period, z.phase) < z.period / 2; }
function rockPositions(r, t) {
  const span = r.b - r.a, out = [];
  for (let i = 0; i < r.count; i++) {
    const d = cyc(t * r.speed + r.phase + i * span / r.count, span);
    const x = r.b - d;
    out.push({ x, y: r.floor - r.r - Math.abs(Math.sin(d / r.hop * Math.PI)) * r.bounce, rot: -d / r.r });
  }
  return out;
}
function patrolPos(s, t) { // ida e volta entre a e b (caranguejos, morcegos)
  const span = s.b - s.a, per = 2 * span / s.speed;
  const p = cyc(t / per + s.phase, 1);
  return p < 0.5 ? { x: s.a + span * p * 2, dir: 1 } : { x: s.b - span * (p - 0.5) * 2, dir: -1 };
}
function batPos(b, t) { const q = patrolPos(b, t); return { x: q.x, y: b.y + Math.sin(q.x / b.wave) * b.amp, dir: q.dir }; }
function waterfallStrong(w, t) { return cyc(t, w.on + w.off, w.phase) < w.on; }
function cartPos(c, t) { // espera, vai, espera, volta
  const tr = (c.b - c.a) / c.speed, per = 2 * (tr + c.wait);
  const p = cyc(t, per, c.phase);
  if (p < c.wait) return c.a;
  if (p < c.wait + tr) return c.a + (p - c.wait) * c.speed;
  if (p < 2 * c.wait + tr) return c.b;
  return c.b - (p - 2 * c.wait - tr) * c.speed;
}

// ---------------------------------------------------------- plataformas
// kinds: static | bob (ponte de cipó) | sink (pedra que afunda) | crumble (galho/chão frágil) | move (vagonete)
Game.prototype.platGeom = function (pl, t) {
  switch (pl.kind) {
    case 'bob': return { top: pl.y + Math.sin(2 * Math.PI * t / pl.T + pl.ph) * pl.A, ox: 0 };
    case 'sink': return { top: pl.y + (pl.sinkD || 0), ox: 0 };
    case 'move': { const x = cartPos(pl.cart, t); return { top: pl.cart.y - 30, ox: x - pl.cart.a }; }
    default: return { top: pl.y, ox: 0 };
  }
};
Game.prototype.updateWorld = function (dt) {
  const L = this.L, p = this.p, t = this.t;
  for (const pl of L.platforms) {
    const on = p.plat === pl;
    if (pl.kind === 'sink') {
      pl.touch = on ? (pl.touch || 0) + dt : 0;
      pl.sinkD = on && pl.touch > pl.delay ? (pl.sinkD || 0) + pl.rate * dt : Math.max(0, (pl.sinkD || 0) - 40 * dt);
      pl.solid = (pl.sinkD || 0) < pl.maxSink;
    } else if (pl.kind === 'crumble') {
      if (pl.broken) { pl.respawn -= dt; if (pl.respawn <= 0 && !(Math.abs(p.x - (pl.x1 + pl.x2) / 2) < (pl.x2 - pl.x1) / 2 + 30 && Math.abs(p.y - pl.y) < 80)) { pl.broken = false; pl.touch = 0; } }
      else if (on) { pl.touch = (pl.touch || 0) + dt; if (pl.touch > pl.delay) { pl.broken = true; pl.respawn = 3.2; this.debris(pl); Snd.sfx('quebra'); } }
      pl.solid = !pl.broken;
    } else pl.solid = true;
    const g = this.platGeom(pl, t);
    pl.dx = pl.prevOx === undefined ? 0 : g.ox - pl.prevOx;
    pl.prevOx = g.ox; pl.top = g.top;
    pl.cx1 = pl.x1 + g.ox; pl.cx2 = pl.x2 + g.ox;
  }
  // estalactites: tremem quando o Zé chega perto, caem e se refazem
  for (const s of L.stalactites) {
    if (s.state === 'idle' && p.x > s.x - 120 && p.x < s.x + 30 && p.state !== 'dead') { s.state = 'shake'; s.t = 0; Snd.sfx('racha'); }
    else if (s.state === 'shake') { s.t += dt; if (s.t > 0.5) { s.state = 'fall'; s.vy = 0; } }
    else if (s.state === 'fall') { s.vy += 1900 * dt; s.y += s.vy * dt; if (s.y > L.floor - 10) { s.state = 'gone'; s.t = 0; this.dust(s.x, L.floor, 10); Snd.sfx('pedra'); this.shake = 3; } }
    else if (s.state === 'gone') { s.t += dt; if (s.t > 3.5) { s.state = 'idle'; s.y = s.y0; } }
  }
  // macacos jogam frutos em ritmo fixo quando o Zé está à vista
  if (!this.fruits) this.fruits = [];
  for (const m of L.monkeys) {
    const k = Math.floor((t + m.phase) / m.period), prevK = Math.floor((t - dt + m.phase) / m.period);
    m.throwing = cyc(t, m.period, m.phase) > m.period - 0.4;
    if (k !== prevK && Math.abs(p.x - m.x) < 560 && p.x < m.x + 40 && p.state !== 'dead') {
      const T = 1.0, sx = m.x - 10, sy = m.y - 44, tx = p.x + p.vx * 0.5, ty = p.y - 34;
      this.fruits.push({ x: sx, y: sy, vx: (tx - sx) / T, vy: (ty - sy - 0.5 * 900 * T * T) / T, life: 2.2, rot: 0 });
      Snd.sfx('arremesso');
    }
  }
  for (const f of this.fruits) { f.vy += 900 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.life -= dt; f.rot += dt * 10; }
  this.fruits = this.fruits.filter(f => f.life > 0 && f.y < H + 40);
};
// apoio sobre plataformas: retorna true se o Zé está em pé numa plataforma neste passo
Game.prototype.platformCollide = function (prevY, dt) {
  const p = this.p, L = this.L;
  if (!L.platforms.length) return false;
  if (p.plat) {
    const pl = p.plat;
    if (p.vy < 0 || !pl.solid || p.x < pl.cx1 - 6 || p.x > pl.cx2 + 6) { p.plat = null; return false; }
    p.x += pl.dx + (pl.current || 0) * dt;
    p.y = pl.top; p.vy = 0; p.onGround = true;
    return true;
  }
  if (p.vy < 0) return false;
  const grounded = p.onGround;
  for (const pl of L.platforms) {
    if (!pl.solid || p.x < pl.cx1 - 6 || p.x > pl.cx2 + 6) continue;
    // pousa vindo de cima, ou sobe um degrau pequeno andando (ponte que balança, vagonete)
    if ((prevY <= pl.top + 8 && p.y >= pl.top) || (grounded && p.y >= pl.top && p.y - pl.top <= 14)) {
      if (!p.onGround && p.vy > 300) { Snd.sfx('pouso'); this.dust(p.x, pl.top, 5); }
      p.plat = pl; p.y = pl.top; p.vy = 0; p.onGround = true;
      return true;
    }
  }
  return false;
};
// lama: corre e pula menos
Game.prototype.moveMods = function () {
  const p = this.p, L = this.L;
  if (!L.muds.length || !p.onGround || p.plat) return null;
  for (const m of L.muds) if (p.x > m.x1 && p.x < m.x2) return { run: 0.42, jump: 0.74, mud: m };
  return null;
};

// ---------------------------------------------------------- tirolesa
Game.prototype.tryZip = function () {
  const p = this.p, L = this.L;
  const hx = p.x + p.face * 3, hy = p.y - 56;
  for (const z of L.ziplines) {
    if (hx < z.x1 - 20 || hx > z.x2) continue;
    const u = clamp((hx - z.x1) / (z.x2 - z.x1), 0, 1);
    const cy = lerp(z.y1, z.y2, u);
    if (Math.abs(cy - hy) < 22 && u < 0.85) {
      p.state = 'zip'; p.zip = z; p.zipU = u; p.zipStart = u; p.vx = p.vy = 0; p.face = 1; p.plat = null;
      Snd.sfx('agarra'); this.say('tirolesa');
      return true;
    }
  }
  return false;
};
Game.prototype.updateZip = function (dt) {
  const p = this.p, z = p.zip;
  const len = Math.hypot(z.x2 - z.x1, z.y2 - z.y1);
  p.zipU += z.speed * dt / len;
  const u = Math.min(1, p.zipU);
  p.x = lerp(z.x1, z.x2, u); p.y = lerp(z.y1, z.y2, u) + 60;
  if (Math.random() < 0.3) this.addP({ x: p.x, y: p.y - 62, vx: -60, vy: -20, life: 0.25, max: 0.25, c: '#ffe28a', s: 2, g: 300 });
  const end = p.zipU >= 1, jump = p.jumpBuf > 0 && p.zipU - (p.zipStart || 0) > 0.05;
  if (end || jump) {
    p.state = 'normal'; p.zip = null; p.grabCD = 0.45; p.jumpBuf = 0; p.onGround = false; p.jumpHeld = false;
    p.vx = z.speed * 0.8; p.vy = jump ? -300 : -60;
    if (jump) Snd.sfx('pulo');
  }
};

// ---------------------------------------------------------- perigos e zonas
Game.prototype.interactNew = function (dt) {
  const p = this.p, L = this.L, t = this.t, floor = L.floor;
  const feet = p.y, top = p.y - PHYS.HH;
  const hit = (x, y, rx, ry) => Math.abs(x - p.x) < PHYS.HW + rx && y + ry > top && y - ry < feet;
  if (p.inv <= 0) {
    for (const c of L.crabs) { const q = patrolPos(c, t); if (Math.abs(q.x - p.x) < 20 && feet > floor - 18) { Snd.sfx('ferroada'); this.kill('caranguejo'); return true; } }
    for (const r of L.rocks) for (const q of rockPositions(r, t)) if (hit(q.x, q.y, r.r - 6, r.r - 6)) { this.kill('pedra'); return true; }
    for (const b of L.bats) { const q = batPos(b, t); if (hit(q.x, q.y, 12, 8)) { this.kill('morcego'); return true; } }
  }
  for (const s of L.stalactites) if (s.state === 'fall' && hit(s.x, s.y, 8, 14)) { this.kill('estalactite'); return true; }
  // frutos do macaco: tropeça e é empurrado (pode cair do galho)
  for (const f of this.fruits || []) {
    if (f.life > 0 && hit(f.x, f.y, 8, 8) && p.invLog <= 0 && p.state === 'normal') {
      f.life = 0; p.invLog = 1.0; p.state = 'trip'; p.tripT = 0.45; p.vx = -220; p.vy = Math.min(p.vy, -160); p.plat = null; p.onGround = false;
      this.score = Math.max(0, this.score - SCORE.trip); this.popup(p.x, top - 10, '-' + SCORE.trip, PAL.red);
      Snd.sfx('tropeco'); this.splat(f.x, f.y);
    }
  }
  // maré: quem está no chão quando a água passa do joelho se afoga
  for (const z of L.tides) {
    if (p.x > z.x1 && p.x < z.x2 && p.onGround && !p.plat && tideLevel(z, t) < floor - 10) { this.splash(p.x, tideLevel(z, t)); this.kill('agua'); return true; }
  }
  // cortina da cachoeira: empurra para trás nos pulsos fortes
  for (const w of L.waterfalls) {
    if (p.x > w.x - 6 && p.x < w.x + w.w + 6 && feet > w.top && waterfallStrong(w, t) && p.state !== 'dead') {
      p.x -= 300 * dt; if (p.vx > 0) p.vx *= 0.5;
      if (Math.random() < 0.4) this.splash(p.x, feet - 30);
    }
  }
  // avisos das zonas (só uma vez)
  for (const m of L.muds) if (!m.said && p.x > m.x1 - 360 && p.x < m.x2) { m.said = true; this.say('lama'); }
  return false;
};

Game.prototype.debris = function (pl) {
  for (let x = pl.x1; x < pl.x2; x += 8) this.addP({ x, y: pl.top + 2, vx: (Math.random() - 0.5) * 60, vy: Math.random() * 40, life: 1, max: 1, c: pl.look === 'branch' ? '#6a4628' : '#6e756f', s: 6, g: 900 });
};
Game.prototype.splat = function (x, y) { for (let i = 0; i < 10; i++) this.addP({ x, y, vx: (Math.random() - 0.5) * 200, vy: -Math.random() * 200, life: 0.6, max: 0.6, c: Math.random() < 0.5 ? '#e8742a' : '#ffd23a', s: 4, g: 800 }); };

// ---------------------------------------------------------- desenho das mecânicas novas
Game.prototype.drawNewBack = function (ctx, L, now) { // atrás dos personagens
  const t = this.t;
  for (const m of L.muds) if (this.visible(m.x1, m.x2 - m.x1)) drawMud(ctx, m, now);
  for (const z of L.tides) if (this.visible(z.x1, z.x2 - z.x1)) drawTide(ctx, z, tideLevel(z, t), tideRising(z, t), now, L.floor);
  for (const c of L.carts) if (this.visible(c.a, c.b - c.a + 100)) drawRail(ctx, c);
  for (const z of L.ziplines) if (this.visible(z.x1, z.x2 - z.x1)) drawZipline(ctx, z);
  for (const pl of L.platforms) if (pl.solid !== false || pl.kind === 'crumble') { if (this.visible(pl.cx1 ?? pl.x1, 200)) drawPlatform(ctx, pl, now); }
  for (const w of L.waterfalls) if (this.visible(w.x, 120)) drawWaterfall(ctx, w, waterfallStrong(w, t), now, L.floor);
};
Game.prototype.drawNewFront = function (ctx, L, now) { // perigos móveis
  const t = this.t, fr = Math.floor(t * 8) % 2;
  for (const c of L.crabs) { const q = patrolPos(c, t); if (this.visible(q.x)) drawSprite(ctx, Art.crab[fr], q.x, L.floor, q.dir); }
  for (const r of L.rocks) { for (const q of rockPositions(r, t)) if (this.visible(q.x)) { const im = Art.rock[((Math.floor(q.rot * 8 / 6.283) % 8) + 8) % 8]; const edge = Math.min(q.x - r.a, r.b - q.x); ctx.globalAlpha = clamp(edge / 30, 0, 1); ctx.drawImage(im, Math.round(q.x - im.width / 2), Math.round(q.y - im.height / 2)); ctx.globalAlpha = 1; } if (this.visible(r.b)) drawRockSource(ctx, r, now); }
  for (const b of L.bats) { const q = batPos(b, t); if (this.visible(q.x)) drawSprite(ctx, Art.bat[Math.floor(t * 10) % 2], q.x, q.y + 12, q.dir); }
  for (const s of L.stalactites) if (this.visible(s.x) && s.state !== 'gone') { const j = s.state === 'shake' ? (Math.floor(now / 40) % 2) * 2 - 1 : 0; ctx.drawImage(Art.stalactite, Math.round(s.x - 12 + j), Math.round(s.y - 30)); }
  if (L.kind === 'surface') for (const s of L.scorpions) { const q = scorpionPos(s, t); if (this.visible(q.x)) { ctx.save(); ctx.translate(Math.round(q.x), L.floor - 38); if (q.dir < 0) ctx.scale(-1, 1); ctx.drawImage(Art.scorpion[fr], -28, 0); ctx.restore(); } }
  for (const m of L.monkeys) if (this.visible(m.x)) drawPerch(ctx, m);
  for (const m of L.monkeys) if (this.visible(m.x)) drawSprite(ctx, Art.monkey[m.throwing ? 1 : Math.floor(now / 400) % 2 ? 0 : 2], m.x, m.y, -1);
  for (const f of this.fruits || []) { ctx.save(); ctx.translate(Math.round(f.x), Math.round(f.y)); ctx.rotate(f.rot); ctx.drawImage(Art.fruit, -7, -7); ctx.restore(); }
  for (const c of L.carts) { const x = cartPos(c, t); if (this.visible(x)) ctx.drawImage(Art.cart, Math.round(x - 36), Math.round(c.y - 34)); }
};
function drawSprite(ctx, img, x, feetY, dir) {
  ctx.save(); ctx.translate(Math.round(x), Math.round(feetY));
  if (dir < 0) ctx.scale(-1, 1);
  ctx.drawImage(img, -img.width / 2, -img.height);
  ctx.restore();
}
