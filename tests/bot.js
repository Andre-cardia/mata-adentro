// ============================================================ teste automático: robô que lê o ritmo dos perigos
// Só entra na versão de teste (python3 build.py --test). Uso no console: bot(semente) ou botMany([...]).
(() => {
  const K = { down: c => dispatchEvent(new KeyboardEvent('keydown', { code: c })), up: c => dispatchEvent(new KeyboardEvent('keyup', { code: c })) };
  const releaseAll = () => ['ArrowRight', 'ArrowLeft', 'Space', 'ArrowDown', 'ArrowUp'].forEach(K.up);
  const closedLeft = (c, t) => { const per = c.closed + c.open; const p = ((t + c.phase) % per + per) % per; return p < c.closed ? c.closed - p : -1; };
  const sandClosedLeft = (s, t) => { const per = s.closed + s.open + s.trans * 2; const p = ((t + s.phase) % per + per) % per; return p < s.closed ? s.closed - p : -1; };

  // route: 'surface' (só superfície) ou 'under' (desce as escadas e usa os atalhos)
  function bot(seed, { route = 'surface', maxSec = 330 } = {}) {
    MA.state = 'title';
    const g = new Game(seed);
    releaseAll(); Input.poll();
    const deaths = [], trips = []; let frames = 0, wasDead = false, wasTrip = false; const plan = {};
    const press = (c, on) => on ? K.down(c) : K.up(c);
    while (frames < maxSec * 60 && !g.over) {
      const p = g.p, t = g.t, L = g.L;
      let right = true, jump = false, down = false, up = false;
      if (p.state === 'dead') right = false;
      else if (p.state === 'ladder') { right = false; if (L.kind === 'surface') { down = p.ladder.link.end === 'in'; up = !down; } else { up = p.ladder.link.end === 'out'; down = !up; } }
      else if (p.state === 'vine') {
        const st = vineState(p.vine, t); right = false;
        jump = st.th > p.vine.A * 0.8;
      } else if (p.onGround) {
        const x = p.x;
        if (L.kind === 'under') {
          const out = L.ladders[1];
          if (Math.abs(x - out.x) < 10) { up = true; right = false; }
          else if (x > out.x) right = false;
          for (const s of L.scorpions) {
            const sp = scorpionPos(s, t), d = sp.x - x;
            if (sp.dir < 0 && d > 30 && d < 100) jump = true;          // vindo na direção do Zé: pula por cima
            if (sp.dir > 0 && d > 0 && d < 150) right = false;          // indo embora: espera ele virar
          }
        } else {
          if (route === 'under') {
            const ld = L.ladders.find(l => l.link.end === 'in' && Math.abs(x - l.x) < 10);
            if (ld) { down = true; right = false; }
          }
          const gap = L.gaps.find(q => q.x2 > x - 4 && q.x1 < x + 260);
          const sand = L.sands.find(s => s.cx + s.hw > x - 4 && s.cx - s.hw < x + 200);
          const crocs = gap ? L.crocs.filter(c => c.x > gap.x1 && c.x < gap.x2).sort((a, b) => a.x - b.x) : [];
          const vine = gap ? L.vines.find(v => v.px > gap.x1 && v.px < gap.x2) : null;
          if (crocs.length) {
            let idx = -1; crocs.forEach((c, i) => { if (Math.abs(x - c.x) <= c.hw + 2) idx = i; });
            if (idx === -1 && x < gap.x1 - 17) { right = true; plan.crocGo = false; }
            else if (idx === -1 && !plan.crocGo) {
              // só parte se cada cabeça estiver fechada quando o Zé passar por ela
              right = false;
              const ok = crocs.every((c, i) => { const a0 = t + 0.5 + 0.76 * i; return closedLeft(c, a0) > 0.45; });
              if (ok) { plan.crocGo = true; }
            }
            if (plan.crocGo || idx >= 0) { jump = true; right = true; }
          } else if (gap && vine) {
            if (x < gap.x1 - 26) right = true;
            else { const st = vineState(vine, t); right = false; if (st.th < -vine.A * 0.5 && st.dth < 0) { jump = true; right = true; } }
          } else if (gap) {
            if (x > gap.x1 - 24) jump = true;
          } else if (sand) {
            const edge = sand.cx - sand.hw - 14;
            const need = (sand.hw * 2 + 30) / PHYS.RUN + 0.2;
            if (x < edge - 6) { right = true; plan.sandGo = false; }
            else if (!plan.sandGo) { right = false; if (sandClosedLeft(sand, t) > need) plan.sandGo = true; }
            if (plan.sandGo) right = true;
          }
          for (const lg of L.logs) for (const lx of logPositions(lg, t)) if (lx > x + 20 && lx < x + 95) jump = true;
        }
      } else {
        jump = Input.held('jump') && p.vy < 0;
        // no ar sobre jacarés: solta a direção perto do alvo para não passar da cabeça
        const gap = g.L.gaps.find(q => p.x > q.x1 && p.x < q.x2);
        right = true;
        if (gap && p.vy > 0) { const c = g.L.crocs.find(c => Math.abs(p.x - c.x) < c.hw - 10); if (c) right = false; }
      }
      press('ArrowRight', right); press('Space', jump); press('ArrowDown', down); press('ArrowUp', up && !jump);
      Input.poll(); g.update(1 / 60); frames++;
      if (frames % 5 === 0) { g.draw(ctx, frames * 16.7); drawHUD(g, frames * 16.7); } // desenha também: pega erros de render
      const dead = g.p.state === 'dead';
      if (dead && !wasDead) deaths.push([g.p.deadKind, Math.round(g.p.x), g.levelId === 'surface' ? 'área ' + g.area : 'sub ' + g.levelId]);
      wasDead = dead;
      const tr = g.p.state === 'trip'; if (tr && !wasTrip) trips.push(Math.round(g.p.x)); wasTrip = tr;
      while (g.events.length) { const e = g.events.shift(); if (e === 'respawn') g.respawn(); }
    }
    releaseAll();
    return { seed, route, result: g.over || 'timeout', tempo: Math.round(TIME_LIMIT - g.time) + 's', score: g.score, lives: g.lives, deaths, trips: trips.length, coins: g.collected.coin, jewels: g.collected.jewel, modelos: g.world.templates.slice(5, 9).join(',') };
  }
  window.bot = bot;

  // ---------------------------------------------------------- robô planejador (fases 2 a 5)
  // Copia a partida, simula jogadas curtas e executa a que sobrevive e avança mais.
  // Os perigos são ligados ao relógio do jogo, então a simulação prevê exatamente o que vai acontecer.
  const KS = { right: false, left: false, jump: false, jpress: false };
  const realInput = { held: Input.held, pressed: Input.pressed };
  const fakeHeld = a => a === 'right' ? KS.right : a === 'left' ? KS.left : a === 'jump' ? KS.jump : false;
  const fakePressed = a => a === 'jump' ? KS.jpress : false;
  const realSnd = { sfx: Snd.sfx, voice: Snd.voice };
  function cloneGame(g) {
    const c = structuredClone(Object.assign({}, g, { particles: [], popups: [], fireflies: [], events: [] }));
    Object.setPrototypeOf(c, Game.prototype);
    return c;
  }
  const M = {
    R: n => ({ id: 'R' + n, keys: (g, f) => f < n ? { right: 1 } : null }),
    W: n => ({ id: 'W' + n, keys: (g, f) => f < n ? {} : null }),
    L: n => ({ id: 'L' + n, keys: (g, f) => f < n ? { left: 1 } : null }),
    // pulo: dir = sentido segurado; full = segura o pulo até o alto; termina ao pousar ou mudar de estado
    J: (dir = 1, full = true, id = 'J') => ({ id, keys: (g, f) => {
      const st = g.p.state;
      if (f > 0 && (f > 90 || st === 'dead' || g.over || (f > 2 && g.p.onGround) || (f > 2 && st !== 'normal' && st !== 'trip'))) return null;
      return { right: dir > 0, left: dir < 0, jump: f === 0 || (full && g.p.vy < 0 && f < 40), jpress: f === 0 };
    } }),
  };
  // caindo num abismo (ou no vazio da copa) abaixo da beira: a morte já é certa
  const doomed = g => { const p = g.p, L = g.L; return p.state === 'normal' && !p.onGround && p.vy > 0 && p.y > L.floor + 30 && (L.noGround || L.gaps.some(q => q.kind === 'pit' && p.x > q.x1 - 10 && p.x < q.x2 + 10)); };
  function runMacro(g, m, rec) {
    let f = 0;
    for (; ; f++) {
      const k = m.keys(g, f);
      if (!k) break;
      KS.jpress = k.jpress !== undefined ? !!k.jpress : (!!k.jump && !KS.jump);
      KS.right = !!k.right; KS.left = !!k.left; KS.jump = !!k.jump;
      g.update(1 / 60);
      if (rec) rec(g);
      else if (doomed(g)) { g.p.state = 'dead'; g.p.deadKind = 'queda'; }
      if (g.p.state === 'dead' || g.over) { f++; break; }
    }
    return f;
  }
  // morrer só no fim do horizonte ainda deixa ~1 s para reagir: conta como avanço, com penalidade
  let PEN = 250; // cai quando o Zé fica parado demais (contra-empaque)
  function score(c, frames, dead) {
    if (c.over === 'win') return 1e7 - frames;
    if (dead) return frames >= 54 ? c.p.x - PEN : -1e6 + frames;
    // terminar dentro de um lago (em cima de um jacaré) não conta como avanço seguro
    const inGap = !c.p.plat && c.L.gaps.some(q => c.p.x > q.x1 && c.p.x < q.x2);
    return c.p.x - (c.p.state === 'trip' ? 40 : 0) - (inGap ? 400 : 0);
  }
  function simulate(g, macros) {
    const c = cloneGame(g); let frames = 0;
    for (const m of macros) { frames += runMacro(c, m); if (c.p.state === 'dead' || c.over) break; }
    return { c, frames, dead: c.p.state === 'dead', s: score(c, frames, c.p.state === 'dead') };
  }
  const FIRST = () => [M.R(6), M.W(6), M.J(1, true, 'J'), M.J(1, false, 'JS'), M.J(0, true, 'JN'), M.L(6)];
  const CONT = () => [[M.R(96)], [M.W(96)], [M.J(1), M.R(60)], [M.W(30), M.R(70)], [M.J(1, false), M.R(60)], [M.W(24), M.J(1), M.R(50)],
    [M.J(1), M.J(1), M.R(40)], [M.J(1), M.J(1), M.J(1), M.R(30)], [M.R(6), M.J(1), M.J(1), M.R(40)], [M.W(12), M.J(1), M.J(1), M.R(40)],
    [M.J(1), M.J(1), M.J(1), M.J(1), M.R(30)], [M.R(12), M.J(1), M.J(1), M.J(1), M.R(30)]];
  function decide(g) {
    Snd.sfx = () => { }; Snd.voice = () => { };
    try {
      // atalho: correr agora e continuar correndo sobrevive? então corre
      const fast = simulate(g, [M.R(6), M.R(96)]);
      if (!fast.dead) return M.R(6);
      let best = null, bestS = -Infinity;
      for (const m of FIRST()) {
        const c0 = cloneGame(g); const f0 = runMacro(c0, m);
        if (c0.p.state === 'dead' || c0.over) { const s = score(c0, f0, c0.p.state === 'dead'); if (s > bestS) { bestS = s; best = m; } continue; }
        for (const cont of CONT()) {
          const r = simulate(c0, cont);
          const s = r.dead ? score(r.c, f0 + r.frames, true) : r.s;
          if (s > bestS) { bestS = s; best = m; }
        }
      }
      return FIRST().find(m => m.id === best.id);
    } finally { Snd.sfx = realSnd.sfx; Snd.voice = realSnd.voice; }
  }
  // regras do robô da fase 1 para os perigos antigos (jacarés, cipó sobre lagoa, areia movediça)
  function classicKeys(g, plan) {
    const p = g.p, t = g.t, L = g.L, x = p.x;
    if (p.state === 'vine') { plan.mode = 'classic'; const st = vineState(p.vine, t); return { jump: st.th > p.vine.A * 0.8 }; }
    if (p.state !== 'normal' && p.state !== 'trip') return null;
    if (!p.onGround) {
      if (plan.mode !== 'classic') return null;
      const gap = L.gaps.find(q => p.x > q.x1 && p.x < q.x2);
      let right = true;
      if (gap && p.vy > 0) { const c = L.crocs.find(c => Math.abs(p.x - c.x) < c.hw - 10); if (c) right = false; }
      return { right, jump: KS.jump && p.vy < 0 };
    }
    if (p.plat) { plan.mode = null; return null; }
    const gap = L.gaps.find(q => q.x2 > x - 4 && q.x1 < x + 420 && q.kind === 'water');
    const crocs = gap ? L.crocs.filter(c => c.x > gap.x1 && c.x < gap.x2).sort((a, b) => a.x - b.x) : [];
    const vine = gap ? L.vines.find(v => v.px > gap.x1 && v.px < gap.x2) : L.vines.find(v => v.px - x > 0 && v.px - x < 240 && !L.platforms.some(pl => pl.x1 <= v.px && pl.x2 >= v.px));
    const sand = L.sands.find(q => q.cx + q.hw > x - 4 && q.cx - q.hw < x + 360);
    if (crocs.length) {
      plan.mode = 'classic';
      let idx = -1; crocs.forEach((c, i) => { if (Math.abs(x - c.x) <= c.hw + 2) idx = i; });
      if (idx === -1 && x < gap.x1 - 120) { plan.crocGo = false; plan.mode = null; return null; } // até perto da beira, quem decide é o planejador
      if (idx === -1 && x < gap.x1 - 17) { plan.crocGo = false; return { right: true }; }
      if (idx === -1 && !plan.crocGo) {
        const ok = crocs.every((c, i) => closedLeft(c, t + 0.5 + 0.76 * i) > 0.45);
        if (!ok) return {};
        plan.crocGo = true;
      }
      return { right: true, jump: true };
    }
    if (vine) {
      plan.mode = 'classic';
      const edge = gap ? gap.x1 : (g.L.platforms.find(pl => x >= pl.x1 - 8 && x <= pl.x2 + 8) || {}).x2;
      if (edge === undefined || x < edge - 120) { plan.mode = null; return null; }
      if (x < edge - 26) return { right: true };
      const st = vineState(vine, t);
      if (st.th < -vine.A * 0.5 && st.dth < 0) return { right: true, jump: true };
      return {};
    }
    if (gap && gap.x1 < x + 260 && !L.platforms.some(pl => pl.x1 >= gap.x1 && pl.x2 <= gap.x2)) { plan.mode = 'classic'; return { right: true, jump: x > gap.x1 - 24 }; }
    if (sand && !gap) {
      plan.mode = 'classic';
      const edge = sand.cx - sand.hw - 14, need = (sand.hw * 2 + 30) / PHYS.RUN + 0.2;
      if (x < edge - 40) { plan.sandGo = false; plan.mode = null; return null; }
      if (x < edge - 6) { plan.sandGo = false; return { right: true }; }
      if (!plan.sandGo) { if (sandClosedLeft(sand, t) > need) plan.sandGo = true; else return {}; }
      return { right: true };
    }
    plan.mode = null;
    return null;
  }
  const once = k => ({ id: 'classic', keys: (g, f) => f < 1 ? k : null });
  function planBot(seed, phase, { maxSec = 330, startX = 0, log = null, logEvery = 30 } = {}) {
    MA.state = 'title';
    const g = new Game(seed, { phase });
    if (startX) { g.p.x = startX; g.checkpoint.x = startX; g.cam = clamp(startX - W * 0.42, 0, g.L.len - W); }
    Input.held = fakeHeld; Input.pressed = fakePressed;
    const deaths = [], trips = []; let frames = 0, wasDead = false, wasTrip = false, decisions = 0;
    const t0 = performance.now(), plan = {};
    const rec = gg => {
      frames++;
      if (frames % 5 === 0) { gg.draw(ctx, frames * 16.7); drawHUD(gg, frames * 16.7); }
      const dead = gg.p.state === 'dead';
      if (dead && !wasDead) deaths.push([gg.p.deadKind, Math.round(gg.p.x), 'área ' + gg.area]);
      wasDead = dead;
      const tr = gg.p.state === 'trip'; if (tr && !wasTrip) trips.push(Math.round(gg.p.x)); wasTrip = tr;
      while (gg.events.length) { const e = gg.events.shift(); if (e === 'respawn') gg.respawn(); }
    };
    try {
      while (frames < maxSec * 60 && !g.over) {
        if (g.p.state === 'dead') { plan.bestX = 0; plan.bestT = g.t; runMacro(g, M.W(1), rec); continue; }
        const ck = classicKeys(g, plan);
        if (log && frames - (plan.lastLog || -99) >= logEvery) plan.lastLog = frames, log.push([frames, Math.round(g.p.x), Math.round(g.p.y), g.p.state, g.p.onGround, ck ? JSON.stringify(ck) : 'plan', plan.mode || '', !!plan.crocGo]);
        if (ck) { runMacro(g, once(ck), rec); continue; }
        if (g.p.x > (plan.bestX || 0) + 20) { plan.bestX = g.p.x; plan.bestT = g.t; }
        // normalmente sobreviver sempre ganha; só quando o Zé empaca a morte tardia passa a contar como avanço
        const stall = g.t - (plan.bestT || 0);
        PEN = stall < 2.5 ? 5000 : Math.max(0, 400 - (stall - 2.5) * 80);
        const m = decide(g); decisions++;
        if (log && logEvery < 30) log.push(['  →', m.id, 'PEN', Math.round(PEN), 'plat', g.p.plat ? g.p.plat.kind : '-', g.L.carts.length ? Math.round(cartPos(g.L.carts[0], g.t)) : '']);
        runMacro(g, m, rec);
      }
    } finally { Input.held = realInput.held; Input.pressed = realInput.pressed; KS.right = KS.left = KS.jump = KS.jpress = false; }
    return { seed, phase, result: g.over || 'timeout', tempo: Math.round(TIME_LIMIT - g.time) + 's', lives: g.lives, score: g.score, deaths, trips: trips.length, coins: g.collected.coin, jewels: g.collected.jewel, modelos: g.world.templates.join(','), ms: Math.round(performance.now() - t0), decisions };
  }
  window.planBot = planBot;
  window.__dbg = { decide, simulate, cloneGame, M, runMacro, KS, score, FIRST, CONT, fakeHeld, fakePressed };
  window.planMany = (seeds, phase, opts) => seeds.map(s => { const r = planBot(s, phase, opts); return `F${phase} ${s}: ${r.result} em ${r.tempo}, vidas ${r.lives}, pontos ${r.score}, mortes ${JSON.stringify(r.deaths)}, tropeços ${r.trips}, ${r.ms} ms [${r.modelos}]`; });
  window.botMany = (seeds, opts) => seeds.map(s => { const r = bot(s, opts); return `${s} ${r.route}: ${r.result} em ${r.tempo}, vidas ${r.lives}, pontos ${r.score}, mortes ${JSON.stringify(r.deaths)}, tropeços ${r.trips} [${r.modelos}]`; });
})();
