'use strict';
// Генерация трасс (замкнутые кольца и открытые площадки), декорации, отрисовка
const TRACK = (() => {
  const STEP = 3, G = 9.81;
  const cache = {};
  const patCache = {};

  function catmull(ctrl, seg) {
    const out = [], n = ctrl.length;
    for (let i = 0; i < n; i++) {
      const p0 = ctrl[(i - 1 + n) % n], p1 = ctrl[i], p2 = ctrl[(i + 1) % n], p3 = ctrl[(i + 2) % n];
      const k = Math.max(2, Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) / seg));
      for (let j = 0; j < k; j++) {
        const t = j / k, t2 = t * t, t3 = t2 * t;
        out.push({
          x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
          y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
        });
      }
    }
    return out;
  }
  function resample(pts, step) {
    const out = [{ x: pts[0].x, y: pts[0].y }], n = pts.length; let need = step;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy); let pos = 0;
      while (d - pos >= need) { pos += need; const t = pos / d; out.push({ x: a.x + dx * t, y: a.y + dy * t }); need = step; }
      need -= d - pos;
    }
    const l = out[out.length - 1]; if (Math.hypot(l.x - out[0].x, l.y - out[0].y) < step * 0.6) out.pop();
    return out;
  }
  function smooth(pts, iters) {
    const n = pts.length;
    for (let it = 0; it < iters; it++) {
      const c = pts.map(p => ({ x: p.x, y: p.y }));
      for (let i = 0; i < n; i++) { const a = c[(i - 1 + n) % n], b = c[(i + 1) % n]; pts[i].x = (a.x + 2 * c[i].x + b.x) / 4; pts[i].y = (a.y + 2 * c[i].y + b.y) / 4; }
    }
    return pts;
  }
  // Раздвигаем участки трассы, которые подходят друг к другу ближе minD
  function relax(pts, minD, iters) {
    const n = pts.length, skip = Math.ceil(minD * 1.6 / STEP), md2 = minD * minD, cs = minD;
    for (let it = 0; it < iters; it++) {
      const grid = new Map(); const key = (x, y) => (x + 30000) * 60000 + (y + 30000);
      for (let i = 0; i < n; i++) { const k = key(Math.floor(pts[i].x / cs), Math.floor(pts[i].y / cs)); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(i); }
      let moved = false;
      for (let i = 0; i < n; i++) {
        const p = pts[i], gx = Math.floor(p.x / cs), gy = Math.floor(p.y / cs);
        for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
          const arr = grid.get(key(gx + ox, gy + oy)); if (!arr) continue;
          for (const j of arr) {
            if (j <= i) continue; const di = j - i; if (di < skip || n - di < skip) continue;
            const q = pts[j], dx = q.x - p.x, dy = q.y - p.y, d2 = dx * dx + dy * dy;
            if (d2 < md2 && d2 > 1e-6) { const d = Math.sqrt(d2), push = (minD - d) * 0.3, ux = dx / d, uy = dy / d; p.x -= ux * push; p.y -= uy * push; q.x += ux * push; q.y += uy * push; moved = true; }
          }
        }
      }
      smooth(pts, 1);
      if (!moved) break;
    }
  }

  function build(m) {
    if (cache[m.id]) return cache[m.id];
    const tr = { m, theme: DATA.THEMES[m.theme], kind: m.kind === 'arena' ? 'arena' : 'circuit', step: STEP };
    if (tr.kind === 'arena') buildArena(tr, m); else buildCircuit(tr, m);
    genDecos(tr);
    cache[m.id] = tr;
    return tr;
  }

  function buildCircuit(tr, m) {
    const r = U.rng(m.seed), n = m.n;
    const ctrl = [];
    for (let i = 0; i < n; i++) {
      const rad = 1 - m.jitter + r() * m.jitter * 2;
      const a = i / n * Math.PI * 2 + (r() - 0.5) * (Math.PI * 2 / n) * 0.55;
      ctrl.push({ x: Math.cos(a) * m.R * rad * m.ax, y: Math.sin(a) * m.R * rad * m.ay });
    }
    const hw = m.width / 2, wall = hw + m.runoff;
    let pts = resample(catmull(ctrl, 2), STEP);
    relax(pts, wall * 2 + 8, 14); smooth(pts, 3); pts = resample(pts, STEP);
    relax(pts, wall * 2 + 6, 6); smooth(pts, 2); pts = resample(pts, STEP);
    let N = pts.length;
    // касательные и кривизна
    const tang = (P, i) => { const a = P[(i - 1 + N) % N], b = P[(i + 1) % N]; const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1; return { x: dx / l, y: dy / l }; };
    let curv = new Float32Array(N);
    for (let i = 0; i < N; i++) { const t0 = tang(pts, (i - 1 + N) % N), t1 = tang(pts, (i + 1) % N); curv[i] = Math.abs(U.wrap(Math.atan2(t1.y, t1.x) - Math.atan2(t0.y, t0.x))) / (2 * STEP); }
    // старт — на самом прямом участке
    let best = 0, bestS = 1e9; const W = 18;
    for (let i = 0; i < N; i++) { let s = 0; for (let k = -W; k <= W; k++) s += curv[(i + k + N) % N]; if (s < bestS) { bestS = s; best = i; } }
    pts = pts.slice(best).concat(pts.slice(0, best));
    curv = Float32Array.from(Array.from(curv.slice(best)).concat(Array.from(curv.slice(0, best))));
    const sm = new Float32Array(N);
    for (let i = 0; i < N; i++) { let s = 0; for (let k = -4; k <= 4; k++) s += curv[(i + k + N) % N]; sm[i] = s / 9; }
    const tan = [], nrm = [];
    for (let i = 0; i < N; i++) { const t = tang(pts, i); tan.push(t); nrm.push({ x: -t.y, y: t.x }); }
    // целевая скорость для ИИ
    const mu = tr.theme.mu;
    const vt = new Float32Array(N);
    for (let i = 0; i < N; i++) vt[i] = Math.min(95, Math.sqrt(mu * 1.05 * G / Math.max(sm[i], 1e-4)));
    for (let pass = 0; pass < 2; pass++) for (let i = N - 1; i >= 0; i--) { const nx = vt[(i + 1) % N]; vt[i] = Math.min(vt[i], Math.sqrt(nx * nx + 2 * 7.5 * mu * STEP)); }
    // пути
    const path = new Path2D(), left = new Path2D(), right = new Path2D(), eL = new Path2D(), eR = new Path2D();
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    for (let i = 0; i <= N; i++) {
      const p = pts[i % N], q = nrm[i % N], f = i === 0 ? 'moveTo' : 'lineTo';
      path[f](p.x, p.y); left[f](p.x + q.x * wall, p.y + q.y * wall); right[f](p.x - q.x * wall, p.y - q.y * wall);
      eL[f](p.x + q.x * (hw - 0.45), p.y + q.y * (hw - 0.45)); eR[f](p.x - q.x * (hw - 0.45), p.y - q.y * (hw - 0.45));
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
    }
    path.closePath();
    Object.assign(tr, { pts, N, tan, nrm, curv: sm, vt, hw, wall, runoff: m.runoff, path, left, right, eL, eR, len: N * STEP, bounds: { minX: minX - wall, minY: minY - wall, maxX: maxX + wall, maxY: maxY + wall } });
  }

  function buildArena(tr, m) {
    const r = U.rng(m.seed), w = m.w, h = m.h;
    const obst = [], cones = [];
    const free = (x, y, d) => obst.every(o => Math.hypot(o.x - x, o.y - y) > d + o.r) && Math.hypot(x + w / 2 - 22, y) > 25;
    const types = ['pillar', 'tires', 'block'];
    const n = 5 + Math.floor(r() * 6);
    for (let i = 0; i < n * 4 && obst.length < n; i++) {
      const x = (r() - 0.5) * (w - 50), y = (r() - 0.5) * (h - 50);
      if (free(x, y, 28)) obst.push({ x, y, r: 1.3 + r() * 1.6, t: types[Math.floor(r() * 3)] });
    }
    // слалом из конусов
    for (let row = 0; row < 2; row++) {
      const y = (row ? 1 : -1) * h * (0.2 + r() * 0.15), x0 = -w * 0.3 + r() * 20;
      for (let i = 0; i < 7; i++) { const x = x0 + i * 13; if (free(x, y, 4)) cones.push({ x, y }); }
    }
    // круги из конусов вокруг столбов (точки касания)
    obst.slice(0, 3).forEach(o => { for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; cones.push({ x: o.x + Math.cos(a) * (o.r + 7), y: o.y + Math.sin(a) * (o.r + 7) }); } });
    // разметка парковки
    const lines = [];
    for (let k = 0; k < 3; k++) { const y = -h / 2 + 12 + k * (h - 24) / 2; for (let x = -w / 2 + 10; x < w / 2 - 10; x += 3.2) lines.push([x, y - 2.6, x, y + 2.6]); }
    Object.assign(tr, { w, h, obst, cones, lines, hw: 0, wall: 0, spawn: { x: -w / 2 + 22, y: 0, h: 0 }, bounds: { minX: -w / 2, minY: -h / 2, maxX: w / 2, maxY: h / 2 } });
  }

  // ---------- декорации ----------
  function genDecos(tr) {
    const th = tr.theme, r = U.rng((tr.m.seed ^ 0x9e3779b9) >>> 0), decos = [], lamps = [];
    const kind = th.deco;
    const far = tr.kind === 'circuit' ? tr.wall + 3 : 0;
    const coarse = tr.kind === 'circuit' ? tr.pts.filter((_, i) => i % 5 === 0) : null;
    const clear = (x, y, rad) => {
      if (tr.kind === 'arena') return Math.abs(x) > tr.w / 2 + rad + 2 || Math.abs(y) > tr.h / 2 + rad + 2;
      for (const p of coarse) { const dx = p.x - x, dy = p.y - y; if (dx * dx + dy * dy < (far + rad) * (far + rad)) return false; }
      return true;
    };
    const pick = () => {
      const q = r();
      switch (kind) {
        case 'city': return q < 0.55 ? 'bld' : q < 0.8 ? 'tree' : 'lamp';
        case 'nightcity': return q < 0.5 ? 'bld' : q < 0.65 ? 'tree' : 'lamp';
        case 'forest': return q < 0.75 ? 'tree' : 'bush';
        case 'snow': return q < 0.75 ? 'pine' : 'rock';
        case 'desert': return q < 0.5 ? 'cactus' : 'rock';
        case 'neon': return q < 0.6 ? 'nbld' : 'lamp';
        case 'port': return q < 0.65 ? 'cont' : q < 0.85 ? 'lamp' : 'tires';
        case 'mountain': return q < 0.6 ? 'pine' : 'rock';
        case 'track': return q < 0.25 ? 'stand' : q < 0.55 ? 'tires' : 'tree';
      }
      return 'tree';
    };
    const make = (t, x, y, a) => {
      const d = { t, x, y, a: a || 0, r: 2 };
      switch (t) {
        case 'bld': case 'nbld': d.w = 10 + r() * 18; d.h = 10 + r() * 18; d.r = Math.hypot(d.w, d.h) / 2; d.c = ['#6b717a', '#7d838c', '#5c6169', '#8a8f96', '#4f545b'][Math.floor(r() * 5)]; d.n = ['#ff2bd6', '#1fe3ff', '#7b5cff', '#3dff7a'][Math.floor(r() * 4)]; break;
        case 'tree': d.r = 2 + r() * 2.8; d.c = ['#2f5d2a', '#3b6e33', '#28502a', '#46803a'][Math.floor(r() * 4)]; break;
        case 'bush': d.r = 1 + r() * 1.2; d.c = '#3d6b30'; break;
        case 'pine': d.r = 2 + r() * 2.2; break;
        case 'rock': d.r = 1.2 + r() * 2.6; d.s = Math.floor(r() * 1000); break;
        case 'cactus': d.r = 0.8 + r() * 0.6; break;
        case 'lamp': d.r = 0.4; break;
        case 'cont': d.w = 12; d.h = 2.5; d.r = 6.3; d.c = ['#c0392b', '#2471a3', '#d68910', '#1e8449', '#7d3c98', '#5d6d7e'][Math.floor(r() * 6)]; d.stack = r() < 0.4; break;
        case 'stand': d.w = 30 + r() * 20; d.h = 9; d.r = d.w / 2; break;
        case 'tires': d.r = 1.4; break;
      }
      return d;
    };
    const tryAdd = (t, x, y, a) => { const d = make(t, x, y, a); if (clear(x, y, d.r)) { decos.push(d); if (t === 'lamp') lamps.push(d); return true; } return false; };
    if (tr.kind === 'circuit') {
      for (let i = 0; i < tr.N; i += 2) {
        for (const s of [-1, 1]) {
          if (r() > 0.42) continue;
          const t = pick(); const p = tr.pts[i], q = tr.nrm[i];
          let dist = tr.wall + 3 + (t === 'lamp' ? 0.5 : t === 'stand' ? 6 : r() * 40);
          if (t === 'tires') dist = tr.wall + 1.2;
          const ang = Math.atan2(tr.tan[i].y, tr.tan[i].x);
          tryAdd(t, p.x + q.x * dist * s, p.y + q.y * dist * s, (t === 'cont' || t === 'stand' || t === 'bld' || t === 'nbld') ? ang : r() * 6.28);
        }
      }
      // заполнение внутренней части
      const b = tr.bounds;
      for (let i = 0; i < 260; i++) { const x = U.lerp(b.minX, b.maxX, r()), y = U.lerp(b.minY, b.maxY, r()); const t = pick(); if (t !== 'lamp' && t !== 'stand' && t !== 'tires') tryAdd(t, x, y, r() * 6.28); }
    } else {
      const { w, h } = tr;
      for (let i = 0; i < 360; i++) { const x = (r() - 0.5) * (w + 160), y = (r() - 0.5) * (h + 160); const t = pick(); tryAdd(t === 'stand' ? 'tree' : t, x, y, r() < 0.5 ? 0 : Math.PI / 2); }
      for (let x = -w / 2; x <= w / 2; x += 40) { lamps.push({ t: 'lamp', x, y: -h / 2 - 2, r: 0.4 }); lamps.push({ t: 'lamp', x, y: h / 2 + 2, r: 0.4 }); decos.push(lamps[lamps.length - 1], lamps[lamps.length - 2]); }
    }
    // сортировка: низкие объекты раньше
    const order = { tires: 0, rock: 1, bush: 2, cactus: 3, lamp: 4, cont: 5, stand: 6, bld: 7, nbld: 7, tree: 8, pine: 8 };
    decos.sort((a, b) => (order[a.t] || 0) - (order[b.t] || 0));
    tr.decos = decos; tr.lamps = lamps;
  }

  // ---------- текстура земли ----------
  function groundPattern(ctx, th) {
    let c = patCache[th.id];
    if (!c) {
      c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const r = U.rng(U.hash(th.id));
      g.fillStyle = th.ground; g.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 26; i++) { g.fillStyle = U.rgba(th.g2, 0.5); g.beginPath(); g.ellipse(r() * 128, r() * 128, 6 + r() * 18, 4 + r() * 12, r() * 3, 0, 7); g.fill(); }
      for (let i = 0; i < 700; i++) { g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.05)'; g.fillRect(r() * 128, r() * 128, 1 + r() * 1.5, 1 + r() * 1.5); }
      patCache[th.id] = c;
    }
    const p = ctx.createPattern(c, 'repeat');
    try { p.setTransform(new DOMMatrix().scale(0.25)); } catch (e) { }
    return p;
  }
  let asphaltC = null;
  function asphaltPattern(ctx) {
    if (!asphaltC) {
      asphaltC = document.createElement('canvas'); asphaltC.width = asphaltC.height = 64; const g = asphaltC.getContext('2d'); const r = U.rng(7);
      for (let i = 0; i < 500; i++) { g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,.09)' : 'rgba(255,255,255,.05)'; g.fillRect(r() * 64, r() * 64, 1, 1); }
    }
    const p = ctx.createPattern(asphaltC, 'repeat'); try { p.setTransform(new DOMMatrix().scale(0.1)); } catch (e) { } return p;
  }

  // ---------- отрисовка ----------
  function drawGround(ctx, tr, v) {
    ctx.fillStyle = groundPattern(ctx, tr.theme);
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
  }
  function draw(ctx, tr, v, race) {
    const th = tr.theme;
    if (tr.kind === 'arena') {
      ctx.fillStyle = th.wall; ctx.fillRect(-tr.w / 2 - 1.6, -tr.h / 2 - 1.6, tr.w + 3.2, tr.h + 3.2);
      ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = th.wallAlt; ctx.lineWidth = 1.2; ctx.strokeRect(-tr.w / 2 - 0.8, -tr.h / 2 - 0.8, tr.w + 1.6, tr.h + 1.6); ctx.restore();
      ctx.fillStyle = th.road; ctx.fillRect(-tr.w / 2, -tr.h / 2, tr.w, tr.h);
      ctx.fillStyle = asphaltPattern(ctx); ctx.fillRect(-tr.w / 2, -tr.h / 2, tr.w, tr.h);
      ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 0.14; ctx.beginPath();
      for (const l of tr.lines) { ctx.moveTo(l[0], l[1]); ctx.lineTo(l[2], l[3]); } ctx.stroke();
      ctx.strokeStyle = U.rgba(th.curb[1], 0.35); ctx.lineWidth = 0.3; ctx.setLineDash([2, 2]);
      for (const o of tr.obst.slice(0, 3)) { ctx.beginPath(); ctx.arc(o.x, o.y, o.r + 7, 0, 7); ctx.stroke(); }
      ctx.setLineDash([]);
      return;
    }
    ctx.lineJoin = 'round'; ctx.lineCap = 'butt';
    // ограждения
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.stroke(tr.left); ctx.stroke(tr.right);
    ctx.lineWidth = 1.0; ctx.strokeStyle = th.wall; ctx.stroke(tr.left); ctx.stroke(tr.right);
    ctx.setLineDash([0.8, 7]); ctx.strokeStyle = th.wallAlt; ctx.stroke(tr.left); ctx.stroke(tr.right); ctx.setLineDash([]);
    // поребрики
    ctx.lineWidth = tr.hw * 2 + 1.8; ctx.strokeStyle = th.curb[0]; ctx.stroke(tr.path);
    ctx.setLineDash([2.2, 2.2]); ctx.strokeStyle = th.curb[1]; ctx.stroke(tr.path); ctx.setLineDash([]);
    // асфальт
    ctx.lineWidth = tr.hw * 2; ctx.strokeStyle = th.road; ctx.stroke(tr.path);
    ctx.strokeStyle = asphaltPattern(ctx); ctx.stroke(tr.path);
    // разметка
    ctx.lineWidth = 0.16; ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.stroke(tr.eL); ctx.stroke(tr.eR);
    if (race) { ctx.setLineDash([4, 7]); ctx.lineWidth = 0.22; ctx.strokeStyle = th.line; ctx.stroke(tr.path); ctx.setLineDash([]); }
    // старт/финиш
    const p = tr.pts[0], t = tr.tan[0];
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(t.y, t.x));
    const sq = 0.9, cnt = Math.ceil(tr.hw * 2 / sq);
    for (let i = 0; i < cnt; i++) for (let j = 0; j < 2; j++) { ctx.fillStyle = (i + j) % 2 ? '#111' : '#f4f4f4'; ctx.fillRect(-sq + j * sq, -tr.hw + i * sq, sq, Math.min(sq, tr.hw * 2 - i * sq)); }
    ctx.restore();
  }
  function drawObstacles(ctx, tr) {
    if (!tr.obst) return;
    for (const o of tr.obst) {
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.arc(o.x + 0.4, o.y + 0.5, o.r, 0, 7); ctx.fill();
      if (o.t === 'tires') { for (let k = 0; k < 3; k++) { ctx.fillStyle = k % 2 ? '#2a2a2a' : '#151515'; ctx.beginPath(); ctx.arc(o.x, o.y, o.r * (1 - k * 0.28), 0, 7); ctx.fill(); } ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 0.2; ctx.beginPath(); ctx.arc(o.x, o.y, o.r * 0.8, 0, 7); ctx.stroke(); }
      else if (o.t === 'block') { ctx.fillStyle = '#9da3a8'; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, 7); ctx.fill(); ctx.fillStyle = '#b7bcc0'; ctx.beginPath(); ctx.arc(o.x - o.r * 0.2, o.y - o.r * 0.2, o.r * 0.6, 0, 7); ctx.fill(); }
      else { ctx.fillStyle = '#6f757b'; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, 7); ctx.fill(); ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 0.3; ctx.setLineDash([0.6, 0.6]); ctx.beginPath(); ctx.arc(o.x, o.y, o.r - 0.15, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
    }
  }
  function drawDecos(ctx, tr, v, t) {
    const th = tr.theme, night = th.night;
    for (const d of tr.decos) {
      if (d.x + d.r < v.x0 || d.x - d.r > v.x1 || d.y + d.r < v.y0 || d.y - d.r > v.y1) continue;
      switch (d.t) {
        case 'tree':
          ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.arc(d.x + d.r * 0.3, d.y + d.r * 0.35, d.r, 0, 7); ctx.fill();
          ctx.fillStyle = night ? U.shade(d.c, -0.45) : d.c; ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 7); ctx.fill();
          ctx.fillStyle = night ? U.shade(d.c, -0.3) : U.shade(d.c, 0.15); ctx.beginPath(); ctx.arc(d.x - d.r * 0.25, d.y - d.r * 0.25, d.r * 0.6, 0, 7); ctx.fill();
          break;
        case 'bush': ctx.fillStyle = U.shade(d.c, night ? -0.4 : 0); ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 7); ctx.arc(d.x + d.r * 0.7, d.y + 0.3, d.r * 0.7, 0, 7); ctx.fill(); break;
        case 'pine': {
          ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.arc(d.x + d.r * 0.3, d.y + d.r * 0.3, d.r, 0, 7); ctx.fill();
          const snow = th.id === 'snow';
          for (let k = 0; k < 3; k++) { const rr = d.r * (1 - k * 0.3); ctx.fillStyle = k === 2 && snow ? '#ffffff' : (snow ? ['#2d4a3a', '#3b5c48', '#e8f0f6'][k] : ['#24452a', '#2f5734', '#3c6b40'][k]); ctx.beginPath(); for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, q = i % 2 ? rr * 0.7 : rr; ctx.lineTo(d.x + Math.cos(a) * q, d.y + Math.sin(a) * q); } ctx.closePath(); ctx.fill(); }
          break;
        }
        case 'rock': {
          const rr = U.rng(d.s); ctx.fillStyle = th.id === 'desert' ? '#a88b5e' : th.id === 'snow' ? '#c5ced8' : '#7c7f78';
          ctx.beginPath(); for (let i = 0; i < 7; i++) { const a = i / 7 * 6.283, q = d.r * (0.7 + rr() * 0.3); ctx.lineTo(d.x + Math.cos(a) * q, d.y + Math.sin(a) * q); } ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.arc(d.x - d.r * 0.25, d.y - d.r * 0.25, d.r * 0.4, 0, 7); ctx.fill(); break;
        }
        case 'cactus': ctx.fillStyle = '#4c7a3a'; ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 7); ctx.fill(); ctx.fillRect(d.x - d.r * 2, d.y - 0.2, d.r * 4, 0.4); ctx.fillStyle = '#5f9147'; ctx.beginPath(); ctx.arc(d.x - 0.15, d.y - 0.15, d.r * 0.5, 0, 7); ctx.fill(); break;
        case 'lamp': ctx.fillStyle = '#2a2d33'; ctx.beginPath(); ctx.arc(d.x, d.y, 0.35, 0, 7); ctx.fill(); ctx.fillStyle = th.id === 'neon' ? '#ff2bd6' : '#ffe9a8'; ctx.beginPath(); ctx.arc(d.x, d.y, 0.2, 0, 7); ctx.fill(); break;
        case 'bld': case 'nbld':
          ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.a);
          ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(-d.w / 2 + 2, -d.h / 2 + 2.5, d.w, d.h);
          ctx.fillStyle = d.t === 'nbld' ? '#1b1930' : (night ? U.shade(d.c, -0.55) : d.c); ctx.fillRect(-d.w / 2, -d.h / 2, d.w, d.h);
          ctx.fillStyle = d.t === 'nbld' ? '#23203d' : (night ? U.shade(d.c, -0.45) : U.shade(d.c, 0.12)); ctx.fillRect(-d.w / 2 + 1, -d.h / 2 + 1, d.w - 2, d.h - 2);
          ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(-2, -1.5, 3, 2.2); ctx.fillRect(d.w / 2 - 5, d.h / 2 - 4, 2.5, 2.5);
          if (d.t === 'nbld') { ctx.strokeStyle = d.n; ctx.lineWidth = 0.5; ctx.strokeRect(-d.w / 2 + 0.4, -d.h / 2 + 0.4, d.w - 0.8, d.h - 0.8); }
          ctx.restore(); break;
        case 'cont':
          ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.a);
          ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(-6 + 0.8, -1.25 + 0.9, 12, 2.5);
          ctx.fillStyle = night ? U.shade(d.c, -0.5) : d.c; ctx.fillRect(-6, -1.25, 12, 2.5);
          ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 0.12; for (let x = -5.5; x < 6; x += 0.7) { ctx.beginPath(); ctx.moveTo(x, -1.2); ctx.lineTo(x, 1.2); ctx.stroke(); }
          if (d.stack) { ctx.fillStyle = U.shade(d.c, 0.2); ctx.fillRect(-5.6, -1.05, 11.2, 2.1); }
          ctx.restore(); break;
        case 'stand':
          ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.a);
          ctx.fillStyle = '#5a6068'; ctx.fillRect(-d.w / 2, -d.h / 2, d.w, d.h);
          for (let k = 0; k < 6; k++) { ctx.fillStyle = k % 2 ? '#3d78c7' : '#d94a3c'; ctx.fillRect(-d.w / 2 + 0.5, -d.h / 2 + 0.6 + k * 1.3, d.w - 1, 0.7); }
          ctx.fillStyle = '#eee'; ctx.fillRect(-d.w / 2, -d.h / 2 - 0.6, d.w, 0.6);
          ctx.restore(); break;
        case 'tires': for (let k = 0; k < 3; k++) { ctx.fillStyle = '#141414'; ctx.beginPath(); ctx.arc(d.x + (k - 1) * 1.2, d.y, 0.6, 0, 7); ctx.fill(); ctx.strokeStyle = '#333'; ctx.lineWidth = 0.15; ctx.stroke(); } break;
      }
    }
  }

  // Ближайшая точка центральной линии (поиск в окне вокруг подсказки)
  function nearest(tr, x, y, hint, win) {
    const P = tr.pts, N = tr.N; let best = 1e18, bi = hint, bt = 0;
    if (win >= N / 2) { hint = 0; win = Math.ceil(N / 2); }
    for (let k = -win; k <= win; k++) {
      const i = ((hint + k) % N + N) % N, j = (i + 1) % N;
      const ax = P[i].x, ay = P[i].y, dx = P[j].x - ax, dy = P[j].y - ay, l2 = dx * dx + dy * dy || 1;
      let t = ((x - ax) * dx + (y - ay) * dy) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const px = ax + dx * t - x, py = ay + dy * t - y, d = px * px + py * py;
      if (d < best) { best = d; bi = i; bt = t; }
    }
    const j = (bi + 1) % N; const px = P[bi].x + (P[j].x - P[bi].x) * bt, py = P[bi].y + (P[j].y - P[bi].y) * bt;
    const d = Math.sqrt(best) || 1e-6;
    return { seg: bi, t: bt, d, px, py, nx: (x - px) / d, ny: (y - py) / d };
  }

  // Мини-карта / превью
  function renderShape(c, tr, pad, opts) {
    const g = c.getContext('2d'), W = c.width, H = c.height, b = tr.bounds, th = tr.theme;
    const sc = Math.min((W - pad * 2) / (b.maxX - b.minX), (H - pad * 2) / (b.maxY - b.minY));
    const ox = W / 2 - (b.minX + b.maxX) / 2 * sc, oy = H / 2 - (b.minY + b.maxY) / 2 * sc;
    g.save(); g.translate(ox, oy); g.scale(sc, sc);
    if (tr.kind === 'arena') {
      g.fillStyle = opts.bg ? th.road : 'rgba(255,255,255,.75)'; g.fillRect(-tr.w / 2, -tr.h / 2, tr.w, tr.h);
      g.fillStyle = opts.bg ? '#e74c3c' : 'rgba(0,0,0,.5)'; for (const o of tr.obst) { g.beginPath(); g.arc(o.x, o.y, Math.max(o.r, 3 / sc), 0, 7); g.fill(); }
    } else {
      g.lineJoin = 'round';
      if (opts.bg) { g.strokeStyle = th.curb[1]; g.lineWidth = tr.hw * 2 + 2 / sc * 2; g.stroke(tr.path); }
      g.strokeStyle = opts.bg ? th.road : 'rgba(255,255,255,.8)'; g.lineWidth = Math.max(tr.hw * 2, (opts.lw || 3) / sc); g.stroke(tr.path);
      const p = tr.pts[0]; g.fillStyle = '#fff'; g.beginPath(); g.arc(p.x, p.y, 4 / sc, 0, 7); g.fill();
    }
    g.restore();
    return { sc, ox, oy };
  }
  function preview(c, m) {
    const tr = build(m), g = c.getContext('2d'), th = tr.theme;
    g.fillStyle = th.ground; g.fillRect(0, 0, c.width, c.height);
    const r = U.rng(m.seed); for (let i = 0; i < 30; i++) { g.fillStyle = U.rgba(th.g2, 0.6); g.beginPath(); g.arc(r() * c.width, r() * c.height, 4 + r() * 14, 0, 7); g.fill(); }
    if (th.night) { g.fillStyle = 'rgba(0,0,20,.35)'; g.fillRect(0, 0, c.width, c.height); }
    renderShape(c, tr, 14, { bg: true, lw: 5 });
  }
  function minimap(tr, size) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const t = renderShape(c, tr, size * 0.14, { bg: false, lw: 3 });
    return Object.assign({ c }, t);
  }

  return { build, nearest, draw, drawGround, drawObstacles, drawDecos, preview, minimap, STEP };
})();
