// ============================================================ v2: geradores das fases 2 a 5 (8 áreas cada)
// Mesmo princípio da fase 1: modelos feitos à mão, a semente só sorteia variações dentro de faixas testadas.
// Distâncias calibradas pelo pulo do Zé: ~155 px correndo na mesma altura, ~137 px de altura máxima.

const NP = {
  // ---------------------------------------------------------- mangue
  // maré: a água sobe sobre o chão; raízes aéreas ficam acima da cheia. holes = raízes que faltam (trecho a pé na vazante)
  tide: (rng, { len = 420, period = 8.5, holes = [], w = 84, gap = 62, coin = true }) => ({
    w: len, place(L, x) {
      let i = 0, lastEnd = x + 60;
      for (let rx = x + 40; rx + w <= x + len - 30; rx += w + gap, i++) {
        lastEnd = rx + w;
        if (holes.includes(i)) continue;
        L.platforms.push({ kind: 'static', look: 'root', x1: rx, x2: rx + w, y: GROUND - 86 });
        if (coin && i % 2 === 1) L.treasures.push({ x: rx + w / 2, y: GROUND - 116, type: 'coin' });
      }
      L.tides.push({ x1: x, x2: lastEnd + 26, low: GROUND + 16, high: GROUND - 46, period, phase: rng.range(0, period) });
      L.announce.push({ x, what: 'mare' });
    },
  }),
  crabs: (rng, { span = 240, speed = 80, coin = true }) => ({
    w: span, place(L, x) {
      L.crabs.push({ a: x + 14, b: x + span - 14, speed, phase: rng.range(0, 1) });
      L.announce.push({ x, what: 'caranguejo' });
      if (coin) L.treasures.push({ x: x + span / 2, y: GROUND - 118, type: 'coin' });
    },
  }),
  mud: (rng, { len = 240 }) => ({ w: len, place(L, x) { L.muds.push({ x1: x, x2: x + len }); L.treasures.push({ x: x + len / 2, y: GROUND - 22, type: 'coin' }); } }),

  // ---------------------------------------------------------- serra
  rocks: (rng, { len = 380, count = 1, speed = 110, bounce = 16, coin = true }) => ({
    w: len, place(L, x) {
      L.rocks.push({ a: x, b: x + len, count, speed, phase: rng.range(0, len), floor: GROUND, r: 18, hop: rng.range(95, 125), bounce });
      L.announce.push({ x, what: 'pedra' });
      if (coin) L.treasures.push({ x: x + len * 0.5, y: GROUND - 124, type: 'coin' });
    },
  }),
  // rio com pedras de travessia que afundam e correnteza que puxa para trás
  river: (rng, { stones = 3, w = 74, gap = 66, current = -45, delay = 0.4, coin = true }) => {
    const len = gap + stones * (w + gap);
    return {
      w: len, place(L, x) {
        L.gaps.push({ x1: x, x2: x + len, kind: 'river' });
        for (let i = 0; i < stones; i++) {
          const sx = x + gap + i * (w + gap);
          L.platforms.push({ kind: 'sink', look: 'stone', x1: sx, x2: sx + w, y: GROUND + 4, delay, rate: 70, maxSink: 28, current });
        }
        L.announce.push({ x, what: 'correnteza' }, { x: x + 40, what: 'afunda' });
        if (coin) L.treasures.push({ x: x + gap + w + gap / 2, y: GROUND - 90, type: 'coin' });
      },
    };
  },
  fall: (rng, { w = 56 }) => ({
    w: w + 40, place(L, x) {
      L.waterfalls.push({ x: x + 20, w, top: 60, on: rng.range(1.3, 1.6), off: rng.range(1.8, 2.1), phase: rng.range(0, 3) });
      L.announce.push({ x, what: 'cachoeira' });
      L.treasures.push({ x: x + 20 + w / 2, y: GROUND - 30, type: 'coin' });
    },
  }),

  // ---------------------------------------------------------- caverna
  stal: (rng, { n = 3, step = 150 }) => ({
    w: step * n, place(L, x) {
      for (let i = 0; i < n; i++) { const sx = x + step * (i + 0.5) + rng.int(-14, 14); L.stalactites.push({ x: sx, y: 62, y0: 62, state: 'idle', t: 0 }); }
      L.announce.push({ x, what: 'estalactite' });
      L.treasures.push({ x: x + step * n / 2, y: GROUND - 22, type: 'coin' });
    },
  }),
  bats: (rng, { span = 300, speed = 110 }) => ({
    w: span, place(L, x) {
      L.bats.push({ a: x, b: x + span, speed, phase: rng.range(0, 1), y: GROUND - 74, amp: 34, wave: rng.range(32, 42) });
      L.announce.push({ x, what: 'morcego' });
      L.treasures.push({ x: x + span / 2, y: GROUND - 22, type: 'coin' });
    },
  }),
  // abismo com lajes que desmoronam
  slabs: (rng, { n = 3, w = 76, gap = 60, delay = 0.38, coin = true }) => {
    const len = gap + n * (w + gap);
    return {
      w: len, place(L, x) {
        L.gaps.push({ x1: x, x2: x + len, kind: 'pit' });
        for (let i = 0; i < n; i++) { const sx = x + gap + i * (w + gap); L.platforms.push({ kind: 'crumble', look: 'slab', x1: sx, x2: sx + w, y: GROUND, delay }); }
        L.announce.push({ x, what: 'fragil' });
        if (coin) L.treasures.push({ x: x + gap + w / 2 + (w + gap), y: GROUND - 34, type: 'jewel' });
      },
    };
  },
  // vagonete: abismo largo atravessado sobre o trilho
  cart: (rng, { len = 520, speed = 150, wait = 1.4 }) => ({
    w: len, place(L, x) {
      L.gaps.push({ x1: x, x2: x + len, kind: 'pit' });
      const c = { a: x + 40, b: x + len - 40, speed, wait, phase: rng.range(0, 6), y: GROUND + 30 };
      L.carts.push(c);
      L.platforms.push({ kind: 'move', look: 'cart', x1: c.a - 36, x2: c.a + 36, cart: c });
      L.announce.push({ x, what: 'vagonete' });
      L.treasures.push({ x: x + len / 2, y: GROUND - 60, type: 'coin' });
    },
  }),
  scorps: (rng, { span = 260, speed = 70 }) => ({
    w: span, place(L, x) { L.scorpions.push({ a: x, b: x + span, speed, phase: rng.range(0, 1) }); L.announce.push({ x, what: 'escorpiao' }); },
  }),
};

function shuffled(rng, arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rng.int(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function relicArea(S, x, relic) {
  S.idol = { x: x + 730, y: GROUND - 40, taken: false, relic };
  S.treasures.push({ x: x + 330, y: GROUND - 22, type: 'coin' }, { x: x + 470, y: GROUND - 110, type: 'coin' });
}

// ---------------------------------------------------------- fase 2 · Mangue na maré
FASE_GEN[2] = seed => {
  const rng = mulberry32(seed), S = newLevel('surface', AREA_W * 8, 'mangue'), ax = i => (i - 1) * AREA_W, tpl = [];
  S.signs.push({ x: ax(1) + 200, lines: ['RAÍZES SALVAM', 'DA MARÉ'] });
  layout(S, rng, ax(1) + 320, ax(1) + 920, [NP.tide(rng, { len: 480, period: rng.range(8.5, 9.5) })], 1); tpl.push('mare');
  layout(S, rng, ax(2) + 60, ax(2) + 920, [NP.crabs(rng, { span: 240, speed: rng.range(60, 75) }), NP.crabs(rng, { span: 240, speed: rng.range(75, 90), coin: false })], 1); tpl.push('caranguejo');
  layout(S, rng, ax(3) + 60, ax(3) + 930, [NP.mud(rng, { len: rng.int(200, 240) }), NP.tide(rng, { len: 420, period: rng.range(8.0, 9.0), holes: [1] })], 0); tpl.push('lama');
  S.fires.push({ x: ax(4) + 110, lit: false });
  layout(S, rng, ax(4) + 220, ax(4) + 930, [Piece.crocs(rng, { closed: rng.range(2.6, 3.0), open: rng.range(1.3, 1.5) })], 1); tpl.push('jacare');
  const POOL = {
    tide_crabs: () => [NP.tide(rng, { len: 420, period: rng.range(7.5, 8.5), holes: [rng.int(1, 2)] }), NP.crabs(rng, { span: 220, speed: rng.range(80, 95) })],
    mud_logs: () => [NP.mud(rng, { len: 220 }), Piece.logs(rng, { count: 2, speed: rng.range(85, 100), len: 300 })],
    crocs_tide: () => [Piece.crocs(rng, { closed: rng.range(2.2, 2.5), open: rng.range(1.2, 1.4), stagger: rng.range(0.3, 0.45) }), Piece.space(60), NP.tide(rng, { len: 260, period: rng.range(7.5, 8.5) })],
    sand_crabs: () => [Piece.sand(rng, { hw: rng.int(100, 112), closed: rng.range(2.0, 2.4), open: 1.7, trans: 0.5 }), NP.crabs(rng, { span: 220, speed: rng.range(80, 95), coin: false })],
  };
  const keys = shuffled(rng, Object.keys(POOL));
  layout(S, rng, ax(5) + 60, ax(5) + 930, POOL[keys[0]](), 1);
  S.fires.push({ x: ax(6) + 60, lit: false });
  layout(S, rng, ax(6) + 140, ax(6) + 940, POOL[keys[1]](), 1);
  tpl.push(keys[0], keys[1]);
  layout(S, rng, ax(7) + 50, ax(7) + 940, [NP.tide(rng, { len: 560, period: rng.range(7.5, 8.2), holes: [1, 3] }), NP.crabs(rng, { span: 200, speed: 90, coin: false })], 0); tpl.push('mare_final');
  relicArea(S, ax(8), 'concha'); tpl.push('concha');
  return { seed, surface: S, under: [], templates: tpl };
};

// ---------------------------------------------------------- fase 3 · Serra e cachoeira
FASE_GEN[3] = seed => {
  const rng = mulberry32(seed), S = newLevel('surface', AREA_W * 8, 'serra'), ax = i => (i - 1) * AREA_W, tpl = [];
  S.signs.push({ x: ax(1) + 200, lines: ['PEDRA ROLANDO:', 'PULE NA HORA'] });
  layout(S, rng, ax(1) + 340, ax(1) + 930, [NP.rocks(rng, { len: 480, count: 1, speed: rng.range(85, 100) })], 1); tpl.push('pedra');
  layout(S, rng, ax(2) + 80, ax(2) + 920, [NP.river(rng, { stones: 3, delay: 0.5 })], 1); tpl.push('rio');
  layout(S, rng, ax(3) + 60, ax(3) + 930, [NP.fall(rng, {}), NP.rocks(rng, { len: 360, count: 1, speed: rng.range(100, 115), coin: false })], 1); tpl.push('cachoeira');
  S.fires.push({ x: ax(4) + 110, lit: false });
  layout(S, rng, ax(4) + 220, ax(4) + 930, [Piece.crocs(rng, { closed: rng.range(2.3, 2.7), open: rng.range(1.3, 1.5), stagger: rng.range(0.2, 0.4) })], 1); tpl.push('jacare');
  const POOL = {
    rocks_sand: () => [NP.rocks(rng, { len: 300, count: 1, speed: rng.range(105, 120) }), Piece.sand(rng, { hw: rng.int(100, 112), closed: rng.range(2.0, 2.3), open: 1.7, trans: 0.5 })],
    river_fall: () => [NP.river(rng, { stones: 3, delay: 0.42 }), NP.fall(rng, {})],
    logs_rocks: () => [Piece.logs(rng, { count: 1, speed: rng.range(90, 105), len: 260, coin: false }), NP.rocks(rng, { len: 340, count: 2, speed: rng.range(100, 115) })],
    pond_rocks: () => [Piece.pond(rng, { hw: rng.int(98, 108), T: rng.range(2.6, 2.9) }), NP.rocks(rng, { len: 300, count: 1, speed: 115, coin: false })],
  };
  const keys = shuffled(rng, Object.keys(POOL));
  layout(S, rng, ax(5) + 60, ax(5) + 930, POOL[keys[0]](), 1);
  S.fires.push({ x: ax(6) + 100, lit: false });
  layout(S, rng, ax(6) + 200, ax(6) + 930, POOL[keys[1]](), 1);
  tpl.push(keys[0], keys[1]);
  layout(S, rng, ax(7) + 40, ax(7) + 940, [NP.river(rng, { stones: 4, delay: 0.38, current: -55 }), NP.rocks(rng, { len: 280, count: 1, speed: 120, coin: false })], 0); tpl.push('rio_final');
  relicArea(S, ax(8), 'mascara'); tpl.push('mascara');
  return { seed, surface: S, under: [], templates: tpl };
};

// ---------------------------------------------------------- fase 4 · Copa das árvores (sem chão: cair é perder vida)
// Montada em sequência com um cursor: entre as peças há vazio de verdade, então os espaços são fixos.
FASE_GEN[4] = seed => {
  const rng = mulberry32(seed), S = newLevel('surface', AREA_W * 8, 'copa'), ax = i => (i - 1) * AREA_W, tpl = [];
  S.noGround = true;
  let x = 0, top = GROUND;
  const deck = (w, dy = 0, coin = false) => {
    top = GROUND + dy;
    S.platforms.push({ kind: 'static', look: 'branch', x1: x, x2: x + w, y: top });
    if (coin) S.treasures.push({ x: x + w / 2, y: top - 22, type: 'coin' });
    x += w;
  };
  const vacuo = w => { x += w; };
  const bridge = (w = 260) => {
    S.platforms.push({ kind: 'bob', look: 'bridge', x1: x, x2: x + w, y: GROUND, A: 7, T: rng.range(2.2, 2.7), ph: rng.range(0, 6) });
    S.announce.push({ x: x - 100, what: 'ponte' });
    S.treasures.push({ x: x + w / 2, y: GROUND - 60, type: 'coin' });
    x += w;
  };
  const dry = (n = 3, delay = 0.42) => {
    S.announce.push({ x: x - 80, what: 'galho' });
    for (let i = 0; i < n; i++) {
      vacuo(58);
      S.platforms.push({ kind: 'crumble', look: 'dry', x1: x, x2: x + 80, y: GROUND, delay });
      if (i === 1) S.treasures.push({ x: x + 40, y: GROUND - 34, type: 'coin' });
      x += 80;
    }
    vacuo(58);
  };
  const zip = (span = 420) => { // a pista começa sobre o fim do galho atual
    const x1 = x - 40, x2 = x + span;
    S.ziplines.push({ x1, y1: GROUND - 132, x2, y2: GROUND - 92, speed: 300 });
    S.announce.push({ x: x1 - 160, what: 'tirolesa' });
    S.treasures.push({ x: x1 + (x2 - x1) * 0.55, y: lerp(GROUND - 132, GROUND - 92, 0.55) + 40, type: 'jewel' });
    x = x2 - 60;
  };
  const vine = (gw = 220) => {
    S.vines.push({ px: x + gw / 2, py: 66, len: 240, A: 0.62, T: rng.range(2.7, 3.0), phase: rng.range(0, 3) });
    S.announce.push({ x: x - 60, what: 'cipo' });
    S.treasures.push({ x: x + gw / 2, y: 66 + 240 + 34, type: 'coin' });
    vacuo(gw);
  };
  const monkey = (dx, period = 2.4) => { S.monkeys.push({ x: x - dx, y: GROUND - 150, period, phase: rng.range(0, period) }); S.announce.push({ x: x - dx - 400, what: 'macaco' }); };
  const until = end => { if (x < end) deck(end - x); };

  // área 1: galhos largos e vãos curtos — aprender que não há chão
  deck(420, 0, true); S.signs.push({ x: 230, lines: ['NÃO HÁ CHÃO:', 'CUIDADO NO VÃO'] });
  vacuo(80); deck(200, -30, true); vacuo(90); deck(260, 0); tpl.push('copa');
  // área 2: ponte de cipó
  vacuo(6); bridge(rng.int(240, 280)); vacuo(6); deck(180, 0, true); vacuo(86); until(ax(3)); tpl.push('ponte');
  // área 3: galhos secos
  deck(140); dry(3, 0.45); deck(220, 0, true); until(ax(4) + 40); tpl.push('galho');
  // área 4: fogueira e macaco num galho largo
  S.fires.push({ x: ax(4) + 140, lit: false, y: GROUND });
  deck(520, 0, true); monkey(40, rng.range(2.4, 2.8)); vacuo(90); deck(200, -30); until(ax(5)); tpl.push('macaco');
  // áreas 5 e 6: combinações sorteadas
  const POOL = {
    zip: () => { deck(220); zip(rng.int(380, 440)); deck(260, 0, true); },
    bridge_monkey: () => { deck(160); vacuo(6); bridge(280); vacuo(6); deck(320, 0, true); monkey(60); },
    dry_bridge: () => { deck(120); dry(2, 0.4); deck(100); vacuo(6); bridge(240); vacuo(6); deck(160, 0, true); },
    vine_dry: () => { deck(200); vine(rng.int(200, 230)); deck(140); dry(2, 0.4); deck(160, 0, true); },
  };
  const keys = shuffled(rng, Object.keys(POOL));
  POOL[keys[0]](); until(ax(6));
  S.fires.push({ x: ax(6) + 100, lit: false, y: GROUND });
  deck(260); POOL[keys[1]](); until(ax(7));
  tpl.push(keys[0], keys[1]);
  // área 7: desafio final — tirolesa, galhos secos e macaco
  deck(180); zip(400); deck(200, 0, true); monkey(30); dry(2, 0.38); until(ax(8)); tpl.push('copa_final');
  // área 8: o ninho do gavião-real com a pena
  until(S.len);
  relicArea(S, ax(8), 'pena');
  return { seed, surface: S, under: [], templates: tpl };
};

// ---------------------------------------------------------- fase 5 · Caverna do ouro (final)
FASE_GEN[5] = seed => {
  const rng = mulberry32(seed), S = newLevel('surface', AREA_W * 8, 'caverna'), ax = i => (i - 1) * AREA_W, tpl = [];
  S.signs.push({ x: ax(1) + 200, lines: ['OLHO NO TETO', 'E NÃO PARE'] });
  layout(S, rng, ax(1) + 340, ax(1) + 930, [NP.stal(rng, { n: 3, step: 160 })], 1); tpl.push('estalactite');
  layout(S, rng, ax(2) + 60, ax(2) + 920, [NP.bats(rng, { span: 320, speed: rng.range(90, 105) })], 1); tpl.push('morcego');
  layout(S, rng, ax(3) + 80, ax(3) + 920, [NP.slabs(rng, { n: 3, delay: 0.42 })], 1); tpl.push('chao');
  S.fires.push({ x: ax(4) + 110, lit: false });
  layout(S, rng, ax(4) + 230, ax(4) + 930, [NP.cart(rng, { len: rng.int(480, 540), speed: rng.range(140, 160) })], 0); tpl.push('vagonete');
  const POOL = {
    stal_bats: () => [NP.stal(rng, { n: 2, step: 150 }), NP.bats(rng, { span: 260, speed: rng.range(100, 115) })],
    slabs_scorps: () => [NP.slabs(rng, { n: 2, delay: 0.38 }), NP.scorps(rng, { span: 260, speed: rng.range(65, 80) })],
    bats_sand: () => [NP.bats(rng, { span: 260, speed: 105 }), Piece.sand(rng, { hw: rng.int(100, 112), closed: rng.range(2.0, 2.3), open: 1.7, trans: 0.5 })],
    scorps_stal: () => [NP.scorps(rng, { span: 240, speed: 75 }), NP.stal(rng, { n: 2, step: 150 })],
  };
  const keys = shuffled(rng, Object.keys(POOL));
  layout(S, rng, ax(5) + 60, ax(5) + 930, POOL[keys[0]](), 1);
  S.fires.push({ x: ax(6) + 100, lit: false });
  layout(S, rng, ax(6) + 200, ax(6) + 930, POOL[keys[1]](), 1);
  tpl.push(keys[0], keys[1]);
  layout(S, rng, ax(7) + 40, ax(7) + 940, [NP.slabs(rng, { n: 2, delay: 0.36, coin: false }), NP.cart(rng, { len: 420, speed: 160, wait: 1.2 })], 0); tpl.push('caverna_final');
  relicArea(S, ax(8), 'coracao'); tpl.push('coracao');
  return { seed, surface: S, under: [], templates: tpl };
};
