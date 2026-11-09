// ============================================================ áudio: trilha (pré-renderizada), efeitos sintetizados e falas
const VOICE_TEXT = {
  abertura: 'Dizem que no coração da Mata Atlântica existe um ídolo de ouro, escondido por um povo esquecido. Muitos entraram. Poucos voltaram. Zé Trilha tem cinco minutos. Mata adentro!',
  cipo: 'Segura firme no cipó e solta no alto do balanço.',
  jacare: 'Olha o ritmo dos jacarés. Boca fechada, caminho livre.',
  areia: 'Areia movediça. Espera ela firmar antes de passar.',
  escada: 'Essa escada leva para baixo. Atalho curto, mas tem escorpião.',
  fogueira: 'Fogueira acesa. Se cair, você volta daqui.',
  minuto: 'Um minuto! Corre, Zé!',
  vitoria: 'O ídolo é seu, Zé Trilha. A mata guardou o segredo por séculos, e hoje ele volta para casa.',
  fimdejogo: 'A mata venceu dessa vez. Mas ela sempre deixa você tentar de novo.',
  creditos: 'Mata Adentro foi criado com inteligência artificial. Código, arte e música pelo Claude. Voz gerada no VoiceStudio. Um experimento Neural Hub.',
};
// laços: arquivo = [1 s antes] + laço L + [1 s depois] (ver audio/process.sh)
const LOOPS = { mus_tema: 40, mus_mata: 60, mus_sub: 30, amb_mata: 30, amb_sub: 20 };

const Snd = (() => {
  let ac = null, master, bus = {}, buffers = {}, ready = false, loading = null;
  const vol = Object.assign({ music: 0.8, sfx: 0.9, voice: 1.0, muted: false }, store.get('mataAdentro.volume', {}));
  let music = null, amb = null;          // { src, gain, name }
  let voiceSrc = null, voiceQueue = [], subtitle = null, duck = 1;
  let noiseBuf = null;

  function init() {
    if (ac) return loading;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return Promise.resolve();
    ac = new AC();
    master = ac.createGain(); master.connect(ac.destination);
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -10; comp.ratio.value = 3; comp.connect(master);
    for (const k of ['music', 'sfx', 'voice']) { bus[k] = ac.createGain(); bus[k].connect(comp); }
    bus.musicDuck = ac.createGain(); bus.musicDuck.connect(bus.music);
    applyVolumes();
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const data = typeof AUDIO_DATA !== 'undefined' ? AUDIO_DATA : {};
    loading = Promise.all(Object.entries(data).map(([name, b64]) => {
      const bin = atob(b64), arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return new Promise(res => ac.decodeAudioData(arr.buffer, b => { buffers[name] = b; res(); }, () => res()));
    })).then(() => { ready = true; });
    return loading;
  }

  function applyVolumes() {
    if (!ac) return;
    const t = ac.currentTime;
    master.gain.setTargetAtTime(vol.muted ? 0 : 1, t, 0.02);
    bus.music.gain.setTargetAtTime(vol.music * 0.75, t, 0.05);
    bus.sfx.gain.setTargetAtTime(vol.sfx * 0.8, t, 0.05);
    bus.voice.gain.setTargetAtTime(vol.voice * 1.1, t, 0.05);
    store.set('mataAdentro.volume', vol);
  }
  function setVol(k, v) { vol[k] = clamp(Math.round(v * 10) / 10, 0, 1); applyVolumes(); }
  function toggleMute() { vol.muted = !vol.muted; applyVolumes(); return vol.muted; }

  function playBuffer(name, dest, { loop = false, rate = 1, gain = 1, offset = 0 } = {}) {
    const b = buffers[name];
    if (!ac || !b) return null;
    const src = ac.createBufferSource(); src.buffer = b;
    if (loop && LOOPS[name]) { src.loop = true; src.loopStart = 1; src.loopEnd = 1 + LOOPS[name]; }
    src.playbackRate.value = rate;
    const g = ac.createGain(); g.gain.setValueAtTime(gain, ac.currentTime);
    src.connect(g); g.connect(dest);
    src.start(ac.currentTime, offset || (loop && LOOPS[name] ? 1 : 0));
    return { src, gain: g, name, rate };
  }
  function fadeOut(h, t = 0.6) {
    if (!h || !ac) return;
    const now = ac.currentTime;
    h.gain.gain.cancelScheduledValues(now);
    h.gain.gain.setValueAtTime(h.gain.gain.value, now);
    h.gain.gain.linearRampToValueAtTime(0, now + t);
    try { h.src.stop(now + t + 0.05); } catch (e) { }
  }
  // troca de música com crossfade; 'rate' acelera para a faixa Pressa
  function setMusic(name, { rate = 1, loop = true, fade = 0.8 } = {}) {
    if (!ac) return;
    if (music && music.name === name && music.loop === loop) {
      if (Math.abs(music.rate - rate) > 0.001) { music.src.playbackRate.setTargetAtTime(rate, ac.currentTime, 0.4); music.rate = rate; }
      return;
    }
    fadeOut(music, fade);
    music = null;
    if (!name) return;
    const h = playBuffer(name, bus.musicDuck, { loop, rate, gain: 0 });
    if (!h) return;
    h.loop = loop;
    h.gain.gain.linearRampToValueAtTime(1, ac.currentTime + (loop ? fade : 0.05));
    music = h;
  }
  function setAmbient(name) {
    if (!ac) return;
    if (amb && amb.name === name) return;
    fadeOut(amb, 1.2); amb = null;
    if (!name) return;
    const h = playBuffer(name, bus.sfx, { loop: true, gain: 0 });
    if (!h) return;
    h.gain.gain.linearRampToValueAtTime(0.55, ac.currentTime + 1.5);
    amb = h;
  }
  function stopAll() { setMusic(null, { fade: 0.3 }); setAmbient(null); stopVoice(); }

  // ---------------------------------------------------------- falas
  function voice(name, { interrupt = false } = {}) {
    if (!ac || ac.state !== 'running' || !buffers['voz_' + name]) { subtitle = { text: VOICE_TEXT[name], until: performance.now() + 4500 }; return; }
    if (voiceSrc) { if (interrupt) stopVoice(); else { voiceQueue.push(name); return; } }
    const h = playBuffer('voz_' + name, bus.voice);
    voiceSrc = h;
    const dur = buffers['voz_' + name].duration;
    subtitle = { text: VOICE_TEXT[name], until: performance.now() + dur * 1000 + 500 };
    duckTo(0.32);
    h.src.onended = () => {
      if (voiceSrc !== h) return;
      voiceSrc = null;
      if (voiceQueue.length) voice(voiceQueue.shift()); else duckTo(1);
    };
  }
  function stopVoice() {
    voiceQueue = [];
    if (voiceSrc) { try { voiceSrc.src.onended = null; voiceSrc.src.stop(); } catch (e) { } voiceSrc = null; }
    subtitle = null; duckTo(1);
  }
  function duckTo(v) { if (!ac) return; duck = v; bus.musicDuck.gain.setTargetAtTime(v, ac.currentTime, 0.12); }
  function currentSubtitle() { return subtitle && performance.now() < subtitle.until ? subtitle.text : null; }

  // ---------------------------------------------------------- efeitos sintetizados
  function env(g, t, a, peak, d, end = 0.0001) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(end, t + a + d);
  }
  function tone(type, f0, f1, dur, peak = 0.3, t0 = 0, dest) {
    const t = ac.currentTime + t0;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, 0.005, peak, dur);
    o.connect(g); g.connect(dest || bus.sfx);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, { type = 'lowpass', f0 = 1000, f1 = f0, q = 1, peak = 0.3, t0 = 0, attack = 0.004 } = {}) {
    const t = ac.currentTime + t0;
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    s.playbackRate.value = 0.5 + Math.random();
    const f = ac.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ac.createGain(); env(g, t, attack, peak, dur);
    s.connect(f); f.connect(g); g.connect(bus.sfx);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + attack + 0.05);
  }
  const SFX = {
    passo: () => noise(0.06, { f0: 600 + Math.random() * 300, f1: 200, peak: 0.12, q: 2 }),
    pulo: () => { tone('square', 220, 520, 0.12, 0.08); noise(0.08, { type: 'bandpass', f0: 1500, f1: 3000, peak: 0.05 }); },
    pouso: () => noise(0.1, { f0: 400, f1: 80, peak: 0.25 }),
    cipo: () => noise(0.35, { type: 'bandpass', f0: 500, f1: 1800, q: 1.5, peak: 0.13, attack: 0.12 }),
    agarra: () => { noise(0.07, { type: 'bandpass', f0: 900, f1: 500, peak: 0.15 }); tone('triangle', 180, 140, 0.08, 0.1); },
    moeda: () => { tone('square', 988, 988, 0.07, 0.09); tone('square', 1319, 1319, 0.22, 0.09, 0.07); },
    joia: () => { [1047, 1319, 1568, 2093, 2637].forEach((f, i) => tone('triangle', f, f, 0.25, 0.12, i * 0.06)); tone('sine', 3136, 3136, 0.6, 0.05, 0.3); },
    tropeco: () => { noise(0.12, { f0: 300, f1: 60, peak: 0.35 }); tone('square', 330, 150, 0.2, 0.07, 0.04); },
    respingo: () => { noise(0.5, { type: 'highpass', f0: 3000, f1: 800, peak: 0.25 }); noise(0.3, { f0: 600, f1: 120, peak: 0.25 }); },
    perdeu: () => { tone('square', 523, 523, 0.12, 0.08); tone('square', 392, 392, 0.12, 0.08, 0.13); tone('square', 262, 196, 0.4, 0.09, 0.26); },
    ferroada: () => { noise(0.08, { type: 'highpass', f0: 4000, f1: 2000, peak: 0.2 }); tone('sawtooth', 900, 300, 0.15, 0.08); },
    tique: () => tone('square', 1760, 1760, 0.03, 0.06),
    menu: () => tone('square', 660, 880, 0.05, 0.06),
    ok: () => { tone('square', 660, 660, 0.06, 0.07); tone('square', 990, 990, 0.12, 0.07, 0.06); },
    escada: () => noise(0.05, { type: 'bandpass', f0: 1200, f1: 900, q: 3, peak: 0.1 }),
    iris: () => noise(0.4, { type: 'bandpass', f0: 300, f1: 1200, q: 2, peak: 0.06, attack: 0.2 }),
  };
  const SAMPLE_SFX = { mordida: 'sfx_mordida', afundar: 'sfx_afundar', fogueira: 'sfx_fogueira', idolo: 'sfx_idolo' };
  function sfx(name) {
    if (!ac || ac.state !== 'running') return;
    if (SAMPLE_SFX[name]) { playBuffer(SAMPLE_SFX[name], bus.sfx, { gain: 0.9 }); return; }
    if (SFX[name]) SFX[name]();
  }

  return {
    init, unlock() { init(); if (ac && ac.state !== 'running') return ac.resume().catch(() => { }); return Promise.resolve(); }, sfx, voice, stopVoice, setMusic, setAmbient, stopAll, setVol, toggleMute, currentSubtitle,
    vol, get ready() { return ready; }, get started() { return !!ac && ac.state === 'running'; }, get loading() { return loading || Promise.resolve(); }, get speaking() { return !!voiceSrc; }, get buffers() { return Object.keys(buffers); }, get state() { return ac ? ac.state : 'none'; },
  };
})();
