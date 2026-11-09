// ============================================================ entrada: teclado + Gamepad API + toque (08-mobile.js) → ações
const Input = (() => {
  const ACTIONS = ['left', 'right', 'up', 'down', 'jump', 'pause', 'mute', 'confirm', 'back'];
  const keys = new Set(), tapped = new Set(); // tapped: teclas apertadas desde a última leitura (toques rápidos)
  const state = {}, prev = {};
  ACTIONS.forEach(a => { state[a] = false; prev[a] = false; });
  let padIndex = -1, padAnnounced = false, lastDevice = 'teclado';
  const listeners = [];

  const KEYMAP = {
    left: ['ArrowLeft', 'KeyA', 'TouchLeft'], right: ['ArrowRight', 'KeyD', 'TouchRight'],
    up: ['ArrowUp', 'KeyW', 'TouchUp'], down: ['ArrowDown', 'KeyS', 'TouchDown'],
    jump: ['Space', 'KeyW', 'ArrowUp', 'TouchJump'], pause: ['Escape', 'KeyP', 'TouchPause'], mute: ['KeyM'],
    confirm: ['Enter', 'Space', 'NumpadEnter'], back: ['Escape', 'Backspace'],
  };
  const GAME_KEYS = new Set(Object.values(KEYMAP).flat());

  addEventListener('keydown', e => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    keys.add(e.code); tapped.add(e.code); lastDevice = 'teclado';
    listeners.forEach(f => f('key', e.code));
  });
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  function poll() {
    for (const a of ACTIONS) { prev[a] = state[a]; state[a] = KEYMAP[a].some(k => keys.has(k) || tapped.has(k)); }
    tapped.clear();
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad = null;
    for (const p of pads) {
      if (!p) continue;
      if (p.buttons.some(b => b.pressed) || Math.abs(p.axes[0] || 0) > 0.5 || Math.abs(p.axes[1] || 0) > 0.5) {
        if (padIndex !== p.index) { padIndex = p.index; padAnnounced = false; }
      }
      if (p.index === padIndex) pad = p;
    }
    if (pad) {
      const b = i => !!(pad.buttons[i] && pad.buttons[i].pressed);
      const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
      const any = pad.buttons.some(x => x.pressed) || Math.abs(ax) > 0.5 || Math.abs(ay) > 0.5;
      if (any) lastDevice = 'controle';
      if (!padAnnounced && any) { padAnnounced = true; listeners.forEach(f => f('pad', pad.id)); }
      state.left ||= b(14) || ax < -0.4;
      state.right ||= b(15) || ax > 0.4;
      state.up ||= b(12) || ay < -0.55;
      state.down ||= b(13) || ay > 0.55;
      state.jump ||= b(0);
      state.confirm ||= b(0);
      state.back ||= b(1);
      state.pause ||= b(9);
      state.mute ||= b(8);
    }
  }
  const pressed = a => state[a] && !prev[a];
  const held = a => state[a];
  // libera tudo (evita que o clique de um menu vire pulo)
  function swallow() { for (const a of ACTIONS) prev[a] = state[a] = true; }
  // botões de toque: códigos virtuais 'Touch*' que entram no mesmo conjunto das teclas
  function press(code) { if (!keys.has(code)) { keys.add(code); tapped.add(code); } lastDevice = 'toque'; }
  function release(code) { keys.delete(code); }
  return { poll, pressed, held, swallow, press, release, on: f => listeners.push(f), get device() { return lastDevice; }, get hasPad() { return padIndex >= 0; } };
})();
