// ============================================================ partida: física, perigos, regras e desenho do mundo
const PHYS = {
  RUN: 215, ACC: 1900, DEC: 2600, AIR_ACC: 1300, GRAV: 2100, JUMP_V: 760, CUT: 0.42, MAXFALL: 900,
  COYOTE: 0.1, BUFFER: 0.1, CLIMB: 140, HW: 11, HH: 58,
};
const SCORE = { start: 2000, coin: 500, jewel: 1000, idol: 5000, perSecond: 20, perLife: 1000, trip: 100 };
const TIME_LIMIT = 300;

class Game {
  constructor(seed, opts = {}) {
    this.seed = seed;
    this.world = generateWorld(seed);
    this.levelId = 'surface';
    this.t = 0;                   // relógio do jogo (ciclos dos perigos)
    this.time = TIME_LIMIT;
    this.score = SCORE.start;
    this.lives = 3;
    this.collected = { coin: 0, jewel: 0 };
    this.voiced = opts.voiced || {};
    this.checkpoint = { level: 'surface', x: 70 };
    this.particles = []; this.popups = [];
    this.shake = 0; this.flash = 0;
    this.cam = 0;
    this.over = null;             // 'win' | 'lose'
    this.loseReason = null;
    this.hurry = false;
    this.god = false;
    this.events = [];             // para a interface (ex.: troca de camada)
    this.p = this.newPlayer(70, GROUND);
    this.lastTick = -1;
    this.fireflies = Array.from({ length: 40 }, (_, i) => ({ x: Math.random() * 1500, y: 120 + Math.random() * 300, ph: Math.random() * 6, sp: 0.4 + Math.random() }));
  }
  get L() { return this.levelId === 'surface' ? this.world.surface : this.world.under[this.levelId]; }
  get area() { return this.levelId === 'surface' ? clamp(Math.floor(this.p.x / AREA_W) + 1, 1, 10) : null; }

  newPlayer(x, y) {
    return { x, y, vx: 0, vy: 0, face: 1, onGround: true, coyote: 0, jumpBuf: 0, state: 'normal', vine: null, vineD: 0, vineT: 0,
      ladder: null, tripT: 0, invLog: 0, inv: 1.0, grabCD: 0, anim: 0, stepT: 0, deadT: 0, deadKind: null, sinkY: 0, hatFly: null };
  }

  // ---------------------------------------------------------- consultas do terreno
  inGap(L, x) {
    for (const g of L.gaps) if (x > g.x1 && x < g.x2) return g;
    return null;
  }
  crocAt(L, x) {
    for (const c of L.crocs) if (Math.abs(x - c.x) <= c.hw) return c;
    return null;
  }
  supported(L, x) { // há chão (ou cabeça de jacaré) sob este x?
    const g = this.inGap(L, x);
    if (!g) return true;
    return !!this.crocAt(L, x);
  }

  // ---------------------------------------------------------- atualização (passo fixo)
  update(dt) {
    const p = this.p, L = this.L;
    if (this.over) { this.updateFx(dt); if (this.over === 'win') { p.anim += dt; } return; }
    this.t += dt;
    if (p.state !== 'dead') {
      this.time -= dt;
      if (this.time <= 60 && !this.hurry) { this.hurry = true; this.say('minuto', true); }
      if (this.time <= 10 && this.time > 0) { const s = Math.ceil(this.time); if (s !== this.lastTick) { this.lastTick = s; Snd.sfx('tique'); } }
      if (this.time <= 0) { this.time = 0; this.kill('tempo'); }
    }
    p.inv = Math.max(0, p.inv - dt); p.invLog = Math.max(0, p.invLog - dt); p.grabCD = Math.max(0, p.grabCD - dt);
    p.anim += dt;

    const ix = (Input.held('right') ? 1 : 0) - (Input.held('left') ? 1 : 0);
    if (Input.pressed('jump')) p.jumpBuf = PHYS.BUFFER; else p.jumpBuf = Math.max(0, p.jumpBuf - dt);

    if (p.state === 'dead') this.updateDead(dt);
    else if (p.state === 'ladder') this.updateLadder(dt);
    else if (p.state === 'vine') this.updateVine(dt, ix);
    else this.updateNormal(dt, ix);

    if (p.state !== 'dead') this.interact(dt);
    this.updateCamera(dt);
    this.updateFx(dt);
  }

  updateNormal(dt, ix) {
    const p = this.p, L = this.L;
    const tripping = p.state === 'trip';
    if (tripping) { p.tripT -= dt; if (p.tripT <= 0) p.state = 'normal'; ix = 0; }
    // escadas
    if (!tripping && p.onGround) {
      for (const ld of L.ladders) {
        if (Math.abs(p.x - ld.x) < 20) {
          const goDown = L.kind === 'surface' && Input.held('down');
          const goUp = L.kind === 'under' && Input.held('up');
          if (goDown || goUp) {
            p.state = 'ladder'; p.ladder = ld; p.x = ld.x; p.vx = 0; p.vy = 0; p.jumpBuf = 0; p.autoDir = 0;
            p.y += goDown ? 6 : -6; p.onGround = false;
            if (goDown && !this.voiced.escada) this.say('escada');
            return;
          }
        }
      }
    }
    // movimento horizontal: aceleração rápida, frenagem curta
    const acc = p.onGround ? (ix ? PHYS.ACC : PHYS.DEC) : PHYS.AIR_ACC;
    const target = ix * PHYS.RUN;
    if (p.vx < target) p.vx = Math.min(target, p.vx + acc * dt); else if (p.vx > target) p.vx = Math.max(target, p.vx - acc * dt);
    if (tripping) p.vx *= 0.9;
    if (ix) p.face = ix;
    // tolerância de borda e pulo antecipado
    p.coyote = p.onGround ? PHYS.COYOTE : Math.max(0, p.coyote - dt);
    if (p.jumpBuf > 0 && p.coyote > 0 && !tripping) {
      p.vy = -PHYS.JUMP_V; p.onGround = false; p.coyote = 0; p.jumpBuf = 0; p.jumpHeld = true;
      Snd.sfx('pulo');
    }
    // pulo variável: soltar cedo corta o pulo
    if (p.vy < 0 && !Input.held('jump') && p.jumpHeld) { p.vy *= PHYS.CUT; p.jumpHeld = false; }
    if (p.vy >= 0) p.jumpHeld = false;
    p.vy = Math.min(PHYS.MAXFALL, p.vy + PHYS.GRAV * dt);

    const prevY = p.y;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.x = clamp(p.x, 16, L.len - 16);

    // abaixo da superfície dentro de um vão: paredes da lagoa
    const floor = L.floor;
    if (prevY > floor + 2) {
      const g = this.inGap(L, p.x) || this.inGap(L, p.x - p.vx * dt);
      if (g) p.x = clamp(p.x, g.x1 + 6, g.x2 - 6);
    }
    const sup = this.supported(L, p.x - 8) || this.supported(L, p.x + 8);
    if (p.vy >= 0 && prevY <= floor + 1 && p.y >= floor && sup) {
      if (!p.onGround && p.vy > 300) { Snd.sfx('pouso'); this.dust(p.x, floor, 6); }
      p.y = floor; p.vy = 0; p.onGround = true;
    } else if (p.onGround && !sup) {
      p.onGround = false; // saiu da borda
    } else if (p.y < floor - 0.5 || !sup) {
      p.onGround = false;
    }
    if (p.y > floor + 16 && !sup) {
      const g = this.inGap(L, p.x);
      if (g) { this.splash(p.x, floor + 12); this.kill('agua'); }
    }
    // passos
    if (p.onGround && Math.abs(p.vx) > 60) { p.stepT -= dt * Math.abs(p.vx) / PHYS.RUN; if (p.stepT <= 0) { p.stepT = 0.17; Snd.sfx('passo'); } }
    // cipós: agarra automaticamente ao encostar durante um pulo
    if (!p.onGround && p.grabCD <= 0 && !tripping) this.tryGrab();
  }

  tryGrab() {
    const p = this.p, L = this.L;
    const hx = p.x + p.face * 3, hy = p.y - 56;
    for (const v of L.vines) {
      if (Math.abs(v.px - p.x) > 320) continue;
      const { th } = vineState(v, this.t);
      for (let d = v.len * 0.45; d <= v.len + 1; d += 8) {
        const rx = v.px + Math.sin(th) * d, ry = v.py + Math.cos(th) * d;
        if (Math.hypot(rx - hx, ry - hy) < 24) {
          p.state = 'vine'; p.vine = v; p.vineD = Math.max(d, v.len * 0.6); p.vineT = 0; p.vx = p.vy = 0;
          Snd.sfx('agarra');
          return;
        }
      }
    }
  }

  updateVine(dt, ix) {
    const p = this.p, v = p.vine;
    const { th, dth } = vineState(v, this.t);
    const rx = v.px + Math.sin(th) * p.vineD, ry = v.py + Math.cos(th) * p.vineD;
    p.x = rx; p.y = ry + 60; p.vineT += dt;
    const tvx = Math.cos(th) * dth * p.vineD, tvy = -Math.sin(th) * dth * p.vineD;
    if (Math.abs(tvx) > 40) p.face = sign(tvx);
    if (ix) p.face = ix;
    if (Math.abs(dth) > 0.6 && Math.floor(this.t * 2) !== Math.floor((this.t - dt) * 2)) Snd.sfx('cipo');
    if (p.jumpBuf > 0 && p.vineT > 0.15) {
      const dir = ix || p.face;
      p.vx = clamp(tvx + dir * 120, -340, 340);
      p.vy = Math.min(tvy, 0) - 330;
      p.state = 'normal'; p.vine = null; p.grabCD = 0.4; p.jumpBuf = 0; p.onGround = false; p.coyote = 0; p.jumpHeld = false;
      Snd.sfx('pulo');
    }
  }

  updateLadder(dt) {
    const p = this.p, L = this.L, ld = p.ladder;
    let dy = (Input.held('down') ? 1 : 0) - (Input.held('up') ? 1 : 0);
    if (dy) p.autoDir = 0; // o jogador assumiu o controle
    else if (p.autoDir) dy = p.autoDir; // acaba de trocar de nível: continua no sentido da travessia
    p.y += dy * PHYS.CLIMB * dt;
    if (dy) { p.stepT -= dt; if (p.stepT <= 0) { p.stepT = 0.22; Snd.sfx('escada'); } }
    p.jumpBuf = 0; // não pula enquanto está na escada
    if (L.kind === 'surface') {
      if (p.y <= GROUND && dy < 0) { p.y = GROUND; p.state = 'normal'; p.onGround = true; p.ladder = null; return; }
      if (p.y > H + 70) this.switchLevel(ld.peerLevel, ld.peer, -4);
    } else {
      if (p.y >= FLOOR_U && dy > 0) { p.y = FLOOR_U; p.state = 'normal'; p.onGround = true; p.ladder = null; return; }
      if (p.y < -26) this.switchLevel('surface', ld.peer, H + 60); // folga entre os limites evita ir e voltar
    }
  }

  switchLevel(levelId, ladder, y) {
    const p = this.p;
    this.levelId = levelId;
    p.x = ladder.x; p.y = y; p.ladder = ladder; p.state = 'ladder';
    // entrada pela escada: o jogo segura o último sentido até o jogador decidir (sem isso o Zé ficava parado acima do teto, invisível)
    p.autoDir = ladder.peerLevel === 'surface' && levelId !== 'surface' ? 1 : -1;
    this.cam = clamp(p.x - W * 0.42, 0, this.L.len - W);
    this.particles = [];
    this.events.push('level');
  }

  interact(dt) {
    const p = this.p, L = this.L, t = this.t, floor = L.floor;
    const feet = p.y, top = p.y - PHYS.HH;
    // jacarés: boca aberta morde quem está na cabeça
    for (const c of L.crocs) {
      if (Math.abs(c.x - p.x) > c.hw + 8) continue;
      const st = crocOpen(c, t);
      if (st.open && st.k > 0.3 && feet > floor - 34 && feet <= floor + 6 && p.state !== 'vine') { this.kill('mordida', c); return; }
    }
    // areia movediça
    for (const s of L.sands) {
      const w = sandWidth(s, t);
      if (w > 12 && p.onGround && Math.abs(p.x - s.cx) < w - 8) { this.kill('areia', s); return; }
    }
    // troncos: tropeça e perde pontos, sem perder vida
    for (const lg of L.logs) for (const lx of logPositions(lg, t)) {
      const cy = floor - 16;
      const nx = clamp(lx, p.x - PHYS.HW, p.x + PHYS.HW), ny = clamp(cy, top, feet);
      if (Math.hypot(lx - nx, cy - ny) < 14 && p.invLog <= 0 && p.state !== 'vine' && p.state !== 'ladder') {
        p.invLog = 1.3; p.state = 'trip'; p.tripT = 0.5; p.vx = -40;
        this.score = Math.max(0, this.score - SCORE.trip);
        this.popup(p.x, top - 10, '-' + SCORE.trip, PAL.red);
        this.shake = 4; Snd.sfx('tropeco'); this.dust(p.x, floor, 8);
      }
    }
    // escorpiões
    for (const s of L.scorpions) {
      const sp = scorpionPos(s, t);
      if (Math.abs(sp.x - p.x) < 19 && feet > floor - 20 && p.inv <= 0) { Snd.sfx('ferroada'); this.kill('escorpiao'); return; }
    }
    // tesouros
    for (const tr of L.treasures) {
      if (tr.taken) continue;
      if (Math.abs(tr.x - p.x) < 22 && tr.y > top - 14 && tr.y < feet + 6) {
        tr.taken = true;
        const v = tr.type === 'jewel' ? SCORE.jewel : SCORE.coin;
        this.score += v; this.collected[tr.type]++;
        this.popup(tr.x, tr.y - 18, '+' + v, tr.type === 'jewel' ? PAL.turq : PAL.gold2);
        this.sparkle(tr.x, tr.y, tr.type === 'jewel' ? PAL.turq : PAL.gold2, 14);
        Snd.sfx(tr.type === 'jewel' ? 'joia' : 'moeda');
      }
    }
    // fogueiras (checkpoints)
    for (const f of L.fires) {
      if (!f.lit && p.x > f.x - 12) {
        f.lit = true;
        this.checkpoint = { level: this.levelId, x: f.x + 34 };
        Snd.sfx('fogueira'); this.embers(f.x, floor - 20, 20);
        this.say('fogueira');
      }
    }
    // avisos narrados: cada um só na primeira vez que o perigo aparece
    for (const a of L.announce) {
      if (!a.done && p.x > a.x - 430 && p.x < a.x + 200) { a.done = true; if (a.what !== 'escorpiao') this.say(a.what); }
    }
    // ídolo
    if (L.idol && !L.idol.taken && Math.abs(p.x - L.idol.x) < 30 && p.onGround) this.win();
  }

  say(name, interrupt) {
    if (this.voiced[name]) return;
    this.voiced[name] = true;
    Snd.voice(name, { interrupt });
  }

  kill(kind, what) {
    const p = this.p;
    if (p.state === 'dead') return;
    if (this.god && kind !== 'tempo') return;
    p.state = 'dead'; p.deadKind = kind; p.deadT = 0; p.vine = null; p.ladder = null;
    p.vx = 0; p.vy = kind === 'mordida' || kind === 'escorpiao' ? -520 : 0; p.sinkY = 0;
    p.hatFly = { x: p.x, y: p.y - 64, vx: -p.face * 80, vy: -300, rot: 0 };
    this.shake = 8; this.flash = kind === 'tempo' ? 0 : 0.25;
    if (kind === 'mordida') Snd.sfx('mordida');
    else if (kind === 'areia') Snd.sfx('afundar');
    else if (kind === 'agua') Snd.sfx('respingo');
    if (kind !== 'tempo') setTimeout(() => Snd.sfx('perdeu'), 250);
    if (kind === 'tempo') { this.lives = 0; }
  }

  updateDead(dt) {
    const p = this.p, floor = this.L.floor;
    p.deadT += dt;
    if (p.deadKind === 'areia') { p.sinkY = Math.min(70, p.sinkY + dt * 45); if (Math.random() < 0.3) this.sandPuff(p.x, floor); }
    else if (p.deadKind === 'agua') { p.y = Math.min(p.y + dt * 80, floor + 70); }
    else if (p.deadKind === 'mordida' || p.deadKind === 'escorpiao') { p.vy += PHYS.GRAV * dt; p.y += p.vy * dt; if (p.y > floor) { p.y = floor; p.vy = 0; } }
    if (p.hatFly) { const h = p.hatFly; h.vy += 900 * dt; h.x += h.vx * dt; h.y += h.vy * dt; h.rot += dt * 6; }
    const wait = p.deadKind === 'tempo' ? 0.8 : 1.6;
    if (p.deadT > wait && !p.respawnRequested) {
      p.respawnRequested = true;
      if (p.deadKind !== 'tempo') this.lives--;
      if (this.lives <= 0) this.lose(p.deadKind === 'tempo' ? 'tempo' : 'vidas');
      else this.events.push('respawn');
    }
  }

  respawn() {
    const cp = this.checkpoint;
    this.levelId = cp.level;
    this.p = this.newPlayer(cp.x, this.L.floor);
    this.p.inv = 1.5;
    this.cam = clamp(this.p.x - W * 0.42, 0, this.L.len - W);
    this.particles = [];
    // perigos já anunciados não repetem a fala
  }

  win() {
    const L = this.L;
    L.idol.taken = true;
    this.over = 'win';
    this.p.state = 'cheer'; this.p.vx = 0; this.p.anim = 0;
    const bonusTime = Math.floor(this.time) * SCORE.perSecond, bonusLives = this.lives * SCORE.perLife;
    this.result = { base: this.score + SCORE.idol, time: Math.floor(this.time), bonusTime, lives: this.lives, bonusLives, idol: SCORE.idol };
    this.score += SCORE.idol + bonusTime + bonusLives;
    this.result.total = this.score;
    this.sparkle(L.idol.x, L.idol.y - 10, PAL.gold2, 40);
    Snd.sfx('idolo');
  }
  lose(reason) { this.over = 'lose'; this.loseReason = reason; this.result = { total: this.score }; }

  updateCamera(dt) {
    const p = this.p, L = this.L;
    const target = clamp(p.x - W * 0.42 + p.face * 40, 0, L.len - W);
    this.cam += (target - this.cam) * Math.min(1, dt * 5);
    this.cam = clamp(this.cam, 0, L.len - W);
  }

  // ---------------------------------------------------------- efeitos (partículas com limite fixo)
  addP(o) { if (this.particles.length < 260) this.particles.push(o); }
  dust(x, y, n) { for (let i = 0; i < n; i++) this.addP({ x: x + (Math.random() - 0.5) * 20, y: y - 2, vx: (Math.random() - 0.5) * 120, vy: -Math.random() * 60, life: 0.5, max: 0.5, c: '#c9b48a', s: 4, g: 200 }); }
  splash(x, y) { for (let i = 0; i < 26; i++) this.addP({ x: x + (Math.random() - 0.5) * 30, y, vx: (Math.random() - 0.5) * 220, vy: -150 - Math.random() * 320, life: 0.9, max: 0.9, c: Math.random() < 0.5 ? PAL.foam : PAL.water2, s: 4, g: 900 }); }
  sparkle(x, y, c, n) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = 40 + Math.random() * 160; this.addP({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.7, max: 0.7, c, s: 4, g: 120, star: true }); } }
  embers(x, y, n) { for (let i = 0; i < n; i++) this.addP({ x: x + (Math.random() - 0.5) * 20, y, vx: (Math.random() - 0.5) * 60, vy: -60 - Math.random() * 120, life: 1.2, max: 1.2, c: Math.random() < 0.5 ? '#ffb24a' : '#ffe28a', s: 2, g: -20 }); }
  sandPuff(x, y) { this.addP({ x: x + (Math.random() - 0.5) * 40, y: y - 4, vx: (Math.random() - 0.5) * 50, vy: -40 - Math.random() * 60, life: 0.6, max: 0.6, c: PAL.sand, s: 4, g: 200 }); }
  popup(x, y, text, c) { this.popups.push({ x, y, text, c, life: 1.1 }); }
  updateFx(dt) {
    for (const q of this.particles) { q.life -= dt; q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; }
    this.particles = this.particles.filter(q => q.life > 0);
    for (const q of this.popups) { q.life -= dt; q.y -= 40 * dt; }
    this.popups = this.popups.filter(q => q.life > 0);
    this.shake = Math.max(0, this.shake - dt * 30);
    this.flash = Math.max(0, this.flash - dt);
    // brasas das fogueiras acesas e brilho nos tesouros
    const L = this.L;
    for (const f of L.fires) if (f.lit && Math.abs(f.x - this.cam - W / 2) < W && Math.random() < 0.25) this.embers(f.x, L.floor - 24, 1);
    if (L.kind === 'surface' && Math.random() < 0.08) this.addP({ x: this.cam + Math.random() * W, y: -10, vx: 20 + Math.random() * 30, vy: 30 + Math.random() * 20, life: 6, max: 6, c: Math.random() < 0.5 ? PAL.fern : '#a8b04a', s: 4, g: 0, leaf: Math.random() * 6 });
  }

  // ---------------------------------------------------------- desenho
  draw(ctx, now) {
    const L = this.L;
    ctx.save();
    if (this.shake > 0) ctx.translate(Math.round((Math.random() - 0.5) * this.shake), Math.round((Math.random() - 0.5) * this.shake));
    if (L.kind === 'surface') drawSurfaceBack(ctx, this.cam, now); else drawCaveBack(ctx, this.cam, now);
    ctx.save();
    ctx.translate(-Math.round(this.cam), 0);
    if (L.kind === 'surface') this.drawSurface(ctx, L, now); else this.drawUnder(ctx, L, now);
    this.drawPlayer(ctx, now);
    for (const q of this.particles) {
      const a = clamp(q.life / q.max, 0, 1);
      ctx.globalAlpha = q.leaf !== undefined ? 0.8 : a;
      ctx.fillStyle = q.c;
      if (q.star) { ctx.fillRect(Math.round(q.x) - 1, Math.round(q.y) - 3, 2, 6); ctx.fillRect(Math.round(q.x) - 3, Math.round(q.y) - 1, 6, 2); }
      else if (q.leaf !== undefined) { const s = Math.sin(now / 300 + q.leaf); ctx.fillRect(Math.round(q.x + s * 10), Math.round(q.y), 6, 4); q.vx = 20 + s * 30; }
      else ctx.fillRect(Math.round(q.x), Math.round(q.y), q.s, q.s);
    }
    ctx.globalAlpha = 1;
    for (const q of this.popups) drawText(ctx, q.text, q.x, q.y, 2, q.c, 'center');
    ctx.restore();
    if (L.kind === 'surface') drawForeground(ctx, this.cam, now);
    else drawCaveDark(ctx, this, now);
    ctx.restore();
    if (this.flash > 0) { ctx.fillStyle = `rgba(200,40,30,${this.flash})`; ctx.fillRect(0, 0, W, H); }
  }

  visible(x, m = 120) { return x > this.cam - m && x < this.cam + W + m; }

  drawSurface(ctx, L, now) {
    const t = this.t, cam = this.cam;
    // chão: azulejos repetidos
    const gTop = GROUND - Art.groundTop;
    const startTile = Math.floor(cam / AREA_W);
    for (let i = startTile; i <= startTile + 1; i++) ctx.drawImage(Art.ground, i * AREA_W, gTop);
    // ruínas da clareira (área 10)
    if (L.idol && this.visible(L.idol.x, 700)) drawRuins(ctx, L.idol, now, L.idol.taken);
    // lagoas
    for (const g of L.gaps) if (this.visible(g.x1, 50) || this.visible(g.x2, 50) || (g.x1 < cam && g.x2 > cam + W)) drawPond(ctx, g, now);
    // buracos das escadas
    for (const ld of L.ladders) if (this.visible(ld.x)) drawLadderHole(ctx, ld);
    // areia movediça
    for (const s of L.sands) if (this.visible(s.cx, s.hw + 40)) drawSand(ctx, s, sandWidth(s, t), now);
    // jacarés
    for (const c of L.crocs) if (this.visible(c.x)) {
      const st = crocOpen(c, t);
      const f = st.open ? Math.round(st.k * 4) : 0;
      const jit = st.warn ? (Math.floor(now / 60) % 2) * 2 - 1 : 0;
      ctx.drawImage(Art.croc[f], Math.round(c.x - 40 + jit), GROUND - 30);
    }
    // placas
    for (const s of L.signs) if (this.visible(s.x, 200)) { const c = signCanvas(s.lines); ctx.drawImage(c, Math.round(s.x - c.width / 2), GROUND - c.height + 4); }
    // fogueiras
    for (const f of L.fires) if (this.visible(f.x)) drawFire(ctx, f, L.floor, now);
    // troncos
    for (const lg of L.logs) for (const lx of logPositions(lg, t)) if (this.visible(lx)) {
      const fr = ((Math.floor(-lx / 12) % 8) + 8) % 8;
      const edge = Math.min(lx - lg.a, lg.b - lx);
      ctx.globalAlpha = clamp(edge / 30, 0, 1);
      ctx.drawImage(Art.log[fr], Math.round(lx - 20), GROUND - 36);
      ctx.globalAlpha = 1;
    }
    // tesouros
    this.drawTreasures(ctx, L, now);
    // cipós
    for (const v of L.vines) if (this.visible(v.px, 320)) drawVine(ctx, v, vineState(v, t).th);
    // ídolo
    if (L.idol && !L.idol.taken && this.visible(L.idol.x)) {
      const bob = Math.sin(now / 400) * 2;
      drawGlow(ctx, L.idol.x, L.idol.y - 10, 60, 'rgba(255,220,120,0.35)');
      ctx.drawImage(Art.idol, Math.round(L.idol.x - 24), Math.round(L.idol.y - 56 + bob));
      if (Math.random() < 0.15) this.addP({ x: L.idol.x + (Math.random() - 0.5) * 40, y: L.idol.y - 30 + (Math.random() - 0.5) * 40, vx: 0, vy: -20, life: 0.6, max: 0.6, c: PAL.gold2, s: 2, g: 0, star: true });
    }
    if (this.debugBoxes) this.drawDebug(ctx, L);
  }

  drawUnder(ctx, L, now) {
    const t = this.t, cam = this.cam;
    const fy = FLOOR_U;
    const startTile = Math.floor(cam / AREA_W);
    for (let i = startTile; i <= startTile + 1; i++) ctx.drawImage(Art.caveFloor, i * AREA_W, fy);
    for (const ld of L.ladders) if (this.visible(ld.x)) drawCaveLadder(ctx, ld, now);
    for (const f of L.fires) if (this.visible(f.x)) drawFire(ctx, f, fy, now);
    this.drawTreasures(ctx, L, now);
    for (const s of L.scorpions) {
      const sp = scorpionPos(s, t);
      if (!this.visible(sp.x)) continue;
      const fr = Math.floor(t * 8) % 2;
      ctx.save();
      ctx.translate(Math.round(sp.x), fy - 38);
      if (sp.dir < 0) ctx.scale(-1, 1);
      ctx.drawImage(Art.scorpion[fr], -28, 0);
      ctx.restore();
    }
    // vagalumes
    for (const ff of this.fireflies) {
      const x = ff.x + Math.sin(now / 1000 * ff.sp + ff.ph) * 30, y = ff.y + Math.cos(now / 1300 * ff.sp + ff.ph) * 20;
      const a = 0.5 + 0.5 * Math.sin(now / 300 * ff.sp + ff.ph);
      if (!this.visible(x)) continue;
      ctx.globalAlpha = a * 0.35; ctx.fillStyle = '#d8ff7a'; ctx.fillRect(Math.round(x) - 3, Math.round(y) - 3, 8, 8);
      ctx.globalAlpha = a; ctx.fillStyle = '#f4ffb0'; ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
    }
    ctx.globalAlpha = 1;
    // gotejar
    const dropT = (now / 1000) % 1.7;
    for (let k = 0; k < 4; k++) {
      const x = 300 + k * 330, y = 70 + ((dropT + k * 0.4) % 1.7) / 1.7 * (fy - 70);
      if (this.visible(x)) { ctx.fillStyle = '#7fb7c4'; ctx.fillRect(x, Math.round(y), 2, 4); }
    }
    if (this.debugBoxes) this.drawDebug(ctx, L);
  }

  drawTreasures(ctx, L, now) {
    for (const tr of L.treasures) {
      if (tr.taken || !this.visible(tr.x)) continue;
      const bob = Math.sin(now / 300 + tr.x) * 2;
      if (tr.type === 'coin') {
        const f = Math.floor(now / 90 + tr.x) % 6;
        ctx.drawImage(Art.coin[f], Math.round(tr.x - 12), Math.round(tr.y - 12 + bob));
      } else {
        drawGlow(ctx, tr.x, tr.y, 26, 'rgba(63,209,196,0.35)');
        ctx.drawImage(Art.jewel, Math.round(tr.x - 14), Math.round(tr.y - 14 + bob));
        if (Math.floor(now / 140 + tr.x) % 9 === 0) { ctx.fillStyle = '#fff'; ctx.fillRect(tr.x + 6, tr.y - 12 + bob, 2, 6); ctx.fillRect(tr.x + 4, tr.y - 10 + bob, 6, 2); }
      }
    }
  }

  drawPlayer(ctx, now) {
    const p = this.p;
    if (p.inv > 0 && p.state !== 'dead' && Math.floor(now / 70) % 2 === 0) return;
    let frames = Art.ze.idle, fi = Math.floor(p.anim * 3) % 4;
    let dx = 0, dy = 0, clipBottom = null;
    switch (p.state) {
      case 'vine': frames = Art.ze.swing; fi = 0; break;
      case 'ladder': frames = Art.ze.climb; fi = ((Math.floor(p.y / 14) % 2) + 2) % 2; break; // y fica negativo ao chegar no subterrâneo
      case 'trip': frames = Art.ze.trip; fi = 0; break;
      case 'cheer': frames = Art.ze.cheer; fi = Math.floor(p.anim * 4) % 2; break;
      case 'dead':
        if (p.deadKind === 'areia') { frames = Art.ze.sink; dy = p.sinkY; clipBottom = this.L.floor + 4; }
        else if (p.deadKind === 'agua') { frames = Art.ze.sink; clipBottom = this.L.floor + 12; }
        else frames = Art.ze.hurt;
        fi = 0; break;
      default:
        if (!p.onGround) { frames = p.vy < 0 ? Art.ze.jump : Art.ze.fall; fi = 0; }
        else if (Math.abs(p.vx) > 20) { frames = Art.ze.run; fi = Math.floor(p.anim * 14) % 8; }
    }
    const img = frames[((fi % frames.length) + frames.length) % frames.length] || Art.ze.idle[0];
    ctx.save();
    if (clipBottom !== null) { ctx.beginPath(); ctx.rect(p.x - 60, -100, 120, clipBottom + 100); ctx.clip(); }
    ctx.translate(Math.round(p.x + dx), Math.round(p.y + dy));
    if (p.face < 0) ctx.scale(-1, 1);
    ctx.drawImage(img, -ZE.OX, -ZE.OY);
    ctx.restore();
    if (p.state === 'cheer') { // ergue o ídolo
      const L = this.L;
      ctx.drawImage(Art.idol, Math.round(p.x - 24), Math.round(p.y - 64 - 52 - (fi ? 2 : 0)));
    }
    if (p.state === 'dead' && p.hatFly && p.deadKind !== 'areia' && p.deadKind !== 'agua') {
      const h = p.hatFly;
      ctx.save(); ctx.translate(Math.round(h.x), Math.round(h.y)); ctx.rotate(h.rot); ctx.drawImage(Art.hatIcon, -14, -7); ctx.restore();
    }
  }

  drawDebug(ctx, L) {
    const p = this.p;
    ctx.strokeStyle = '#f0f'; ctx.strokeRect(p.x - PHYS.HW, p.y - PHYS.HH, PHYS.HW * 2, PHYS.HH);
    ctx.strokeStyle = '#0ff'; for (const g of L.gaps) ctx.strokeRect(g.x1, L.floor, g.x2 - g.x1, 30);
  }
}

// ---------------------------------------------------------- desenho de cenário compartilhado
const beams = [[180, 0.9], [520, 0.6], [880, 1.0], [1300, 0.7], [1650, 0.85]];
function drawSurfaceBack(ctx, cam, now) {
  ctx.drawImage(Art.sky, 0, 0);
  const strip = (img, f, y = 0) => {
    const w = img.width, off = -((cam * f) % w + w) % w;
    ctx.drawImage(img, Math.round(off), y); ctx.drawImage(img, Math.round(off + w), y);
  };
  strip(Art.mountains, 0.1);
  strip(Art.farForest, 0.25);
  // neblina que se move
  const fogX = ((now / 1000) * 10 + cam * 0.35) % 1920;
  ctx.globalAlpha = 0.25;
  for (let k = 0; k < 4; k++) {
    const x = ((k * 520 - fogX) % 1920 + 1920) % 1920 - 300;
    const gr = ctx.createRadialGradient(x + 200, 360, 10, x + 200, 360, 260);
    gr.addColorStop(0, 'rgba(230,240,215,0.9)'); gr.addColorStop(1, 'rgba(230,240,215,0)');
    ctx.fillStyle = gr; ctx.fillRect(x - 100, 200, 600, 300);
  }
  ctx.globalAlpha = 1;
  strip(Art.midForest, 0.5);
  // feixes de luz entre as copas
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const [bx, s] of beams) {
    const x = ((bx - cam * 0.6) % 1920 + 1920) % 1920 - 200;
    const a = 0.05 + 0.03 * Math.sin(now / 1800 + bx);
    ctx.globalAlpha = a * s;
    const gr = ctx.createLinearGradient(0, 0, 0, 420);
    gr.addColorStop(0, '#fff2c0'); gr.addColorStop(1, 'rgba(255,240,190,0)');
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 70, 0); ctx.lineTo(x + 230, 420); ctx.lineTo(x + 120, 420); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
function drawForeground(ctx, cam, now) {
  const img = Art.foreground, w = img.width, off = -((cam * 1.3) % w + w) % w;
  ctx.drawImage(img, Math.round(off), 0); ctx.drawImage(img, Math.round(off + w), 0);
}
function drawCaveBack(ctx, cam, now) {
  const strip = (img, f, y = 0) => { const w = img.width, off = -((cam * f) % w + w) % w; ctx.drawImage(img, Math.round(off), y); ctx.drawImage(img, Math.round(off + w), y); };
  strip(Art.caveBack, 0.6);
  strip(Art.caveCeil, 1.0);
}
let caveVignette = null;
function drawCaveDark(ctx, game, now) {
  // escuridão com luz ao redor do Zé, das fogueiras e das bocas das escadas
  if (!caveVignette) { const [c] = makeCanvas(W, H); caveVignette = c; }
  const g = caveVignette.getContext('2d');
  g.clearRect(0, 0, W, H);
  g.fillStyle = 'rgba(4,8,6,0.72)'; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'destination-out';
  const hole = (x, y, r, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); };
  const p = game.p, L = game.L, cam = game.cam;
  hole(p.x - cam, p.y - 40, 230, 0.9);
  for (const f of L.fires) hole(f.x - cam, FLOOR_U - 30, f.lit ? 260 + Math.sin(now / 90) * 8 : 90, f.lit ? 0.95 : 0.4);
  for (const ld of L.ladders) hole(ld.x - cam, 40, 200, 0.85);
  for (const tr of L.treasures) if (!tr.taken && tr.type === 'jewel') hole(tr.x - cam, tr.y, 70, 0.6);
  g.globalCompositeOperation = 'source-over';
  ctx.drawImage(caveVignette, 0, 0);
}
function drawGlow(ctx, x, y, r, c) {
  const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
function drawPond(ctx, g, now) {
  const x1 = g.x1, x2 = g.x2, top = GROUND;
  ctx.fillStyle = '#2a1a0e'; ctx.fillRect(x1, top - 2, x2 - x1, H - top + 2);   // margem escura
  const gr = ctx.createLinearGradient(0, top + 12, 0, H);
  gr.addColorStop(0, PAL.water2); gr.addColorStop(0.3, PAL.water); gr.addColorStop(1, '#0d2224');
  ctx.fillStyle = gr; ctx.fillRect(x1 + 4, top + 12, x2 - x1 - 8, H - top - 12);
  // paredes de terra
  ctx.fillStyle = PAL.soil2; ctx.fillRect(x1, top - 2, 6, H); ctx.fillRect(x2 - 6, top - 2, 6, H);
  ctx.fillStyle = PAL.leaf; ctx.fillRect(x1 - 2, top - 2, 8, 6); ctx.fillRect(x2 - 6, top - 2, 8, 6);
  // superfície com brilho em movimento
  ctx.fillStyle = PAL.foam;
  for (let x = x1 + 8; x < x2 - 8; x += 16) {
    const o = Math.sin(now / 400 + x / 23) * 3;
    if ((Math.floor(now / 250 + x / 16) % 3) === 0) ctx.fillRect(Math.round(x + o), top + 12, 8, 2);
  }
  ctx.fillStyle = 'rgba(191,227,212,0.25)'; ctx.fillRect(x1 + 4, top + 12, x2 - x1 - 8, 2);
  // juncos nas margens
  ctx.fillStyle = '#4f7a3a';
  for (const bx of [x1 + 8, x1 + 14, x2 - 16, x2 - 10]) ctx.fillRect(bx, top - 10 + (bx % 3) * 2, 2, 22);
  ctx.fillStyle = '#7a5230'; ctx.fillRect(x1 + 13, top - 14, 4, 6); ctx.fillRect(x2 - 11, top - 12, 4, 6);
}
function drawLadderHole(ctx, ld) {
  const x = ld.x;
  ctx.fillStyle = '#0e0805'; ctx.fillRect(x - 24, GROUND + 2, 48, H - GROUND);
  ctx.fillStyle = '#1e140c'; ctx.fillRect(x - 24, GROUND + 2, 4, H); ctx.fillRect(x + 20, GROUND + 2, 4, H);
  ctx.fillStyle = '#7a5230'; ctx.fillRect(x - 16, GROUND - 14, 4, H); ctx.fillRect(x + 12, GROUND - 14, 4, H);
  for (let y = GROUND - 8; y < H; y += 16) { ctx.fillStyle = '#a87a48'; ctx.fillRect(x - 14, y, 28, 4); ctx.fillStyle = '#5a3a20'; ctx.fillRect(x - 14, y + 4, 28, 2); }
  ctx.fillStyle = '#5a3a20'; ctx.fillRect(x - 28, GROUND - 2, 8, 6); ctx.fillRect(x + 20, GROUND - 2, 8, 6);
}
function drawCaveLadder(ctx, ld, now) {
  const x = ld.x;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.18;
  const gr = ctx.createLinearGradient(0, 0, 0, FLOOR_U);
  gr.addColorStop(0, '#fff2c0'); gr.addColorStop(1, 'rgba(255,240,190,0)');
  ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(x - 24, 0); ctx.lineTo(x + 24, 0); ctx.lineTo(x + 70, FLOOR_U); ctx.lineTo(x - 70, FLOOR_U); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#7a5230'; ctx.fillRect(x - 16, 0, 4, FLOOR_U); ctx.fillRect(x + 12, 0, 4, FLOOR_U);
  for (let y = 4; y < FLOOR_U; y += 16) { ctx.fillStyle = '#a87a48'; ctx.fillRect(x - 14, y, 28, 4); ctx.fillStyle = '#5a3a20'; ctx.fillRect(x - 14, y + 4, 28, 2); }
}
function drawSand(ctx, s, w, now) {
  const y = GROUND;
  // superfície firme: mancha de areia que denuncia o poço
  ctx.fillStyle = '#9c7a44'; ctx.fillRect(s.cx - s.hw, y, s.hw * 2, 10);
  ctx.fillStyle = PAL.sand; ctx.fillRect(s.cx - s.hw, y, s.hw * 2, 3);
  for (let x = s.cx - s.hw + 4; x < s.cx + s.hw - 4; x += 12) { ctx.fillStyle = PAL.sand2; ctx.fillRect(x + ((x * 7) % 5), y + 4, 2, 2); }
  if (w < 2) return;
  // poço aberto: redemoinho de areia
  const ww = Math.round(w / 2) * 2;
  ctx.fillStyle = '#5a3a1a'; ctx.fillRect(s.cx - ww, y - 2, ww * 2, 18);
  ctx.fillStyle = '#7a5428'; ctx.fillRect(s.cx - ww + 6, y, ww * 2 - 12, 12);
  ctx.fillStyle = '#3a2410'; ctx.fillRect(s.cx - ww + 18, y + 4, Math.max(0, ww * 2 - 36), 6);
  ctx.fillStyle = PAL.sand;
  for (let k = 0; k < 8; k++) {
    const a = now / 500 + k * 0.8;
    const rx = Math.cos(a) * (ww - 10), ry = Math.sin(a) * 4;
    ctx.fillRect(Math.round(s.cx + rx), Math.round(y + 6 + ry), 4, 2);
  }
  if (Math.floor(now / 180) % 5 === 0) { ctx.fillStyle = '#c9a56a'; ctx.fillRect(s.cx - 4 + Math.sin(now) * ww * 0.5, y + 2, 4, 4); }
  // bordas da mancha
  ctx.fillStyle = PAL.sand2; ctx.fillRect(s.cx - ww - 2, y - 2, 4, 4); ctx.fillRect(s.cx + ww - 2, y - 2, 4, 4);
}
function drawVine(ctx, v, th) {
  // galho de onde pende o cipó
  ctx.fillStyle = '#3a2a1a'; ctx.fillRect(v.px - 70, v.py - 10, 140, 8); ctx.fillStyle = '#4f3a24'; ctx.fillRect(v.px - 70, v.py - 10, 140, 2);
  for (let k = -3; k <= 3; k++) pixCircle(ctx, v.px + k * 22, v.py - 18 - Math.abs(k) * 2, 14, k % 2 ? '#24402c' : '#2f5a36', 2);
  const s = Math.sin(th), c = Math.cos(th);
  for (let d = 0; d <= v.len; d += 4) {
    const wob = Math.sin(d / 18) * 1.5;
    const x = v.px + s * d + c * wob, y = v.py + c * d - s * wob;
    ctx.fillStyle = '#2a2414'; ctx.fillRect(Math.round(x) - 4, Math.round(y), 8, 4);
    ctx.fillStyle = d % 12 === 0 ? '#7a9a3a' : '#a08a4a';
    ctx.fillRect(Math.round(x) - 2, Math.round(y), 4, 4);
    if (d % 36 === 0 && d > 0) { ctx.fillStyle = PAL.fern; ctx.fillRect(Math.round(x) + 2, Math.round(y) - 2, 6, 4); ctx.fillRect(Math.round(x) - 8, Math.round(y) + 4, 6, 4); }
  }
}
function drawFire(ctx, f, floor, now) {
  if (f.lit) {
    drawGlow(ctx, f.x, floor - 24, 90 + Math.sin(now / 80) * 6, 'rgba(255,170,70,0.35)');
    ctx.drawImage(Art.fire[Math.floor(now / 110) % 4], Math.round(f.x - 24), floor - 50);
  } else ctx.drawImage(Art.fireOff, Math.round(f.x - 24), floor - 50);
}
function drawRuins(ctx, idol, now, taken) {
  const x = idol.x, y = GROUND;
  const block = (bx, by, bw, bh, c1, c2) => { ctx.fillStyle = c1; ctx.fillRect(bx, by, bw, bh); ctx.fillStyle = c2; ctx.fillRect(bx, by, bw, 4); ctx.fillStyle = PAL.stoneD; ctx.fillRect(bx, by + bh - 4, bw, 4); };
  // colunas e arcos cobertos de musgo
  for (const [ox, h] of [[-360, 230], [-230, 170], [160, 200], [300, 260]]) {
    block(x + ox, y - h, 44, h, PAL.stone, PAL.stone2);
    for (let yy = y - h + 12; yy < y; yy += 26) { ctx.fillStyle = PAL.stoneD; ctx.fillRect(x + ox, yy, 44, 2); }
    ctx.fillStyle = PAL.leaf; ctx.fillRect(x + ox - 4, y - h - 6, 52, 10);
    for (let k = 0; k < 6; k++) ctx.fillRect(x + ox + 4 + k * 7, y - h, 3, 20 + (k * 13) % 40);
  }
  block(x - 360, y - 250, 180, 26, PAL.stone, PAL.stone2);
  // pedestal com glifos
  block(x - 34, y - 44, 68, 44, '#6e756f', '#9aa19a');
  ctx.fillStyle = PAL.stoneD;
  for (let k = 0; k < 4; k++) { ctx.fillRect(x - 26 + k * 14, y - 32, 8, 2); ctx.fillRect(x - 24 + k * 14, y - 26, 4, 8); }
  ctx.fillStyle = PAL.gold; ctx.fillRect(x - 34, y - 46, 68, 2);
}
