// ============================================================ gerador do mundo: 10 áreas por semente + 2 subterrâneos
// Cada área sorteia um modelo de um catálogo feito à mão; a semente só decide variações
// dentro de faixas testadas (ritmos, larguras, tesouros, presença de cipó) — toda área é vencível.

function newLevel(kind, len, theme = 'mata') {
  return {
    kind, len, theme, floor: kind === 'surface' ? GROUND : FLOOR_U, areas: Math.round(len / AREA_W), noGround: false,
    gaps: [], crocs: [], sands: [], logs: [], vines: [], ladders: [], fires: [],
    treasures: [], signs: [], scorpions: [], props: [], announce: [], idol: null,
    // v2: plataformas, zonas e perigos das fases novas (listas vazias = comportamento da fase 1)
    platforms: [], muds: [], tides: [], currents: [], waterfalls: [],
    rocks: [], crabs: [], bats: [], stalactites: [], monkeys: [], ziplines: [], carts: [],
  };
}

// ---------------------------------------------------------- campanha: 5 fases
const FASES = [
  null,
  { id: 1, key: 'mata', nome: 'MATA ADENTRO', reliquia: 'ÍDOLO DE OURO', relic: 'idolo', areas: 10, music: 'mus_mata', amb: 'amb_mata', abertura: 'abertura' },
  { id: 2, key: 'mangue', nome: 'MANGUE NA MARÉ', reliquia: 'CONCHA DOURADA', relic: 'concha', areas: 8, music: 'mus_mangue', amb: 'amb_mangue', abertura: 'f2_abertura' },
  { id: 3, key: 'serra', nome: 'SERRA E CACHOEIRA', reliquia: 'MÁSCARA DE PEDRA-VERDE', relic: 'mascara', areas: 8, music: 'mus_serra', amb: 'amb_serra', abertura: 'f3_abertura' },
  { id: 4, key: 'copa', nome: 'COPA DAS ÁRVORES', reliquia: 'PENA DO GAVIÃO-REAL', relic: 'pena', areas: 8, music: 'mus_copa', amb: 'amb_copa', abertura: 'f4_abertura' },
  { id: 5, key: 'caverna', nome: 'CAVERNA DO OURO', reliquia: 'CORAÇÃO DE OURO', relic: 'coracao', areas: 8, music: 'mus_caverna', amb: 'amb_caverna', abertura: 'f5_abertura' },
];
const LAST_FASE = 5;
const FASE_GEN = {}; // preenchido por src/04b-fases.js
function generateCampaign(seed, fase = 1) {
  if (fase === 1 || !FASE_GEN[fase]) return generateWorld(seed);
  // sub-semente determinística por fase: a mesma trilha gera sempre as mesmas 5 fases
  const w = FASE_GEN[fase]((seed * 7919 + fase * 104729) >>> 0);
  w.seed = seed;
  w.surface.treasures.forEach(t => t.taken = false);
  w.surface.announce.sort((a, b) => a.x - b.x);
  return w;
}

// ---------------------------------------------------------- peças do catálogo
// cada peça tem largura fixa e um place(L, x) que escreve no nível
const Piece = {
  space: w => ({ w, place() { } }),
  logs: (rng, { count = 1, speed = 70, len = 300, coin = true }) => ({
    w: len, place(L, x) {
      L.logs.push({ a: x, b: x + len, count, speed, phase: rng.range(0, len) });
      if (coin) L.treasures.push({ x: x + len * rng.range(0.35, 0.65), y: GROUND - 112, type: 'coin' });
    },
  }),
  pond: (rng, { hw = 110, vine = true, T = 2.9, A = 0.62, coin = true }) => ({
    w: hw * 2, place(L, x) {
      const cx = x + hw;
      L.gaps.push({ x1: x, x2: x + hw * 2, kind: 'water' });
      if (vine) {
        L.vines.push({ px: cx, py: 66, len: 240, A, T, phase: rng.range(0, T) });
        L.announce.push({ x, what: 'cipo' });
        if (coin) L.treasures.push({ x: cx, y: 66 + 240 + 34, type: 'coin' });
      }
    },
  }),
  // jacarés: espaçamento calibrado para o pulo parado do Zé (~130 px) cair na próxima cabeça
  crocs: (rng, { closed = 2.7, open = 1.5, stagger = 0, vine = false, coin = true, jewel = false }) => {
    const head = 64, step = 126, g0 = 92, g1 = 72;
    const w = g0 + head / 2 + step * 2 + head / 2 + g1;
    return {
      w, place(L, x) {
        L.gaps.push({ x1: x, x2: x + w, kind: 'water' });
        const phase = rng.range(0, closed + open);
        for (let i = 0; i < 3; i++) {
          const cx = x + g0 + head / 2 + i * step;
          L.crocs.push({ x: cx, hw: head / 2, closed, open, phase: phase - i * stagger, dir: -1 }); // a onda de bocas fechadas acompanha quem atravessa
        }
        L.announce.push({ x, what: 'jacare' });
        if (vine) L.vines.push({ px: x + w / 2, py: 46, len: 262, A: 0.84, T: rng.range(3.0, 3.4), phase: rng.range(0, 3) });
        if (coin) L.treasures.push({ x: x + g0 + head / 2 + step * 0.5, y: GROUND - 118, type: jewel ? 'jewel' : 'coin' });
      },
    };
  },
  sand: (rng, { hw = 115, closed = 2.6, open = 1.8, trans = 0.6, vine = false, coin = true }) => ({
    w: hw * 2, place(L, x) {
      const cx = x + hw;
      L.sands.push({ cx, hw, closed, open, trans, phase: rng.range(0, closed + open + trans * 2) });
      L.announce.push({ x, what: 'areia' });
      if (vine) L.vines.push({ px: cx, py: 66, len: 240, A: 0.62, T: rng.range(2.8, 3.2), phase: rng.range(0, 3) });
      if (coin) L.treasures.push({ x: cx + rng.range(-40, 40), y: GROUND - 116, type: 'coin' });
    },
  }),
  ladder: (link, sign) => ({
    w: 56, place(L, x) {
      L.ladders.push({ x: x + 28, top: GROUND, bottom: H + 80, link, hole: true });
      if (sign) L.signs.push({ x: x - 50, lines: sign });
      L.announce.push({ x: x - 200, what: 'escada' });
    },
  }),
  fire: () => ({ w: 60, place(L, x) { L.fires.push({ x: x + 30, lit: false }); } }),
};

// distribui as peças dentro de [a, b] com espaços iguais e moedas no chão nos vãos
function layout(L, rng, a, b, pieces, groundCoins = 1) {
  // as bordas da área recebem meio espaço: sobra mais chão entre um perigo e outro
  const total = pieces.reduce((s, p) => s + p.w, 0);
  const free = Math.max(0, (b - a) - total);
  const gap = free / pieces.length;
  let x = a + gap / 2;
  const gaps = [[a, x]];
  pieces.forEach((p, i) => {
    p.place(L, Math.round(x));
    x += p.w;
    const g = i === pieces.length - 1 ? gap / 2 : gap;
    gaps.push([x, x + g]);
    x += g;
  });
  // moedas no chão em vãos largos o bastante
  const wide = gaps.filter(([g0, g1]) => g1 - g0 > 70);
  for (let i = 0; i < groundCoins && wide.length; i++) {
    const [g0, g1] = wide.splice(rng.int(0, wide.length - 1), 1)[0];
    L.treasures.push({ x: Math.round((g0 + g1) / 2), y: GROUND - 22, type: 'coin' });
  }
}

const POOL_MID = {
  crocs_vine: rng => [Piece.crocs(rng, { closed: rng.range(2.1, 2.5), open: rng.range(1.3, 1.5), stagger: rng.range(0.3, 0.5), vine: true })],
  sand_vine: rng => [Piece.sand(rng, { hw: rng.int(110, 125), closed: rng.range(1.7, 2.1), open: rng.range(1.8, 2.2), trans: 0.5, vine: true })],
  logs_pond: rng => [Piece.logs(rng, { count: 2, speed: rng.range(90, 110), len: 260 }), Piece.pond(rng, { hw: rng.int(44, 52), vine: false, coin: false })],
  crocs_stagger: rng => [Piece.crocs(rng, { closed: rng.range(2.1, 2.4), open: rng.range(1.2, 1.4), stagger: rng.range(0.4, 0.55) })],
  logs_sand: rng => [Piece.logs(rng, { count: 1, speed: rng.range(95, 115), len: 210, coin: false }), Piece.sand(rng, { hw: rng.int(105, 118), closed: rng.range(1.9, 2.3), open: rng.range(1.6, 1.9), trans: 0.5 })],
  ponds_vines: rng => [Piece.pond(rng, { hw: rng.int(98, 108), T: rng.range(2.6, 2.9) }), Piece.pond(rng, { hw: rng.int(98, 108), T: rng.range(2.5, 2.8), coin: false })],
};
const POOL_FINAL = {
  crocs_then_sand: rng => [Piece.crocs(rng, { closed: rng.range(1.9, 2.2), open: rng.range(1.2, 1.4), stagger: rng.range(0.35, 0.5), jewel: true }), Piece.sand(rng, { hw: rng.int(100, 112), closed: rng.range(1.8, 2.1), open: 1.7, trans: 0.45 })],
  crocs_then_vine: rng => [Piece.crocs(rng, { closed: rng.range(1.9, 2.2), open: rng.range(1.2, 1.4), stagger: rng.range(0.35, 0.5), jewel: true }), Piece.pond(rng, { hw: rng.int(100, 110), T: rng.range(2.6, 2.9) })],
  logs_sand_vine: rng => [Piece.logs(rng, { count: 2, speed: rng.range(105, 120), len: 240 }), Piece.sand(rng, { hw: 118, closed: rng.range(1.6, 1.9), open: 2.0, trans: 0.45, vine: true, coin: false }), Piece.space(10)],
};

function generateWorld(seed) {
  const rng = mulberry32(seed);
  const S = newLevel('surface', AREA_W * 10);
  const U = [newLevel('under', 1500), newLevel('under', 1500)];
  U[0].name = 'A'; U[1].name = 'B';
  const ax = i => (i - 1) * AREA_W;           // início da área i
  const areaTemplates = [];

  // Área 1 — tutorial: só correr e pular
  S.signs.push({ x: ax(1) + 300, lines: ['← → ANDA', 'ESPAÇO PULA'] });
  layout(S, rng, ax(1) + 400, ax(1) + 940, [Piece.logs(rng, { count: 1, speed: rng.range(50, 60), len: 480 })], 0);
  S.treasures.push({ x: ax(1) + 200, y: GROUND - 22, type: 'coin' });
  areaTemplates.push('tutorial');

  // Área 2 — primeiro cipó
  S.signs.push({ x: ax(2) + 120, lines: ['PULE E', 'AGARRE O CIPÓ'] });
  layout(S, rng, ax(2) + 220, ax(2) + 900, [Piece.pond(rng, { hw: rng.int(104, 118), T: rng.range(2.8, 3.1) })], 1);
  areaTemplates.push('cipo');

  // Área 3 — troncos e primeira escada para o subterrâneo
  layout(S, rng, ax(3) + 80, ax(3) + 940, [Piece.logs(rng, { count: rng.int(1, 2), speed: rng.range(70, 85), len: 300 }), Piece.ladder({ level: 0, end: 'in' }, ['↓ ATALHO', 'SUBTERRÂNEO'])], 1);
  areaTemplates.push('escada');

  // Área 4 — primeiro jacaré, ciclo lento e sincronizado
  layout(S, rng, ax(4) + 80, ax(4) + 920, [Piece.crocs(rng, { closed: rng.range(2.6, 3.0), open: rng.range(1.4, 1.6), stagger: 0 })], 1);
  areaTemplates.push('jacare');

  // Área 5 — primeira areia movediça + fogueira
  layout(S, rng, ax(5) + 60, ax(5) + 920, [Piece.fire(), Piece.sand(rng, { hw: rng.int(108, 122), closed: rng.range(2.5, 2.9), open: rng.range(1.6, 1.9), trans: 0.6 })], 1);
  areaTemplates.push('areia');

  // Áreas 6 a 8 — combinações, ritmo mais rápido (três modelos distintos)
  const mids = Object.keys(POOL_MID);
  for (let i = mids.length - 1; i > 0; i--) { const j = rng.int(0, i); [mids[i], mids[j]] = [mids[j], mids[i]]; }
  // área 6: saída do subterrâneo A logo no começo
  S.ladders.push({ x: ax(6) + 150, top: GROUND, bottom: H + 80, link: { level: 0, end: 'out' }, hole: true });
  layout(S, rng, ax(6) + 270, ax(6) + 935, POOL_MID[mids[0]](rng), 1);
  // área 7: desafio e, no fim, a escada do subterrâneo B
  layout(S, rng, ax(7) + 50, ax(7) + 740, POOL_MID[mids[1]](rng), 1);
  Piece.ladder({ level: 1, end: 'in' }, ['↓ ATALHO']).place(S, ax(7) + 790);
  // área 8: fogueira + combinação
  S.fires.push({ x: ax(8) + 120, lit: false });
  layout(S, rng, ax(8) + 230, ax(8) + 935, POOL_MID[mids[2]](rng), 1);
  areaTemplates.push(mids[0], mids[1], mids[2]);

  // Área 9 — desafio final: dois perigos combinados
  const fk = rng.pick(Object.keys(POOL_FINAL));
  layout(S, rng, ax(9) + 40, ax(9) + 940, POOL_FINAL[fk](rng), 1);
  areaTemplates.push(fk);

  // Área 10 — clareira das ruínas com o ídolo
  S.ladders.push({ x: ax(10) + 150, top: GROUND, bottom: H + 80, link: { level: 1, end: 'out' }, hole: true });
  S.idol = { x: ax(10) + 730, y: GROUND - 44, taken: false, relic: 'idolo' };
  S.treasures.push({ x: ax(10) + 330, y: GROUND - 22, type: 'coin' }, { x: ax(10) + 470, y: GROUND - 110, type: 'coin' });
  areaTemplates.push('ruinas');

  // ---------------------------------------------------------- subterrâneos (pulam duas áreas da superfície)
  U.forEach((L, k) => {
    L.ladders.push({ x: 120, top: -80, bottom: FLOOR_U, link: { level: 'surface', end: 'in', k } });
    L.ladders.push({ x: L.len - 120, top: -80, bottom: FLOOR_U, link: { level: 'surface', end: 'out', k } });
    L.fires.push({ x: 240, lit: false }, { x: L.len - 260, lit: false }); // fogueira na entrada e perto da saída
    const ranges = k === 0 ? [[340, 640], [760, 1110]] : [[330, 540], [620, 860], [930, 1170]];
    const sp = k === 0 ? [55, 72] : [70, 92];
    ranges.forEach(([a, b]) => L.scorpions.push({ a, b, speed: rng.range(sp[0], sp[1]), phase: rng.range(0, 1) }));
    const jx = k === 0 ? rng.int(680, 720) : rng.int(545, 575);
    L.treasures.push({ x: jx, y: FLOOR_U - 24, type: 'jewel' });
    L.treasures.push({ x: rng.int(290, 310), y: FLOOR_U - 22, type: 'coin' });
    L.announce.push({ x: 160, what: 'escorpiao' });
  });

  // ligações das escadas
  const surfLadder = (k, end) => S.ladders.find(l => l.link.level === k && l.link.end === end);
  U.forEach((L, k) => {
    L.ladders[0].peer = surfLadder(k, 'in'); L.ladders[1].peer = surfLadder(k, 'out');
    L.ladders[0].peer.peer = L.ladders[0]; L.ladders[1].peer.peer = L.ladders[1];
    L.ladders[0].peerLevel = 'surface'; L.ladders[1].peerLevel = 'surface';
    L.ladders[0].peer.peerLevel = k; L.ladders[1].peer.peerLevel = k;
  });

  S.treasures.forEach(t => t.taken = false);
  U.forEach(L => L.treasures.forEach(t => t.taken = false));
  S.announce.sort((a, b) => a.x - b.x);
  return { seed, surface: S, under: U, templates: areaTemplates };
}

// ---------------------------------------------------------- estados cíclicos dos perigos (ligados ao relógio do jogo)
function crocOpen(c, t) {
  const p = ((t + c.phase) % (c.closed + c.open) + (c.closed + c.open)) % (c.closed + c.open);
  if (p < c.closed) return { open: false, k: 0, warn: p > c.closed - 0.45 };
  const q = (p - c.closed) / c.open;
  return { open: true, k: Math.sin(Math.min(1, q * 4) * Math.PI / 2) * (q > 0.8 ? (1 - q) / 0.2 : 1) };
}
function sandWidth(s, t) {
  const per = s.closed + s.open + s.trans * 2;
  const p = ((t + s.phase) % per + per) % per;
  if (p < s.closed) return 0;
  if (p < s.closed + s.trans) return s.hw * smooth((p - s.closed) / s.trans);
  if (p < s.closed + s.trans + s.open) return s.hw;
  return s.hw * (1 - smooth((p - s.closed - s.trans - s.open) / s.trans));
}
function logPositions(lg, t) {
  const span = lg.b - lg.a, out = [];
  for (let i = 0; i < lg.count; i++) {
    const d = ((t * lg.speed + lg.phase + i * span / lg.count) % span + span) % span;
    out.push(lg.b - d);
  }
  return out;
}
function vineState(v, t) {
  const w = 2 * Math.PI / v.T;
  const th = v.A * Math.sin(w * (t + v.phase));
  const dth = v.A * w * Math.cos(w * (t + v.phase));
  return { th, dth };
}
function scorpionPos(s, t) {
  const span = s.b - s.a, per = 2 * span / s.speed;
  const p = (((t / per + s.phase) % 1) + 1) % 1;
  return p < 0.5 ? { x: s.a + span * p * 2, dir: 1 } : { x: s.b - span * (p - 0.5) * 2, dir: -1 };
}
