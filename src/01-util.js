'use strict';
// ============================================================ Mata Adentro — utilidades
const W = 960, H = 540;          // tela interna
const DT = 1 / 60;               // passo fixo da física
const AREA_W = 960;              // cada área tem uma tela de largura
const GROUND = 400;              // y dos pés no chão da superfície
const FLOOR_U = 456;             // y dos pés no chão do subterrâneo
const DEFAULT_SEED = 20261107;

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);
const sign = v => v < 0 ? -1 : v > 0 ? 1 : 0;

// Mulberry32 — sorteador determinístico, não usa o relógio
function mulberry32(seed) {
  let a = seed >>> 0;
  const r = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.range = (a, b) => a + (b - a) * r();
  r.int = (a, b) => Math.floor(a + (b - a + 1) * r());
  r.pick = arr => arr[Math.floor(r() * arr.length)];
  r.chance = p => r() < p;
  return r;
}

// Paleta (~32 cores): verdes profundos, terra, dourado da luz, vermelho do lenço, turquesa das joias
const PAL = {
  ink: '#0d1410', night: '#14201a', deep: '#1b2e22', moss: '#24402c', leaf: '#2f5a36',
  leaf2: '#3f7442', fern: '#5b9248', lime: '#8fbf55', mist: '#9fb9a2', fog: '#c9dcc4',
  skyTop: '#2c5a52', skyMid: '#6f9a6a', skyLow: '#d9c27a', sun: '#ffe9a8',
  soil: '#3a2616', soil2: '#5a3a20', clay: '#7a5230', sand: '#b8925a', sand2: '#d9b878',
  stone: '#5d6460', stone2: '#8a918a', stoneD: '#363d3a',
  water: '#1f4a4f', water2: '#2f6e6a', foam: '#bfe3d4',
  gold: '#f2c14e', gold2: '#ffe28a', goldD: '#a8742a',
  red: '#c8322a', redD: '#8a1f1a', turq: '#3fd1c4', turqD: '#1f8f8a',
  skin: '#c98a5a', skinD: '#a0663c', white: '#f4f1e4', black: '#000000',
};

// ------------------------------------------------------------ fonte em pixel (5×7), desenhada em código
const GLYPHS = {
  'A': ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  'B': ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  'C': ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  'D': ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  'E': ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  'F': ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  'G': ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  'H': ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  'I': ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  'J': ['..###', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'],
  'K': ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  'L': ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  'M': ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  'N': ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  'O': ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  'P': ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  'Q': ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  'R': ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  'S': ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  'T': ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  'U': ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  'V': ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  'W': ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  'X': ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  'Y': ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  'Z': ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  ',': ['.....', '.....', '.....', '.....', '.##..', '..#..', '.#...'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
  ';': ['.....', '.##..', '.##..', '.....', '.##..', '..#..', '.#...'],
  '-': ['.....', '.....', '.....', '.###.', '.....', '.....', '.....'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '=': ['.....', '.....', '#####', '.....', '#####', '.....', '.....'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  "'": ['..#..', '..#..', '.#...', '.....', '.....', '.....', '.....'],
  '"': ['.#.#.', '.#.#.', '.....', '.....', '.....', '.....', '.....'],
  '(': ['...#.', '..#..', '.#...', '.#...', '.#...', '..#..', '...#.'],
  ')': ['.#...', '..#..', '...#.', '...#.', '...#.', '..#..', '.#...'],
  '%': ['##..#', '##..#', '...#.', '..#..', '.#...', '#..##', '#..##'],
  '#': ['.#.#.', '.#.#.', '#####', '.#.#.', '#####', '.#.#.', '.#.#.'],
  '×': ['.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '.....'],
  '→': ['.....', '..#..', '...#.', '#####', '...#.', '..#..', '.....'],
  '←': ['.....', '..#..', '.#...', '#####', '.#...', '..#..', '.....'],
  '↑': ['..#..', '.###.', '#.#.#', '..#..', '..#..', '..#..', '..#..'],
  '↓': ['..#..', '..#..', '..#..', '..#..', '#.#.#', '.###.', '..#..'],
  '★': ['..#..', '..#..', '#####', '.###.', '.###.', '#.#.#', '.....'],
  '·': ['.....', '.....', '.....', '..#..', '.....', '.....', '.....'],
  '—': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '♪': ['..###', '..#.#', '..#..', '..#..', '###..', '###..', '.....'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
};
// acentos do português: letra base + marca desenhada acima
const ACCENTS = {
  'Á': ['A', 'acute'], 'À': ['A', 'grave'], 'Â': ['A', 'circ'], 'Ã': ['A', 'tilde'],
  'É': ['E', 'acute'], 'Ê': ['E', 'circ'], 'Í': ['I', 'acute'], 'Ó': ['O', 'acute'],
  'Ô': ['O', 'circ'], 'Õ': ['O', 'tilde'], 'Ú': ['U', 'acute'], 'Ü': ['U', 'uml'], 'Ç': ['C', 'cedil'],
};
const MARKS = {
  acute: [[3, -2], [2, -1]], grave: [[1, -2], [2, -1]], circ: [[2, -2], [1, -1], [3, -1]],
  tilde: [[1, -2], [2, -1], [3, -2], [4, -2], [0, -1]], uml: [[1, -1], [3, -1]], cedil: [[2, 7], [2, 8], [1, 8]],
};
const GLYPH_W = 6, GLYPH_H = 10; // célula no atlas (inclui 2 linhas para acentos e 1 para cedilha)
const FONT_CHARS = Object.keys(GLYPHS).concat(Object.keys(ACCENTS));
const fontCache = new Map();

function fontAtlas(color) {
  let a = fontCache.get(color);
  if (a) return a;
  const c = document.createElement('canvas');
  c.width = FONT_CHARS.length * GLYPH_W; c.height = GLYPH_H;
  const g = c.getContext('2d');
  g.fillStyle = color;
  FONT_CHARS.forEach((ch, i) => {
    let base = ch, mark = null;
    if (ACCENTS[ch]) { base = ACCENTS[ch][0]; mark = ACCENTS[ch][1]; }
    const rows = GLYPHS[base];
    const ox = i * GLYPH_W, oy = 2;
    for (let y = 0; y < 7; y++) for (let x = 0; x < 5; x++) if (rows[y][x] === '#') g.fillRect(ox + x, oy + y, 1, 1);
    if (mark) for (const [mx, my] of MARKS[mark]) g.fillRect(ox + mx, oy + my, 1, 1);
  });
  a = { canvas: c, index: new Map(FONT_CHARS.map((ch, i) => [ch, i])) };
  fontCache.set(color, a);
  return a;
}

function textWidth(str, scale = 2) { return str.length * GLYPH_W * scale - scale; }

// desenha texto em pixel; align: 'left' | 'center' | 'right'
function drawText(ctx, str, x, y, scale = 2, color = PAL.white, align = 'left', shadow = PAL.ink) {
  str = String(str).toUpperCase();
  const w = textWidth(str, scale);
  let sx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  sx = Math.round(sx); y = Math.round(y);
  if (shadow) drawRun(ctx, str, sx + scale, y + scale, scale, shadow);
  drawRun(ctx, str, sx, y, scale, color);
  return w;
}
function drawRun(ctx, str, x, y, scale, color) {
  const a = fontAtlas(color);
  for (let i = 0; i < str.length; i++) {
    const gi = a.index.get(str[i]);
    if (gi === undefined) continue;
    ctx.drawImage(a.canvas, gi * GLYPH_W, 0, GLYPH_W, GLYPH_H, x + i * GLYPH_W * scale, y - 2 * scale, GLYPH_W * scale, GLYPH_H * scale);
  }
}
// quebra texto em linhas que cabem em maxW
function wrapText(str, maxW, scale = 2) {
  const words = String(str).split(' ');
  const lines = []; let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (textWidth(t, scale) > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w); c.height = Math.ceil(h);
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return [c, g];
}

const fmtTime = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const fmtNum = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

// armazenamento seguro: o jogo segue normal se o navegador bloquear
const store = {
  get(k, def) { try { const v = localStorage.getItem(k); return v === null ? def : JSON.parse(v); } catch (e) { return def; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sem armazenamento */ } },
};
