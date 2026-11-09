// ============================================================ arte: tudo desenhado em código, pré-renderizado em canvas fora da tela
const Art = {};

// ---------------------------------------------------------- primitivas em grade de pixel
function pixRect(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
function pixCircle(g, cx, cy, r, c, u = 2) {
  g.fillStyle = c;
  for (let y = -r; y <= r; y += u) {
    const hw = Math.floor(Math.sqrt(Math.max(0, r * r - y * y)) / u) * u;
    g.fillRect(Math.round(cx - hw), Math.round(cy + y), hw * 2, u);
  }
}
function pixEllipse(g, cx, cy, rx, ry, c, u = 2) {
  g.fillStyle = c;
  for (let y = -ry; y <= ry; y += u) {
    const hw = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))) / u) * u;
    g.fillRect(Math.round(cx - hw), Math.round(cy + y), hw * 2, u);
  }
}
function pixPoly(g, pts, c, u = 2) {
  // rasteriza um polígono na grade de pixel (sem antisserrilhado)
  g.fillStyle = c;
  const ys = pts.map(p => p[1]), xs = pts.map(p => p[0]);
  const y0 = Math.floor(Math.min(...ys) / u) * u, y1 = Math.max(...ys);
  const x0 = Math.floor(Math.min(...xs) / u) * u, x1 = Math.max(...xs);
  for (let y = y0; y < y1; y += u) for (let x = x0; x < x1; x += u) {
    const px = x + u / 2, py = y + u / 2; let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
    }
    if (inside) g.fillRect(x, y, u, u);
  }
}
function pixLine(g, x0, y0, x1, y1, w, c, u = 2) {
  g.fillStyle = c;
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(d / (u * 0.7)));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = Math.round((x0 + (x1 - x0) * t - w / 2) / u) * u, y = Math.round((y0 + (y1 - y0) * t - w / 2) / u) * u;
    g.fillRect(x, y, w, w);
  }
}
const artRng = mulberry32(77);

// ---------------------------------------------------------- Zé Trilha (≈64 px de altura, grade de arte de 2 px)
const ZE = { W: 64, H: 84, OX: 32, OY: 80 }; // canvas por quadro; OX/OY = pés
const ZC = {
  hat: '#d9b65c', hatS: '#a8843a', hatH: '#f0d68a', band: '#7a3b1e',
  skin: '#c98a5a', skinS: '#9c6238', eye: '#22140c', hair: '#3b2414', stub: '#8a5a38',
  scarf: '#c8322a', scarfS: '#8a1f1a',
  shirt: '#6b7a3a', shirtS: '#4c5828', shirtH: '#86964a',
  pack: '#8a6a3c', packS: '#63492a', rope: '#cfb276', can: '#7d8f96', canS: '#55666c',
  belt: '#4a2e1a', buckle: '#d9b65c',
  pants: '#b59a64', pantsS: '#8a7247', boot: '#4a2e1a', bootS: '#2e1c10',
};

// pose: {by, feet:[[x,y],[x,y]], hands:[[x,y],[x,y]], lean, hat:{dx,dy,off}, eye}
function drawZe(g, pose) {
  const u = 2, ox = ZE.OX, oy = ZE.OY;
  const R = (x, y, w, h, c) => pixRect(g, ox + x * u, oy + y * u, w * u, h * u, c);
  const L = (x0, y0, x1, y1, w, c) => pixLine(g, ox + x0 * u, oy + y0 * u, ox + x1 * u, oy + y1 * u, w * u, c, u);
  const by = pose.by || 0, lean = pose.lean || 0;
  const hip = [0 + lean * 0.3, -12 + by];
  const ik = (a, b, len, bend) => { // joelho/cotovelo por IK de dois ossos
    const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 0.001;
    if (d >= len * 2) return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const h = Math.sqrt(len * len - (d / 2) * (d / 2));
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    return [mx + (-dy / d) * h * bend, my + (dx / d) * h * bend];
  };
  const leg = (f, back) => {
    const k = ik(hip, f, 6.6, -1);
    const c = back ? ZC.pantsS : ZC.pants;
    L(hip[0], hip[1], k[0], k[1], 3, c);
    L(k[0], k[1], f[0], f[1] - 1, 3, c);
    R(f[0] - 1.5, f[1] - 2, 4.5, 2, back ? ZC.bootS : ZC.boot);
    R(f[0] - 1.5, f[1] - 2, 4.5, 0.5, back ? ZC.boot : '#6a4428');
  };
  const sh = [1 + lean, -20 + by];
  const arm = (hnd, back) => {
    const e = ik(sh, hnd, 4.4, 1);
    L(sh[0], sh[1], e[0], e[1], 3, back ? ZC.shirtS : ZC.shirt);
    L(e[0], e[1], hnd[0], hnd[1], 2.5, back ? ZC.skinS : ZC.skin);
    R(hnd[0] - 1, hnd[1] - 1, 2, 2, back ? ZC.skinS : ZC.skin);
  };
  // braço e perna de trás
  arm(pose.hands[1], true);
  leg(pose.feet[1], true);
  // mochila de lona com cantil e corda
  const tx = lean, ty = by;
  R(tx - 8, ty - 21, 4, 9, ZC.pack); R(tx - 8, ty - 21, 1, 9, ZC.packS); R(tx - 8, ty - 17, 4, 1, ZC.packS);
  R(tx - 9, ty - 23, 5, 2, ZC.rope); R(tx - 8, ty - 22, 3, 1, '#a88f58');
  R(tx - 10, ty - 16, 2, 4, ZC.can); R(tx - 10, ty - 13, 2, 1, ZC.canS);
  // tronco: camisa de linho verde-oliva
  R(tx - 4, ty - 21, 8, 9, ZC.shirt); R(tx - 4, ty - 21, 2, 9, ZC.shirtS); R(tx + 2, ty - 20, 1, 6, ZC.shirtH);
  R(tx - 1, ty - 19, 1, 1, ZC.shirtS); R(tx - 1, ty - 16, 1, 1, ZC.shirtS); // botões
  R(tx - 4, ty - 13, 8, 1.5, ZC.belt); R(tx + 1, ty - 13, 1.5, 1.5, ZC.buckle);
  leg(pose.feet[0], false);
  // cabeça
  const hx = lean * 1.3 + (pose.headDx || 0), hy = by + (pose.headDy || 0);
  R(hx - 2, hy - 23, 4, 2, ZC.skinS); // pescoço
  R(hx - 3, hy - 29, 6, 6, ZC.skin); R(hx - 3, hy - 29, 1.5, 6, ZC.skinS);
  R(hx - 3, hy - 28, 1.5, 3, ZC.hair);
  R(hx + 3, hy - 26, 1, 1.5, ZC.skin); // nariz
  if (pose.eye === 'x') { R(hx + 1, hy - 27, 1, 1, ZC.eye); R(hx + 2, hy - 26, 1, 1, ZC.eye); }
  else if (pose.eye === 'closed') R(hx + 1, hy - 26.5, 1.5, 0.5, ZC.eye);
  else R(hx + 1.5, hy - 27, 1, 1.5, ZC.eye);
  R(hx, hy - 24, 3, 1, ZC.stub); // barba por fazer
  if (pose.mouth) R(hx + 1.5, hy - 24.5, 1.5, 1, '#5a1a10');
  // lenço vermelho com nó
  R(hx - 3, hy - 23, 6, 2, ZC.scarf); R(hx - 3, hy - 21.5, 6, 0.5, ZC.scarfS);
  R(hx - 5, hy - 23, 2, 1.5, ZC.scarf); R(hx - 6, hy - 22, 1.5, 2, ZC.scarfS);
  // chapéu de palha de abas largas
  if (!pose.noHat) {
    const h = pose.hat || { dx: 0, dy: 0 };
    const cx = hx + h.dx, cy = hy + h.dy;
    R(cx - 3, cy - 33, 6, 4, ZC.hat); R(cx - 3, cy - 33, 6, 1, ZC.hatH); R(cx - 3, cy - 31, 1.5, 2, ZC.hatS);
    R(cx - 3, cy - 30, 6, 1, ZC.band);
    R(cx - 7, cy - 29, 14, 1.5, ZC.hat); R(cx - 7, cy - 28, 14, 0.5, ZC.hatS); R(cx + 4, cy - 29, 3, 0.5, ZC.hatH);
  }
  // braço da frente (manga dobrada, antebraço à mostra)
  arm(pose.hands[0], false);
}

function zePoses() {
  const P = {};
  const base = (o = {}) => Object.assign({ by: 0, feet: [[1.5, 0], [-1.5, 0]], hands: [[3, -12], [-2, -12]], lean: 0 }, o);
  P.idle = [0, 1, 2, 3].map(i => base({ by: [0, 0, 0.5, 0.5][i], hands: [[3, -12 + [0, 0, 0.5, 0.5][i]], [-2, -12 + [0, 0, 0.5, 0.5][i]]], eye: i === 3 ? 'closed' : null }));
  P.run = [];
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    const foot = ph => [Math.sin(ph) * 5.5, -Math.max(0, -Math.cos(ph)) * 4.5];
    const hand = ph => [Math.sin(ph) * 4.5 + 1, -12 - Math.max(0, Math.cos(ph)) * 2];
    P.run.push(base({ by: -Math.abs(Math.sin(a)) * 1, lean: 1, feet: [foot(a), foot(a + Math.PI)], hands: [hand(a + Math.PI), hand(a)] }));
  }
  P.jump = [base({ by: -1, lean: 0.5, feet: [[3, -4], [-2, -2]], hands: [[5, -24], [-3, -20]], mouth: true })];
  P.fall = [base({ by: 0, lean: 0, feet: [[2.5, 0], [-2.5, -1]], hands: [[5, -22], [-5, -22]] })];
  P.swing = [0, 1].map(i => base({ by: 0, feet: [[1 + i, -1], [-1 + i, 0]], hands: [[1, -33], [0, -33]], headDy: 0.5 }));
  P.climb = [0, 1].map(i => base({ feet: [[1, i ? -4 : 0], [-1, i ? 0 : -4]], hands: [[2, i ? -32 : -27], [0, i ? -27 : -32]], lean: -0.5 }));
  P.trip = [base({ by: 1, lean: 3, feet: [[5, 0], [-5, -3]], hands: [[8, -16], [6, -20]], headDx: 1.5, headDy: 1.5, mouth: true, hat: { dx: 2, dy: -2 } })];
  P.hurt = [base({ by: 0, lean: -2, feet: [[3, -1], [-3, 0]], hands: [[4, -27], [-5, -27]], eye: 'x', mouth: true, noHat: true })];
  P.sink = [base({ by: 0, feet: [[2, 0], [-2, 0]], hands: [[5, -30], [-4, -30]], eye: 'x', mouth: true })];
  P.cheer = [0, 1].map(i => base({ by: -i, feet: [[3, -i], [-3, 0]], hands: [[3, -34 - i], [-2, -34 - i]], mouth: true, eye: i ? 'closed' : null }));
  return P;
}

// ---------------------------------------------------------- cenário em camadas (parallax)
function buildBackgrounds() {
  const r = mulberry32(2026);
  // céu: degradê do amanhecer verde-dourado
  const [sky, gs] = makeCanvas(W, H);
  const gr = gs.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#1d3f3c'); gr.addColorStop(0.35, '#4f7c5c'); gr.addColorStop(0.62, '#b9b46e'); gr.addColorStop(0.78, '#f0d58a'); gr.addColorStop(1, '#f6e2a4');
  gs.fillStyle = gr; gs.fillRect(0, 0, W, H);
  const sun = gs.createRadialGradient(700, 300, 10, 700, 300, 380);
  sun.addColorStop(0, 'rgba(255,240,190,0.95)'); sun.addColorStop(0.15, 'rgba(255,226,150,0.5)'); sun.addColorStop(1, 'rgba(255,220,140,0)');
  gs.fillStyle = sun; gs.fillRect(0, 0, W, H);
  // banding em degraus para parecer pixel art
  const id = gs.getImageData(0, 0, W, H), d = id.data;
  for (let i = 0; i < d.length; i += 4) { d[i] = d[i] & 0xf8; d[i + 1] = d[i + 1] & 0xf8; d[i + 2] = d[i + 2] & 0xf8; }
  gs.putImageData(id, 0, 0);
  Art.sky = sky;

  // serra ao fundo, silhueta com neblina (10%)
  const SW = 1920;
  const [mt, gm] = makeCanvas(SW, H);
  const ridge = (base, amp, col, seed) => {
    const rr = mulberry32(seed);
    const ph = [rr() * 6, rr() * 6, rr() * 6];
    gm.fillStyle = col;
    for (let x = 0; x < SW; x += 2) {
      const a = x / SW * Math.PI * 2;
      const y = base - amp * (0.55 * Math.sin(a * 2 + ph[0]) + 0.3 * Math.sin(a * 5 + ph[1]) + 0.15 * Math.sin(a * 11 + ph[2]));
      gm.fillRect(x, Math.round(y / 2) * 2, 2, H - y);
    }
  };
  ridge(250, 70, '#7d9e86', 5); ridge(300, 55, '#5f8670', 9);
  const fogG = gm.createLinearGradient(0, 260, 0, 380);
  fogG.addColorStop(0, 'rgba(220,232,200,0)'); fogG.addColorStop(1, 'rgba(220,232,200,0.75)');
  gm.fillStyle = fogG; gm.fillRect(0, 260, SW, 280);
  Art.mountains = mt;

  // mata distante: copas em tons frios (25%)
  const [far, gf] = makeCanvas(SW, H);
  for (let x = -40; x < SW + 40; x += 26) {
    const top = 300 + r() * 40;
    const col = r() < 0.5 ? '#3d6658' : '#456f5c';
    pixCircle(gf, x, top, 26 + r() * 22, col, 2);
    gf.fillStyle = col; gf.fillRect(x - 30, top, 60, H);
  }
  for (let x = -40; x < SW + 40; x += 34) pixCircle(gf, x + 10, 330 + r() * 30, 20 + r() * 16, '#355a4e', 2);
  gf.fillStyle = '#304f45'; gf.fillRect(0, 352, SW, H);
  const ff = gf.createLinearGradient(0, 300, 0, 420);
  ff.addColorStop(0, 'rgba(200,220,190,0.0)'); ff.addColorStop(1, 'rgba(200,220,190,0.35)');
  gf.fillStyle = ff; gf.fillRect(0, 290, SW, 200);
  Art.farForest = far;

  // mata média: troncos, bromélias, palmito-juçara (50%)
  const [mid, gmid] = makeCanvas(SW, H);
  for (let i = 0; i < 26; i++) {
    const x = Math.round(r() * SW / 2) * 2, w = 10 + Math.round(r() * 8) * 2;
    const c = r() < 0.5 ? '#2c4434' : '#334c3a';
    gmid.fillStyle = c; gmid.fillRect(x, 0, w, H);
    gmid.fillStyle = '#243a2c'; gmid.fillRect(x, 0, 4, H);
    gmid.fillStyle = '#3d5a44'; gmid.fillRect(x + w - 4, 0, 2, H);
    if (r() < 0.45) bromelia(gmid, x + (r() < 0.5 ? 0 : w), 200 + r() * 160, r);
  }
  for (let i = 0; i < 9; i++) palm(gmid, Math.round(r() * SW), 170 + r() * 60, r);
  // copas penduradas no topo
  for (let x = -20; x < SW + 20; x += 18) pixCircle(gmid, x, -10 + r() * 30, 30 + r() * 20, r() < 0.5 ? '#1f3628' : '#24402c', 2);
  for (let i = 0; i < 30; i++) { // cipós finos ao fundo
    const x = r() * SW, len = 80 + r() * 160;
    for (let y = 0; y < len; y += 2) gmid.fillRect(Math.round(x + Math.sin(y / 30) * 4), y, 2, 2);
  }
  gmid.fillStyle = '#20382a'; gmid.fillRect(0, 392, SW, H);
  Art.midForest = mid;

  // primeiro plano: folhas e samambaias desfocadas (130%)
  const [fg, gfg] = makeCanvas(SW, H);
  const blurDraw = fn => { // desfoque falso, compatível com todos os navegadores
    for (const [dx, dy, a] of [[-3, 0, 0.14], [3, 0, 0.14], [0, -3, 0.14], [0, 3, 0.14], [0, 0, 0.35]]) {
      gfg.save(); gfg.globalAlpha = a; gfg.translate(dx, dy); fn(); gfg.restore();
    }
  };
  for (let i = 0; i < 7; i++) {
    const x = 100 + i * 270 + r() * 80;
    const bottom = r() < 0.7;
    blurDraw(() => fern(gfg, x, bottom ? H + 20 : -20, bottom ? -1 : 1, r, '#0f2016'));
  }
  Art.foreground = fg;

  buildCave();
}

function bromelia(g, x, y, r) {
  const cols = ['#4f8a46', '#3f7442', '#5b9248'];
  for (let i = -3; i <= 3; i++) pixLine(g, x, y, x + i * 6, y - 14 + Math.abs(i) * 3, 2, cols[(i + 3) % 3]);
  pixRect(g, x - 2, y - 6, 4, 4, '#c8322a');
}
function palm(g, x, top, r) {
  g.fillStyle = '#3a4f3c';
  for (let y = top; y < H; y += 2) g.fillRect(Math.round((x + Math.sin(y / 60) * 6) / 2) * 2, y, 4, 2);
  for (let k = 0; k < 9; k++) {
    const a = -Math.PI + (k / 8) * Math.PI;
    const len = 50 + r() * 20;
    for (let t = 0; t < 1; t += 0.04) {
      const px = x + Math.cos(a) * len * t, py = top + Math.sin(a) * len * t * 0.6 + t * t * 30;
      g.fillStyle = '#2f5a3a'; g.fillRect(Math.round(px / 2) * 2, Math.round(py / 2) * 2, 2, 4);
    }
  }
}
function fern(g, x, y, dir, r, col) {
  // dir = -1: brota de baixo; dir = 1: pende do alto
  g.fillStyle = col;
  for (let k = 0; k < 6; k++) {
    const s = (k - 2.5) * 0.38, len = 120 + r() * 80;
    for (let t = 0; t < 1; t += 0.02) {
      const px = x + Math.sin(s) * len * t * 1.3;
      const py = y + dir * Math.cos(s) * len * t + (dir < 0 ? 1 : -1) * t * t * 55;
      g.fillRect(Math.round(px), Math.round(py), 6, 6);
      if (Math.floor(t * 50) % 3 === 0) { g.fillRect(Math.round(px) - 12, Math.round(py) - dir * 4, 12, 4); g.fillRect(Math.round(px) + 6, Math.round(py) - dir * 4, 12, 4); }
    }
  }
}
function buildCave() {
  const r = mulberry32(31);
  const [cv, g] = makeCanvas(1920, H);
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#0b1210'); gr.addColorStop(0.5, '#16231e'); gr.addColorStop(1, '#0d1512');
  g.fillStyle = gr; g.fillRect(0, 0, 1920, H);
  for (let i = 0; i < 340; i++) { // pedras na parede, achatadas e discretas
    const x = r() * 1920, y = 80 + r() * 380, w = 14 + r() * 34, h = 6 + r() * 12;
    pixEllipse(g, x, y, w / 2, h / 2, r() < 0.5 ? '#18241f' : '#1d2c26', 2);
    pixRect(g, x - w / 4, y - h / 2, w / 2, 2, '#24362e');
  }
  for (let i = 0; i < 14; i++) { // raízes descendo
    const x = r() * 1920; let px = x;
    for (let y = 60; y < 60 + 80 + r() * 140; y += 2) { px += (r() - 0.5) * 2; g.fillStyle = '#2a2318'; g.fillRect(Math.round(px), y, 2, 2); }
  }
  Art.caveBack = cv;
  // teto com estalactites
  const [ceil, gc] = makeCanvas(1920, 140);
  gc.fillStyle = '#1a1612'; gc.fillRect(0, 0, 1920, 60);
  for (let x = 0; x < 1920; x += 2) {
    const y = 60 + Math.sin(x / 37) * 8 + Math.sin(x / 13) * 4;
    gc.fillRect(x, 0, 2, y);
  }
  for (let i = 0; i < 40; i++) {
    const x = Math.round(r() * 960) * 2, len = 16 + r() * 50, w = 8 + r() * 10;
    for (let y = 0; y < len; y += 2) { const ww = Math.round(w * (1 - y / len) / 2) * 2; gc.fillStyle = y < 4 ? '#1a1612' : '#2b241c'; gc.fillRect(x - ww / 2, 56 + y, ww || 2, 2); }
  }
  gc.fillStyle = '#3a6b3e'; for (let x = 0; x < 1920; x += 6) if (r() < 0.3) gc.fillRect(x, 50 + r() * 8, 4, 6 + r() * 20); // musgo e raízes verdes
  Art.caveCeil = ceil;
}

// ---------------------------------------------------------- chão e solo (azulejo de 960 px)
function buildGround() {
  const r = mulberry32(404);
  const [c, g] = makeCanvas(AREA_W, H - GROUND + 12);
  const top = 12;
  g.fillStyle = PAL.soil2; g.fillRect(0, top, AREA_W, H);
  g.fillStyle = PAL.soil; g.fillRect(0, top + 40, AREA_W, H);
  g.fillStyle = '#2a1a0e'; g.fillRect(0, top + 96, AREA_W, H);
  for (let i = 0; i < 140; i++) pixEllipse(g, r() * AREA_W, top + 14 + r() * 120, 2 + r() * 6, 2 + r() * 3, r() < 0.5 ? '#6a4628' : '#2e1d10', 2);
  for (let i = 0; i < 40; i++) pixEllipse(g, r() * AREA_W, top + 30 + r() * 100, 4 + r() * 8, 3 + r() * 4, PAL.stone, 2);
  for (let i = 0; i < 18; i++) { let x = r() * AREA_W; for (let y = top + 6; y < top + 50 + r() * 60; y += 2) { x += Math.round((r() - 0.5) * 2) * 2; g.fillStyle = '#7a5a34'; g.fillRect(x, y, 2, 2); } }
  // grama
  g.fillStyle = PAL.leaf; g.fillRect(0, top, AREA_W, 8);
  g.fillStyle = PAL.fern; g.fillRect(0, top, AREA_W, 3);
  for (let x = 0; x < AREA_W; x += 4) {
    const h = 2 + Math.floor(r() * 4) * 2;
    g.fillStyle = r() < 0.5 ? PAL.fern : PAL.leaf2; g.fillRect(x, top - h, 2, h + 2);
    if (r() < 0.05) { g.fillStyle = r() < 0.5 ? '#e8c84a' : '#e06a4a'; g.fillRect(x, top - h - 2, 4, 2); }
  }
  g.fillStyle = PAL.moss; g.fillRect(0, top + 8, AREA_W, 2);
  Art.ground = c; Art.groundTop = top;

  const [cf, gf] = makeCanvas(AREA_W, H - FLOOR_U + 8);
  gf.fillStyle = '#2a2a24'; gf.fillRect(0, 0, AREA_W, H);
  for (let x = 0; x < AREA_W; x += 32) { gf.fillStyle = '#3a3a32'; gf.fillRect(x, 0, 30, 6); gf.fillStyle = '#1a1a16'; gf.fillRect(x + 30, 0, 2, 40); }
  for (let i = 0; i < 80; i++) pixEllipse(gf, r() * AREA_W, 14 + r() * 70, 3 + r() * 8, 2 + r() * 4, r() < 0.5 ? '#36362e' : '#202018', 2);
  gf.fillStyle = '#4a4a3e'; gf.fillRect(0, 0, AREA_W, 2);
  Art.caveFloor = cf;
}

// ---------------------------------------------------------- sprites dos perigos e tesouros
function buildSprites() {
  // tronco rolando: 8 quadros de rotação
  Art.log = [];
  for (let f = 0; f < 8; f++) {
    const [c, g] = makeCanvas(40, 40);
    pixCircle(g, 20, 20, 17, '#5a3a20'); pixCircle(g, 20, 20, 13, '#8a6038'); pixCircle(g, 20, 20, 8, '#a87a48'); pixCircle(g, 20, 20, 3, '#6a4628');
    const a = -f / 8 * Math.PI * 2;
    for (let k = 0; k < 3; k++) { const b = a + k * 2.1; pixLine(g, 20 + Math.cos(b) * 5, 20 + Math.sin(b) * 5, 20 + Math.cos(b) * 13, 20 + Math.sin(b) * 13, 2, '#5a3a20'); }
    for (let k = 0; k < 10; k++) { const b = a + k * 0.63; pixRect(g, 20 + Math.cos(b) * 16 - 1, 20 + Math.sin(b) * 16 - 1, 3, 3, '#3a2414'); }
    Art.log.push(c);
  }
  // moeda girando (6 quadros)
  Art.coin = [];
  for (let f = 0; f < 6; f++) {
    const sx = Math.abs(Math.cos(f / 6 * Math.PI)) * 0.85 + 0.15;
    const [c, g] = makeCanvas(24, 24);
    pixEllipse(g, 12, 12, Math.max(2, Math.round(10 * sx)), 10, PAL.goldD);
    pixEllipse(g, 12, 12, Math.max(2, Math.round(8 * sx)), 8, PAL.gold);
    if (sx > 0.5) { pixRect(g, 12 - 2, 7, 4, 10, PAL.goldD); pixRect(g, 10 - 4 * sx, 6, 2, 4, PAL.gold2); }
    Art.coin.push(c);
  }
  // joia turquesa lapidada
  const [jw, gj] = makeCanvas(28, 28);
  const gem = [[14, 3], [24, 11], [14, 25], [4, 11]];
  gj.fillStyle = PAL.turqD; gj.beginPath(); gem.forEach(([x, y], i) => i ? gj.lineTo(x, y) : gj.moveTo(x, y)); gj.fill();
  gj.fillStyle = PAL.turq; gj.beginPath(); gj.moveTo(14, 5); gj.lineTo(21, 11); gj.lineTo(14, 21); gj.lineTo(8, 11); gj.fill();
  gj.fillStyle = '#9ff5ea'; gj.fillRect(10, 8, 4, 4); gj.fillStyle = '#ffffff'; gj.fillRect(11, 9, 2, 2);
  Art.jewel = jw;

  // escorpião: 2 quadros de caminhada (virado para a direita)
  Art.scorpion = [0, 1].map(f => {
    const [c, g] = makeCanvas(56, 40);
    const body = '#8a3a1a', dark = '#5a2410', hi = '#c0602a';
    for (let k = 0; k < 3; k++) { // patas
      const lx = 18 + k * 7;
      pixLine(g, lx, 30, lx - 4 + ((k + f) % 2) * 4, 38, 2, dark);
    }
    pixEllipse(g, 26, 30, 12, 6, body); pixRect(g, 18, 26, 16, 2, hi);
    // cauda curvada com ferrão
    const pts = [[14, 30], [8, 24], [6, 16], [10, 9], [17, 7], [22, 10]];
    for (let i = 0; i < pts.length - 1; i++) pixLine(g, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 5 - i * 0.5, i % 2 ? body : dark);
    pixRect(g, 22, 10, 4, 4, '#2a0a04'); pixRect(g, 25, 13, 2, 3, '#f4f1e4');
    // pinças
    pixLine(g, 36, 28, 44, 24, 3, body); pixLine(g, 36, 31, 45, 32, 3, body);
    pixRect(g, 44, 21 + f, 6, 3, dark); pixRect(g, 45, 30 - f, 6, 3, dark);
    pixRect(g, 34, 26, 2, 2, '#ffd27a');
    return c;
  });

  // fogueira: apagada e 4 quadros de chama
  const fireBase = g => {
    pixLine(g, 10, 44, 38, 36, 6, '#5a3a20'); pixLine(g, 10, 36, 38, 44, 6, '#6a4628');
    for (let k = 0; k < 6; k++) pixEllipse(g, 6 + k * 7, 46, 4, 3, PAL.stone2);
  };
  { const [c, g] = makeCanvas(48, 52); fireBase(g); Art.fireOff = c; }
  Art.fire = [0, 1, 2, 3].map(f => {
    const [c, g] = makeCanvas(48, 52);
    fireBase(g);
    const fl = (x, y, w, h, col) => { for (let yy = 0; yy < h; yy += 2) { const ww = Math.round(w * Math.sin((yy / h) * Math.PI * 0.9 + 0.2) / 2) * 2; g.fillStyle = col; g.fillRect(x - ww / 2, y - yy, ww, 2); } };
    const j = [0, 2, -2, 1][f];
    fl(24 + j, 40, 22, 30 + [0, 4, 2, 6][f], '#e04a1a');
    fl(24 - j, 40, 14, 22 + [3, 0, 5, 2][f], '#f29a2a');
    fl(24 + j / 2, 40, 7, 13 + [2, 4, 0, 3][f], '#ffe28a');
    return c;
  });

  // ídolo de ouro sobre pedestal (figura original: guardião sentado com cocar de sol)
  const [id, gi] = makeCanvas(48, 56);
  const G1 = PAL.gold, G2 = PAL.gold2, GD = PAL.goldD;
  for (let k = 0; k < 9; k++) { const a = Math.PI + k / 8 * Math.PI; pixLine(gi, 24, 18, 24 + Math.cos(a) * 18, 18 + Math.sin(a) * 16, 3, k % 2 ? G1 : GD); }
  pixCircle(gi, 24, 20, 10, G1); pixRect(gi, 16, 18, 16, 2, GD);
  pixRect(gi, 18, 18, 4, 4, '#2a1a08'); pixRect(gi, 26, 18, 4, 4, '#2a1a08'); pixRect(gi, 19, 19, 2, 2, PAL.turq); pixRect(gi, 27, 19, 2, 2, PAL.turq);
  pixRect(gi, 21, 25, 6, 2, GD);
  pixEllipse(gi, 24, 40, 12, 10, G1); pixRect(gi, 12, 46, 24, 6, GD); pixRect(gi, 14, 36, 4, 8, G2); pixRect(gi, 30, 36, 4, 8, GD);
  pixRect(gi, 20, 32, 8, 2, G2); pixRect(gi, 22, 14, 2, 2, '#ffffff');
  Art.idol = id;

  // placa de madeira
  Art.hatIcon = (() => { const [c, g] = makeCanvas(28, 14); pixRect(g, 8, 0, 12, 7, ZC.hat); pixRect(g, 8, 0, 12, 2, ZC.hatH); pixRect(g, 8, 5, 12, 2, ZC.band); pixRect(g, 0, 7, 28, 4, ZC.hat); pixRect(g, 0, 10, 28, 2, ZC.hatS); return c; })();

  // jacaré: cabeça (plataforma) com mandíbula em 5 aberturas — focinho para a esquerda.
  // No sprite: topo da cabeça fechada em y=30 (= chão do jogo), linha d'água em y≈44.
  Art.croc = [0, 1, 2, 3, 4].map(f => {
    const k = f / 4;
    const [c, g] = makeCanvas(116, 72);
    const dk = '#24401c', md = '#3f6a2a', lt = '#6a9a3c', hi = '#8fbf55', belly = '#c9c27a';
    // costas e cauda acima da água, com escamas
    pixPoly(g, [[66, 36], [112, 40], [112, 46], [66, 46]], dk);
    for (let x = 72; x < 110; x += 8) pixPoly(g, [[x, 38], [x + 3, 32], [x + 6, 38]], md);
    // mandíbula inferior
    pixPoly(g, [[8, 38], [72, 36], [72, 46], [12, 46]], md);
    pixRect(g, 10, 44, 60, 2, belly);
    // mandíbula superior: gira em torno da articulação (70, 38)
    const ang = k * 0.8, hx = 70, hy = 38;
    const R = ([x, y]) => [hx + (x - hx) * Math.cos(ang) - (y - hy) * Math.sin(ang), hy + (x - hx) * Math.sin(ang) + (y - hy) * Math.cos(ang)];
    const jaw = [[6, 32], [14, 28], [58, 28], [72, 30], [72, 38], [8, 38]].map(R);
    if (k > 0) { // céu da boca vermelho e dentes
      pixPoly(g, [R([10, 38]), R([70, 38]), [70, 38], [12, 38]], '#9a1f1a');
      pixPoly(g, [R([16, 37]), R([64, 37]), [64, 37], [16, 37]], '#c8322a');
      for (let x = 14; x < 66; x += 7) { pixRect(g, x, 34, 2, 3, '#f4f1e4'); const [tx, ty] = R([x, 38]); pixRect(g, tx, ty, 2, 3, '#f4f1e4'); }
    }
    pixPoly(g, jaw, md);
    pixPoly(g, [[6, 32], [14, 28], [58, 28], [72, 30], [72, 32], [8, 32]].map(R), lt);
    pixPoly(g, [[14, 28], [58, 28], [58, 30], [14, 30]].map(R), hi);
    // olho saltado e narinas acompanham a mandíbula
    pixPoly(g, [[52, 30], [54, 22], [64, 22], [66, 30]].map(R), md);
    const [ex, ey] = R([57, 24]); pixRect(g, ex, ey, 6, 4, f >= 1 ? '#ffd23a' : '#e8c84a'); pixRect(g, ex + 2, ey, 2, 4, '#111');
    const [nx, ny] = R([10, 28]); pixRect(g, nx, ny, 4, 2, dk);
    pixPoly(g, [[8, 38], [72, 36], [72, 38], [8, 40]], dk);
    return c;
  });

  // placa
  const [sg, gsg] = makeCanvas(4, 4); Art.signDummy = sg;
}

// placa de madeira com texto (gerada sob demanda e guardada)
const signCache = new Map();
function signCanvas(lines) {
  const key = lines.join('|');
  if (signCache.has(key)) return signCache.get(key);
  const tw = Math.max(...lines.map(l => textWidth(l.toUpperCase(), 2))) + 20, th = lines.length * 18 + 12;
  const [c, g] = makeCanvas(tw, th + 46);
  pixRect(g, tw / 2 - 4, th - 2, 8, 48, '#5a3a20'); pixRect(g, tw / 2 - 4, th - 2, 2, 48, '#3a2414');
  pixRect(g, 0, 0, tw, th, '#8a6038'); pixRect(g, 0, 0, tw, 2, '#a87a48'); pixRect(g, 0, th - 4, tw, 4, '#5a3a20');
  pixRect(g, 2, th / 2, tw - 4, 2, '#7a5230');
  lines.forEach((l, i) => drawText(g, l, tw / 2, 9 + i * 18, 2, '#f6e6c0', 'center', '#3a2414'));
  signCache.set(key, c);
  return c;
}

// contorno escuro de 2 px para o personagem se destacar do cenário
function outline(g, w, h, col) {
  const id = g.getImageData(0, 0, w, h), d = id.data, src = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) src[i] = d[i * 4 + 3] > 0 ? 1 : 0;
  const [r, gg, b] = [parseInt(col.slice(1, 3), 16), parseInt(col.slice(3, 5), 16), parseInt(col.slice(5, 7), 16)];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (src[y * w + x]) continue;
    let near = false;
    for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < w && yy < h && src[yy * w + xx]) { near = true; break; }
    }
    if (near) { const i = (y * w + x) * 4; d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = 235; }
  }
  g.putImageData(id, 0, 0);
}
function buildAllArt() {
  buildBackgrounds();
  buildGround();
  buildSprites();
  buildFaseArt();
  // quadros do Zé: pré-desenhados uma vez
  const poses = zePoses();
  Art.ze = {};
  for (const [name, frames] of Object.entries(poses)) {
    Art.ze[name] = frames.map(p => { const [c, g] = makeCanvas(ZE.W, ZE.H); drawZe(g, p); outline(g, ZE.W, ZE.H, '#0d1410'); return c; });
  }
}
