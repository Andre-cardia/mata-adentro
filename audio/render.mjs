#!/usr/bin/env node
// Mata Adentro — sintetizador das partituras (Node puro, sem dependências).
//
// Lê audio/scores/<faixa>.json (gerado por compose.py) e grava
// audio/render/<faixa>.wav (48 kHz, estéreo, 16 bits).
//
//   node render.mjs mangue serra            # grava render/mangue.wav, render/serra.wav
//   node render.mjs mata --out /tmp/x.wav    # faixas antigas só com --out (ou --force)
//   opções: --lufs -14  --peak -1.5  --solo <trilha>  --stats
//
// Partitura: { tracks: [{ name, instrument, gainDb, pan, reverb, chorus,
//   humanize: { timingMs, velocity }, drums?, notes: [[t, dur, pitch|[pitches]|nome, vel]] }] }
//
// Laços: a humanização de tempo só atrasa (0..timingMs), então nenhuma nota do início
// de um ciclo vaza para antes dele. O sorteio usa a posição da nota dentro do ciclo
// (L lido de scores/loops.json), então os 3 ciclos saem idênticos e o 2º ciclo
// recortado pelo process.sh fecha sem emenda.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SR = 48000;
const TAU = Math.PI * 2;
// Faixas da v1: renderizadas por outro sintetizador, não podem ser sobrescritas.
const PROTECTED = new Set(['tema', 'mata', 'sub', 'vitoria', 'derrota']);

// ------------------------------------------------------------------ utilidades
function rng32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
// altura em MIDI; aceita número ou nome ("F#3", "Bb1")
function toMidi(p) {
  if (typeof p === 'number') return p;
  const m = /^([A-G])([#b]*)(-?\d+)$/.exec(p);
  if (!m) throw new Error(`altura inválida: ${p}`);
  return 12 * (+m[3] + 1) + NOTE[m[1]] + [...m[2]].reduce((a, c) => a + (c === '#' ? 1 : -1), 0);
}
const mtof = (p) => 440 * Math.pow(2, (toMidi(p) - 69) / 12);
const dbToGain = (db) => Math.pow(10, db / 20);
const ms = (x) => Math.round(x * SR);

// ADSR com ataque linear, decaimento e release exponenciais. Tempos em segundos.
function adsr(n, gate, a, d, s, r) {
  const out = new Float32Array(n);
  const A = Math.max(1, ms(a)), kd = 1 / Math.max(1, ms(d) / 4), kr = 1 / Math.max(1, ms(r) / 5);
  let lvl = 0;
  for (let i = 0; i < n; i++) {
    if (i < gate) {
      if (i < A) lvl = Math.max(lvl, (i + 1) / A);
      else lvl = s + (lvl - s) * (1 - kd);
    } else lvl *= 1 - kr;
    out[i] = lvl;
  }
  return out;
}
function polyblep(t, dt) {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}
// filtro de estado variável (TPT); set() pode ser chamado a cada bloco
class SVF {
  constructor() { this.ic1 = 0; this.ic2 = 0; this.lp = 0; this.bp = 0; this.hp = 0; this.set(1000, 0.707); }
  set(fc, q) {
    const g = Math.tan(Math.PI * Math.min(Math.max(fc, 10), SR * 0.45) / SR);
    this.k = 1 / q; this.a1 = 1 / (1 + g * (g + this.k)); this.a2 = g * this.a1; this.a3 = g * this.a2;
  }
  tick(v0) {
    const v3 = v0 - this.ic2;
    const v1 = this.a1 * this.ic1 + this.a2 * v3;
    const v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
    this.ic1 = 2 * v1 - this.ic1; this.ic2 = 2 * v2 - this.ic2;
    this.lp = v2; this.bp = v1; this.hp = v0 - this.k * v1 - v2;
    return v2;
  }
}
function filt(x, type, fc, q = 0.707) {
  const f = new SVF(); f.set(fc, q);
  for (let i = 0; i < x.length; i++) { f.tick(x[i]); x[i] = f[type]; }
  return x;
}
function noise(n, rnd) { const x = new Float32Array(n); for (let i = 0; i < n; i++) x[i] = rnd() * 2 - 1; return x; }

// soma de parciais senoidais com decaimento próprio: [razão, amplitude, t60]
function modal(f, parts, rnd, { n = 0, pitchDrop = 0, dropT = 0.03 } = {}) {
  const len = n || ms(Math.max(...parts.map((p) => p[2])) + 0.02);
  const out = new Float32Array(len);
  for (const [ratio, amp, t60] of parts) {
    const fr = f * ratio;
    if (fr > SR * 0.45) continue;
    const k = Math.exp(-6.9 / (t60 * SR));
    let ph = rnd(), g = amp;
    const m = Math.min(len, ms(t60 * 1.2));
    for (let i = 0; i < m; i++) {
      const bend = pitchDrop ? 1 + pitchDrop * Math.exp(-i / (dropT * SR)) : 1;
      ph += fr * bend / SR;
      out[i] += g * Math.sin(TAU * ph);
      g *= k;
    }
  }
  return out;
}
// Karplus-Strong com afinação fracionária (allpass) e abafamento no fim da nota
function pluck(f, n, gate, rnd, { t60 = 2, damp = 0.15, bright = 0.5, pos = 0.18, S = 0.35 } = {}) {
  const out = new Float32Array(n);
  const P = SR / f;
  const M = Math.max(2, Math.floor(P - S - 0.15));
  const dfrac = P - M - S;
  const C = (1 - dfrac) / (1 + dfrac);
  const w = TAU * f / SR;
  const H = Math.sqrt((1 - S) ** 2 + S * S + 2 * S * (1 - S) * Math.cos(w));
  const g = Math.min(0.99999, Math.pow(10, -3 / (t60 * f)) / H);
  const gd = Math.min(g, Math.pow(10, -3 / (damp * f)) / H);
  // excitação: ruído de um período, filtrado (brilho) e com pente da posição de ataque
  const exc = filt(noise(M, rnd), 'lp', 300 + bright * 7000);
  const pp = Math.max(1, Math.round(pos * M));
  const e2 = new Float32Array(M);
  let mean = 0;
  for (let i = 0; i < M; i++) { e2[i] = exc[i] - (i >= pp ? exc[i - pp] : 0); mean += e2[i]; }
  mean /= M;
  let peak = 1e-9;
  for (let i = 0; i < M; i++) { e2[i] -= mean; peak = Math.max(peak, Math.abs(e2[i])); }
  const buf = new Float32Array(M);
  let idx = 0, prev = 0, x1 = 0, y1 = 0;
  for (let i = 0; i < n; i++) {
    const xd = buf[idx];
    const gg = i < gate ? g : gd;
    const lf = gg * ((1 - S) * xd + S * prev); prev = xd;
    const ap = C * lf + x1 - C * y1; x1 = lf; y1 = ap;
    const v = ap + (i < M ? e2[i] / peak : 0);
    buf[idx] = v; idx = idx + 1 === M ? 0 : idx + 1;
    out[i] = v;
  }
  return out;
}

// oscilador genérico: soma de serras/quadradas/senos com vibrato e curva de altura
function osc(n, f, rnd, { saw = 0, sq = 0, sin = 0, tri = 0, detune = [0], vib = 0, vibRate = 5.2, vibDelay = 0.3, scoop = 0, scoopT = 0.05 }) {
  const out = new Float32Array(n);
  const vr = vibRate * (0.92 + 0.16 * rnd());
  for (const dc of detune) {
    const fd = f * Math.pow(2, dc / 1200);
    let ph = rnd(), vph = rnd();
    const norm = 1 / detune.length;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      let m = 1;
      if (vib) { vph += vr / SR; const vd = Math.min(1, Math.max(0, (t - vibDelay) / 0.4)); m += vib * vd * Math.sin(TAU * vph); }
      if (scoop) m *= Math.pow(2, (scoop * Math.exp(-t / scoopT)) / 1200);
      const dt = fd * m / SR;
      ph += dt; if (ph >= 1) ph -= 1;
      let v = 0;
      if (saw) v += saw * (2 * ph - 1 - polyblep(ph, dt));
      if (sq) { let s = ph < 0.5 ? 1 : -1; s += polyblep(ph, dt) - polyblep((ph + 0.5) % 1, dt); v += sq * s; }
      if (sin) v += sin * Math.sin(TAU * ph);
      if (tri) v += tri * (ph < 0.5 ? 4 * ph - 1 : 3 - 4 * ph);
      out[i] += v * norm;
    }
  }
  return out;
}
// filtro passa-baixa com envelope: fc(t) = base + amt*env(t), atualizado a cada 16 amostras
function envFilter(x, envv, base, amt, q = 0.7, cap = 12000) {
  const f = new SVF();
  for (let i = 0; i < x.length; i++) {
    if ((i & 15) === 0) f.set(Math.min(cap, base + amt * envv[i]), q);
    x[i] = f.tick(x[i]);
  }
  return x;
}
function mulEnv(x, e) { for (let i = 0; i < x.length; i++) x[i] *= e[i]; return x; }
function addInto(x, y, g = 1) { const m = Math.min(x.length, y.length); for (let i = 0; i < m; i++) x[i] += y[i] * g; return x; }

// ------------------------------------------------------------------ instrumentos melódicos
// cada um: (f, durS, vel01, rnd) -> Float32Array mono
function brass(f, dur, v, rnd, o) {
  const gate = ms(dur), n = gate + ms(o.r * 3 + 0.05);
  const e = adsr(n, gate, o.a, o.d, o.s, o.r);
  const fe = adsr(n, gate, o.a * 1.6, o.d * 1.5, o.fs ?? 0.55, o.r);
  const x = osc(n, f, rnd, { saw: o.saw ?? 1, sq: o.sq ?? 0, tri: o.tri ?? 0, detune: o.detune ?? [0], vib: o.vib ?? 0.003, vibRate: 5.4, vibDelay: 0.35, scoop: o.scoop ?? -25, scoopT: 0.035 });
  envFilter(x, fe, f * o.fb, f * o.fa * (0.35 + 0.85 * v), o.q ?? 0.8, o.cap ?? 5500);
  if (o.breath) addInto(x, mulEnv(filt(noise(n, rnd), 'bp', Math.min(f * 3, 4000), 1.2), e), o.breath);
  return mulEnv(x, e);
}
function windy(f, dur, v, rnd, o) { // flauta, ocarina, shakuhachi
  const gate = ms(dur), n = gate + ms(o.r * 3 + 0.05);
  const e = adsr(n, gate, o.a, o.d ?? 0.12, o.s ?? 0.85, o.r);
  const x = new Float32Array(n);
  const vr = (o.vibRate ?? 5) * (0.9 + 0.2 * rnd());
  let ph = rnd(), vph = rnd();
  const H = o.harm;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const vd = Math.min(1, Math.max(0, (t - (o.vibDelay ?? 0.25)) / 0.35));
    vph += vr / SR;
    let m = 1 + (o.vib ?? 0.004) * vd * Math.sin(TAU * vph);
    if (o.bend) m *= Math.pow(2, (o.bend * Math.exp(-t / (o.bendT ?? 0.07))) / 1200);
    ph += f * m / SR;
    let s = 0;
    for (let h = 0; h < H.length; h++) if (f * (h + 1) < SR * 0.45) s += H[h] * Math.sin(TAU * ph * (h + 1));
    x[i] = s;
  }
  // sopro contínuo + "chiff" no ataque
  const br = filt(noise(n, rnd), 'bp', Math.min(f * 2.2, 6000), 0.9);
  const ch = filt(noise(ms(0.06), rnd), 'bp', Math.min(f * 3, 7000), 1.5);
  for (let i = 0; i < n; i++) x[i] += br[i] * o.breath * (0.6 + 0.4 * e[i]);
  for (let i = 0; i < ch.length; i++) x[i] += ch[i] * (o.chiff ?? 0.15) * Math.exp(-i / ms(0.012)) * v;
  filt(x, 'lp', o.lp ?? 6000, 0.6);
  return mulEnv(x, e);
}
function pad(f, dur, v, rnd, o) {
  const gate = ms(dur), n = gate + ms(o.r * 3);
  const e = adsr(n, gate, o.a, o.d, o.s, o.r);
  const x = osc(n, f, rnd, { saw: 1, detune: o.detune, vib: o.vib ?? 0, vibRate: o.vibRate ?? 4.8, vibDelay: 0.15 });
  if (o.sub) addInto(x, osc(n, f, rnd, { sin: 1 }), o.sub);
  const fc = Math.min(o.cap ?? 4000, o.lp + f * (o.key ?? 1.5));
  filt(x, 'lp', fc, o.q ?? 0.6); filt(x, 'lp', fc * 1.4, 0.6);
  if (o.bow) addInto(x, mulEnv(filt(noise(n, rnd), 'bp', Math.min(f * 4, 5000), 1), e), o.bow);
  return mulEnv(x, e);
}

const INSTR = {
  trumpet: (f, d, v, r) => brass(f, d, v, r, { a: 0.028, d: 0.18, s: 0.78, r: 0.09, fb: 1.4, fa: 7, saw: 1, sq: 0.15, breath: 0.035, cap: 6500, vib: 0.0035 }),
  trombone: (f, d, v, r) => brass(f, d, v, r, { a: 0.04, d: 0.2, s: 0.8, r: 0.14, fb: 1.2, fa: 5, saw: 1, breath: 0.02, cap: 4200, scoop: -35 }),
  horn: (f, d, v, r) => brass(f, d, v, r, { a: 0.06, d: 0.25, s: 0.85, r: 0.18, fb: 1.0, fa: 2.6, saw: 0.7, tri: 0.6, cap: 2600, scoop: -15, vib: 0.002 }),
  'brass-section': (f, d, v, r) => brass(f, d, v, r, { a: 0.03, d: 0.2, s: 0.75, r: 0.12, fb: 1.5, fa: 8, saw: 1, detune: [-7, 0, 6], cap: 7000, scoop: -20, vib: 0.002 }),
  tuba: (f, d, v, r) => {
    const x = brass(f, d, v, r, { a: 0.03, d: 0.15, s: 0.7, r: 0.09, fb: 2.2, fa: 6, saw: 0.8, sq: 0.3, cap: 2600, scoop: -15, vib: 0.0015 });
    const gate = ms(d); return addInto(x, mulEnv(osc(x.length, f, r, { sin: 1 }), adsr(x.length, gate, 0.03, 0.15, 0.7, 0.09)), 0.12);
  },
  flute: (f, d, v, r) => windy(f, d, v, r, { a: 0.045, r: 0.11, harm: [1, 0.35, 0.16, 0.08, 0.04, 0.02], breath: 0.07, chiff: 0.2, vib: 0.0045, lp: 9000 }),
  ocarina: (f, d, v, r) => windy(f, d, v, r, { a: 0.03, r: 0.09, harm: [1, 0.06, 0.1, 0.01], breath: 0.025, chiff: 0.1, vib: 0.005, vibRate: 5.6, lp: 4000 }),
  shakuhachi: (f, d, v, r) => windy(f, d, v, r, { a: 0.09, r: 0.25, harm: [1, 0.3, 0.12, 0.05, 0.02], breath: 0.2, chiff: 0.3, vib: 0.007, vibRate: 4.2, vibDelay: 0.35, bend: -60, bendT: 0.09, lp: 7000 }),
  marimba: (f, d, v, r) => {
    const t1 = Math.max(0.35, Math.min(1.6, 1.4 * Math.pow(261.6 / f, 0.6)));
    const x = modal(f, [[1, 1, t1], [3.93, 0.3 * (0.4 + v), t1 * 0.3], [9.9, 0.09 * v, 0.08]], r);
    const ck = filt(noise(ms(0.006), r), 'bp', 2500, 1); for (let i = 0; i < ck.length; i++) x[i] += ck[i] * 0.12 * v * (1 - i / ck.length);
    const damp = ms(d + 0.35); for (let i = damp; i < x.length; i++) x[i] *= Math.exp(-(i - damp) / ms(0.08));
    return x;
  },
  celesta: (f, d, v, r) => modal(f, [[1, 1, 1.6], [2, 0.28, 0.6], [3.01, 0.1, 0.25], [4.18, 0.07 * v, 0.1]], r, { pitchDrop: 0.002 }),
  kalimba: (f, d, v, r) => {
    const x = modal(f, [[1, 1, 1.7], [5.43, 0.35 * v, 0.16], [8.92, 0.12 * v, 0.06]], r, { pitchDrop: 0.008, dropT: 0.025 });
    const ck = filt(noise(ms(0.003), r), 'hp', 3000); for (let i = 0; i < ck.length; i++) x[i] += ck[i] * 0.15 * v;
    return x;
  },
  timpani: (f, d, v, r) => {
    const x = modal(f, [[1, 1, 1.6], [1.5, 0.45, 1.0], [1.98, 0.3, 0.7], [2.44, 0.15, 0.4], [2.9, 0.08, 0.25]], r, { pitchDrop: 0.02, dropT: 0.05 });
    const nz = filt(noise(ms(0.08), r), 'lp', 900); for (let i = 0; i < nz.length; i++) x[i] += nz[i] * 0.5 * v * Math.exp(-i / ms(0.015));
    return x;
  },
  'nylon-guitar': (f, d, v, r) => {
    const gate = ms(d), n = gate + ms(0.25);
    const x = pluck(f, n, gate, r, { t60: Math.min(3.5, 2.2 * Math.pow(196 / f, 0.4)), damp: 0.12, bright: 0.2 + 0.4 * v, pos: 0.16, S: 0.42 });
    return filt(x, 'lp', 3200, 0.6);
  },
  pizzicato: (f, d, v, r) => {
    const n = ms(0.9);
    const x = pluck(f, n, n, r, { t60: Math.min(0.9, 0.55 * Math.pow(220 / f, 0.3)), bright: 0.35 + 0.3 * v, pos: 0.3, S: 0.45 });
    return filt(x, 'lp', 5000, 0.6);
  },
  sitar: (f, d, v, r) => { // usado como berimbau: corda metálica com cabaça (wah) e zumbido
    const gate = ms(d), n = gate + ms(0.35);
    const x = pluck(f, n, gate + ms(0.2), r, { t60: 1.2, damp: 0.25, bright: 0.85, pos: 0.12, S: 0.2 });
    const bp = new SVF();
    for (let i = 0; i < n; i++) {
      if ((i & 15) === 0) bp.set(f * (2.2 + 2.6 * (1 - Math.exp(-i / ms(0.12)))), 2.2);
      const y = Math.tanh(x[i] * 1.8);
      bp.tick(y);
      x[i] = 0.8 * y + 0.6 * bp.bp;
    }
    return filt(x, 'lp', 7500, 0.6);
  },
  'finger-bass': (f, d, v, r) => {
    const gate = ms(d), n = gate + ms(0.15);
    const e = adsr(n, gate, 0.004, 0.35, 0.55, 0.05);
    const fe = adsr(n, gate, 0.002, 0.12, 0.25, 0.05);
    const x = osc(n, f, r, { saw: 1, sin: 0.35 });
    envFilter(x, fe, 250 + 2.2 * f, 1300 * (0.4 + 0.6 * v), 0.9, 3000);
    return mulEnv(x, e);
  },
  'warm-pad': (f, d, v, r) => pad(f, d, v, r, { a: 0.35, d: 0.6, s: 0.85, r: 0.7, detune: [-9, -3, 4, 10], lp: 500, key: 1.2, cap: 2200, sub: 0.25 }),
  'slow-strings': (f, d, v, r) => pad(f, d, v, r, { a: 0.4, d: 0.5, s: 0.9, r: 0.6, detune: [-12, -5, 3, 9], vib: 0.003, lp: 1100, key: 3, cap: 6500, q: 0.75, bow: 0.03 }),
  contrabass: (f, d, v, r) => pad(f, d, v, r, { a: 0.12, d: 0.3, s: 0.85, r: 0.3, detune: [-4, 4], vib: 0.002, lp: 250, key: 3, cap: 1400, q: 0.8, sub: 0.3, bow: 0.01 }),
};
// aliases
INSTR.berimbau = INSTR.sitar;
INSTR.glockenspiel = INSTR.celesta;
INSTR.strings = INSTR['slow-strings'];

// nível de saída de cada instrumento (calibrado contra render/mata.wav original)
const LEVEL = {
  trumpet: 0, trombone: 0, horn: 0, 'brass-section': 1, tuba: -2, flute: 0, ocarina: 1, shakuhachi: -1.5,
  marimba: -1, celesta: -2, kalimba: 2, timpani: 0, 'nylon-guitar': 0, pizzicato: 0, sitar: 3, berimbau: 3,
  'finger-bass': -1.5, 'warm-pad': 8.5, 'slow-strings': -2, contrabass: 0, drums: 0,
};

// ------------------------------------------------------------------ percussão (mapa GM)
const DRUM_NAMES = {
  kick: 36, 'kick-2': 35, snare: 38, 'snare-2': 40, 'snare-rim': 37, rim: 37, sidestick: 37, clap: 39,
  hat: 42, 'hat-closed': 42, 'hat-pedal': 44, 'hat-open': 46, crash: 49, 'crash-2': 57, ride: 51, 'ride-bell': 53,
  tambourine: 54, cowbell: 56, 'bongo-hi': 60, 'bongo-lo': 61, 'conga-mute': 62, 'conga-hi': 63, conga: 63, 'conga-lo': 64,
  'timbale-hi': 65, 'timbale-lo': 66, 'agogo-hi': 67, agogo: 67, 'agogo-lo': 68, cabasa: 69, maracas: 70, shaker: 82,
  'guiro-short': 73, guiro: 74, claves: 75, 'woodblock-hi': 76, woodblock: 76, 'woodblock-lo': 77, 'cuica-mute': 78, cuica: 79,
  'triangle-mute': 80, triangle: 81,
  'tom-floor-lo': 41, 'tom-floor-hi': 43, 'tom-lo': 45, 'tom-mid-lo': 47, 'tom-mid-hi': 48, 'tom-hi': 50, surdo: 41,
};
function metal(n, freqs, rnd, t60) { // cimbal/triângulo: quadradas inarmônicas
  const x = new Float32Array(n);
  for (const fr of freqs) {
    let ph = rnd();
    for (let i = 0; i < n; i++) { ph += fr / SR; if (ph >= 1) ph -= 1; x[i] += ph < 0.5 ? 1 : -1; }
  }
  for (let i = 0; i < n; i++) x[i] *= Math.exp(-6.9 * i / (t60 * SR)) / freqs.length;
  return x;
}
function decayNoise(n, rnd, type, fc, q, t60, att = 0.001) {
  const x = filt(noise(n, rnd), type, fc, q);
  const A = Math.max(1, ms(att));
  for (let i = 0; i < n; i++) x[i] *= Math.min(1, i / A) * Math.exp(-6.9 * i / (t60 * SR));
  return x;
}
function tom(f, rnd, t60 = 0.45, drop = 0.6) {
  const n = ms(t60 * 1.1);
  const x = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR; ph += f * (1 + drop * Math.exp(-t / 0.03)) / SR;
    const s = Math.sin(TAU * ph);
    x[i] = (s + 0.35 * Math.sin(TAU * ph * 1.59) * Math.exp(-t / 0.08) + 0.25 * Math.tanh(3 * s)) * Math.exp(-6.9 * t / t60);
  }
  addInto(x, decayNoise(ms(0.06), rnd, 'bp', f * 3, 0.7, 0.05), 0.35);
  return x;
}
function drum(key, dur, v, rnd) {
  const k = typeof key === 'number' ? key : DRUM_NAMES[key];
  switch (k) {
    case 35: case 36: {
      const n = ms(0.45), x = new Float32Array(n); let ph = 0;
      for (let i = 0; i < n; i++) { const t = i / SR; ph += (48 + 95 * Math.exp(-t / 0.035)) / SR; x[i] = Math.sin(TAU * ph) * Math.exp(-6.9 * t / 0.4); }
      return addInto(x, decayNoise(ms(0.01), rnd, 'bp', 3000, 0.7, 0.008), 0.3);
    }
    case 38: case 40: {
      const x = modal(190, [[1, 0.6, 0.12], [1.76, 0.35, 0.08]], rnd);
      return addInto(filt(decayNoise(ms(0.3), rnd, 'hp', 1400, 0.6, 0.2), 'lp', 6000, 0.6), x, 1.1).map((s) => s * 0.8);
    }
    case 37: return addInto(decayNoise(ms(0.06), rnd, 'bp', 1900, 2.5, 0.035), modal(820, [[1, 0.6, 0.03]], rnd), 1);
    case 39: { const x = decayNoise(ms(0.25), rnd, 'bp', 1200, 1.2, 0.18); for (const o of [0.011, 0.022]) addInto(x.subarray(ms(o)), decayNoise(ms(0.02), rnd, 'bp', 1200, 1.2, 0.015), 0.8); return x; }
    case 42: case 44: return decayNoise(ms(0.1), rnd, 'hp', 7000, 0.7, 0.05);
    case 46: return decayNoise(ms(0.6), rnd, 'hp', 6500, 0.7, 0.45);
    case 49: case 57: case 55: case 52: {
      const n = ms(dur > 0.6 ? 2.2 : 1.6);
      return addInto(decayNoise(n, rnd, 'hp', 3500, 0.6, n / SR * 0.9), filt(metal(n, [312, 449, 571, 806, 1045, 1233], rnd, n / SR * 0.8), 'hp', 3000), 0.5).map((s) => s * 0.6);
    }
    case 51: case 59: case 53: {
      const n = ms(1.4);
      return addInto(filt(metal(n, [421, 607, 783, 1013, 1341], rnd, 1.2), 'bp', 4200, 0.9), decayNoise(n, rnd, 'hp', 5000, 0.7, 0.5), 0.25);
    }
    case 54: return decayNoise(ms(0.25), rnd, 'bp', 7500, 1.0, 0.15, 0.004);
    case 56: return filt(addInto(metal(ms(0.3), [560, 845], rnd, 0.22), modal(560, [[1, 0.3, 0.1]], rnd), 1), 'bp', 900, 1.2);
    case 60: return tom(400, rnd, 0.18, 0.15);
    case 61: return tom(300, rnd, 0.22, 0.15);
    case 62: return tom(330, rnd, 0.07, 0.1);
    case 63: return tom(330, rnd, 0.28, 0.08);
    case 64: return tom(220, rnd, 0.32, 0.08);
    case 65: return addInto(tom(520, rnd, 0.35, 0.05), metal(ms(0.35), [1040, 1560], rnd, 0.2), 0.15);
    case 66: return addInto(tom(390, rnd, 0.4, 0.05), metal(ms(0.4), [780, 1170], rnd, 0.22), 0.15);
    case 67: return modal(890, [[1, 1, 0.3], [2.71, 0.35, 0.12], [4.13, 0.15, 0.06]], rnd);
    case 68: return modal(660, [[1, 1, 0.33], [2.71, 0.35, 0.13], [4.13, 0.15, 0.06]], rnd);
    case 69: return decayNoise(ms(0.12), rnd, 'hp', 5000, 0.8, 0.07, 0.006);
    case 70: return decayNoise(ms(0.1), rnd, 'hp', 4500, 0.8, 0.05, 0.004);
    case 82: return decayNoise(ms(0.12), rnd, 'bp', 6000, 0.8, 0.06, 0.012);
    case 73: case 74: {
      const n = ms(k === 74 ? 0.3 : 0.1), x = new Float32Array(n);
      for (let t = 0; t < n; t += ms(0.011)) addInto(x.subarray(t), decayNoise(ms(0.008), rnd, 'bp', 3500, 2, 0.006), 1);
      return x;
    }
    case 75: return modal(2500, [[1, 1, 0.05]], rnd);
    case 76: return addInto(modal(1900, [[1, 1, 0.06], [2.3, 0.3, 0.03]], rnd), decayNoise(ms(0.01), rnd, 'bp', 2000, 1, 0.008), 0.3);
    case 77: return addInto(modal(1350, [[1, 1, 0.07], [2.3, 0.3, 0.03]], rnd), decayNoise(ms(0.01), rnd, 'bp', 1500, 1, 0.008), 0.3);
    case 78: case 79: { // cuíca: gemido com glissando
      const n = ms(0.3), x = new Float32Array(n); let ph = 0; const f0 = k === 79 ? 520 : 380;
      for (let i = 0; i < n; i++) { const t = i / SR; ph += f0 * (1 + 0.5 * Math.sin(Math.PI * Math.min(1, t / 0.25))) / SR; x[i] = Math.sin(TAU * ph) * Math.sin(Math.PI * Math.min(1, t / 0.28)); }
      return x;
    }
    case 80: return metal(ms(0.15), [1880, 3520, 5160], rnd, 0.1).map((s) => s * 0.5);
    case 81: return metal(ms(0.9), [1880, 3520, 5160, 6870, 8240], rnd, dur > 0.3 ? 1.5 : 0.55).map((s) => s * 0.5);
    case 41: return tom(84, rnd, 0.45, 0.35);
    case 43: return tom(100, rnd, 0.42, 0.35);
    case 45: return tom(105, rnd, 0.42, 0.45);
    case 47: return tom(122, rnd, 0.4, 0.45);
    case 48: return tom(140, rnd, 0.36, 0.4);
    case 50: return tom(165, rnd, 0.33, 0.4);
    default: throw new Error(`percussão desconhecida: ${key}`);
  }
}
// nível relativo das peças de percussão (dB)
const DRUM_LEVEL = { 36: -12, 35: -12, 38: -6, 40: -6, 37: -1, 42: -10, 44: -10, 46: -12, 49: -9, 57: -9, 51: -14, 53: -12, 54: -12, 56: -8,
  67: -6, 68: -6, 70: -3, 82: 0, 69: -5, 81: -5, 80: -12, 75: -8, 76: -8, 77: -8, 41: -4.5, 43: -4.5, 63: -3, 64: -3, 62: -4 };

// ------------------------------------------------------------------ efeitos
function freeverb(inL, inR, { room = 0.72, damp = 0.4 } = {}) {
  const sc = SR / 44100, spread = Math.round(23 * sc);
  const combT = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((x) => Math.round(x * sc));
  const apT = [556, 441, 341, 225].map((x) => Math.round(x * sc));
  const fb = room * 0.28 + 0.7, d1 = damp * 0.4, d2 = 1 - d1;
  const n = inL.length, outL = new Float32Array(n), outR = new Float32Array(n);
  const mk = (T) => T.map((t) => ({ b: new Float32Array(t), i: 0, s: 0 }));
  for (const [out, off] of [[outL, 0], [outR, spread]]) {
    const combs = mk(combT.map((t) => t + off)), aps = mk(apT.map((t) => t + off));
    for (let i = 0; i < n; i++) {
      const x = (inL[i] + inR[i]) * 0.015;
      let y = 0;
      for (const c of combs) { const o = c.b[c.i]; c.s = o * d2 + c.s * d1; c.b[c.i] = x + c.s * fb; if (++c.i >= c.b.length) c.i = 0; y += o; }
      for (const a of aps) { const bo = a.b[a.i]; a.b[a.i] = y + bo * 0.5; if (++a.i >= a.b.length) a.i = 0; y = bo - y; }
      out[i] = y * 3;
    }
  }
  return [outL, outR];
}
function chorus(L, R, amt) {
  const n = L.length, base = ms(0.018), depth = ms(0.004), size = base + depth + 4;
  const bl = new Float32Array(size), br = new Float32Array(size);
  let w = 0;
  for (let i = 0; i < n; i++) {
    bl[w] = L[i]; br[w] = R[i];
    const t = i / SR;
    const dl = base + depth * Math.sin(TAU * 0.8 * t), dr = base + depth * Math.sin(TAU * 0.8 * t + Math.PI / 2);
    const rd = (buf, d) => { let p = w - d; while (p < 0) p += size; const i0 = Math.floor(p), fr = p - i0; return buf[i0] * (1 - fr) + buf[(i0 + 1) % size] * fr; };
    L[i] += amt * rd(bl, dl); R[i] += amt * rd(br, dr);
    if (++w >= size) w = 0;
  }
}
// loudness integrada (ITU-R BS.1770-4)
function lufs(L, R) {
  const kw = (x) => {
    const y = new Float64Array(x.length);
    const st = [[1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585],
      [1, -2, 1, -1.99004745483398, 0.99007225036621]];
    let src = x;
    for (const [b0, b1, b2, a1, a2] of st) {
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
      for (let i = 0; i < src.length; i++) { const v = src[i]; const o = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = v; y2 = y1; y1 = o; y[i] = o; }
      src = y.slice();
    }
    return src;
  };
  const kl = kw(L), kr = kw(R);
  const blk = ms(0.4), hop = ms(0.1), powers = [];
  for (let s = 0; s + blk <= kl.length; s += hop) {
    let z = 0;
    for (let i = s; i < s + blk; i++) z += kl[i] * kl[i] + kr[i] * kr[i];
    powers.push(z / blk);
  }
  const ld = (p) => -0.691 + 10 * Math.log10(p);
  let g = powers.filter((p) => ld(p) > -70);
  const rel = ld(g.reduce((a, b) => a + b, 0) / g.length) - 10;
  g = g.filter((p) => ld(p) > rel);
  return ld(g.reduce((a, b) => a + b, 0) / g.length);
}
// limitador com antecipação de 5 ms (offline)
function limit(L, R, ceilDb) {
  const c = dbToGain(ceilDb), n = L.length, la = ms(0.005);
  const req = new Float32Array(n);
  for (let i = 0; i < n; i++) { const p = Math.max(Math.abs(L[i]), Math.abs(R[i])); req[i] = p > c ? c / p : 1; }
  // mínimo deslizante da janela futura [i, i+la] (deque monotônica)
  const tgt = new Float32Array(n), dq = new Int32Array(n);
  let h = 0, t = 0;
  for (let j = 0; j < n + la; j++) {
    if (j < n) { while (t > h && req[dq[t - 1]] >= req[j]) t--; dq[t++] = j; }
    const i = j - la;
    if (i < 0) continue;
    while (dq[h] < i) h++;
    tgt[i] = req[dq[h]];
  }
  const att = 1 - Math.exp(-5 / la), rel = 1 - Math.exp(-1 / ms(0.12));
  let g = 1;
  for (let i = 0; i < n; i++) {
    const tg = tgt[i];
    g += (tg - g) * (tg < g ? att : rel);
    let l = L[i] * g, r = R[i] * g;
    L[i] = Math.max(-c, Math.min(c, l)); R[i] = Math.max(-c, Math.min(c, r));
  }
}
function writeWav(file, L, R) {
  const n = L.length, buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  const rnd = rng32(12345);
  for (let i = 0; i < n; i++) {
    for (const [ch, x] of [[0, L[i]], [1, R[i]]]) {
      const d = (rnd() - rnd()) / 32768; // TPDF
      buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round((x + d) * 32767))), 44 + i * 4 + ch * 2);
    }
  }
  fs.writeFileSync(file, buf);
}

// ------------------------------------------------------------------ render
function renderScore(score, opts) {
  let end = 0;
  for (const tr of score.tracks) for (const nt of tr.notes) end = Math.max(end, nt[0] + nt[1]);
  const N = ms(end + 3);
  const mixL = new Float32Array(N), mixR = new Float32Array(N), revL = new Float32Array(N), revR = new Float32Array(N);
  const stats = [];
  for (const tr of score.tracks) {
    if (opts.solo && !opts.solo.includes(tr.name)) continue;
    const isDrum = !!tr.drums;
    const inst = isDrum ? 'drums' : tr.instrument;
    const fn = isDrum ? null : INSTR[inst];
    if (!isDrum && !fn) throw new Error(`instrumento desconhecido: ${inst} (trilha ${tr.name})`);
    const tL = new Float32Array(N), tR = new Float32Array(N);
    const hum = tr.humanize || { timingMs: 0, velocity: 0 };
    const gain = dbToGain((tr.gainDb ?? 0) + (LEVEL[inst] ?? 0) + (opts.trim?.[inst] ?? 0));
    const pan = Math.max(-1, Math.min(1, tr.pan ?? 0));
    const pl = Math.cos((pan + 1) * Math.PI / 4) * Math.SQRT2, pr = Math.sin((pan + 1) * Math.PI / 4) * Math.SQRT2;
    for (const nt of tr.notes) {
      const [t0, dur, pitch, vel] = nt;
      // sorteio determinístico pela posição da nota: ciclos idênticos recebem a mesma humanização
      const tc = opts.period ? ((t0 % opts.period) + opts.period) % opts.period : t0;
      const rnd = rng32(hash(`${tr.name}|${Math.round(tc * 1000)}|${JSON.stringify(pitch)}`));
      const dt = rnd() * (hum.timingMs || 0) / 1000;
      const vv = Math.max(1, Math.min(127, vel + (rnd() * 2 - 1) * (hum.velocity || 0)));
      const amp = Math.pow(vv / 127, opts.velExp ?? 1.7);
      const pitches = Array.isArray(pitch) ? pitch : [pitch];
      pitches.forEach((p, k) => {
        let y;
        let off = dt;
        if (isDrum) {
          const dk = typeof p === 'number' ? p : DRUM_NAMES[p];
          y = drum(p, dur, vv / 127, rnd);
          const g = amp * dbToGain(DRUM_LEVEL[dk] ?? -6);
          for (let i = 0; i < y.length; i++) y[i] *= g;
        } else {
          if (inst === 'nylon-guitar' && pitches.length > 1) off += k * 0.009; // rasgueado
          y = fn(mtof(p), Math.max(0.02, dur), vv / 127, rnd);
          for (let i = 0; i < y.length; i++) y[i] *= amp * 0.3;
        }
        const s = ms(t0 + off);
        const m = Math.min(y.length, N - s);
        for (let i = 0; i < m; i++) { tL[s + i] += y[i] * pl * gain; tR[s + i] += y[i] * pr * gain; }
      });
    }
    if (tr.chorus) chorus(tL, tR, tr.chorus);
    let e = 0;
    const send = tr.reverb ?? 0, pre = ms(0.018);
    // envio do reverb com passa-alta (evita lama nos graves)
    const hpL = new SVF(), hpR = new SVF(); hpL.set(220, 0.7); hpR.set(220, 0.7);
    for (let i = 0; i < N; i++) {
      mixL[i] += tL[i]; mixR[i] += tR[i]; e += tL[i] * tL[i] + tR[i] * tR[i];
      if (send) { hpL.tick(tL[i]); hpR.tick(tR[i]); if (i + pre < N) { revL[i + pre] += hpL.hp * send; revR[i + pre] += hpR.hp * send; } }
    }
    stats.push([tr.name, inst, (10 * Math.log10(e / N / 2 + 1e-20)).toFixed(1)]);
  }
  const [wl, wr] = freeverb(revL, revR, { room: 0.72, damp: 0.45 });
  const RW = opts.revGain ?? 0.5;
  for (let i = 0; i < N; i++) { mixL[i] += wl[i] * RW; mixR[i] += wr[i] * RW; }
  // tom geral: leve escurecimento dos agudos, como a trilha atual
  if (opts.tilt) { const a = new SVF(), b = new SVF(); a.set(opts.tilt ?? 9000, 0.6); b.set(opts.tilt ?? 9000, 0.6); for (let i = 0; i < N; i++) { mixL[i] = a.tick(mixL[i]); mixR[i] = b.tick(mixR[i]); } }
  // normaliza loudness e limita o pico
  const raw = lufs(mixL, mixR);
  if (opts.raw) { const g0 = dbToGain(-6); return { L: mixL.map((x) => x * g0), R: mixR.map((x) => x * g0), stats, raw, got: raw - 6 }; }
  let g = dbToGain(opts.lufs - raw);
  for (let it = 0; it < 3; it++) {
    const L = mixL.map((x) => x * g), R = mixR.map((x) => x * g);
    limit(L, R, opts.peak);
    const got = lufs(L, R);
    if (Math.abs(got - opts.lufs) < 0.1 || it === 2) return { L, R, stats, raw, got };
    g *= dbToGain(opts.lufs - got);
  }
}

function main() {
  const args = process.argv.slice(2);
  const opts = { lufs: -14, peak: -1.5 };
  const names = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--out') opts.out = args[++i];
    else if (a === '--lufs') opts.lufs = +args[++i];
    else if (a === '--peak') opts.peak = +args[++i];
    else if (a === '--solo') opts.solo = args[++i].split(',');
    else if (a === '--force') opts.force = true;
    else if (a === '--stats') opts.stats = true;
    else if (a === '--trim') opts.trim = JSON.parse(args[++i]);
    else if (a === '--rev') opts.revGain = +args[++i];
    else if (a === '--tilt') opts.tilt = +args[++i];
    else if (a === '--raw') opts.raw = true;
    else if (a === '--velexp') opts.velExp = +args[++i];
    else names.push(a);
  }
  if (!names.length) { console.error('uso: node render.mjs <faixa> [...] [--out arquivo.wav]'); process.exit(1); }
  if (opts.out && names.length > 1) throw new Error('--out só com uma faixa');
  for (const name of names) {
    const out = opts.out || path.join(HERE, 'render', name + '.wav');
    if (!opts.out && PROTECTED.has(name) && !opts.force) {
      console.error(`recusado: render/${name}.wav é da trilha atual (use --out para outro arquivo)`); process.exit(2);
    }
    const score = JSON.parse(fs.readFileSync(path.join(HERE, 'scores', name + '.json'), 'utf8'));
    try { opts.period = JSON.parse(fs.readFileSync(path.join(HERE, 'scores', 'loops.json'), 'utf8'))[name]; } catch { opts.period = 0; }
    const t0 = Date.now();
    const { L, R, stats, raw, got } = renderScore(score, opts);
    writeWav(out, L, R);
    console.log(`${name}: ${(L.length / SR).toFixed(1)} s, ${raw.toFixed(1)} → ${got.toFixed(1)} LUFS, ${((Date.now() - t0) / 1000).toFixed(1)} s de render → ${path.relative(process.cwd(), out)}`);
    if (opts.stats) for (const s of stats) console.log('   ', s.join('  '));
  }
}
main();
