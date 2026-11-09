// ============================================================ v2: arte das fases 2 a 5 (cenários por tema, perigos novos, relíquias)
// Mesmas primitivas da fase 1. Os cenários de cada tema são montados na primeira vez em que a fase abre.

const THEMES = {};
function themeArt(key) {
  if (!key || key === 'mata') return Art;
  if (!THEMES[key]) THEMES[key] = THEME_BUILD[key]();
  return THEMES[key];
}

// ---------------------------------------------------------- utilidades dos cenários
const BGW = 1920;
function skyCanvas(stops, sun, sunR = 380) {
  const [c, g] = makeCanvas(W, H);
  const gr = g.createLinearGradient(0, 0, 0, H);
  stops.forEach(([k, col]) => gr.addColorStop(k, col));
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  if (sun) {
    const s = g.createRadialGradient(sun[0], sun[1], 10, sun[0], sun[1], sunR);
    s.addColorStop(0, sun[2]); s.addColorStop(0.15, sun[3]); s.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = s; g.fillRect(0, 0, W, H);
  }
  const id = g.getImageData(0, 0, W, H), d = id.data;
  for (let i = 0; i < d.length; i += 4) { d[i] &= 0xf8; d[i + 1] &= 0xf8; d[i + 2] &= 0xf8; }
  g.putImageData(id, 0, 0);
  return c;
}
function ridgeOn(g, base, amp, col, seed, sharp = 0) {
  const rr = mulberry32(seed), ph = [rr() * 6, rr() * 6, rr() * 6];
  g.fillStyle = col;
  for (let x = 0; x < BGW; x += 2) {
    const a = x / BGW * Math.PI * 2;
    let v = 0.55 * Math.sin(a * 2 + ph[0]) + 0.3 * Math.sin(a * 5 + ph[1]) + 0.15 * Math.sin(a * 11 + ph[2]);
    if (sharp) v = v * (1 - sharp) + sharp * (1 - 2 * Math.abs(Math.sin(a * 7 + ph[1])));
    const y = base - amp * v;
    g.fillRect(x, Math.round(y / 2) * 2, 2, H - y);
  }
}
function fogBand(g, y0, y1, rgb, a) {
  const f = g.createLinearGradient(0, y0, 0, y1);
  f.addColorStop(0, `rgba(${rgb},0)`); f.addColorStop(1, `rgba(${rgb},${a})`);
  g.fillStyle = f; g.fillRect(0, y0, BGW, y1 - y0);
}
function fakeBlur(g, fn) {
  for (const [dx, dy, a] of [[-3, 0, 0.14], [3, 0, 0.14], [0, -3, 0.14], [0, 3, 0.14], [0, 0, 0.35]]) { g.save(); g.globalAlpha = a; g.translate(dx, dy); fn(); g.restore(); }
}
function groundCanvas(fn) {
  const [c, g] = makeCanvas(AREA_W, H - GROUND + 12);
  fn(g, 12);
  return c;
}
function arch(g, x0, y0, x1, y1, bend, w, col) { // raiz/cipó curvo em pixel
  let px = x0, py = y0;
  for (let t = 0.05; t <= 1.0001; t += 0.05) {
    const x = lerp(x0, x1, t), y = lerp(y0, y1, t) - Math.sin(t * Math.PI) * bend;
    pixLine(g, px, py, x, y, w, col); px = x; py = y;
  }
}

// ---------------------------------------------------------- temas
const THEME_BUILD = {
  mangue() {
    const r = mulberry32(2202), T = { fog: '220,236,226', fogAlpha: 0.18 };
    T.sky = skyCanvas([[0, '#1f4a58'], [0.35, '#4f8d8f'], [0.6, '#a9c9a8'], [0.8, '#f3d79a'], [1, '#f7e3b0']], [600, 330, 'rgba(255,236,190,0.95)', 'rgba(255,222,160,0.5)']);
    { const [c, g] = makeCanvas(BGW, H); ridgeOn(g, 322, 22, '#6f9a88', 12); g.fillStyle = '#5b98a0'; g.fillRect(0, 332, BGW, H);
      for (let i = 0; i < 160; i++) pixRect(g, r() * BGW, 336 + r() * 60, 6 + r() * 18, 2, r() < 0.5 ? '#8fc6c4' : '#76b2b4');
      fogBand(g, 290, 360, '230,240,225', 0.6); T.mountains = c; }
    { const [c, g] = makeCanvas(BGW, H);
      for (let x = -30; x < BGW + 30; x += 30) {
        const top = 318 + r() * 18, col = r() < 0.5 ? '#3f6650' : '#466f58';
        pixCircle(g, x, top, 22 + r() * 14, col, 2);
        for (let k = -2; k <= 2; k++) arch(g, x + k * 4, top + 12, x + k * 16, 384, 6, 2, '#35574a');
      }
      g.fillStyle = '#3f7478'; g.fillRect(0, 382, BGW, H);
      for (let i = 0; i < 90; i++) pixRect(g, r() * BGW, 386 + r() * 30, 8 + r() * 14, 2, '#5f9a98');
      fogBand(g, 300, 420, '210,228,215', 0.3); T.farForest = c; }
    { const [c, g] = makeCanvas(BGW, H);
      for (let i = 0; i < 16; i++) {
        const x = Math.round(r() * BGW / 2) * 2, base = 330 + r() * 20, ttop = 210 + r() * 40;
        for (let k = -3; k <= 3; k++) arch(g, x, base - 10, x + k * 22 + (r() - 0.5) * 10, 396, 10 + r() * 14, 4, k % 2 ? '#25362a' : '#2c4030');
        pixRect(g, x - 6, ttop, 12, base - ttop, '#2a3a2c'); pixRect(g, x - 6, ttop, 4, base - ttop, '#22302a');
        for (let k = 0; k < 7; k++) pixCircle(g, x + (r() - 0.5) * 110, ttop - 10 + (r() - 0.5) * 50, 24 + r() * 18, r() < 0.5 ? '#2a4a34' : '#31553a', 2);
        for (let k = 0; k < 4; k++) { const hx = x + (r() - 0.5) * 90; for (let y = ttop + 10; y < ttop + 80 + r() * 90; y += 2) g.fillRect(Math.round(hx + Math.sin(y / 14) * 2), y, 2, 2); }
      }
      for (let x = -20; x < BGW + 20; x += 20) pixCircle(g, x, -14 + r() * 26, 26 + r() * 16, r() < 0.5 ? '#1f3628' : '#24402c', 2);
      g.fillStyle = '#22322a'; g.fillRect(0, 394, BGW, H);
      T.midForest = c; }
    { const [c, g] = makeCanvas(BGW, H);
      for (let i = 0; i < 7; i++) { const x = 120 + i * 270 + r() * 80, b = r() < 0.6; fakeBlur(g, () => fern(g, x, b ? H + 20 : -20, b ? -1 : 1, r, '#0e1e18')); }
      for (let i = 0; i < 5; i++) { const x = r() * BGW; fakeBlur(g, () => { for (let k = 0; k < 4; k++) arch(g, x, H - 70, x + 50 + k * 30, H + 10, 40, 10, '#0c1a14'); }); }
      T.foreground = c; }
    T.ground = groundCanvas((g, top) => {
      g.fillStyle = '#4a3a2a'; g.fillRect(0, top, AREA_W, H); g.fillStyle = '#3a2c20'; g.fillRect(0, top + 30, AREA_W, H); g.fillStyle = '#2a2018'; g.fillRect(0, top + 90, AREA_W, H);
      for (let i = 0; i < 120; i++) pixEllipse(g, r() * AREA_W, top + 16 + r() * 120, 2 + r() * 7, 2 + r() * 3, r() < 0.5 ? '#5a4632' : '#2e2218', 2);
      for (let i = 0; i < 26; i++) { const x = r() * AREA_W; pixEllipse(g, x, top + 6, 5, 3, '#1a120c', 2); } // tocas de caranguejo
      g.fillStyle = '#6a5a44'; g.fillRect(0, top, AREA_W, 4); g.fillStyle = '#8a7a5e'; g.fillRect(0, top, AREA_W, 2);
      for (let x = 0; x < AREA_W; x += 6) if (r() < 0.22) { g.fillStyle = r() < 0.5 ? '#9ab0a8' : '#c9d8d0'; g.fillRect(x, top + 1, 4, 2); } // brilho molhado
      for (let i = 0; i < 30; i++) { const x = Math.round(r() * AREA_W / 2) * 2, h = 6 + Math.round(r() * 5) * 2; pixRect(g, x, top - h, 2, h, '#4f7a3a'); pixRect(g, x - 2, top - h, 6, 2, '#6a9a48'); } // propágulos
      for (let i = 0; i < 20; i++) pixRect(g, r() * AREA_W, top + 6 + r() * 20, 4, 2, '#e8e0cc'); // conchinhas
    });
    return T;
  },

  serra() {
    const r = mulberry32(3303), T = { fog: '226,236,240', fogAlpha: 0.22 };
    T.sky = skyCanvas([[0, '#24486a'], [0.4, '#5f8fae'], [0.66, '#a9c6c8'], [1, '#ecdcae']], [760, 250, 'rgba(255,244,210,0.9)', 'rgba(255,232,180,0.4)']);
    { const [c, g] = makeCanvas(BGW, H); ridgeOn(g, 230, 120, '#8aa0b0', 41, 0.45); ridgeOn(g, 290, 90, '#687e90', 43, 0.35);
      fogBand(g, 250, 390, '225,235,240', 0.75); T.mountains = c; }
    { const [c, g] = makeCanvas(BGW, H); ridgeOn(g, 330, 40, '#4a6a58', 47);
      for (let i = 0; i < 40; i++) { // araucárias
        const x = Math.round(r() * BGW / 2) * 2, top = 240 + r() * 70, col = r() < 0.5 ? '#2f4a3c' : '#36533f';
        pixRect(g, x - 2, top, 4, 360 - top, '#3a3a2c');
        for (let k = 0; k < 3; k++) pixEllipse(g, x, top + k * 9, 30 - k * 6, 5, col, 2);
      }
      fogBand(g, 300, 420, '215,228,225', 0.4); g.fillStyle = '#3a5446'; g.fillRect(0, 380, BGW, H); T.farForest = c; }
    { const [c, g] = makeCanvas(BGW, H);
      for (let i = 0; i < 9; i++) { // paredões de pedra
        const x = Math.round(r() * BGW / 2) * 2, w = 90 + r() * 120, top = 120 + r() * 120;
        pixPoly(g, [[x, H], [x + 10, top + 20], [x + w * 0.4, top], [x + w - 10, top + 30], [x + w, H]], r() < 0.5 ? '#4a4e48' : '#52564e');
        for (let y = top + 30; y < 390; y += 22 + r() * 16) pixRect(g, x + 14, y, w - 28, 2, '#3a3e38');
        pixRect(g, x + w * 0.2, top + 4, w * 0.5, 6, '#4f7a3a');
      }
      for (const fx of [520, 1500]) { // cachoeiras distantes
        for (let y = 150; y < 392; y += 2) { g.fillStyle = (y >> 1) % 3 ? 'rgba(220,240,245,0.55)' : 'rgba(180,220,230,0.5)'; g.fillRect(fx + Math.round(Math.sin(y / 30) * 2), y, 14, 2); }
        pixEllipse(g, fx + 7, 392, 26, 6, 'rgba(230,245,248,0.6)', 2);
      }
      for (let i = 0; i < 14; i++) palm(g, Math.round(r() * BGW), 220 + r() * 80, r);
      g.fillStyle = '#2c3a30'; g.fillRect(0, 392, BGW, H);
      T.midForest = c; }
    { const [c, g] = makeCanvas(BGW, H);
      for (let i = 0; i < 6; i++) { const x = 100 + i * 310 + r() * 80, b = r() < 0.7; fakeBlur(g, () => fern(g, x, b ? H + 20 : -20, b ? -1 : 1, r, '#101c16')); }
      for (let i = 0; i < 4; i++) { const x = r() * BGW; fakeBlur(g, () => pixEllipse(g, x, H + 10, 90 + r() * 50, 50, '#0e1612', 4)); }
      T.foreground = c; }
    T.ground = groundCanvas((g, top) => {
      g.fillStyle = '#4e4a3e'; g.fillRect(0, top, AREA_W, H); g.fillStyle = '#3a3830'; g.fillRect(0, top + 46, AREA_W, H); g.fillStyle = '#26241e'; g.fillRect(0, top + 100, AREA_W, H);
      for (let i = 0; i < 90; i++) { const x = r() * AREA_W, y = top + 14 + r() * 110, w = 6 + r() * 14; pixEllipse(g, x, y, w, 3 + r() * 5, r() < 0.5 ? '#6e7268' : '#5a5e56', 2); pixRect(g, x - w / 2, y - 3, w * 0.6, 2, '#8a9088'); }
      g.fillStyle = PAL.leaf; g.fillRect(0, top, AREA_W, 6); g.fillStyle = '#6a9a4a'; g.fillRect(0, top, AREA_W, 2);
      for (let x = 0; x < AREA_W; x += 6) { const h = 2 + Math.floor(r() * 3) * 2; g.fillStyle = r() < 0.5 ? '#5b8a48' : PAL.leaf2; g.fillRect(x, top - h, 2, h + 2); if (r() < 0.04) { g.fillStyle = '#e8d24a'; g.fillRect(x, top - h - 2, 4, 2); } }
    });
    return T;
  },

  copa() {
    const r = mulberry32(4404), T = { fog: '236,244,232', fogAlpha: 0.3 };
    T.sky = skyCanvas([[0, '#2a6a8e'], [0.35, '#6fb0c8'], [0.65, '#bfe0d8'], [1, '#f5efc8']], [650, 120, 'rgba(255,250,220,0.95)', 'rgba(255,240,200,0.45)'], 420);
    { const [c, g] = makeCanvas(BGW, H);
      for (let x = -40; x < BGW + 40; x += 24) pixCircle(g, x, 400 + Math.sin(x / 90) * 16 + r() * 12, 30 + r() * 16, r() < 0.5 ? '#8ab894' : '#7aa886', 2);
      g.fillStyle = '#7aa886'; g.fillRect(0, 430, BGW, H);
      fogBand(g, 330, 480, '240,246,236', 0.7); T.mountains = c; }
    { const [c, g] = makeCanvas(BGW, H);
      for (let i = 0; i < 14; i++) {
        const x = Math.round(r() * BGW / 2) * 2, ct = 120 + r() * 90, w = 14 + r() * 10;
        pixRect(g, x - w / 2, ct, w, H - ct, '#5a7a5e'); pixRect(g, x - w / 2, ct, 4, H - ct, '#4e6e52');
        for (let k = 0; k < 6; k++) pixCircle(g, x + (r() - 0.5) * 120, ct + (r() - 0.5) * 40, 26 + r() * 20, r() < 0.5 ? '#4f7a5a' : '#58845f', 2);
      }
      fogBand(g, 360, H, '235,244,235', 0.65); T.farForest = c; }
    { const [c, g] = makeCanvas(BGW, H);
      for (let i = 0; i < 7; i++) { // troncos gigantes
        const x = Math.round((80 + i * 270 + r() * 90) / 2) * 2, w = 40 + Math.round(r() * 10) * 2;
        pixRect(g, x, 0, w, H, '#3a2e22'); pixRect(g, x, 0, 8, H, '#2e241a'); pixRect(g, x + w - 6, 0, 4, H, '#4e3e2c');
        for (let y = 10; y < H; y += 18 + r() * 20) pixRect(g, x + 10, y, w - 20, 2, '#2a2016');
        for (let k = 0; k < 3; k++) bromelia(g, x + (r() < 0.5 ? 0 : w), 80 + r() * 380, r);
        g.fillStyle = '#4a6a2a';
        for (let k = 0; k < 2; k++) { const lx = x + r() * w; for (let y = 0; y < 200 + r() * 200; y += 2) g.fillRect(Math.round(lx + Math.sin(y / 26) * 6), y, 2, 2); }
      }
      for (let x = -20; x < BGW + 20; x += 18) pixCircle(g, x, -10 + r() * 34, 30 + r() * 20, r() < 0.5 ? '#1f3628' : '#24402c', 2);
      const deep = g.createLinearGradient(0, 400, 0, H); deep.addColorStop(0, 'rgba(30,52,38,0)'); deep.addColorStop(1, 'rgba(22,40,30,0.85)');
      g.fillStyle = deep; g.fillRect(0, 400, BGW, H - 400);
      T.midForest = c; }
    { const [c, g] = makeCanvas(BGW, H);
      for (let i = 0; i < 8; i++) { const x = 100 + i * 240 + r() * 80, b = r() < 0.4; fakeBlur(g, () => fern(g, x, b ? H + 20 : -20, b ? -1 : 1, r, '#10221a')); }
      T.foreground = c; }
    T.ground = Art.ground;
    return T;
  },

  caverna() {
    const r = mulberry32(5505), T = { fog: '220,180,96', fogAlpha: 0.07, beams: false };
    T.sky = skyCanvas([[0, '#07090a'], [0.45, '#141310'], [1, '#2a2416']], [480, 430, 'rgba(255,200,110,0.35)', 'rgba(220,160,80,0.18)'], 520);
    T.mountains = null;
    { const [c, g] = makeCanvas(BGW, H);
      for (let x = 0; x < BGW; x += 2) { const y = 90 + Math.sin(x / 47) * 20 + Math.sin(x / 13) * 8; g.fillStyle = '#121110'; g.fillRect(x, 0, 2, y); }
      for (let x = 0; x < BGW; x += 2) { const y = 380 - Math.abs(Math.sin(x / 29)) * 40 - Math.sin(x / 71) * 20; g.fillStyle = '#16140f'; g.fillRect(x, y, 2, H - y); }
      for (let i = 0; i < 220; i++) pixRect(g, r() * BGW, 100 + r() * 280, 2, 2, r() < 0.6 ? '#5a4824' : '#7a6230'); // veios de ouro
      T.farForest = c; }
    { const [c, g] = makeCanvas(BGW, H);
      for (let i = 0; i < 12; i++) { // colunas de pedra
        const x = Math.round(r() * BGW / 2) * 2, w = 26 + r() * 30;
        for (let y = 0; y < H; y += 2) { const ww = w * (0.55 + 0.45 * Math.abs(Math.cos(y / H * Math.PI))) ; g.fillStyle = (y >> 3) % 3 ? '#221e18' : '#28231b'; g.fillRect(Math.round(x - ww / 2), y, Math.round(ww), 2); }
        for (let k = 0; k < 4; k++) pixRect(g, x - 2 + (r() - 0.5) * w * 0.6, 60 + r() * 360, 4, 4, '#a8742a');
      }
      for (let i = 0; i < 30; i++) { const x = r() * BGW, len = 20 + r() * 60; pixPoly(g, [[x - 8, 0], [x + 8, 0], [x, len]], '#1a1712'); }
      for (let i = 0; i < 24; i++) { const x = r() * BGW, h = 20 + r() * 50; pixPoly(g, [[x - 12, 396], [x + 12, 396], [x, 396 - h]], '#1e1a14'); }
      g.fillStyle = '#17140f'; g.fillRect(0, 394, BGW, H);
      T.midForest = c; }
    { const [c, g] = makeCanvas(BGW, H);
      for (let i = 0; i < 6; i++) { const x = r() * BGW; fakeBlur(g, () => pixEllipse(g, x, H + 20, 120 + r() * 60, 60, '#080706', 4)); }
      for (let i = 0; i < 5; i++) { const x = r() * BGW; fakeBlur(g, () => pixPoly(g, [[x - 40, -10], [x + 40, -10], [x + 4, 90 + r() * 40]], '#080706', 4)); }
      T.foreground = c; }
    T.extraBack = (ctx, cam) => { const img = Art.caveCeil, w = img.width, off = -((cam % w) + w) % w; ctx.drawImage(img, Math.round(off), -8); ctx.drawImage(img, Math.round(off + w), -8); };
    T.ground = groundCanvas((g, top) => {
      g.fillStyle = '#2e2a22'; g.fillRect(0, top, AREA_W, H); g.fillStyle = '#221f19'; g.fillRect(0, top + 50, AREA_W, H);
      for (let x = 0; x < AREA_W; x += 32) { g.fillStyle = '#3a352a'; g.fillRect(x, top, 30, 6); g.fillStyle = '#1a1712'; g.fillRect(x + 30, top, 2, 36); }
      for (let i = 0; i < 90; i++) pixEllipse(g, r() * AREA_W, top + 14 + r() * 110, 3 + r() * 8, 2 + r() * 4, r() < 0.5 ? '#36322a' : '#1c1914', 2);
      for (let i = 0; i < 40; i++) pixRect(g, r() * AREA_W, top + 8 + r() * 100, 2, 2, r() < 0.5 ? '#c9962e' : '#8a6a24');
      g.fillStyle = '#5a5240'; g.fillRect(0, top, AREA_W, 2);
    });
    return T;
  },
};

// ---------------------------------------------------------- sprites novos
function buildFaseArt() {
  const ink = '#0d1410';
  // caranguejo-uçá: carapaça azul-arroxeada, patas laranja
  Art.crab = [0, 1].map(f => {
    const [c, g] = makeCanvas(52, 30);
    for (let k = 0; k < 3; k++) for (const s of [-1, 1]) { const bx = 26 + s * (6 + k * 5), lift = (k + f) % 2 ? 2 : 0; pixLine(g, bx, 20, bx + s * 8, 28 - lift, 2, '#c8602a'); }
    pixLine(g, 16, 16, 8, 10, 3, '#c8602a'); pixLine(g, 36, 16, 44, 10, 3, '#c8602a');
    pixCircle(g, 7, 9, 5, '#d8703a'); pixCircle(g, 45, 9, 5, '#d8703a'); pixRect(g, 3, 5 + f, 4, 2, '#f0a060'); pixRect(g, 45, 5 + f, 4, 2, '#f0a060');
    pixEllipse(g, 26, 18, 14, 7, '#3c4f8f'); pixRect(g, 16, 13, 20, 2, '#5a70b0'); pixRect(g, 18, 22, 16, 2, '#2a3666');
    pixRect(g, 20, 6, 2, 7, '#3c4f8f'); pixRect(g, 30, 6, 2, 7, '#3c4f8f'); pixRect(g, 19, 4, 4, 4, '#111'); pixRect(g, 29, 4, 4, 4, '#111'); pixRect(g, 20, 4, 2, 2, '#fff'); pixRect(g, 30, 4, 2, 2, '#fff');
    outline(g, 52, 30, ink); return c;
  });
  // pedra rolante: 8 quadros de rotação
  Art.rock = [0, 1, 2, 3, 4, 5, 6, 7].map(f => {
    const [c, g] = makeCanvas(44, 44), a = f / 8 * Math.PI * 2;
    pixCircle(g, 22, 22, 18, '#55554e'); pixCircle(g, 20, 20, 15, '#7a7a70'); pixCircle(g, 16, 15, 6, '#9a9a8e');
    for (const [ang, len] of [[0, 14], [2.1, 10], [4.2, 12]]) { const q = ang + a; pixLine(g, 22, 22, 22 + Math.cos(q) * len, 22 + Math.sin(q) * len, 2, '#3e3e38'); }
    pixRect(g, 22 + Math.cos(a + 1) * 8, 22 + Math.sin(a + 1) * 8, 4, 4, '#4f7a3a'); // musgo
    outline(g, 44, 44, ink); return c;
  });
  // morcego: asas em cima e embaixo
  Art.bat = [0, 1].map(f => {
    const [c, g] = makeCanvas(44, 26);
    const up = f === 0;
    pixPoly(g, up ? [[22, 12], [12, 2], [2, 4], [8, 10], [4, 14], [16, 16]] : [[22, 12], [12, 22], [2, 24], [8, 18], [4, 14], [16, 12]], '#6a5a7a');
    pixPoly(g, up ? [[22, 12], [32, 2], [42, 4], [36, 10], [40, 14], [28, 16]] : [[22, 12], [32, 22], [42, 24], [36, 18], [40, 14], [28, 12]], '#6a5a7a');
    pixEllipse(g, 22, 14, 5, 6, '#4a3a52'); pixRect(g, 18, 6, 2, 4, '#4a3a52'); pixRect(g, 24, 6, 2, 4, '#4a3a52');
    pixRect(g, 19, 12, 2, 2, '#ff6a4a'); pixRect(g, 23, 12, 2, 2, '#ff6a4a');
    outline(g, 44, 26, ink); return c;
  });
  { const [c, g] = makeCanvas(24, 46); pixPoly(g, [[2, 0], [22, 0], [15, 36], [12, 46], [9, 36]], '#5a5246'); pixPoly(g, [[2, 0], [9, 0], [10, 38], [9, 36]], '#7a7062'); pixRect(g, 0, 0, 24, 4, '#3a342c'); Art.stalactite = c; }
  // macaco-prego: sentado (0), braço erguido com fruto (1), rabo enrolado (2)
  Art.monkey = [0, 1, 2].map(f => {
    const [c, g] = makeCanvas(44, 42), fur = '#6a4a2e', dk = '#4a321e';
    if (f === 2) arch(g, 10, 34, 2, 18, 8, 3, dk); else arch(g, 10, 36, 0, 38, -6, 3, dk);
    pixEllipse(g, 20, 28, 10, 11, fur); pixEllipse(g, 22, 30, 6, 7, '#8a6a46');
    pixCircle(g, 24, 12, 8, fur); pixEllipse(g, 26, 14, 5, 5, '#d9b48a'); pixRect(g, 18, 4, 14, 4, '#2a1e14');
    pixRect(g, 25, 11, 2, 2, '#111'); pixRect(g, 29, 11, 2, 2, '#111'); pixRect(g, 27, 16, 3, 2, '#7a4a2a');
    if (f === 1) { pixLine(g, 28, 24, 36, 10, 3, fur); pixCircle(g, 37, 7, 4, '#e8742a'); }
    else pixLine(g, 28, 26, 32, 34, 3, fur);
    pixRect(g, 12, 38, 8, 4, dk); pixRect(g, 22, 38, 8, 4, dk);
    outline(g, 44, 42, ink); return c;
  });
  { const [c, g] = makeCanvas(14, 14); pixCircle(g, 7, 8, 5, '#e8742a'); pixRect(g, 4, 5, 3, 2, '#ffd23a'); pixRect(g, 7, 1, 2, 3, '#4f7a3a'); pixRect(g, 9, 1, 3, 2, '#5b9248'); Art.fruit = c; }
  // vagonete de mina (topo plano em y=4: é a plataforma)
  { const [c, g] = makeCanvas(72, 42);
    pixPoly(g, [[2, 4], [70, 4], [64, 30], [8, 30]], '#6a5236'); pixRect(g, 2, 4, 68, 4, '#8a6a46');
    for (const x of [14, 34, 54]) pixRect(g, x, 8, 4, 22, '#4a3a26');
    pixRect(g, 6, 16, 60, 3, '#5a5a54'); pixRect(g, 8, 26, 56, 3, '#5a5a54');
    for (const x of [6, 22, 40, 56]) pixCircle(g, x + 4, 3, 4, x % 3 ? '#c9962e' : '#f2c14e', 2); // ouro aparecendo
    for (const x of [16, 56]) { pixCircle(g, x, 34, 7, '#2a2a28'); pixCircle(g, x, 34, 3, '#8a8a80'); }
    outline(g, 72, 42, ink); Art.cart = c; }

  // ---------------------------------------------------------- relíquias
  const G1 = PAL.gold, G2 = PAL.gold2, GD = PAL.goldD;
  Art.relics = { idolo: Art.idol };
  { const [c, g] = makeCanvas(40, 34); // concha dourada
    pixCircle(g, 20, 20, 16, G1); pixRect(g, 2, 20, 36, 14, 'rgba(0,0,0,0)'); g.clearRect(0, 22, 40, 12);
    for (let k = -3; k <= 3; k++) pixLine(g, 20, 26, 20 + k * 5, 6 + Math.abs(k) * 2, 2, GD);
    pixPoly(g, [[14, 22], [26, 22], [24, 30], [16, 30]], G1); pixRect(g, 16, 24, 8, 2, GD);
    pixRect(g, 12, 8, 4, 4, G2); pixRect(g, 20, 4, 2, 2, '#ffffff');
    outline(g, 40, 34, ink); Art.relics.concha = c; }
  { const [c, g] = makeCanvas(40, 44); // máscara de pedra-verde
    pixEllipse(g, 20, 22, 15, 19, '#3f8f6a'); pixEllipse(g, 18, 18, 10, 12, '#5aaa82');
    pixRect(g, 10, 15, 8, 5, '#12261c'); pixRect(g, 22, 15, 8, 5, '#12261c'); pixRect(g, 12, 16, 3, 2, G2); pixRect(g, 24, 16, 3, 2, G2);
    pixRect(g, 18, 20, 4, 8, '#2f7052'); pixRect(g, 14, 32, 12, 3, '#12261c');
    pixRect(g, 6, 8, 28, 2, G1); pixRect(g, 4, 20, 3, 6, G1); pixRect(g, 33, 20, 3, 6, G1);
    outline(g, 40, 44, ink); Art.relics.mascara = c; }
  { const [c, g] = makeCanvas(26, 48); // pena do gavião-real
    pixLine(g, 13, 46, 13, 4, 2, GD);
    for (let y = 6; y < 40; y += 2) { const w = Math.round(Math.sin((y - 4) / 36 * Math.PI) * 9); const band = Math.floor(y / 7) % 2; pixRect(g, 13 - w, y, w, 2, band ? '#3a3a3a' : G1); pixRect(g, 14, y, w, 2, band ? '#5a5a5a' : G2); }
    pixRect(g, 12, 40, 4, 6, GD);
    outline(g, 26, 48, ink); Art.relics.pena = c; }
  { const [c, g] = makeCanvas(40, 38); // coração de ouro
    pixCircle(g, 13, 14, 10, G1); pixCircle(g, 27, 14, 10, G1); pixPoly(g, [[4, 18], [36, 18], [20, 36]], G1);
    pixCircle(g, 12, 11, 4, G2); pixPoly(g, [[20, 30], [34, 18], [36, 18], [20, 36]], GD);
    pixCircle(g, 20, 19, 5, PAL.turqD); pixCircle(g, 19, 18, 3, PAL.turq); pixRect(g, 18, 16, 2, 2, '#ffffff');
    outline(g, 40, 38, ink); Art.relics.coracao = c; }
}

// ---------------------------------------------------------- desenho em coordenadas do mundo
function drawPit(ctx, g, theme) {
  const x1 = g.x1, x2 = g.x2;
  const gr = ctx.createLinearGradient(0, GROUND, 0, H);
  gr.addColorStop(0, '#1a1510'); gr.addColorStop(1, '#000000');
  ctx.fillStyle = gr; ctx.fillRect(x1, GROUND - 2, x2 - x1, H - GROUND + 2);
  for (const [x, s] of [[x1, 1], [x2, -1]]) for (let y = GROUND - 2; y < H; y += 12) {
    const w = 6 + ((y * 7 + x) % 5) * 2;
    ctx.fillStyle = '#3a332a'; ctx.fillRect(s > 0 ? x : x - w, y, w, 12); ctx.fillStyle = '#4e463a'; ctx.fillRect(s > 0 ? x : x - w, y, w, 2);
  }
}
function drawRiver(ctx, g, now) {
  const x1 = g.x1, x2 = g.x2, top = GROUND;
  ctx.fillStyle = '#2a2218'; ctx.fillRect(x1, top - 2, x2 - x1, H - top + 2);
  const gr = ctx.createLinearGradient(0, top + 12, 0, H);
  gr.addColorStop(0, '#4f9aa8'); gr.addColorStop(0.3, '#2f6e7a'); gr.addColorStop(1, '#0d2228');
  ctx.fillStyle = gr; ctx.fillRect(x1 + 4, top + 12, x2 - x1 - 8, H - top - 12);
  const wd = x2 - x1 - 24;
  for (let k = 0; k < Math.max(4, wd / 18); k++) { // correnteza: espuma correndo para a esquerda
    const x = x1 + 12 + ((((k * 53 + 7) - now * 0.12) % wd) + wd) % wd, y = top + 14 + (k % 5) * 9;
    ctx.fillStyle = k % 3 ? 'rgba(207,238,240,0.8)' : 'rgba(160,210,220,0.7)'; ctx.fillRect(Math.round(x), y, 14 - (k % 3) * 3, 2);
  }
  ctx.fillStyle = PAL.stone; ctx.fillRect(x1, top - 2, 8, H); ctx.fillRect(x2 - 8, top - 2, 8, H);
  ctx.fillStyle = PAL.stone2; ctx.fillRect(x1, top - 2, 8, 3); ctx.fillRect(x2 - 8, top - 2, 8, 3);
}
function drawMud(ctx, m, now) {
  const w = m.x2 - m.x1;
  ctx.fillStyle = '#3a2a1a'; ctx.fillRect(m.x1, GROUND - 2, w, 18);
  ctx.fillStyle = '#5a4630'; ctx.fillRect(m.x1 + 4, GROUND - 2, w - 8, 3);
  ctx.fillStyle = '#2a1e12'; ctx.fillRect(m.x1 + 10, GROUND + 6, w - 20, 4);
  for (let k = 0; k < w / 40; k++) {
    const ph = (now / 900 + k * 0.37) % 1, x = m.x1 + 12 + ((k * 37) % (w - 24));
    if (ph < 0.6) { const s = 2 + Math.round(ph * 4) * 2; ctx.fillStyle = '#6a5640'; ctx.fillRect(Math.round(x - s / 2), GROUND - s / 2, s, s / 2 + 2); }
  }
}
function drawTide(ctx, z, level, rising, now, floor) {
  // poste de medição: listras vermelhas/brancas e seta de subida/descida
  const px = z.x1 - 12;
  ctx.fillStyle = '#5a3a20'; ctx.fillRect(px - 3, GROUND - 120, 6, 132);
  for (let y = GROUND - 116; y < GROUND; y += 16) { ctx.fillStyle = (y / 16) % 2 < 1 ? '#c8322a' : '#f4f1e4'; ctx.fillRect(px - 3, y, 6, 8); }
  const ay = GROUND - 136, up = rising;
  ctx.fillStyle = up ? '#e0503a' : '#5bbf6a';
  for (let k = 0; k < 4; k++) ctx.fillRect(px - k * 2 - 1, up ? ay + k * 2 : ay + 6 - k * 2, k * 4 + 2, 2);
  if (level < floor + 8) {
    const y = Math.round(level / 2) * 2;
    ctx.fillStyle = 'rgba(40,104,104,0.78)'; ctx.fillRect(z.x1, y, z.x2 - z.x1, floor + 26 - y);
    ctx.fillStyle = 'rgba(191,227,212,0.55)'; ctx.fillRect(z.x1, y, z.x2 - z.x1, 2);
    for (let x = z.x1 + 6; x < z.x2 - 6; x += 18) if ((Math.floor(now / 260 + x / 18) % 3) === 0) { ctx.fillStyle = PAL.foam; ctx.fillRect(Math.round(x + Math.sin(now / 380 + x) * 3), y + 2, 8, 2); }
  } else {
    ctx.fillStyle = 'rgba(150,180,175,0.35)';
    for (let x = z.x1; x < z.x2; x += 12) if (((x / 12) | 0) % 2 === 0) ctx.fillRect(x, GROUND - 1, 8, 2);
  }
}
function drawRail(ctx, c) {
  const y = c.y + 4, x1 = c.a - 44, x2 = c.b + 44;
  for (let x = Math.ceil(x1 / 120) * 120; x < x2; x += 120) { ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x - 4, y + 4, 8, H - y); ctx.fillStyle = '#4e3a24'; ctx.fillRect(x - 4, y + 4, 2, H - y); }
  ctx.fillStyle = '#4a3a26'; for (let x = x1; x < x2; x += 14) ctx.fillRect(x, y + 2, 8, 6);
  ctx.fillStyle = '#7a7a72'; ctx.fillRect(x1, y, x2 - x1, 3); ctx.fillStyle = '#a0a096'; ctx.fillRect(x1, y, x2 - x1, 1);
  ctx.fillStyle = '#5a3a20'; ctx.fillRect(x2 - 4, y - 18, 8, 22); ctx.fillRect(x1 - 4, y - 18, 8, 22); // batentes
}
function drawZipline(ctx, z) {
  for (const [x, y] of [[z.x1, z.y1], [z.x2, z.y2]]) { ctx.fillStyle = '#4a3220'; ctx.fillRect(x - 4, y - 14, 8, GROUND - y + 14); ctx.fillStyle = '#6a4a2e'; ctx.fillRect(x - 4, y - 14, 2, GROUND - y + 14); }
  const n = Math.ceil(Math.hypot(z.x2 - z.x1, z.y2 - z.y1) / 2);
  ctx.fillStyle = '#c9c2a8';
  for (let i = 0; i <= n; i++) { const t = i / n; ctx.fillRect(Math.round(lerp(z.x1, z.x2, t)), Math.round(lerp(z.y1, z.y2, t)), 2, 2); }
}
function drawPlatform(ctx, pl, now) {
  const x1 = Math.round(pl.cx1 ?? pl.x1), x2 = Math.round(pl.cx2 ?? pl.x2), top = Math.round(pl.top ?? pl.y), w = x2 - x1;
  const shaking = (pl.kind === 'crumble' || pl.kind === 'sink') && (pl.touch || 0) > 0;
  const j = shaking ? (Math.floor(now / 45) % 2) * 2 - 1 : 0;
  switch (pl.look) {
    case 'root': {
      for (const fx of [0, 0.5, 1]) { const bx = x1 + w * fx; arch(ctx, bx, top + 8, bx + (fx - 0.5) * 50, GROUND + 6, -10, 4, '#4a3c2c'); arch(ctx, bx, top + 8, bx + (0.5 - fx) * 30 + 10, GROUND + 6, 8, 2, '#3a2e22'); }
      ctx.fillStyle = '#5a4a36'; ctx.fillRect(x1, top, w, 10); ctx.fillStyle = '#7a6a50'; ctx.fillRect(x1, top, w, 2);
      ctx.fillStyle = '#5b7a48'; for (let x = x1 + 4; x < x2 - 4; x += 14) ctx.fillRect(x, top - 2, 6, 2);
      break;
    }
    case 'stone': {
      const cx = (x1 + x2) / 2;
      pixEllipse(ctx, cx + j, top + 9, w / 2, 10, '#5a5e56'); pixEllipse(ctx, cx + j, top + 6, w / 2 - 2, 7, '#7a7e74');
      ctx.fillStyle = '#9aa094'; ctx.fillRect(x1 + 10 + j, top, w - 24, 2);
      if (shaking) { ctx.fillStyle = PAL.foam; ctx.fillRect(x1 - 4 + (Math.floor(now / 90) % 3) * 4, GROUND + 12, 6, 2); ctx.fillRect(x2 - 4 - (Math.floor(now / 110) % 3) * 4, GROUND + 12, 6, 2); }
      break;
    }
    case 'branch': {
      const trunks = []; for (let tx = Math.ceil((x1 + 40) / 380) * 380; tx < x2 - 40; tx += 380) trunks.push(tx);
      if (!trunks.length && w > 60) trunks.push(Math.round((x1 + x2) / 2));
      for (const tx of trunks) { ctx.fillStyle = '#3e2c1c'; ctx.fillRect(tx - 18, top + 14, 36, H - top); ctx.fillStyle = '#2e2014'; ctx.fillRect(tx - 18, top + 14, 6, H - top); ctx.fillStyle = '#4e3a26'; ctx.fillRect(tx + 12, top + 14, 4, H - top); }
      ctx.fillStyle = '#5a3a20'; ctx.fillRect(x1, top, w, 18); ctx.fillStyle = '#3a2414'; for (let x = x1 + 8; x < x2; x += 22) ctx.fillRect(x, top + 8, 12, 2);
      ctx.fillStyle = '#4f7a3a'; ctx.fillRect(x1, top, w, 4); ctx.fillStyle = '#6a9a48'; for (let x = x1; x < x2; x += 8) ctx.fillRect(x, top - 2, 4, 2);
      pixCircle(ctx, x1 + 6, top + 18, 12, '#2f5a36'); pixCircle(ctx, x2 - 6, top + 18, 12, '#2f5a36');
      ctx.fillStyle = '#3a2414'; ctx.fillRect(x1, top + 16, w, 2);
      break;
    }
    case 'bridge': {
      const ry = top - 34, sag = 10;
      for (let x = x1; x < x2; x += 10) { ctx.fillStyle = ((x - x1) / 10) % 2 ? '#7a5230' : '#8a6038'; ctx.fillRect(x, top, 8, 8); ctx.fillStyle = '#5a3a20'; ctx.fillRect(x, top + 6, 8, 2); }
      ctx.fillStyle = '#6a7a3a';
      for (let x = x1; x <= x2; x += 2) { const t = (x - x1) / w, y = ry + Math.sin(t * Math.PI) * sag; ctx.fillRect(x, Math.round(y), 2, 2); if ((x - x1) % 30 === 0) ctx.fillRect(x, Math.round(y), 2, top - y); }
      ctx.fillStyle = '#4a3220'; ctx.fillRect(x1 - 4, ry - 6, 6, top - ry + 12); ctx.fillRect(x2 - 2, ry - 6, 6, top - ry + 12);
      break;
    }
    case 'dry': {
      if (pl.broken) { ctx.fillStyle = '#5a4a3a'; ctx.fillRect(x1, top, 10, 10); break; }
      ctx.fillStyle = '#7a6a56'; ctx.fillRect(x1 + j, top, w, 12); ctx.fillStyle = '#9a8a72'; ctx.fillRect(x1 + j, top, w, 2);
      ctx.fillStyle = '#3a3026'; for (let x = x1 + 10; x < x2 - 6; x += 18) ctx.fillRect(x + j, top + 4, 6, 2);
      if (shaking) { ctx.fillStyle = '#1a140e'; ctx.fillRect(x1 + w / 2 - 1 + j, top, 3, 12); ctx.fillRect(x1 + w / 2 - 6 + j, top + 6, 12, 2); }
      ctx.fillStyle = '#8a7a3a'; ctx.fillRect(x2 - 8 + j, top - 6, 2, 6); ctx.fillRect(x2 - 10 + j, top - 8, 6, 2); // folha seca
      break;
    }
    case 'slab': {
      if (pl.broken) break;
      ctx.fillStyle = '#4a4438'; ctx.fillRect(x1 + j, top, w, 16);
      for (let x = x1; x < x2; x += 8) { const d = 4 + ((x * 13) % 9); ctx.fillRect(x + j, top + 16, 8, d); }
      ctx.fillStyle = '#6a6252'; ctx.fillRect(x1 + j, top, w, 3);
      if (shaking) { ctx.fillStyle = '#100e0a'; ctx.fillRect(x1 + w * 0.4 + j, top, 2, 16); ctx.fillRect(x1 + w * 0.65 + j, top + 4, 2, 12); }
      break;
    }
  }
}
function drawWaterfall(ctx, w, strong, now, floor) {
  const x = w.x, top = w.top;
  ctx.fillStyle = '#4a4e48'; ctx.fillRect(x - 24, top - 24, w.w + 48, 24); ctx.fillStyle = '#4f7a3a'; ctx.fillRect(x - 24, top - 26, w.w + 48, 4);
  const inset = strong ? 0 : Math.round(w.w * 0.3);
  for (let i = inset; i < w.w - inset; i += 4) {
    for (let y = top; y < floor; y += 8) {
      const k = Math.floor((y - now * (strong ? 0.5 : 0.25) + i * 7) / 8);
      ctx.fillStyle = k % 3 === 0 ? (strong ? 'rgba(235,250,252,0.95)' : 'rgba(220,240,245,0.45)') : (strong ? 'rgba(150,206,218,0.85)' : 'rgba(150,206,218,0.3)');
      ctx.fillRect(x + i, y, 4, 8);
    }
  }
  const s = strong ? 1 : 0.5;
  for (let k = 0; k < 6; k++) { const ph = (now / 300 + k / 6) % 1; ctx.fillStyle = `rgba(230,246,248,${(1 - ph) * 0.8 * s})`; ctx.fillRect(Math.round(x - 10 + k * (w.w + 20) / 6), Math.round(floor - 8 - ph * 26 * s), 8, 6); }
  pixEllipse(ctx, x + w.w / 2, floor + 2, w.w / 2 + 20, 5, `rgba(220,240,245,${0.5 * s + 0.2})`, 2);
}
function drawRockSource(ctx, r, now) {
  const x = r.b;
  for (const [dx, dy, rr, c] of [[30, -18, 18, '#55554e'], [10, -12, 12, '#6a6a60'], [44, -40, 16, '#5e5e56'], [22, -52, 14, '#6a6a60'], [50, -14, 14, '#4a4a44']]) pixCircle(ctx, x + dx, GROUND + dy, rr, c);
  ctx.fillStyle = '#8a8a7e'; ctx.fillRect(x + 16, GROUND - 60, 10, 2); ctx.fillRect(x + 38, GROUND - 52, 8, 2);
}
function drawPedestal(ctx, idol) {
  const x = idol.x, y = idol.y, h = GROUND - y;
  const col = { concha: ['#b89a7a', '#d8bc9a'], mascara: ['#5d6460', '#8a918a'], pena: ['#6a4a2a', '#8a6a3a'], coracao: ['#4a4234', '#6a6050'] }[idol.relic] || ['#6e756f', '#9aa19a'];
  ctx.fillStyle = col[0]; ctx.fillRect(x - 32, y, 64, h); ctx.fillStyle = col[1]; ctx.fillRect(x - 32, y, 64, 4);
  ctx.fillStyle = PAL.stoneD; ctx.fillRect(x - 32, y + h - 4, 64, 4);
  for (let k = 0; k < 4; k++) { ctx.fillRect(x - 24 + k * 14, y + 12, 8, 2); ctx.fillRect(x - 22 + k * 14, y + 18, 4, 8); }
  ctx.fillStyle = PAL.gold; ctx.fillRect(x - 32, y - 2, 64, 2);
}
function drawPerch(ctx, m) { // galho onde o macaco fica
  ctx.fillStyle = '#4a3220'; ctx.fillRect(m.x - 40, m.y, 80, 10); ctx.fillStyle = '#6a4a2e'; ctx.fillRect(m.x - 40, m.y, 80, 2);
  pixCircle(ctx, m.x - 40, m.y + 2, 14, '#2f5a36'); pixCircle(ctx, m.x + 40, m.y + 2, 12, '#24402c');
  ctx.fillStyle = '#3e2c1c'; ctx.fillRect(m.x + 30, m.y - 80, 14, 90);
}
