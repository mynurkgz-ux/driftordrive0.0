'use strict';
// Процедурная отрисовка машин. Система координат машины: x — вперёд, y — вправо, единицы — метры.
const CARR = (() => {
  const spriteCache = new Map();
  let carbonCanvas = null;
  const DARK = '#15171c';

  function carbon(ctx, alpha) {
    if (!carbonCanvas) {
      carbonCanvas = document.createElement('canvas'); carbonCanvas.width = carbonCanvas.height = 8;
      const g = carbonCanvas.getContext('2d');
      g.fillStyle = '#17181b'; g.fillRect(0, 0, 8, 8);
      g.fillStyle = '#2b2d33'; g.fillRect(0, 0, 4, 2); g.fillRect(4, 4, 4, 2); g.fillRect(0, 6, 2, 2);
      g.fillStyle = '#222428'; g.fillRect(4, 0, 2, 4); g.fillRect(0, 4, 2, 4); g.fillRect(6, 2, 2, 2);
    }
    const p = ctx.createPattern(carbonCanvas, 'repeat');
    try { p.setTransform(new DOMMatrix().scale(0.022)); } catch (e) { }
    return p;
  }

  function geom(look) {
    const def = DATA.CAR[look.car] || DATA.CAR[DATA.STARTER];
    const T = DATA.TYPES[def.type]; const L = T.L * def.lmul, W = T.W * def.wmul, sh = T.shape;
    const hl = L / 2, hw = W / 2;
    return {
      def, T, L, W, hl, hw, type: def.type, cf: sh[0] * L, ws: sh[1] * L, re: sh[2] * L, rw: sh[3] * L, cw: sh[4], nose: sh[5], tail: sh[6],
      xF: hl * 0.64, xR: -hl * 0.6, fl: (look.kit && look.kit.fender) || 0
    };
  }

  function bodyPath(g) {
    const { hl, hw } = g; const rn = hw * g.nose * 1.6, rt = hw * g.tail * 1.4;
    const p = new Path2D();
    p.moveTo(-hl + rt, -hw);
    p.lineTo(hl - rn, -hw * 0.985);
    p.quadraticCurveTo(hl, -hw * 0.96, hl, -hw + rn * 0.8);
    p.quadraticCurveTo(hl + 0.06, 0, hl, hw - rn * 0.8);
    p.quadraticCurveTo(hl, hw * 0.96, hl - rn, hw * 0.985);
    p.lineTo(-hl + rt, hw);
    p.quadraticCurveTo(-hl, hw, -hl, hw - rt);
    p.lineTo(-hl, -hw + rt);
    p.quadraticCurveTo(-hl, -hw, -hl + rt, -hw);
    p.closePath();
    return p;
  }

  function paintFill(ctx, g, p) {
    const c = p.body || '#d33', f = p.finish || 'gloss';
    if (f === 'matte') return U.shade(c, -0.08);
    const gr = ctx.createLinearGradient(0, -g.hw, 0, g.hw);
    if (f === 'chrome') { gr.addColorStop(0, U.shade(c, 0.55)); gr.addColorStop(0.25, U.shade(c, -0.35)); gr.addColorStop(0.5, U.shade(c, 0.7)); gr.addColorStop(0.75, U.shade(c, -0.4)); gr.addColorStop(1, U.shade(c, 0.35)); }
    else if (f === 'metal') { gr.addColorStop(0, U.shade(c, -0.3)); gr.addColorStop(0.35, U.shade(c, 0.18)); gr.addColorStop(0.5, U.shade(c, 0.34)); gr.addColorStop(0.65, U.shade(c, 0.15)); gr.addColorStop(1, U.shade(c, -0.32)); }
    else if (f === 'pearl') { gr.addColorStop(0, U.hue(c, -35)); gr.addColorStop(0.5, U.shade(c, 0.22)); gr.addColorStop(1, U.hue(c, 35)); }
    else { gr.addColorStop(0, U.shade(c, -0.2)); gr.addColorStop(0.5, U.shade(c, 0.1)); gr.addColorStop(1, U.shade(c, -0.22)); }
    return gr;
  }

  function star(ctx, x, y, r) { ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); }

  // ---------- винилы ----------
  function drawVinyl(ctx, g, p) {
    const v = p.vinyl | 0; if (!v) return;
    const c1 = p.v1 || '#fff', c2 = p.v2 || '#111'; const { hl, hw, L, W } = g; const r = U.rng(v * 977 + 13);
    ctx.save();
    switch (v) {
      case 1: ctx.fillStyle = c1; ctx.fillRect(-hl, -0.34, L, 0.2); ctx.fillRect(-hl, 0.14, L, 0.2); ctx.fillStyle = c2; ctx.fillRect(-hl, -0.38, L, 0.04); ctx.fillRect(-hl, 0.34, L, 0.04); break;
      case 2: ctx.fillStyle = c1; ctx.fillRect(-hl * 0.85, -hw + 0.06, L * 0.86, 0.12); ctx.fillRect(-hl * 0.85, hw - 0.18, L * 0.86, 0.12); ctx.fillStyle = c2; ctx.fillRect(-hl * 0.85, -hw + 0.2, L * 0.86, 0.04); ctx.fillRect(-hl * 0.85, hw - 0.24, L * 0.86, 0.04); break;
      case 3: ctx.fillStyle = c1;[-0.2, -0.08, 0.04, 0.16].forEach((y, i) => { ctx.fillStyle = i % 2 ? c2 : c1; ctx.fillRect(-hl, y, L, 0.06); }); break;
      case 4: for (const s of [-1, 1]) {
        const gr = ctx.createLinearGradient(hl, 0, -hl * 0.3, 0); gr.addColorStop(0, c1); gr.addColorStop(1, c2); ctx.fillStyle = gr;
        ctx.beginPath(); ctx.moveTo(hl + 0.1, s * hw * 0.05);
        for (let i = 0; i < 6; i++) {
          const y0 = s * hw * (0.08 + i * 0.16), y1 = s * hw * (0.16 + i * 0.16), tip = hl - 0.9 - r() * 1.7 - i * 0.12;
          ctx.quadraticCurveTo(hl - 0.4, y0, tip, y1); ctx.quadraticCurveTo(hl - 0.5, y1 + s * 0.04, hl - 0.15, s * hw * (0.22 + i * 0.16));
        }
        ctx.lineTo(hl + 0.1, s * hw * 1.1); ctx.closePath(); ctx.fill();
      } break;
      case 5: { const sz = 0.28; for (let x = -hl; x < hl; x += sz) for (let y = -hw; y < hw; y += sz) { if ((Math.round((x + hl) / sz) + Math.round((y + hw) / sz)) % 2) { ctx.fillStyle = c1; } else ctx.fillStyle = c2; ctx.fillRect(x, y, sz + 0.005, sz + 0.005); } break; }
      case 6: for (let i = 0; i < 46; i++) { ctx.fillStyle = [c1, c2, U.shade(p.body || '#555', -0.35)][i % 3]; ctx.beginPath(); ctx.ellipse(-hl + r() * L, -hw + r() * W, 0.18 + r() * 0.35, 0.12 + r() * 0.22, r() * 3, 0, 7); ctx.fill(); } break;
      case 7: ctx.strokeStyle = c2; ctx.lineWidth = 0.13; for (let x = -hl + 0.2; x < hl; x += 0.36) { ctx.beginPath(); ctx.moveTo(x, -hw); for (let y = -hw; y <= hw; y += 0.2) ctx.lineTo(x + Math.sin(y * 3 + x) * 0.12, y); ctx.stroke(); } break;
      case 8: ctx.fillStyle = c2; for (let i = 0; i < 12; i++) { const x = -hl + 0.2 + i * L / 12; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x - 0.1, s * hw); ctx.lineTo(x + 0.12, s * hw); ctx.lineTo(x + r() * 0.35, s * (hw - 0.35 - r() * 0.4)); ctx.closePath(); ctx.fill(); } } break;
      case 9: for (const s of [-1, 1]) { ctx.strokeStyle = c2; ctx.lineWidth = 0.16; ctx.beginPath(); let y = s * 0.45; ctx.moveTo(-hl, y); for (let x = -hl; x < hl; x += 0.4) { y = s * (0.3 + r() * 0.35); ctx.lineTo(x, y); } ctx.stroke(); ctx.strokeStyle = c1; ctx.lineWidth = 0.08; ctx.stroke(); } break;
      case 10: ctx.fillStyle = c1; for (let i = 0; i < 16; i++) star(ctx, -hl + r() * L, -hw + r() * W, 0.1 + r() * 0.16); break;
      case 11: ctx.fillStyle = c1; for (let x = -hl + 0.2; x < hl; x += 0.42) for (let y = -hw + 0.2, k = 0; y < hw; y += 0.42, k++) { ctx.beginPath(); ctx.arc(x + (k % 2) * 0.21, y, 0.1, 0, 7); ctx.fill(); } break;
      case 12: { ctx.strokeStyle = U.rgba(c1, 0.75); ctx.lineWidth = 0.03; const s = 0.17; for (let x = -hl, i = 0; x < hl + s; x += s * 1.5, i++) for (let y = -hw; y < hw + s; y += s * 1.732) { const yy = y + (i % 2) * s * 0.866; ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; ctx.lineTo(x + Math.cos(a) * s, yy + Math.sin(a) * s); } ctx.closePath(); ctx.stroke(); } break; }
      case 13: { const gr = ctx.createLinearGradient(hl, 0, -hl, 0); gr.addColorStop(0, U.rgba(c1, 0)); gr.addColorStop(0.45, U.rgba(c1, 0.3)); gr.addColorStop(1, U.rgba(c2, 0.95)); ctx.fillStyle = gr; ctx.fillRect(-hl, -hw, L, W); break; }
      case 14: ctx.globalAlpha = 0.92; ctx.fillStyle = carbon(ctx); ctx.fillRect(-hl, -hw, L, W); break;
      case 15: ctx.fillStyle = c1; ctx.beginPath(); ctx.arc(g.cf + (hl - g.cf) * 0.45, 0, 0.36, 0, 7); ctx.fill(); ctx.save(); ctx.translate(g.cf + (hl - g.cf) * 0.45, 0); ctx.rotate(Math.PI / 2); ctx.scale(0.02, 0.02); ctx.fillStyle = c2; ctx.font = 'bold 28px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(7 + (U.hash(p.body || '') % 92)), 0, 1); ctx.restore(); break;
      case 16: ctx.fillStyle = U.rgba(c1, 0.85); for (let i = 0; i < 14; i += 2) { const a0 = -Math.PI / 2 + i * Math.PI / 13, a1 = a0 + Math.PI / 13; ctx.beginPath(); ctx.moveTo(-hl, 0); ctx.lineTo(-hl + Math.cos(a0 + Math.PI / 2) * 6, Math.sin(a0 + Math.PI / 2) * 6); ctx.lineTo(-hl + Math.cos(a1 + Math.PI / 2) * 6, Math.sin(a1 + Math.PI / 2) * 6); ctx.closePath(); ctx.fill(); } ctx.fillStyle = c2; ctx.beginPath(); ctx.arc(-hl, 0, 0.45, 0, 7); ctx.fill(); break;
      case 17: [[c1, 0.3], [c2, 0], [c1, -0.3]].forEach(([c, o], i) => { ctx.strokeStyle = c; ctx.lineWidth = 0.12; ctx.beginPath(); for (let x = -hl; x <= hl; x += 0.1) ctx.lineTo(x, o + Math.sin(x * 2.5 + i) * 0.18); ctx.stroke(); }); break;
      case 18: ctx.fillStyle = c2; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(hl * 0.7, 0); ctx.quadraticCurveTo(0, s * 0.1, -hl * 0.6, s * hw * 0.9); ctx.quadraticCurveTo(-hl * 0.1, s * 0.35, hl * 0.2, s * hw * 0.75); ctx.quadraticCurveTo(0.2, s * 0.25, hl * 0.7, 0); ctx.fill(); } break;
      case 19: { const s = 0.2; for (let x = -hl; x < hl; x += s) for (let y = -hw; y < hw; y += s) { const k = (hl - x) / L; if (r() < k * 0.75) { ctx.fillStyle = r() < 0.5 ? c1 : c2; ctx.fillRect(x, y, s * 0.92, s * 0.92); } } break; }
      case 20: for (let i = 0; i < 7; i++) { const cx = -hl + r() * L, cy = -hw + r() * W; ctx.fillStyle = i % 2 ? c1 : c2; for (let k = 0; k < 9; k++) { ctx.beginPath(); ctx.arc(cx + (r() - 0.5) * 0.8, cy + (r() - 0.5) * 0.8, 0.04 + r() * 0.16, 0, 7); ctx.fill(); } } break;
      case 21: ctx.fillStyle = c1; ctx.rotate(-0.7); for (let x = -5; x < 5; x += 0.55) ctx.fillRect(x, -5, 0.2, 10); break;
      case 22: for (let i = 0; i < 12; i++) { const cx = -hl + r() * L, cy = -hw + r() * W, s = 0.08 + r() * 0.08; ctx.fillStyle = i % 3 ? c1 : '#ffb7d0'; for (let k = 0; k < 5; k++) { const a = k * Math.PI * 2 / 5; ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * s, cy + Math.sin(a) * s, s * 0.9, s * 0.55, a, 0, 7); ctx.fill(); } ctx.fillStyle = c2; ctx.beginPath(); ctx.arc(cx, cy, s * 0.4, 0, 7); ctx.fill(); } break;
      case 23: ctx.globalAlpha = 0.45; ctx.fillStyle = c1; for (let x = -hl; x < hl; x += 0.5) ctx.fillRect(x, -hw, 0.18, W); ctx.fillStyle = c2; for (let y = -hw; y < hw; y += 0.5) ctx.fillRect(-hl, y, L, 0.18); break;
    }
    ctx.restore();
  }

  // ---------- капот ----------
  function drawHood(ctx, g, k, p) {
    const { hl, hw } = g, x0 = g.cf + 0.05, x1 = hl - 0.12, len = x1 - x0, mid = (x0 + x1) / 2;
    if (len < 0.25) return;
    switch (k.hood | 0) {
      case 0: ctx.strokeStyle = 'rgba(0,0,0,.16)'; ctx.lineWidth = 0.025; ctx.beginPath(); ctx.moveTo(x0, -hw * 0.38); ctx.lineTo(x1, -hw * 0.3); ctx.moveTo(x0, hw * 0.38); ctx.lineTo(x1, hw * 0.3); ctx.stroke(); break;
      case 1: ctx.fillStyle = DARK; U.rr(ctx, mid - len * 0.18, -0.18, len * 0.36, 0.36, 0.06); ctx.fill(); ctx.fillStyle = '#333'; ctx.fillRect(mid - len * 0.15, -0.12, 0.05, 0.24); break;
      case 2: ctx.fillStyle = carbon(ctx); ctx.beginPath(); ctx.moveTo(x0, -hw * 0.8); ctx.lineTo(hl, -hw * 0.75); ctx.lineTo(hl, hw * 0.75); ctx.lineTo(x0, hw * 0.8); ctx.closePath(); ctx.fill(); break;
      case 3: ctx.fillStyle = DARK; for (const s of [-1, 1]) for (let i = 0; i < 4; i++) ctx.fillRect(mid - len * 0.25 + i * 0.13, s * hw * 0.48 - 0.12, 0.06, 0.24); break;
      case 4: ctx.fillStyle = DARK; U.rr(ctx, x0 + 0.05, -0.28, Math.min(0.75, len * 0.6), 0.56, 0.08); ctx.fill(); ctx.fillStyle = '#aab0b8'; U.rr(ctx, x0 + 0.1, -0.22, Math.min(0.62, len * 0.5), 0.44, 0.06); ctx.fill(); ctx.fillStyle = '#222'; ctx.fillRect(x0 + 0.1 + Math.min(0.62, len * 0.5) - 0.08, -0.18, 0.06, 0.36); break;
      case 5: ctx.fillStyle = DARK; for (let i = 0; i < 6; i++) ctx.fillRect(mid - 0.3 + i * 0.1, -hw * 0.42, 0.04, hw * 0.84); break;
      case 6: ctx.fillStyle = carbon(ctx); ctx.fillRect(x0, -0.36, hl - x0, 0.2); ctx.fillRect(x0, 0.16, hl - x0, 0.2); break;
      case 7: { const gr = ctx.createRadialGradient(mid, 0, 0.05, mid, 0, len * 0.5); gr.addColorStop(0, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(mid, 0, len * 0.45, hw * 0.35, 0, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 0.025; ctx.stroke(); break; }
    }
  }

  // ---------- основной рисунок кузова (всё, кроме колёс) ----------
  function drawBody(ctx, look, o) {
    o = o || {};
    const g = geom(look), k = look.kit || {}, p = look.paint || {};
    const { hl, hw, L, W } = g; const body = p.body || '#d33';
    const bodyDark = U.shade(body, -0.3);

    // широкие пороги (выступают за кузов)
    if (k.skirt >= 3) {
      ctx.fillStyle = k.skirt === 4 ? DARK : bodyDark;
      for (const s of [-1, 1]) { U.rr(ctx, g.xR + 0.3, s > 0 ? hw - 0.12 : -hw - 0.07, g.xF - g.xR - 0.6, 0.19, 0.05); ctx.fill(); }
    }
    // расширители арок
    if (g.fl > 0) {
      const ext = [0, 0.05, 0.09, 0.14, 0.12][g.fl];
      ctx.fillStyle = paintFill(ctx, g, p); ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 0.03;
      for (const x of [g.xF, g.xR]) for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.ellipse(x, s * (hw - 0.06), 0.56, ext + 0.12, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        if (g.fl === 4) { ctx.fillStyle = '#ccc'; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.arc(x + i * 0.15, s * (hw + ext - 0.01 - Math.abs(i) * 0.012), 0.022, 0, 7); ctx.fill(); } ctx.fillStyle = paintFill(ctx, g, p); }
      }
    }

    const path = bodyPath(g);
    ctx.fillStyle = paintFill(ctx, g, p); ctx.fill(path);
    ctx.save(); ctx.clip(path);
    drawVinyl(ctx, g, p);
    drawHood(ctx, g, k, p);
    // боковое затенение для объёма
    const sg = ctx.createLinearGradient(0, -hw, 0, hw);
    sg.addColorStop(0, 'rgba(0,0,0,.32)'); sg.addColorStop(0.16, 'rgba(0,0,0,0)'); sg.addColorStop(0.84, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,0,.32)');
    ctx.fillStyle = sg; ctx.fillRect(-hl, -hw, L, W);
    // кузов пикапа
    if (g.type === 'pickup') { const bx = g.re - g.rw - 0.08; ctx.fillStyle = '#26282d'; U.rr(ctx, -hl + 0.14, -hw + 0.14, bx + hl - 0.14, W - 0.28, 0.05); ctx.fill(); ctx.strokeStyle = '#3a3d44'; ctx.lineWidth = 0.03; for (let x = -hl + 0.4; x < bx; x += 0.3) { ctx.beginPath(); ctx.moveTo(x, -hw + 0.18); ctx.lineTo(x, hw - 0.18); ctx.stroke(); } }
    ctx.restore();
    ctx.lineWidth = 0.035; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.stroke(path);

    // пороги обычные
    if (k.skirt === 1 || k.skirt === 2) { ctx.fillStyle = k.skirt === 2 ? carbon(ctx) : bodyDark; for (const s of [-1, 1]) ctx.fillRect(g.xR + 0.36, s > 0 ? hw - 0.09 : -hw, g.xF - g.xR - 0.72, 0.09); }

    // передний бампер
    switch (k.fbump | 0) {
      case 1: ctx.fillStyle = DARK; U.rr(ctx, hl - 0.06, -hw * 0.9, 0.16, hw * 1.8, 0.05); ctx.fill(); break;
      case 2: ctx.fillStyle = DARK; U.rr(ctx, hl - 0.06, -hw - 0.07, 0.2, W + 0.14, 0.06); ctx.fill(); for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(hl - 0.4, s * hw); ctx.lineTo(hl - 0.05, s * (hw + 0.12)); ctx.lineTo(hl, s * hw); ctx.fill(); } break;
      case 3: ctx.fillStyle = DARK; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(hl - 0.03, s * hw * 0.32); ctx.lineTo(hl - 0.03, s * hw * 0.82); ctx.lineTo(hl - 0.38, s * hw * 0.76); ctx.closePath(); ctx.fill(); } ctx.fillRect(hl - 0.08, -hw * 0.28, 0.07, hw * 0.56); break;
      case 4: ctx.fillStyle = DARK; for (const s of [-1, 1]) for (const dx of [0, 0.18]) { ctx.beginPath(); ctx.moveTo(hl - 0.42 + dx, s * (hw - 0.02)); ctx.lineTo(hl - 0.3 + dx, s * (hw + 0.13)); ctx.lineTo(hl - 0.22 + dx, s * (hw + 0.13)); ctx.lineTo(hl - 0.28 + dx, s * (hw - 0.02)); ctx.closePath(); ctx.fill(); } break;
      case 5: for (const y of [-0.6, -0.2, 0.2, 0.6]) { ctx.fillStyle = DARK; ctx.beginPath(); ctx.arc(hl - 0.22, y * hw, 0.11, 0, 7); ctx.fill(); ctx.fillStyle = o.lights ? '#fff8c8' : '#d9dccf'; ctx.beginPath(); ctx.arc(hl - 0.22, y * hw, 0.075, 0, 7); ctx.fill(); } break;
      case 6: ctx.strokeStyle = '#8b9098'; ctx.lineWidth = 0.06; ctx.beginPath(); ctx.moveTo(hl - 0.05, -hw * 0.75); ctx.lineTo(hl + 0.14, -hw * 0.6); ctx.lineTo(hl + 0.14, hw * 0.6); ctx.lineTo(hl - 0.05, hw * 0.75); ctx.moveTo(hl + 0.14, -hw * 0.25); ctx.lineTo(hl - 0.04, -hw * 0.25); ctx.moveTo(hl + 0.14, hw * 0.25); ctx.lineTo(hl - 0.04, hw * 0.25); ctx.stroke(); break;
      case 7: ctx.fillStyle = carbon(ctx); U.rr(ctx, hl - 0.04, -hw * 0.85, 0.12, hw * 1.7, 0.05); ctx.fill(); break;
    }
    // задний бампер / выхлоп
    const tip = (y, r) => { ctx.fillStyle = '#6d7178'; ctx.beginPath(); ctx.ellipse(-hl - 0.03, y, 0.07, r, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(-hl - 0.03, y, 0.04, r * 0.6, 0, 0, 7); ctx.fill(); };
    const rb = k.rbump | 0;
    if (rb === 1 || rb === 2) {
      const d = rb === 2 ? 0.16 : 0.08; ctx.fillStyle = DARK; U.rr(ctx, -hl - d, -hw * 0.72, d + 0.08, hw * 1.44, 0.04); ctx.fill();
      ctx.strokeStyle = '#33363d'; ctx.lineWidth = 0.025; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(-hl - d, i * hw * 0.2); ctx.lineTo(-hl + 0.06, i * hw * 0.2); ctx.stroke(); }
    }
    if (rb === 0) tip(hw * 0.55, 0.06); else if (rb === 1 || rb === 2 || rb === 3) { tip(-hw * 0.55, 0.07); tip(hw * 0.55, 0.07); }
    else if (rb === 4) { tip(-0.09, 0.07); tip(0.09, 0.07); } else if (rb === 5) { [-0.62, -0.44, 0.44, 0.62].forEach(f => tip(f * hw, 0.06)); }

    // салон / стёкла
    const rwH = W * g.cw / 2, baseH = Math.min(hw * 0.93, rwH + 0.15);
    const x0 = g.cf, x1 = g.cf - g.ws, x2 = g.re, x3 = g.re - g.rw;
    const glass = ctx.createLinearGradient(x0, 0, x3, 0);
    glass.addColorStop(0, '#2a3a4c'); glass.addColorStop(0.5, '#0d141c'); glass.addColorStop(1, '#22303f');
    ctx.fillStyle = glass;
    ctx.beginPath(); ctx.moveTo(x0, -baseH); ctx.quadraticCurveTo(x0 + 0.07, 0, x0, baseH); ctx.lineTo(x1, rwH); ctx.lineTo(x2, rwH); ctx.lineTo(x3, baseH); ctx.quadraticCurveTo(x3 - 0.05, 0, x3, -baseH); ctx.lineTo(x2, -rwH); ctx.lineTo(x1, -rwH); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 0.03; ctx.stroke();
    // блик на лобовом
    ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 0.04; ctx.beginPath(); ctx.moveTo(x0 - 0.06, -baseH * 0.6); ctx.lineTo(x1 + 0.06, -rwH * 0.2); ctx.stroke();
    // крыша
    const rf = k.roof | 0;
    if (x1 - x2 > 0.1) {
      ctx.fillStyle = rf === 1 ? carbon(ctx) : rf === 5 ? '#0f1720' : paintFill(ctx, g, p);
      U.rr(ctx, x2, -rwH + 0.04, x1 - x2, rwH * 2 - 0.08, 0.12); ctx.fill();
      if (rf === 0 || rf === 2 || rf === 3 || rf === 4) { ctx.save(); U.rr(ctx, x2, -rwH + 0.04, x1 - x2, rwH * 2 - 0.08, 0.12); ctx.clip(); drawVinyl(ctx, g, p); ctx.restore(); }
      ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 0.025; U.rr(ctx, x2, -rwH + 0.04, x1 - x2, rwH * 2 - 0.08, 0.12); ctx.stroke();
      const rm = (x1 + x2) / 2, rl = x1 - x2;
      if (rf === 2) { ctx.fillStyle = DARK; U.rr(ctx, x1 - 0.42, -0.16, 0.36, 0.32, 0.06); ctx.fill(); }
      if (rf === 3) { ctx.strokeStyle = '#9aa0a8'; ctx.lineWidth = 0.045; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x2 + 0.08, s * (rwH - 0.14)); ctx.lineTo(x1 - 0.08, s * (rwH - 0.14)); ctx.stroke(); } for (let x = x2 + 0.15; x < x1 - 0.1; x += 0.3) { ctx.beginPath(); ctx.moveTo(x, -rwH + 0.14); ctx.lineTo(x, rwH - 0.14); ctx.stroke(); } }
      if (rf === 4) { ctx.fillStyle = '#0f1720'; U.rr(ctx, rm - rl * 0.22, -rwH * 0.55, rl * 0.44, rwH * 1.1, 0.06); ctx.fill(); ctx.strokeStyle = '#555'; ctx.stroke(); }
      if (rf === 5) { ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.moveTo(x1 - 0.1, -rwH * 0.6); ctx.lineTo(x2 + 0.2, rwH * 0.2); ctx.stroke(); }
      // светлый блик крыши
      const hg = ctx.createLinearGradient(0, -rwH, 0, rwH); hg.addColorStop(0, 'rgba(255,255,255,0)'); hg.addColorStop(0.35, 'rgba(255,255,255,.12)'); hg.addColorStop(0.5, 'rgba(255,255,255,0)');
      ctx.fillStyle = hg; U.rr(ctx, x2, -rwH + 0.04, x1 - x2, rwH * 2 - 0.08, 0.12); ctx.fill();
    }

    // зеркала
    const mr = k.mirror | 0, mx = x0 - 0.08;
    for (const s of [-1, 1]) {
      if (mr === 0) { ctx.fillStyle = paintFill(ctx, g, p); ctx.beginPath(); ctx.ellipse(mx, s * (baseH + 0.13), 0.08, 0.1, 0, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 0.02; ctx.stroke(); }
      else if (mr === 1) { ctx.strokeStyle = DARK; ctx.lineWidth = 0.03; ctx.beginPath(); ctx.moveTo(mx + 0.25, s * baseH); ctx.lineTo(mx + 0.3, s * (baseH + 0.12)); ctx.stroke(); ctx.fillStyle = DARK; ctx.beginPath(); ctx.ellipse(mx + 0.3, s * (baseH + 0.14), 0.05, 0.08, 0, 0, 7); ctx.fill(); }
      else if (mr === 2) { ctx.fillStyle = carbon(ctx); ctx.beginPath(); ctx.ellipse(mx, s * (baseH + 0.13), 0.08, 0.11, 0, 0, 7); ctx.fill(); }
      else { ctx.fillStyle = paintFill(ctx, g, p); ctx.beginPath(); ctx.moveTo(mx + 0.12, s * baseH); ctx.quadraticCurveTo(mx + 0.08, s * (baseH + 0.2), mx - 0.08, s * (baseH + 0.16)); ctx.lineTo(mx - 0.02, s * baseH); ctx.closePath(); ctx.fill(); }
    }

    // фары
    const lc = p.light || '#fff6d5', hx = hl - 0.2, hy = hw * 0.62;
    const lens = (on) => { const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, 0.25); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, lc); gr.addColorStop(1, U.shade(lc, -0.3)); return on ? gr : U.shade(lc, -0.15); };
    for (const s of [-1, 1]) {
      ctx.save(); ctx.translate(hx, s * hy);
      switch (k.head | 0) {
        case 0: ctx.fillStyle = DARK; U.rr(ctx, -0.13, -0.23, 0.26, 0.46, 0.08); ctx.fill(); ctx.fillStyle = lens(o.lights); U.rr(ctx, -0.1, -0.19, 0.2, 0.38, 0.06); ctx.fill(); break;
        case 1: ctx.fillStyle = DARK; ctx.beginPath(); ctx.arc(0, 0, 0.16, 0, 7); ctx.fill(); ctx.fillStyle = lens(o.lights); ctx.beginPath(); ctx.arc(0, 0, 0.12, 0, 7); ctx.fill(); break;
        case 2: ctx.fillStyle = lens(o.lights); ctx.beginPath(); ctx.moveTo(0.1, -s * 0.28); ctx.lineTo(0.15, s * 0.22); ctx.lineTo(0.08, s * 0.24); ctx.lineTo(0.03, -s * 0.26); ctx.closePath(); ctx.fill(); break;
        case 3: ctx.fillStyle = DARK; ctx.beginPath(); ctx.moveTo(0.14, -s * 0.28); ctx.lineTo(0.14, s * 0.26); ctx.lineTo(-0.12, s * 0.18); ctx.lineTo(-0.02, -s * 0.24); ctx.closePath(); ctx.fill(); ctx.fillStyle = lens(o.lights); ctx.beginPath(); ctx.moveTo(0.11, -s * 0.22); ctx.lineTo(0.11, s * 0.2); ctx.lineTo(-0.06, s * 0.14); ctx.lineTo(0.0, -s * 0.18); ctx.closePath(); ctx.fill(); break;
        case 4: if (o.lights) { ctx.fillStyle = DARK; U.rr(ctx, -0.22, -0.22, 0.26, 0.44, 0.04); ctx.fill(); ctx.fillStyle = lens(true); U.rr(ctx, -0.04, -0.18, 0.08, 0.36, 0.03); ctx.fill(); } else { ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 0.025; U.rr(ctx, -0.22, -0.22, 0.3, 0.44, 0.04); ctx.stroke(); } break;
        case 5: break;
        case 6: for (const dy of [-0.11, 0.11]) { ctx.fillStyle = DARK; ctx.beginPath(); ctx.arc(0, dy, 0.1, 0, 7); ctx.fill(); ctx.fillStyle = lens(o.lights); ctx.beginPath(); ctx.arc(0, dy, 0.072, 0, 7); ctx.fill(); } break;
        case 7: ctx.fillStyle = DARK; ctx.fillRect(-0.13, -0.24, 0.26, 0.48); ctx.fillStyle = lens(o.lights); ctx.fillRect(-0.1, -0.21, 0.2, 0.19); ctx.fillRect(-0.1, 0.02, 0.2, 0.19); break;
      }
      ctx.restore();
    }
    if ((k.head | 0) === 5) { ctx.fillStyle = DARK; U.rr(ctx, hl - 0.13, -hw * 0.82, 0.1, hw * 1.64, 0.04); ctx.fill(); ctx.fillStyle = lens(o.lights); U.rr(ctx, hl - 0.11, -hw * 0.78, 0.05, hw * 1.56, 0.02); ctx.fill(); }
    // задние фонари
    for (const s of [-1, 1]) { ctx.fillStyle = o.brake ? '#ff2a3a' : '#9e0f1f'; U.rr(ctx, -hl + 0.02, s * hw * 0.62 - 0.22, 0.11, 0.44, 0.04); ctx.fill(); }

    // спойлер
    const sp = k.spoiler | 0;
    if (sp) {
      const wing = (x, chord, span, col, plate) => {
        ctx.fillStyle = 'rgba(0,0,0,.3)'; U.rr(ctx, x - 0.06, -span - 0.02, chord, span * 2 + 0.04, 0.04); ctx.fill();
        ctx.fillStyle = col; U.rr(ctx, x, -span, chord, span * 2, 0.04); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 0.025; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(x + chord * 0.55, -span + 0.03, chord * 0.18, span * 2 - 0.06);
        if (plate) { ctx.fillStyle = DARK; for (const s of [-1, 1]) U.rr(ctx, x - 0.06, s > 0 ? span - 0.03 : -span - 0.03, chord + plate, 0.06, 0.02), ctx.fill(); }
      };
      const bf = paintFill(ctx, g, p);
      switch (sp) {
        case 1: ctx.fillStyle = bodyDark; U.rr(ctx, -hl + 0.06, -hw * 0.82, 0.07, hw * 1.64, 0.03); ctx.fill(); break;
        case 2: ctx.fillStyle = bf; ctx.beginPath(); ctx.moveTo(-hl + 0.35, -hw * 0.85); ctx.quadraticCurveTo(-hl - 0.05, -hw * 0.9, -hl - 0.04, 0); ctx.quadraticCurveTo(-hl - 0.05, hw * 0.9, -hl + 0.35, hw * 0.85); ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 0.025; ctx.stroke(); break;
        case 3: wing(-hl + 0.1, 0.3, hw * 0.96, DARK, 0.08); break;
        case 4: ctx.strokeStyle = '#333'; ctx.lineWidth = 0.05; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(-hl + 0.45, s * 0.35); ctx.quadraticCurveTo(-hl + 0.3, s * 0.4, -hl + 0.2, s * 0.35); ctx.stroke(); } wing(-hl + 0.08, 0.3, hw * 0.98, bf, 0.06); break;
        case 5: wing(-hl + 0.26, 0.16, hw * 0.92, DARK, 0); wing(-hl + 0.05, 0.18, hw * 0.96, DARK, 0.06); break;
        case 6: wing(-hl + 0.08, 0.32, hw + 0.05, bf, 0.1); break;
        case 7: wing(-hl + 0.05, 0.3, hw + 0.13, DARK, 0.14); break;
        case 8: wing(-hl + 0.1, 0.14, hw * 0.6, bf, 0); break;
        case 9: wing(-hl - 0.1, 0.44, hw + 0.1, carbon(ctx), 0.2); break;
      }
    }
  }

  function drawWheels(ctx, look, steer) {
    const g = geom(look), p = look.paint || {};
    const wl = 0.68, ww = 0.25 + g.fl * 0.025, yo = g.hw - ww * 0.35 + g.fl * 0.045;
    for (const [x, front] of [[g.xF, 1], [g.xR, 0]]) for (const s of [-1, 1]) {
      ctx.save(); ctx.translate(x, s * yo); if (front) ctx.rotate(steer || 0);
      ctx.fillStyle = '#0d0d0f'; U.rr(ctx, -wl / 2, -ww / 2, wl, ww, 0.08); ctx.fill();
      ctx.fillStyle = '#1e1f23'; for (let i = -3; i <= 3; i++) ctx.fillRect(i * 0.09 - 0.015, -ww / 2, 0.03, ww);
      ctx.fillStyle = p.wheel || '#c8ccd2'; ctx.fillRect(-wl * 0.3, s > 0 ? 0.01 : -ww / 2 + 0.035, wl * 0.6, ww / 2 - 0.045);
      ctx.restore();
    }
  }

  function lookKey(look, lights) { return look.car + '|' + JSON.stringify(look.kit) + '|' + JSON.stringify(look.paint) + '|' + (lights ? 1 : 0); }
  // Кэшированный спрайт кузова (для игры — быстро)
  function sprite(look, lights) {
    const key = lookKey(look, lights);
    let s = spriteCache.get(key); if (s) return s;
    // Реалистичный спрайт из 3D-модели (если модуль three.js загрузился)
    if (window.CAR3D && window.CAR3D.ready) {
      try { s = window.CAR3D.topSprite(look, lights); } catch (e) { console.warn(e); s = null; }
      if (s) { spriteCache.set(key, s); if (spriteCache.size > 80) spriteCache.delete(spriteCache.keys().next().value); return s; }
    }
    const g = geom(look), ppm = 48;
    const wM = g.L + 1.4, hM = g.W + 1.0;
    const c = document.createElement('canvas'); c.width = Math.ceil(wM * ppm); c.height = Math.ceil(hM * ppm);
    const x = c.getContext('2d'); x.translate(c.width / 2, c.height / 2); x.scale(ppm, ppm);
    drawBody(x, look, { lights });
    s = { c, w: c.width / ppm, h: c.height / ppm };
    spriteCache.set(key, s);
    if (spriteCache.size > 80) spriteCache.delete(spriteCache.keys().next().value);
    return s;
  }

  // Полная машина в игре (контекст уже переведён в позицию машины и повёрнут)
  function drawTop(ctx, look, st) {
    st = st || {};
    const g = geom(look), p = look.paint || {};
    ctx.fillStyle = 'rgba(0,0,0,.32)'; U.rr(ctx, -g.hl + 0.12, -g.hw + 0.18, g.L, g.W, 0.45); ctx.fill();
    if (p.neon) {
      const gr = ctx.createRadialGradient(0, 0, 0.3, 0, 0, g.hl + 0.8);
      gr.addColorStop(0, U.rgba(p.neon, 0.55)); gr.addColorStop(1, U.rgba(p.neon, 0));
      ctx.save(); ctx.scale(1, g.W / g.L * 1.4); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, g.hl + 0.8, 0, 7); ctx.fill(); ctx.restore();
    }
    drawWheels(ctx, look, st.steer);
    const sp = sprite(look, !!st.lights);
    ctx.drawImage(sp.c, -sp.w / 2, -sp.h / 2, sp.w, sp.h);
    if (st.brake || st.reverse) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const s of [-1, 1]) {
        const gr = ctx.createRadialGradient(-g.hl, s * g.hw * 0.62, 0, -g.hl, s * g.hw * 0.62, 0.9);
        gr.addColorStop(0, st.reverse ? 'rgba(255,255,255,.55)' : 'rgba(255,40,50,.7)'); gr.addColorStop(1, 'rgba(255,0,0,0)');
        ctx.fillStyle = gr; ctx.fillRect(-g.hl - 1, s * g.hw * 0.62 - 1, 2, 2);
      }
      ctx.restore();
    }
  }

  // Вид сбоку (экран "Гонка")
  function drawSide(ctx, look, wheelRot, o) {
    o = o || {};
    const g = geom(look), p = look.paint || {}, k = look.kit || {};
    const [H, hoodH, deckH] = g.T.side; const { hl, L } = g; const gc = 0.2;
    const body = p.body || '#d33';
    const pts = new Path2D();
    pts.moveTo(hl, -gc - 0.08);
    pts.quadraticCurveTo(hl + 0.06, -hoodH * 0.55, hl - 0.04, -hoodH * 0.82);
    pts.lineTo(g.cf, -hoodH);
    pts.lineTo(g.cf - g.ws, -H);
    pts.lineTo(g.re, -H);
    pts.lineTo(Math.max(g.re - g.rw, -hl + 0.05), -deckH);
    pts.lineTo(-hl + 0.06, -deckH * 0.98);
    pts.quadraticCurveTo(-hl - 0.04, -deckH * 0.6, -hl, -gc - 0.08);
    pts.closePath();
    // тень на земле
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.ellipse(0, 0.02, hl * 1.05, 0.12, 0, 0, 7); ctx.fill();
    const gr = ctx.createLinearGradient(0, -H, 0, 0);
    gr.addColorStop(0, U.shade(body, 0.3)); gr.addColorStop(0.45, body); gr.addColorStop(1, U.shade(body, -0.45));
    ctx.fillStyle = gr; ctx.fill(pts);
    ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 0.03; ctx.stroke(pts);
    // окна
    if (g.type !== 'pickup' || true) {
      ctx.fillStyle = '#121a24';
      ctx.beginPath(); ctx.moveTo(g.cf - 0.08, -hoodH - 0.05); ctx.lineTo(g.cf - g.ws + 0.06, -H + 0.07); ctx.lineTo(g.re + 0.02, -H + 0.07); ctx.lineTo(Math.max(g.re - g.rw, -hl + 0.12) + 0.1, -deckH - 0.04); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = U.shade(body, -0.3); ctx.lineWidth = 0.06; ctx.beginPath(); ctx.moveTo((g.cf + g.re) / 2 - 0.1, -H + 0.05); ctx.lineTo((g.cf + g.re) / 2 - 0.05, -hoodH - 0.05); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = 0.035; ctx.beginPath(); ctx.moveTo(g.cf - g.ws + 0.2, -H + 0.12); ctx.lineTo(g.cf - 0.2, -hoodH - 0.08); ctx.stroke();
    }
    // линия кузова
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 0.025; ctx.beginPath(); ctx.moveTo(hl - 0.1, -hoodH * 0.6); ctx.lineTo(-hl + 0.1, -deckH * 0.62); ctx.stroke();
    // пороги
    if (k.skirt) { ctx.fillStyle = k.skirt === 2 ? carbon(ctx) : '#16181d'; ctx.fillRect(g.xR + 0.4, -gc - 0.12, g.xF - g.xR - 0.8, 0.08); }
    // фары/фонари
    ctx.fillStyle = p.light || '#fff6d5'; ctx.beginPath(); ctx.ellipse(hl - 0.08, -hoodH * 0.68, 0.07, 0.05, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#d0112b'; ctx.fillRect(-hl - 0.01, -deckH * 0.88, 0.07, 0.1);
    // спойлер
    const sp = k.spoiler | 0;
    if (sp >= 3 && sp !== 8) {
      const big = sp === 9 ? 1.4 : sp === 7 || sp === 6 ? 1.15 : 1;
      ctx.fillStyle = '#222'; ctx.fillRect(-hl + 0.25, -deckH - 0.22 * big, 0.04, 0.22 * big);
      ctx.fillStyle = sp === 4 || sp === 6 ? body : '#16181d';
      U.rr(ctx, -hl - 0.05 * big, -deckH - 0.3 * big, 0.5 * big, 0.08, 0.03); ctx.fill();
    } else if (sp === 2 || sp === 1 || sp === 8) { ctx.fillStyle = U.shade(body, -0.2); ctx.fillRect(-hl + 0.02, -deckH - 0.05, 0.22, 0.05); }
    // колёса
    for (const x of [g.xF, g.xR]) {
      ctx.fillStyle = '#07080a'; ctx.beginPath(); ctx.arc(x, -0.34, 0.42, Math.PI, 0); ctx.fill();
      ctx.save(); ctx.translate(x, -0.34);
      ctx.fillStyle = '#121316'; ctx.beginPath(); ctx.arc(0, 0, 0.35, 0, 7); ctx.fill();
      ctx.fillStyle = p.wheel || '#c8ccd2'; ctx.beginPath(); ctx.arc(0, 0, 0.22, 0, 7); ctx.fill();
      ctx.rotate(wheelRot || 0); ctx.strokeStyle = '#2a2c31'; ctx.lineWidth = 0.05;
      for (let i = 0; i < 5; i++) { ctx.rotate(Math.PI * 2 / 5); ctx.beginPath(); ctx.moveTo(0.04, 0); ctx.lineTo(0.2, 0); ctx.stroke(); }
      ctx.fillStyle = '#444'; ctx.beginPath(); ctx.arc(0, 0, 0.05, 0, 7); ctx.fill();
      ctx.restore();
    }
    // блик
    ctx.save(); ctx.clip(pts); ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(-hl, -H, L, (H - hoodH) * 0.6 + 0.05); ctx.restore();
  }

  return { geom, drawBody, drawWheels, drawTop, drawSide, sprite, carbon, drawVinyl, clearCache: () => spriteCache.clear() };
})();
