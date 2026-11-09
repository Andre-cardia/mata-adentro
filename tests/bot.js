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
  window.botMany = (seeds, opts) => seeds.map(s => { const r = bot(s, opts); return `${s} ${r.route}: ${r.result} em ${r.tempo}, vidas ${r.lives}, pontos ${r.score}, mortes ${JSON.stringify(r.deaths)}, tropeços ${r.trips} [${r.modelos}]`; });
})();
