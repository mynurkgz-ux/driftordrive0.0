'use strict';
// Весь звук генерируется Web Audio API: музыка, двигатель, шины, окружение, эффекты
const AUDIO = (() => {
  const A = {};
  let ctx = null, master = null, comp = null, noiseBuf = null;
  const bus = {};
  let musicTimer = null, cur = null, step = 0, nextT = 0, melody = null, fileEl = null, fileSrc = null, fileName = '';
  let eng = null, amb = null;

  const TRACKS = [
    { name: 'Ночной дрифт', style: 'Phonk', bpm: 128, root: 41, scale: [0, 1, 3, 5, 7, 8, 10], prog: [0, 0, 5, 6],
      kick: 'x.....x...x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.xxx.', bass: 'x.....x...x...x.', lead: 'cowbell', dens: 0.5, clap: true, pad: false },
    { name: 'Неоновый город', style: 'Synthwave', bpm: 104, root: 45, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 2, 6],
      kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', bass: 'x.x.x.x.x.x.x.x.', lead: 'sawtooth', dens: 0.3, pad: true, arp: true },
    { name: 'Турбо', style: 'Drum & Bass', bpm: 172, root: 43, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 3, 4],
      kick: 'x.........x.....', snare: '....x.......x...', hat: 'x.xxx.xxx.xxx.xx', bass: 'x..x..x...x..x..', lead: 'square', dens: 0.22, pad: true },
    { name: 'Закат на трассе', style: 'Chill', bpm: 86, root: 48, scale: [0, 2, 4, 5, 7, 9, 11], prog: [0, 5, 3, 4],
      kick: 'x.......x.x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', bass: 'x.......x.......', lead: 'triangle', dens: 0.28, pad: true },
    { name: 'Автобан', style: 'Techno', bpm: 132, root: 40, scale: [0, 1, 3, 5, 7, 8, 10], prog: [0, 0, 0, 1],
      kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', bass: '.xx.xxx..xx.xxx.', lead: 'sawtooth', dens: 0.18, clap: true, pad: false },
    { name: 'Гаражный лоу-фай', style: 'Lo-fi', bpm: 78, root: 50, scale: [0, 2, 3, 5, 7, 9, 10], prog: [0, 3, 6, 2],
      kick: 'x......x..x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', bass: 'x......x..x.....', lead: 'sine', dens: 0.3, pad: true },
  ];
  A.TRACKS = TRACKS;
  A.ready = () => !!ctx;

  A.init = function () {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try { ctx = new AC(); } catch (e) { return; }
    comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    master = ctx.createGain(); master.connect(comp); comp.connect(ctx.destination);
    ['music', 'engine', 'tire', 'amb', 'sfx'].forEach(k => { bus[k] = ctx.createGain(); bus[k].connect(master); });
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    A.apply();
    const s = SAVE.s(); if (s.musicOn) A.playMusic(s.track);
  };
  A.apply = function () {
    if (!ctx) return; const s = SAVE.s(), t = ctx.currentTime;
    master.gain.setTargetAtTime(s.master, t, 0.05);
    bus.music.gain.setTargetAtTime(s.musicOn ? s.music * 0.5 : 0, t, 0.05);
    bus.engine.gain.setTargetAtTime(s.engine, t, 0.05);
    bus.tire.gain.setTargetAtTime(s.tire, t, 0.05);
    bus.amb.gain.setTargetAtTime(s.amb, t, 0.05);
    bus.sfx.gain.setTargetAtTime(s.sfx, t, 0.05);
    if (s.musicOn && !musicTimer && !(fileEl && !fileEl.paused) && cur === null) A.playMusic(s.track);
    if (!s.musicOn) A.stopMusic();
  };

  // ---------- инструменты ----------
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  function gain(v, out) { const g = ctx.createGain(); g.gain.value = v; if (out) g.connect(out); return g; }
  function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function noise(t, dur, type, freq, q, peak, out) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q || 1;
    const g = ctx.createGain(); env(g, t, 0.002, peak, dur);
    s.connect(f); f.connect(g); g.connect(out || bus.music); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  function tone(type, f, t, a, peak, d, out, f2) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + a + d);
    const g = ctx.createGain(); env(g, t, a, peak, d); o.connect(g); g.connect(out || bus.music); o.start(t); o.stop(t + a + d + 0.05);
  }
  function kick(t) { tone('sine', 150, t, 0.003, 0.95, 0.32, bus.music, 42); }
  function snare(t) { noise(t, 0.17, 'highpass', 1300, 0.7, 0.32); tone('triangle', 190, t, 0.002, 0.18, 0.1); }
  function clap(t) { for (let i = 0; i < 3; i++) noise(t + i * 0.011, 0.05, 'bandpass', 1500, 1.2, 0.3); noise(t + 0.033, 0.16, 'bandpass', 1400, 1, 0.22); }
  function hat(t, v) { noise(t, 0.035, 'highpass', 7500, 1, v); }
  function bass(m, t, dur) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(700, t); f.frequency.exponentialRampToValueAtTime(180, t + dur);
    const g = ctx.createGain(); env(g, t, 0.008, 0.32, dur); o.connect(f); f.connect(g); g.connect(bus.music); o.start(t); o.stop(t + dur + 0.05);
  }
  function lead(m, t, dur, kind) {
    const f0 = mtof(m);
    if (kind === 'cowbell') {
      const g = ctx.createGain(); env(g, t, 0.002, 0.16, 0.22);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f0 * 1.3; bp.Q.value = 2.5;
      [1, 1.48].forEach(r => { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f0 * r; o.connect(bp); o.start(t); o.stop(t + 0.3); });
      bp.connect(g); g.connect(bus.music); return;
    }
    const o = ctx.createOscillator(); o.type = kind; o.frequency.value = f0;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = kind === 'sine' || kind === 'triangle' ? 4000 : 2400;
    const g = ctx.createGain(); env(g, t, 0.01, kind === 'sine' || kind === 'triangle' ? 0.2 : 0.09, dur);
    o.connect(f); f.connect(g); g.connect(bus.music); o.start(t); o.stop(t + dur + 0.05);
  }
  function pad(notes, t, dur) {
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05, t + dur * 0.25); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    f.connect(g); g.connect(bus.music);
    notes.forEach(m => [-7, 7].forEach(dt => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = dt; o.connect(f); o.start(t); o.stop(t + dur + 0.05); }));
  }
  function noteOf(T, deg, oct) { const sc = T.scale, n = sc.length; const o = Math.floor(deg / n), d = ((deg % n) + n) % n; return T.root + 12 * (oct + o) + sc[d] + 12; }

  function playStep(st, t) {
    const T = cur, i = st % 16, bar = Math.floor(st / 16), sd = 60 / T.bpm / 4;
    const deg = T.prog[bar % T.prog.length];
    if (T.kick[i] === 'x') kick(t);
    if (T.snare[i] === 'x') (T.clap ? clap : snare)(t);
    if (T.hat[i] === 'x') hat(t, i % 4 === 2 ? 0.13 : 0.07);
    if (T.bass[i] === 'x') bass(noteOf(T, deg, -1), t, sd * (T.bass[i + 1] === '.' ? 2 : 1));
    if (T.pad && i === 0) pad([noteOf(T, deg, 0), noteOf(T, deg + 2, 0), noteOf(T, deg + 4, 0)], t, sd * 16);
    if (T.arp && i % 2 === 0) lead(noteOf(T, deg + [0, 2, 4, 7][(i / 2) % 4], 1), t, sd * 1.2, 'square');
    const mm = melody[st % 32]; if (mm !== null && bar % 4 !== 3 || (mm !== null && T.lead === 'cowbell')) lead(noteOf(T, deg + mm, T.lead === 'cowbell' ? 1 : 1), t, sd * 1.6, T.lead);
  }
  function scheduler() {
    if (!ctx || !cur) return;
    while (nextT < ctx.currentTime + 0.15) { playStep(step, nextT); nextT += 60 / cur.bpm / 4; step++; }
  }
  A.playMusic = function (i) {
    if (!ctx) return;
    A.stopMusic();
    if (i === 'file') { if (fileEl && fileEl.src) { fileEl.play().catch(() => { }); } return; }
    cur = TRACKS[i] || TRACKS[0];
    const r = U.rng(U.hash(cur.name)); const tones = [0, 2, 4, 0, 2, 4, 6, 7, -1, 3];
    melody = []; for (let k = 0; k < 32; k++) melody.push(r() < cur.dens ? tones[Math.floor(r() * tones.length)] : null);
    step = 0; nextT = ctx.currentTime + 0.12;
    musicTimer = setInterval(scheduler, 25);
  };
  A.stopMusic = function () { clearInterval(musicTimer); musicTimer = null; cur = null; if (fileEl) fileEl.pause(); };
  A.playFile = function (file) {
    A.init(); if (!ctx) return;
    A.stopMusic();
    if (!fileEl) { fileEl = new Audio(); fileEl.loop = true; fileSrc = ctx.createMediaElementSource(fileEl); fileSrc.connect(bus.music); }
    fileEl.src = URL.createObjectURL(file); fileName = file.name; fileEl.play().catch(() => { });
  };
  A.fileName = () => fileName;
  A.nowPlaying = () => cur ? cur.name : (fileEl && !fileEl.paused ? fileName : '');

  // ---------- двигатель и шины ----------
  function distCurve(k) { const n = 1024, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; c[i] = (1 + k) * x / (1 + k * Math.abs(x)); } return c; }
  A.engineStart = function (spec) {
    if (!ctx) return; A.engineStop();
    const cyl = spec.cyl, t = ctx.currentTime;
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth';
    const o2 = ctx.createOscillator(); o2.type = 'square';
    const o3 = ctx.createOscillator(); o3.type = 'sine';
    const ws = ctx.createWaveShaper(); ws.curve = distCurve(cyl >= 8 ? 6 : 3);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.5; lp.frequency.value = 600;
    const am = ctx.createGain(); am.gain.value = 0.8;
    const out = ctx.createGain(); out.gain.value = 0;
    o1.connect(gain(0.45, ws)); o2.connect(gain(0.2, ws)); o3.connect(gain(0.7, ws));
    ws.connect(lp); lp.connect(am); am.connect(out); out.connect(bus.engine);
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; const lfoG = gain(cyl === 8 ? 0.35 : 0.12); lfo.connect(lfoG); lfoG.connect(am.gain);
    // турбина
    const tb = ctx.createOscillator(); tb.type = 'sine'; const tbG = gain(0, bus.engine); tb.connect(tbG);
    // шины: визг и шорох
    const sq = ctx.createBufferSource(); sq.buffer = noiseBuf; sq.loop = true;
    const sqF = ctx.createBiquadFilter(); sqF.type = 'bandpass'; sqF.frequency.value = 1000; sqF.Q.value = 4;
    const sqG = gain(0, bus.tire); sq.connect(sqF); sqF.connect(sqG);
    const sq2 = ctx.createOscillator(); sq2.type = 'triangle'; sq2.frequency.value = 900; const sq2G = gain(0, bus.tire); sq2.connect(sq2G);
    const rb = ctx.createBufferSource(); rb.buffer = noiseBuf; rb.loop = true;
    const rbF = ctx.createBiquadFilter(); rbF.type = 'lowpass'; rbF.frequency.value = 260; const rbG = gain(0, bus.tire); rb.connect(rbF); rbF.connect(rbG);
    const wind = ctx.createBufferSource(); wind.buffer = noiseBuf; wind.loop = true;
    const wF = ctx.createBiquadFilter(); wF.type = 'bandpass'; wF.frequency.value = 500; wF.Q.value = 0.6; const wG = gain(0, bus.tire); wind.connect(wF); wF.connect(wG);
    [o1, o2, o3, lfo, tb, sq, sq2, rb, wind].forEach(n => n.start(t));
    eng = { o1, o2, o3, lp, out, lfo, tb, tbG, sqF, sqG, sq2, sq2G, rbG, wG, wF, nodes: [o1, o2, o3, lfo, tb, sq, sq2, rb, wind], spec, cyl, lastThr: 0 };
  };
  const CYLF = { 3: 1.5, 4: 2, 6: 2.6, 8: 2.2, 10: 3, 12: 3.4 };
  A.engineUpdate = function (rpm, thr, spd, skid, surf) {
    if (!eng) return; const t = ctx.currentTime, s = eng.spec;
    const rn = rpm / s.redline;
    const f = rpm / 60 * (CYLF[eng.cyl] || 2);
    eng.o1.frequency.setTargetAtTime(f, t, 0.02); eng.o2.frequency.setTargetAtTime(f * 0.5, t, 0.02); eng.o3.frequency.setTargetAtTime(f * 0.5, t, 0.02);
    eng.lfo.frequency.setTargetAtTime(rpm / 60 / 2, t, 0.05);
    eng.lp.frequency.setTargetAtTime(250 + thr * 1400 + rn * 1600, t, 0.04);
    eng.out.gain.setTargetAtTime(0.12 + thr * 0.2 + rn * 0.08, t, 0.04);
    eng.tb.frequency.setTargetAtTime(1500 + rn * 3000, t, 0.05);
    eng.tbG.gain.setTargetAtTime(s.turbo ? thr * rn * 0.012 * s.turbo : 0, t, 0.08);
    if (s.turbo && eng.lastThr > 0.6 && thr < 0.1 && rn > 0.5) A.blowoff();
    if (eng.lastThr > 0.7 && thr < 0.1 && rn > 0.62 && Math.random() < 0.7) A.backfire();
    eng.lastThr = thr;
    const sk = U.clamp(skid, 0, 1.2);
    const onRoad = surf !== 'off';
    eng.sqG.gain.setTargetAtTime(onRoad && sk > 0.15 ? Math.min(0.32, (sk - 0.15) * 0.45) : 0, t, 0.05);
    eng.sq2G.gain.setTargetAtTime(onRoad && sk > 0.25 ? Math.min(0.05, (sk - 0.25) * 0.07) : 0, t, 0.05);
    eng.sqF.frequency.setTargetAtTime(800 + sk * 500, t, 0.05);
    eng.sq2.frequency.setTargetAtTime(820 + sk * 260 + Math.sin(t * 20) * 25, t, 0.03);
    eng.rbG.gain.setTargetAtTime(surf === 'off' ? Math.min(0.5, spd / 25) : surf === 'curb' ? Math.min(0.35, spd / 30) : 0, t, 0.05);
    eng.wG.gain.setTargetAtTime(Math.min(0.12, spd / 600), t, 0.1);
  };
  A.engineStop = function () { if (!eng) return; const e = eng; eng = null; try { e.out.gain.setTargetAtTime(0, ctx.currentTime, 0.05); } catch (x) { } setTimeout(() => e.nodes.forEach(n => { try { n.stop(); } catch (x) { } }), 200); };
  A.backfire = function () { if (!ctx) return; const t = ctx.currentTime; const n = 1 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) noise(t + i * 0.07 + Math.random() * 0.04, 0.07, 'lowpass', 900, 1, 0.5, bus.engine); };
  A.blowoff = function () { if (!ctx) return; const t = ctx.currentTime; noise(t, 0.35, 'bandpass', 2600, 2, 0.12, bus.engine); };
  A.shift = function () { if (!ctx) return; noise(ctx.currentTime, 0.05, 'bandpass', 1800, 1, 0.08, bus.engine); };

  // ---------- эффекты ----------
  A.hit = function (imp) { if (!ctx) return; const t = ctx.currentTime, v = U.clamp(imp / 14, 0.1, 1); noise(t, 0.28, 'lowpass', 500, 1, v * 0.8, bus.sfx); tone('sine', 90, t, 0.003, v * 0.6, 0.25, bus.sfx, 40); };
  A.cone = function () { if (!ctx) return; tone('triangle', 520, ctx.currentTime, 0.002, 0.15, 0.12, bus.sfx, 300); };
  A.beep = function (hi) { if (!ctx) return; tone('square', hi ? 990 : 660, ctx.currentTime, 0.005, 0.12, hi ? 0.45 : 0.18, bus.sfx); };
  A.click = function () { if (!ctx) return; tone('sine', 1300, ctx.currentTime, 0.002, 0.06, 0.04, bus.sfx); };
  A.cash = function () { if (!ctx) return; const t = ctx.currentTime;[880, 1175, 1568].forEach((f, i) => tone('triangle', f, t + i * 0.07, 0.005, 0.12, 0.2, bus.sfx)); };
  A.bad = function () { if (!ctx) return; tone('sawtooth', 220, ctx.currentTime, 0.005, 0.1, 0.3, bus.sfx, 110); };

  // ---------- окружение ----------
  A.ambStart = function (kind) {
    if (!ctx) return; A.ambStop();
    const nodes = [], timers = [];
    const loop = (type, freq, q, vol) => {
      const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = gain(vol, bus.amb); s.connect(f); f.connect(g); s.start(); nodes.push(s); return g;
    };
    const lfoOn = (param, rate, depth) => { const o = ctx.createOscillator(); o.frequency.value = rate; const g = gain(depth); o.connect(g); g.connect(param); o.start(); nodes.push(o); };
    const every = (min, max, fn) => { const go = () => { fn(); timers.push(setTimeout(go, min + Math.random() * (max - min))); }; timers.push(setTimeout(go, min * Math.random())); };
    const chirp = () => { const t = ctx.currentTime; const n = 2 + Math.floor(Math.random() * 4), b = 2400 + Math.random() * 1800; for (let i = 0; i < n; i++) tone('sine', b, t + i * 0.11, 0.01, 0.03, 0.07, bus.amb, b * 1.4); };
    switch (kind) {
      case 'wind': { const g = loop('lowpass', 380, 0.7, 0.2); lfoOn(g.gain, 0.13, 0.1); break; }
      case 'forest': loop('lowpass', 600, 0.5, 0.05); every(1500, 5000, chirp); break;
      case 'city': loop('lowpass', 170, 0.6, 0.18); every(4000, 9000, () => { const t = ctx.currentTime; noise(t, 2.2, 'bandpass', 400, 0.8, 0.05, bus.amb); }); break;
      case 'night': {
        loop('lowpass', 300, 0.5, 0.05);
        [4300, 4750].forEach((f, i) => { const o = ctx.createOscillator(); o.frequency.value = f; const g = gain(0, bus.amb); const l = ctx.createOscillator(); l.type = 'square'; l.frequency.value = 22 + i * 7; const lg = gain(0.012); l.connect(lg); lg.connect(g.gain); o.connect(g); o.start(); l.start(); nodes.push(o, l); });
        break;
      }
      case 'neon': { const o = ctx.createOscillator(); o.frequency.value = 55; o.connect(gain(0.03, bus.amb)); o.start(); nodes.push(o); loop('lowpass', 220, 0.6, 0.08); break; }
      case 'port': { const g = loop('lowpass', 280, 0.6, 0.14); lfoOn(g.gain, 0.18, 0.07); every(3000, 8000, () => { const t = ctx.currentTime; tone('triangle', 1250, t, 0.03, 0.025, 0.35, bus.amb, 850); tone('triangle', 1150, t + 0.4, 0.03, 0.02, 0.3, bus.amb, 800); }); break; }
      case 'crowd': { const g = loop('bandpass', 900, 0.6, 0.06); lfoOn(g.gain, 0.3, 0.03); break; }
      case 'rain': loop('highpass', 2500, 0.5, 0.13); loop('lowpass', 500, 0.5, 0.07); break;
    }
    amb = { nodes, timers };
  };
  A.ambStop = function () { if (!amb) return; amb.nodes.forEach(n => { try { n.stop(); } catch (e) { } }); amb.timers.forEach(clearTimeout); amb = null; };

  // Пауза всего звука при сворачивании вкладки
  document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) ctx.suspend(); else ctx.resume(); });
  return A;
})();
