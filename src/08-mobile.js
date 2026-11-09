// ============================================================ celular: controles de toque, tela cheia, paisagem, áudio no iOS e PWA
// Os botões ficam num <div id="touch"> sobre o canvas (CSS em index.html) e alimentam o Input com códigos virtuais 'Touch*'.
const Mobile = (() => {
  const body = document.body, root = document.documentElement;
  const $ = id => document.getElementById(id);
  const pad = $('pad'), knob = pad.querySelector('b'), jump = $('jump'), pauseBtn = $('pause'), fsBtn = $('fs');
  const arrows = { up: pad.querySelector('.u'), down: pad.querySelector('.d'), left: pad.querySelector('.l'), right: pad.querySelector('.r') };
  const CODES = { left: 'TouchLeft', right: 'TouchRight', up: 'TouchUp', down: 'TouchDown' };
  const forced = params.has('toque'); // ?toque mostra os controles também no computador (teste)

  const standalone = () => matchMedia('(display-mode: fullscreen)').matches || matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement;
  const canFullscreen = !!(root.requestFullscreen || root.webkitRequestFullscreen) && (document.fullscreenEnabled || document.webkitFullscreenEnabled);

  // ---------------------------------------------------------- modo toque: liga em aparelhos de toque (ou no primeiro toque real)
  function enableTouch() {
    if (body.classList.contains('touch')) return;
    body.classList.add('touch');
    if (canFullscreen && !standalone()) body.classList.add('can-fs');
    layout();
  }
  if (forced || (matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches)) enableTouch();
  addEventListener('touchstart', enableTouch, { passive: true, capture: true });

  // ---------------------------------------------------------- direcional: a direção vem do polegar em relação ao centro (desliza entre as setas)
  // o dedo continua "preso" ao botão mesmo se escorregar para fora dele
  const capture = (el, e) => { try { el.setPointerCapture(e.pointerId); } catch (err) { } };
  let padId = null;
  const dirs = { up: false, down: false, left: false, right: false };
  function setDirs(next) {
    for (const k in dirs) {
      if (next[k] === dirs[k]) continue;
      dirs[k] = next[k];
      next[k] ? Input.press(CODES[k]) : Input.release(CODES[k]);
      arrows[k].classList.toggle('on', next[k]);
    }
    pad.classList.toggle('on', Object.values(next).some(Boolean));
  }
  function padMove(e) {
    const r = pad.getBoundingClientRect(), half = r.width / 2;
    let dx = (e.clientX - r.left - half) / half, dy = (e.clientY - r.top - half) / half;
    const d = Math.hypot(dx, dy), DEAD = 0.24;
    if (d > 1) { dx /= d; dy /= d; }
    const ax = Math.abs(dx), ay = Math.abs(dy), on = d > DEAD;
    // horizontal até ~68° da linha do chão; vertical a partir de ~31°: nas diagonais as duas valem
    setDirs({ left: on && dx < 0 && ax >= ay * 0.4, right: on && dx > 0 && ax >= ay * 0.4, up: on && dy < 0 && ay >= ax * 0.6, down: on && dy > 0 && ay >= ax * 0.6 });
    knob.style.transform = `translate(${dx * half * 0.55}px, ${dy * half * 0.55}px)`;
  }
  function padEnd(e) {
    if (e.pointerId !== padId) return;
    padId = null; setDirs({ up: false, down: false, left: false, right: false }); knob.style.transform = '';
  }
  pad.addEventListener('pointerdown', e => { e.preventDefault(); padId = e.pointerId; padMove(e); capture(pad, e); });
  pad.addEventListener('pointermove', e => { if (e.pointerId === padId) padMove(e); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => pad.addEventListener(t, padEnd));

  // ---------------------------------------------------------- botões simples: pular, pausa (cada dedo é um ponteiro: multitoque)
  function holdButton(el, code) {
    const ids = new Set();
    el.addEventListener('pointerdown', e => { e.preventDefault(); ids.add(e.pointerId); el.classList.add('on'); Input.press(code); capture(el, e); });
    const up = e => { if (!ids.delete(e.pointerId)) return; if (!ids.size) { el.classList.remove('on'); Input.release(code); } };
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => el.addEventListener(t, up));
    return () => { ids.clear(); el.classList.remove('on'); Input.release(code); };
  }
  const releaseJump = holdButton(jump, 'TouchJump'), releasePause = holdButton(pauseBtn, 'TouchPause');
  fsBtn.addEventListener('pointerup', () => goFullscreen(true));
  function releaseAll() { padId = null; setDirs({ up: false, down: false, left: false, right: false }); knob.style.transform = ''; releaseJump(); releasePause(); }
  addEventListener('blur', releaseAll);

  // os controles de jogo só aparecem durante a partida; nos menus se toca direto nos botões do canvas
  let wasPlaying = false;
  setInterval(() => {
    const playing = App.state === 'play' && !!App.game && !App.game.over;
    // girou para retrato no meio da partida: pausa (o aviso "gire o celular" cobre a tela)
    if (playing && body.classList.contains('touch') && matchMedia('(orientation: portrait)').matches) { setState('pause'); return; }
    if (playing !== wasPlaying) { wasPlaying = playing; body.classList.toggle('playing', playing); if (!playing) releaseAll(); }
    body.classList.toggle('is-fs', !!fsElement() || standalone());
  }, 100);

  // ---------------------------------------------------------- tela cheia + paisagem (Android/Chrome; no iPhone vale "Adicionar à Tela de Início")
  function lockLandscape() {
    if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => { });
  }
  let askedFs = false;
  function goFullscreen(user = false) {
    if (!body.classList.contains('touch') || fsElement() || standalone() || !canFullscreen) return;
    if (askedFs && !user) return; // pede sozinho só no primeiro toque; depois, pelo botão ⛶
    askedFs = true;
    try {
      const p = root.requestFullscreen ? root.requestFullscreen({ navigationUI: 'hide' }) : root.webkitRequestFullscreen();
      if (p && p.then) p.then(lockLandscape, () => { });
    } catch (e) { }
  }
  if (standalone()) lockLandscape();

  // ---------------------------------------------------------- primeiro toque: tela cheia e áudio (o iOS só libera o som dentro de um gesto)
  if (navigator.audioSession) { try { navigator.audioSession.type = 'playback'; } catch (e) { } } // toca mesmo com a chave de silencioso (Safari 17+)
  function gesture(e) {
    if (e.type === 'pointerup' && e.pointerType === 'mouse') return;
    goFullscreen();
    if (!Snd.started) startAudio(); // também retoma o áudio "interrompido" do iOS ao voltar para o app
  }
  addEventListener('touchend', gesture, { capture: true });
  addEventListener('pointerup', gesture, { capture: true });

  // ---------------------------------------------------------- sem zoom, rolagem, menu de toque longo ou "puxar para atualizar"
  const stop = e => { if (body.classList.contains('touch')) e.preventDefault(); };
  document.addEventListener('touchmove', stop, { passive: false });
  document.addEventListener('gesturestart', e => e.preventDefault());
  document.addEventListener('dblclick', stop);
  document.addEventListener('contextmenu', stop);

  // ---------------------------------------------------------- encaixe: o canvas mantém 16:9; a pausa fica logo abaixo do placar
  function layout() {
    fit();
    const r = canvas.getBoundingClientRect();
    root.style.setProperty('--hudTop', Math.max(8, Math.round(r.top + r.height * 46 / H)) + 'px');
  }
  addEventListener('resize', layout);
  addEventListener('orientationchange', () => setTimeout(layout, 250)); // o iOS só atualiza a medida depois de girar
  if (window.visualViewport) visualViewport.addEventListener('resize', layout);
  layout();

  // ---------------------------------------------------------- PWA: service worker para abrir sem internet
  const secure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if ('serviceWorker' in navigator && secure && !/teste\.html$/.test(location.pathname)) {
    addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));
  }

  return { get touch() { return body.classList.contains('touch'); }, releaseAll };
})();
function isTouchUI() { return document.body.classList.contains('touch'); }
