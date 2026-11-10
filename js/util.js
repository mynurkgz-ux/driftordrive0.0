'use strict';
// Общие утилиты
const U = {
  rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  },
  hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; },
  clamp(v, a, b) { return v < a ? a : v > b ? b : v; },
  lerp(a, b, t) { return a + (b - a) * t; },
  wrap(a) { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; },
  $(s, r = document) { return r.querySelector(s); },
  $$(s, r = document) { return Array.from(r.querySelectorAll(s)); },
  el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; },
  money(n) { return '$' + Math.round(n).toLocaleString('ru-RU'); },
  num(n) { return Math.round(n).toLocaleString('ru-RU'); },
  time(s) { if (!isFinite(s) || s <= 0) return '--:--'; const m = Math.floor(s / 60), r = s - m * 60; return m + ':' + (r < 10 ? '0' : '') + r.toFixed(2); },
  clock(s) { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); },
  esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
  hexRgb(h) {
    h = String(h || '#000').replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16) || 0; return [n >> 16 & 255, n >> 8 & 255, n & 255];
  },
  rgbHex(r, g, b) { return '#' + [r, g, b].map(v => Math.round(U.clamp(v, 0, 255)).toString(16).padStart(2, '0')).join(''); },
  shade(h, a) { const [r, g, b] = U.hexRgb(h); const t = a < 0 ? 0 : 255, p = Math.abs(a); return U.rgbHex(r + (t - r) * p, g + (t - g) * p, b + (t - b) * p); },
  rgba(h, a) { const [r, g, b] = U.hexRgb(h); return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'; },
  hue(h, deg) {
    let [r, g, b] = U.hexRgb(h).map(v => v / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let hh = 0, s = 0; const l = (mx + mn) / 2;
    if (mx !== mn) {
      const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
      hh = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; hh *= 60;
    }
    hh = ((hh + deg) % 360 + 360) % 360;
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((hh / 60) % 2 - 1)), m = l - c / 2;
    let rr = 0, gg = 0, bb = 0;
    if (hh < 60) [rr, gg, bb] = [c, x, 0]; else if (hh < 120) [rr, gg, bb] = [x, c, 0]; else if (hh < 180) [rr, gg, bb] = [0, c, x];
    else if (hh < 240) [rr, gg, bb] = [0, x, c]; else if (hh < 300) [rr, gg, bb] = [x, 0, c]; else [rr, gg, bb] = [c, 0, x];
    return U.rgbHex((rr + m) * 255, (gg + m) * 255, (bb + m) * 255);
  },
  code(n = 6) { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < n; i++) s += a[Math.floor(Math.random() * a.length)]; return s; },
  copy(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    const t = document.createElement('textarea'); t.value = text; t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (e) { } t.remove(); return Promise.resolve();
  },
  // Скругленный прямоугольник (своя реализация — работает во всех браузерах)
  rr(ctx, x, y, w, h, r) {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  },
};
U.isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
U.isMobile = /[?&]mobile=1/.test(location.search) ||
  (U.isTouch && matchMedia('(pointer: coarse)').matches) ||
  /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
