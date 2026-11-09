// ============================================================ telas, interface e laço principal
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = W; canvas.height = H;
ctx.imageSmoothingEnabled = false;

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');

const App = {
  state: 'title',     // title | options | intro | play | pause | win | lose | credits
  prevState: null,
  game: null,
  seed: Number(params.get('seed')) || DEFAULT_SEED,
  record: store.get('mataAdentro.recorde', null),
  menu: 0, t: 0, stateT: 0,
  iris: null,         // { t, dur, dir: 'out'|'in', then }
  toast: null,
  titleCam: 0,
  mouse: { x: -1, y: -1, click: false },
  buttons: [],
  newRecord: false,
};

function setState(s) { App.prevState = App.state; App.state = s; App.stateT = 0; App.menu = 0; Input.swallow(); }
function irisTo(fn, dur = 0.45) {
  if (App.iris) return;
  Snd.sfx('iris');
  App.iris = { t: 0, dur, dir: 'out', then: fn };
}
function showToast(text, time = 2.5) { App.toast = { text, until: App.t + time }; }

// ---------------------------------------------------------- música por estado
function updateMusic() {
  if (!Snd.started) return;
  const s = App.state, g = App.game;
  if (s === 'title' || s === 'options' || s === 'credits') { Snd.setMusic('mus_tema'); Snd.setAmbient(s === 'credits' ? null : 'amb_mata'); }
  else if (s === 'intro') { Snd.setMusic('mus_tema'); Snd.setAmbient('amb_mata'); }
  else if ((s === 'play' || s === 'pause') && g && !g.over) {
    const under = g.levelId !== 'surface';
    Snd.setMusic(under ? 'mus_sub' : 'mus_mata', { rate: g.hurry ? 1.16 : 1 });
    Snd.setAmbient(under ? 'amb_sub' : 'amb_mata');
  }
}

// ---------------------------------------------------------- início da partida
function startAudio() { return Snd.unlock().then(() => updateMusic()); }
// começa o jogo só depois do áudio decodificado, para a abertura narrada não sair muda
function whenAudioReady(fn) {
  startAudio();
  if (Snd.ready) { fn(); return; }
  showToast('CARREGANDO SOM...', 10);
  Snd.loading.then(() => { App.toast = null; fn(); });
}
function startGame() {
  App.game = new Game(App.seed);
  App.game.god = DEBUG && App.god;
  App.newRecord = false;
  setState('intro');
  Snd.stopVoice();
  Snd.voice('abertura');
  updateMusic();
}
function beginPlay() {
  setState('play');
  updateMusic();
}
function finishGame(kind) {
  const g = App.game;
  if (!App.record || g.score > App.record.score) {
    App.record = { score: g.score, seed: g.seed };
    store.set('mataAdentro.recorde', App.record);
    App.newRecord = true;
  }
  if (kind === 'win') {
    Snd.setAmbient(null);
    Snd.setMusic('mus_vitoria', { loop: false, fade: 0.3 });
    Snd.stopVoice();
    setTimeout(() => Snd.voice('vitoria'), 900);
  } else {
    Snd.setAmbient(null);
    Snd.setMusic('mus_derrota', { loop: false, fade: 0.3 });
    Snd.stopVoice();
    setTimeout(() => Snd.voice('fimdejogo'), 1200);
  }
}

// ---------------------------------------------------------- menus
function menuNav(items, onPick, { horizontal = null } = {}) {
  if (Input.pressed('down')) { App.menu = (App.menu + 1) % items.length; Snd.sfx('menu'); }
  if (Input.pressed('up')) { App.menu = (App.menu + items.length - 1) % items.length; Snd.sfx('menu'); }
  if (horizontal) {
    if (Input.pressed('left')) horizontal(App.menu, -1);
    if (Input.pressed('right')) horizontal(App.menu, 1);
  }
  if (Input.pressed('confirm')) { Snd.sfx('ok'); onPick(App.menu); }
}
function volumeItems() {
  const bar = v => '█'.repeat(0) + '■'.repeat(0) + Array.from({ length: 10 }, (_, i) => i < Math.round(v * 10) ? '#' : '·').join('');
  const v = Snd.vol;
  return [
    { label: 'MÚSICA  ← ' + bar(v.music) + ' →', key: 'music' },
    { label: 'EFEITOS ← ' + bar(v.sfx) + ' →', key: 'sfx' },
    { label: 'VOZ     ← ' + bar(v.voice) + ' →', key: 'voice' },
    { label: 'MUDO: ' + (v.muted ? 'SIM' : 'NÃO') + '  (M)', key: 'mute' },
  ];
}
function adjustVolume(item, d) {
  if (!item) return;
  if (item.key === 'mute') { Snd.toggleMute(); return; }
  Snd.setVol(item.key, Snd.vol[item.key] + d * 0.1);
  Snd.sfx('menu');
}

// ---------------------------------------------------------- atualização por estado (passo fixo)
function step(dt) {
  Input.poll();
  App.t += dt; App.stateT += dt;
  if (Input.pressed('mute')) { const m = Snd.toggleMute(); showToast(m ? 'SOM DESLIGADO' : 'SOM LIGADO'); }

  if (App.iris) {
    const ir = App.iris; ir.t += dt;
    if (ir.t >= ir.dur) {
      if (ir.dir === 'out') { ir.dir = 'in'; ir.t = 0; ir.then && ir.then(); }
      else App.iris = null;
    }
  }
  const s = App.state, g = App.game;
  App.titleCam += dt * 40;

  if (s === 'title') {
    const items = titleItems();
    menuNav(items, i => items[i].act());
    if (Input.pressed('jump') && !Input.pressed('confirm')) { /* nada */ }
  } else if (s === 'options') {
    const items = volumeItems().concat([{ label: 'VOLTAR', key: 'back' }]);
    menuNav(items, i => { if (items[i].key === 'back') setState('title'); else if (items[i].key === 'mute') Snd.toggleMute(); }, { horizontal: (i, d) => adjustVolume(items[i], d) });
    if (Input.pressed('back')) setState('title');
  } else if (s === 'intro') {
    App.titleCam += dt * 30;
    if ((App.stateT > 1.2 && (Input.pressed('confirm') || Input.pressed('jump'))) || App.stateT > 15) {
      Snd.stopVoice();
      irisTo(() => beginPlay());
    }
  } else if (s === 'play') {
    if (Input.pressed('pause')) { setState('pause'); return; }
    if (!App.iris || App.iris.dir === 'in') g.update(dt);
    if (DEBUG) debugKeys(g);
    while (g.events.length) {
      const ev = g.events.shift();
      if (ev === 'level') updateMusic();
      if (ev === 'respawn') irisTo(() => { g.respawn(); updateMusic(); });
    }
    if (g.hurry && !g._hurryMusic) { g._hurryMusic = true; updateMusic(); }
    if (g.over && !g._finished) {
      g._finished = true;
      finishGame(g.over);
      g.overT = 0;
    }
    if (g.over) {
      g.overT += dt;
      if (g.overT > (g.over === 'win' ? 3.2 : 1.0)) setState(g.over === 'win' ? 'win' : 'lose');
    }
  } else if (s === 'pause') {
    const items = [{ label: 'CONTINUAR', key: 'resume' }].concat(volumeItems(), [{ label: 'SAIR PARA O INÍCIO', key: 'quit' }]);
    menuNav(items, i => {
      const k = items[i].key;
      if (k === 'resume') setState('play');
      else if (k === 'quit') { Snd.stopAll(); irisTo(() => { setState('title'); App.game = null; updateMusic(); }); }
      else if (k === 'mute') Snd.toggleMute();
    }, { horizontal: (i, d) => adjustVolume(items[i], d) });
    if (Input.pressed('pause') && App.stateT > 0.1) setState('play');
  } else if (s === 'win' || s === 'lose') {
    g.update(dt);
    const items = s === 'win' ? [{ label: 'VER CRÉDITOS', act: () => irisTo(() => startCredits()) }, { label: 'JOGAR DE NOVO', act: () => irisTo(() => startGame()) }]
      : [{ label: 'JOGAR DE NOVO', act: () => irisTo(() => startGame()) }, { label: 'TELA INICIAL', act: () => irisTo(() => { setState('title'); App.game = null; Snd.stopVoice(); updateMusic(); }) }];
    App.endItems = items;
    if (App.stateT > 1.0) menuNav(items, i => items[i].act());
  } else if (s === 'credits') {
    if (App.stateT > 1 && (Input.pressed('confirm') || Input.pressed('back') || Input.pressed('jump'))) irisTo(() => { Snd.stopVoice(); setState('title'); App.game = null; updateMusic(); });
    if (App.stateT > 34) irisTo(() => { setState('title'); App.game = null; updateMusic(); });
  }
}
function titleItems() {
  return [
    { label: 'JOGAR', act: () => whenAudioReady(() => irisTo(() => startGame())) },
    { label: 'NOVA TRILHA', act: () => { App.seed = 1 + Math.floor(Math.random() * 999999); showToast('NOVA TRILHA: SEMENTE ' + App.seed); } },
    { label: 'OPÇÕES', act: () => setState('options') },
    { label: 'CRÉDITOS', act: () => whenAudioReady(() => irisTo(() => startCredits())) },
  ];
}
function startCredits() { setState('credits'); Snd.stopVoice(); updateMusic(); setTimeout(() => { if (App.state === 'credits') Snd.voice('creditos'); }, 900); }

function debugKeys(g) {
  // atalhos de teste (?debug): 1–9 e 0 pulam para a área, G imortal, H caixas
  for (let i = 0; i <= 9; i++) {
    if (Input.debugKey && Input.debugKey === 'Digit' + i) {
      const a = i === 0 ? 10 : i;
      g.levelId = 'surface'; g.p = g.newPlayer((a - 1) * AREA_W + 60, GROUND); g.cam = clamp(g.p.x - W * 0.42, 0, g.L.len - W);
    }
  }
  if (Input.debugKey === 'KeyG') { g.god = App.god = !g.god; showToast(g.god ? 'IMORTAL' : 'MORTAL'); }
  if (Input.debugKey === 'KeyH') g.debugBoxes = !g.debugBoxes;
  if (Input.debugKey === 'KeyU') { g.switchLevel(0, g.world.under[0].ladders[0], -4); }
  Input.debugKey = null;
}
if (DEBUG) Input.on((type, code) => { if (type === 'key') Input.debugKey = code; });

// ---------------------------------------------------------- desenho
function render(now) {
  const s = App.state, g = App.game;
  App.buttons = [];
  ctx.imageSmoothingEnabled = false;
  if (s === 'title' || s === 'options') drawTitle(now);
  else if (s === 'intro') drawIntro(now);
  else if (s === 'credits') drawCredits(now);
  else if (g) {
    g.draw(ctx, now);
    drawHUD(g, now);
    if (s === 'pause') drawPause(now);
    if (s === 'win') drawWin(g, now);
    if (s === 'lose') drawLose(g, now);
  }
  drawSubtitle();
  if (App.toast && App.t < App.toast.until) {
    const w = textWidth(App.toast.text, 2) + 24;
    ctx.fillStyle = 'rgba(13,20,16,0.85)'; ctx.fillRect(W / 2 - w / 2, 64, w, 28);
    drawText(ctx, App.toast.text, W / 2, 73, 2, PAL.gold2, 'center');
  }
  if (App.iris) drawIris();
}

function drawIris() {
  const ir = App.iris;
  const k = clamp(ir.t / ir.dur, 0, 1);
  const r = (ir.dir === 'out' ? 1 - smooth(k) : smooth(k)) * 620;
  let cx = W / 2, cy = H / 2;
  const g = App.game;
  if (g && (App.state === 'play' || App.state === 'win' || App.state === 'lose')) { cx = clamp(g.p.x - g.cam, 0, W); cy = clamp(g.p.y - 32, 0, H); }
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(cx, cy, Math.max(0.1, r), 0, Math.PI * 2, true); ctx.fill('evenodd');
}

function drawHUD(g, now) {
  ctx.fillStyle = 'rgba(10,16,12,0.62)'; ctx.fillRect(0, 0, W, 38);
  ctx.fillStyle = 'rgba(242,193,78,0.35)'; ctx.fillRect(0, 38, W, 2);
  drawText(ctx, 'PONTOS', 16, 8, 1, PAL.mist, 'left', null);
  drawText(ctx, fmtNum(g.score), 16, 18, 2, PAL.gold2);
  const low = g.time <= 60;
  const blink = g.time <= 10 && Math.floor(now / 250) % 2;
  drawText(ctx, 'TEMPO', W / 2, 8, 1, PAL.mist, 'center', null);
  drawText(ctx, fmtTime(g.time), W / 2, 18, 2, blink ? PAL.white : low ? '#ff6a4a' : PAL.white, 'center');
  for (let i = 0; i < 3; i++) {
    ctx.globalAlpha = i < g.lives ? 1 : 0.2;
    ctx.drawImage(Art.hatIcon, W - 270 + i * 34, 14);
  }
  ctx.globalAlpha = 1;
  const areaLabel = g.levelId === 'surface' ? 'ÁREA ' + g.area : 'SUBTERRÂNEO';
  drawText(ctx, areaLabel, W - 16, 14, 2, PAL.white, 'right');
  drawText(ctx, (g.levelId === 'surface' ? g.area : '·') + '/10', W - 16, 4, 1, PAL.mist, 'right', null);
  if (g.god) drawText(ctx, 'IMORTAL', 220, 18, 1, PAL.red);
}

function drawSubtitle() {
  const sub = Snd.currentSubtitle();
  if (!sub || App.state === 'title' || App.state === 'credits') return; // nos créditos o texto já rola na tela
  const lines = wrapText(sub.toUpperCase(), 760, 2);
  const h = lines.length * 20 + 16, y0 = H - h - 18;
  ctx.fillStyle = 'rgba(8,12,10,0.72)'; ctx.fillRect(W / 2 - 400, y0, 800, h);
  lines.forEach((l, i) => drawText(ctx, l, W / 2, y0 + 10 + i * 20, 2, '#f6ecc8', 'center'));
}

function button(label, x, y, sel, act, scale = 2) {
  const w = textWidth(label, scale) + 40, h = 12 * scale + 6;
  const rx = x - w / 2, ry = y - 6;
  App.buttons.push({ x: rx, y: ry, w, h, act, label });
  if (sel) {
    ctx.fillStyle = 'rgba(242,193,78,0.18)'; ctx.fillRect(rx, ry, w, h);
    ctx.fillStyle = PAL.gold; ctx.fillRect(rx, ry, 4, h); ctx.fillRect(rx + w - 4, ry, 4, h);
    drawText(ctx, '►', rx + 10, y, scale, PAL.gold2, 'left');
  }
  drawText(ctx, label, x, y, scale, sel ? PAL.gold2 : PAL.white, 'center');
}

function drawLogo(y, scale = 7) {
  const t = 'MATA ADENTRO';
  drawText(ctx, t, W / 2 + 4, y + 4, scale, '#1a0e04', 'center', null);
  drawText(ctx, t, W / 2, y, scale, PAL.goldD, 'center', null);
  ctx.save(); ctx.beginPath(); ctx.rect(0, y, W, scale * 4); ctx.clip();
  drawText(ctx, t, W / 2, y, scale, PAL.gold2, 'center', null);
  ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.rect(0, y + scale * 4, W, scale * 2); ctx.clip();
  drawText(ctx, t, W / 2, y, scale, PAL.gold, 'center', null);
  ctx.restore();
}

function drawTitleScene(now, cam) {
  drawSurfaceBack(ctx, cam, now);
  ctx.save(); ctx.translate(-Math.round(cam % AREA_W), 0);
  ctx.drawImage(Art.ground, 0, GROUND - Art.groundTop); ctx.drawImage(Art.ground, AREA_W, GROUND - Art.groundTop);
  ctx.restore();
  drawForeground(ctx, cam, now);
}

function drawTitle(now) {
  drawTitleScene(now, App.titleCam);
  // Zé correndo no lugar
  const f = Math.floor(now / 70) % 8;
  ctx.drawImage(Art.ze.run[f], 140 - ZE.OX, GROUND - ZE.OY);
  ctx.fillStyle = 'rgba(8,14,10,0.45)'; ctx.fillRect(0, 0, W, H);
  drawLogo(58, 7);
  drawText(ctx, 'UMA CORRIDA PELA MATA ATLÂNTICA ATRÁS DO ÍDOLO DE OURO', W / 2, 126, 2, PAL.fog, 'center');
  if (App.state === 'options') { drawOptionsPanel(); return; }
  const items = titleItems();
  items.forEach((it, i) => button(it.label, W / 2, 170 + i * 36, App.menu === i, () => { App.menu = i; it.act(); }, 3));
  // recorde e semente
  const rec = App.record ? fmtNum(App.record.score) + ' (TRILHA ' + App.record.seed + ')' : '—';
  drawText(ctx, 'RECORDE: ' + rec, W / 2, 330, 2, PAL.gold2, 'center');
  drawText(ctx, 'TRILHA ATUAL: SEMENTE ' + App.seed + (App.seed === DEFAULT_SEED ? ' (PADRÃO)' : ''), W / 2, 352, 2, PAL.fog, 'center');
  // controles
  ctx.fillStyle = 'rgba(8,14,10,0.72)'; ctx.fillRect(80, 384, 800, 132);
  ctx.fillStyle = PAL.goldD; ctx.fillRect(80, 384, 800, 2);
  drawText(ctx, 'CONTROLES', W / 2, 392, 2, PAL.gold, 'center');
  const rows = [
    ['← → OU A D', 'ANDAR', 'ANALÓGICO'],
    ['ESPAÇO W ↑', 'PULAR / SOLTAR CIPÓ', 'A · X'],
    ['↓ ↑ OU S W', 'DESCER / SUBIR ESCADA', 'DIRECIONAL'],
    ['ESC P · M', 'PAUSA · MUDO', 'START · SELECT'],
  ];
  rows.forEach((r, i) => {
    drawText(ctx, r[0], 100, 416 + i * 22, 2, PAL.white);
    drawText(ctx, r[1], 290, 416 + i * 22, 2, PAL.gold2);
    drawText(ctx, r[2], 860, 416 + i * 22, 2, PAL.mist, 'right');
  });
  if (!Snd.started) drawText(ctx, 'O SOM COMEÇA NO PRIMEIRO CLIQUE', W / 2, 526, 1, PAL.mist, 'center', null);
  else drawText(ctx, (Input.hasPad ? 'CONTROLE CONECTADO · ' : '') + 'ENTER OU CLIQUE PARA ESCOLHER', W / 2, 526, 1, PAL.mist, 'center', null);
}

function drawOptionsPanel() {
  ctx.fillStyle = 'rgba(8,14,10,0.78)'; ctx.fillRect(180, 160, 600, 300);
  drawText(ctx, 'OPÇÕES DE SOM', W / 2, 180, 3, PAL.gold, 'center');
  const items = volumeItems().concat([{ label: 'VOLTAR', key: 'back' }]);
  items.forEach((it, i) => button(it.label, W / 2, 232 + i * 40, App.menu === i, () => {
    App.menu = i;
    if (it.key === 'back') setState('title'); else if (it.key === 'mute') Snd.toggleMute(); else adjustVolume(it, App.mouse.x > W / 2 ? 1 : -1);
  }, 2));
  drawText(ctx, '← → AJUSTA · CLIQUE À ESQUERDA OU À DIREITA', W / 2, 440, 1, PAL.mist, 'center', null);
}

function drawPause(now) {
  ctx.fillStyle = 'rgba(6,10,8,0.7)'; ctx.fillRect(0, 0, W, H);
  drawText(ctx, 'PAUSA', W / 2, 120, 5, PAL.gold2, 'center');
  const items = [{ label: 'CONTINUAR', key: 'resume' }].concat(volumeItems(), [{ label: 'SAIR PARA O INÍCIO', key: 'quit' }]);
  items.forEach((it, i) => button(it.label, W / 2, 200 + i * 40, App.menu === i, () => {
    App.menu = i;
    if (it.key === 'resume') setState('play');
    else if (it.key === 'quit') { Snd.stopAll(); irisTo(() => { setState('title'); App.game = null; updateMusic(); }); }
    else if (it.key === 'mute') Snd.toggleMute(); else adjustVolume(it, App.mouse.x > W / 2 ? 1 : -1);
  }, 2));
  drawText(ctx, 'TRILHA ' + App.game.seed, W / 2, 470, 1, PAL.mist, 'center', null);
}

function panel(y, h) { ctx.fillStyle = 'rgba(6,10,8,0.78)'; ctx.fillRect(170, y, 620, h); ctx.fillStyle = PAL.goldD; ctx.fillRect(170, y, 620, 2); ctx.fillRect(170, y + h - 2, 620, 2); }

function drawWin(g, now) {
  const r = g.result, k = App.stateT;
  panel(70, 400);
  drawText(ctx, 'O ÍDOLO É SEU!', W / 2, 92, 4, PAL.gold2, 'center');
  const rows = [
    ['TESOUROS E PONTOS', fmtNum(r.base - r.idol)],
    ['ÍDOLO DE OURO', '+' + fmtNum(r.idol)],
    ['TEMPO RESTANTE ' + fmtTime(r.time) + ' × 20', '+' + fmtNum(r.bonusTime)],
    ['VIDAS RESTANTES ' + r.lives + ' × 1.000', '+' + fmtNum(r.bonusLives)],
  ];
  rows.forEach((row, i) => {
    if (k < 0.3 + i * 0.35) return;
    drawText(ctx, row[0], 210, 150 + i * 30, 2, PAL.white);
    drawText(ctx, row[1], 750, 150 + i * 30, 2, PAL.gold2, 'right');
  });
  if (k > 1.8) {
    ctx.fillStyle = PAL.goldD; ctx.fillRect(210, 278, 540, 2);
    drawText(ctx, 'TOTAL', 210, 292, 3, PAL.white);
    drawText(ctx, fmtNum(r.total), 750, 292, 3, PAL.gold2, 'right');
    if (App.newRecord && Math.floor(now / 300) % 2) drawText(ctx, '★ NOVO RECORDE ★', W / 2, 330, 2, PAL.turq, 'center');
    drawText(ctx, 'MOEDAS ' + g.collected.coin + ' · JOIAS ' + g.collected.jewel + ' · TRILHA ' + g.seed, W / 2, 352, 1, PAL.mist, 'center', null);
  }
  if (k > 1.0) (App.endItems || []).forEach((it, i) => button(it.label, W / 2, 384 + i * 36, App.menu === i, () => { App.menu = i; it.act(); }, 2));
}
function drawLose(g, now) {
  panel(110, 320);
  drawText(ctx, 'A MATA VENCEU', W / 2, 134, 4, '#ff7a5a', 'center');
  drawText(ctx, g.loseReason === 'tempo' ? 'O TEMPO ACABOU' : 'AS VIDAS ACABARAM', W / 2, 184, 2, PAL.fog, 'center');
  drawText(ctx, 'PONTOS: ' + fmtNum(g.score), W / 2, 222, 3, PAL.gold2, 'center');
  if (App.newRecord && g.score > 0) drawText(ctx, '★ NOVO RECORDE ★', W / 2, 262, 2, PAL.turq, 'center');
  drawText(ctx, 'ÁREA ALCANÇADA: ' + (g.levelId === 'surface' ? g.area : 'SUBTERRÂNEO') + ' · TRILHA ' + g.seed, W / 2, 288, 1, PAL.mist, 'center', null);
  if (App.stateT > 1.0) (App.endItems || []).forEach((it, i) => button(it.label, W / 2, 326 + i * 38, App.menu === i, () => { App.menu = i; it.act(); }, 2));
}

function drawIntro(now) {
  const k = App.stateT;
  drawTitleScene(now, 400 + App.titleCam * 1.5);
  const zx = clamp(-60 + (k - 9) * 120, -80, 300);
  if (k > 9) ctx.drawImage(Art.ze.run[Math.floor(now / 70) % 8], Math.round(zx - ZE.OX), GROUND - ZE.OY);
  ctx.fillStyle = `rgba(0,0,0,${clamp(1 - k / 2, 0, 1)})`; ctx.fillRect(0, 0, W, H);
  // barras de cinema
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, 44); ctx.fillRect(0, H - 44, W, 44);
  if (k > 11) { ctx.globalAlpha = clamp((k - 11) / 0.6, 0, 1); drawLogo(130, 7); ctx.globalAlpha = 1; }
  if (k > 1.2) drawText(ctx, 'ESPAÇO PARA PULAR A ABERTURA', W - 20, 18, 1, PAL.mist, 'right', null);
}

const CREDITS = [
  ['MATA ADENTRO', 'title'],
  ['UM EXPERIMENTO NEURAL HUB', 'sub'],
  ['', ''],
  ['IDEIA E DIREÇÃO', 'head'], ['ANDRÉ CARDIA', 'line'], ['', ''],
  ['CÓDIGO', 'head'], ['ESCRITO PELO CLAUDE (ANTHROPIC)', 'line'], ['JAVASCRIPT PURO E CANVAS 2D, UM ÚNICO ARQUIVO', 'small'], ['', ''],
  ['ARTE', 'head'], ['DESENHADA EM CÓDIGO PELO CLAUDE', 'line'], ['PIXEL ART SEM NENHUMA IMAGEM EXTERNA', 'small'], ['', ''],
  ['MÚSICA E EFEITOS', 'head'], ['COMPOSTOS PELO CLAUDE NOTA A NOTA', 'line'], ['PARTITURAS EM CÓDIGO, METAIS E PERCUSSÃO BRASILEIRA', 'small'], ['EFEITOS SINTETIZADOS AO VIVO PELA WEB AUDIO API', 'small'], ['', ''],
  ['NARRAÇÃO', 'head'], ['VOZ CLONADA DE ANDRÉ NO VOICESTUDIO', 'line'], ['10 FALAS GERADAS UMA ÚNICA VEZ E EMBUTIDAS NO JOGO', 'small'], ['', ''],
  ['HOMENAGEM', 'head'], ['AO GÊNERO DE PLATAFORMA NA SELVA DOS ANOS 80', 'small'], ['NOME, HERÓI, ARTE, TRILHA E VOZ TOTALMENTE ORIGINAIS', 'small'], ['', ''],
  ['OBRIGADO POR JOGAR!', 'sub'],
];
function drawCredits(now) {
  const k = App.stateT;
  drawTitleScene(now, App.titleCam * 0.5);
  ctx.fillStyle = 'rgba(6,10,8,0.78)'; ctx.fillRect(0, 0, W, H);
  let y = H + 20 - k * 34;
  for (const [txt, kind] of CREDITS) {
    const sc = kind === 'title' ? 5 : kind === 'head' ? 2 : kind === 'small' ? 1 : 2;
    const col = kind === 'title' ? PAL.gold2 : kind === 'head' ? PAL.gold : kind === 'sub' ? PAL.turq : kind === 'small' ? PAL.mist : PAL.white;
    if (y > -40 && y < H + 20 && txt) drawText(ctx, txt, W / 2, y, sc, col, 'center', kind === 'small' ? null : PAL.ink);
    y += kind === 'title' ? 56 : kind === 'small' ? 18 : 28;
  }
  if (y < 200) ctx.drawImage(Art.idol, W / 2 - 24, Math.max(200, y + 20));
  drawText(ctx, 'ENTER PARA VOLTAR', W - 20, H - 18, 1, PAL.mist, 'right', null);
}

// ---------------------------------------------------------- mouse
function toInternal(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
}
canvas.addEventListener('mousemove', e => {
  const m = toInternal(e); App.mouse.x = m.x; App.mouse.y = m.y;
  App.buttons.forEach((b, i) => { if (m.x > b.x && m.x < b.x + b.w && m.y > b.y && m.y < b.y + b.h) { const idx = App.buttons.indexOf(b); if (App.menu !== idx) { App.menu = idx; } } });
});
canvas.addEventListener('mousedown', e => {
  const m = toInternal(e);
  startAudio();
  for (const b of App.buttons) if (m.x > b.x && m.x < b.x + b.w && m.y > b.y && m.y < b.y + b.h) { Snd.sfx('ok'); b.act(); Input.swallow(); return; }
  if (App.state === 'intro' && App.stateT > 1.2) { Snd.stopVoice(); irisTo(() => beginPlay()); }
  if (App.state === 'credits' && App.stateT > 1) irisTo(() => { Snd.stopVoice(); setState('title'); App.game = null; updateMusic(); });
});
// qualquer tecla na tela inicial libera o áudio (os navegadores bloqueiam som antes de uma interação)
Input.on((type, code) => {
  if (!Snd.started) startAudio();
  if (type === 'pad') showToast('CONTROLE CONECTADO');
});

// ---------------------------------------------------------- ajuste de tela 16:9 com faixas pretas
function fit() {
  const s = Math.min(innerWidth / W, innerHeight / H);
  canvas.style.width = Math.floor(W * s) + 'px';
  canvas.style.height = Math.floor(H * s) + 'px';
}
addEventListener('resize', fit);

// ---------------------------------------------------------- laço: passo fixo de 1/60 s com acumulador
let last = performance.now(), acc = 0;
const fps = { frames: 0, t: 0, value: 60 };
function frame(now) {
  let dtReal = (now - last) / 1000; last = now;
  if (dtReal > 0.25) dtReal = 0.25; // aba voltou do segundo plano
  acc += dtReal;
  let steps = 0;
  while (acc >= DT && steps < 5) { step(DT); acc -= DT; steps++; }
  if (steps >= 5) acc = 0;
  render(now);
  fps.frames++; fps.t += dtReal;
  if (fps.t >= 1) { fps.value = fps.frames / fps.t; fps.frames = 0; fps.t = 0; }
  if (DEBUG) drawText(ctx, Math.round(fps.value) + ' FPS', 8, H - 14, 1, PAL.lime, 'left');
  requestAnimationFrame(frame);
}

function boot() {
  fit();
  buildAllArt();
  Snd.init(); // decodifica o áudio em segundo plano; o som só toca após o primeiro clique
  window.MA = App; // acesso para testes
  window.__test = { step, render, setState, startGame, beginPlay };
  requestAnimationFrame(t => { last = t; requestAnimationFrame(frame); });
}
boot();
