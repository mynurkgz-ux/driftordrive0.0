'use strict';
// Физика автомобиля: «велосипедная» модель с шинами по упрощённой формуле Пачейки,
// переносом веса, кругом трения (пробуксовка снижает боковое сцепление → занос), ручником, прижимной силой.
const PHYS = (() => {
  const G = 9.81;
  const SPOILER_DF = [0, 0.04, 0.07, 0.16, 0.16, 0.2, 0.14, 0.18, 0.08, 0.26];
  const FBUMP_DF = [0, 0.06, 0.08, 0.04, 0.07, 0, 0, 0.05];
  const REDLINE = { 3: 7000, 4: 7800, 6: 7600, 8: 6900, 10: 8600, 12: 9000 };

  function spec(def, cfg) {
    const up = cfg.up, tu = cfg.tune, kit = cfg.kit, T = DATA.TYPES[def.type];
    const mass = def.mass * (1 - 0.05 * up.weight) - (kit.hood === 2 ? 12 : kit.hood === 6 ? 6 : 0) - (kit.roof === 1 ? 8 : 0);
    const pmul = (1 + 0.12 * up.engine) * (1 + 0.1 * up.turbo);
    const hp = def.hp * pmul, P = hp * 745.7;
    const vmax = def.top / 3.6 * Math.pow(pmul, 1 / 3);
    const cd = P * 0.92 / Math.pow(vmax, 3);
    const L = T.L * def.lmul * 0.6, b = L * T.wf, a = L - b;
    const grip = def.grip * (1 + 0.05 * up.tires) * (1 + 0.015 * (kit.fender || 0)) * (1 + (5 - tu.height) * 0.006);
    const bal = (tu.fstiff - tu.rstiff) * 0.025;
    const cF = Math.abs(tu.fcamber), cR = Math.abs(tu.rcamber);
    const gripF = grip * (1 + Math.min(cF, 4) * 0.015 - Math.max(0, cF - 4) * 0.02 - bal * 0.5);
    const gripR = grip * (1 - cR * 0.022 + bal * 0.5);
    const redline = REDLINE[T.cyl] || 7500;
    return {
      mass, hp, P, vmax, cd, L, a, b, I: mass * (T.L * T.L + T.W * T.W) / 12 * 1.15,
      maxF: mass * def.accel * (1 + 0.04 * up.engine), brakeF: mass * G * 1.05 * (1 + 0.12 * up.brakes), bias: tu.bias / 100,
      gripF, gripR, steerMax: tu.steer * Math.PI / 180, diff: tu.diff / 100, drive: def.drive,
      dfR: SPOILER_DF[kit.spoiler || 0], dfF: FBUMP_DF[kit.fbump || 0], cyl: T.cyl, redline, idle: 900,
      gears: [0.27, 0.42, 0.56, 0.7, 0.85, 1.0].map(f => f * vmax), turbo: up.turbo, hcg: 0.5, vrev: 9, tcs: false
    };
  }

  // Подъём шины: sin(C·atan(B·α)) — пик и плавный спад после срыва
  const tire = (al, B, C) => Math.sin(C * Math.atan(B * al));

  function step(c, dt, surf) {
    const s = c.spec, m = s.mass, inp = c.input;
    const cs = Math.cos(c.h), sn = Math.sin(c.h);
    const vx = cs * c.vx + sn * c.vy, vy = -sn * c.vx + cs * c.vy;
    const spd = Math.hypot(vx, vy);
    const steer = c.steer;
    const dfk = (spd / 60) * (spd / 60);
    const muF = s.gripF * surf.mu * (1 + s.dfF * dfk), muR = s.gripR * surf.mu * (1 + s.dfR * dfk);
    // перенос веса
    let Nf = m * G * (s.b / s.L) - m * c.axl * s.hcg / s.L;
    let Nr = m * G * (s.a / s.L) + m * c.axl * s.hcg / s.L;
    Nf = Math.max(Nf, m * G * 0.15); Nr = Math.max(Nr, m * G * 0.15);
    const capF = muF * Nf, capR = muR * Nr;
    // продольные силы
    let thr = inp.throttle, brk = inp.brake;
    if (c.shiftT > 0) thr *= 0.2;
    let Fdrive = 0, brakeAmt = 0;
    if (thr > 0) { if (vx < -0.6) brakeAmt = thr; else Fdrive = thr * Math.min(s.maxF, s.P / Math.max(vx, 1)); }
    if (brk > 0) { if (vx > 0.6) brakeAmt = Math.max(brakeAmt, brk); else if (vx > -s.vrev) Fdrive -= brk * s.maxF * 0.4; }
    let dF = 0, dR = 1; if (s.drive === 'AWD') { dF = 0.38; dR = 0.62; } else if (s.drive === 'FWD') { dF = 1; dR = 0; }
    let FxF = Fdrive * dF, FxR = Fdrive * dR;
    if (s.tcs) { FxR = U.clamp(FxR, -capR * 0.85, capR * 0.85); FxF = U.clamp(FxF, -capF * 0.85, capF * 0.85); }
    const sgn = vx >= 0 ? 1 : -1;
    if (brakeAmt > 0) { FxF -= sgn * brakeAmt * s.brakeF * s.bias; FxR -= sgn * brakeAmt * s.brakeF * (1 - s.bias); }
    // пробуксовка / блокировка
    const spinR = Math.abs(FxR) / capR, spinF = Math.abs(FxF) / capF;
    if (spinR > 1) FxR = FxR / spinR * 0.92;
    if (spinF > 1) FxF = FxF / spinF * 0.92;
    const latCapF = capF * Math.sqrt(Math.max(0.05, 1 - Math.pow(Math.min(1, spinF), 4) * 0.85));
    let latCapR = capR * Math.sqrt(Math.max(0.05, 1 - Math.pow(Math.min(1, spinR), 4) * 0.85));
    if (spinR > 1) latCapR *= 1 - Math.min(0.5, (spinR - 1) * 0.35) * (0.4 + 0.6 * s.diff);
    // углы увода
    const vxa = Math.max(Math.abs(vx), 2.0);
    const sf = Math.atan2(vy + c.w * s.a, vxa) - steer * sgn;
    const sr = Math.atan2(vy - c.w * s.b, vxa);
    let FyF = -tire(sf, 9, 1.35) * latCapF;
    let FyR = -tire(sr, 10, 1.55) * latCapR;
    // ручник: задние колёса заблокированы — сила трения скольжения против движения пятна контакта
    const hand = inp.hand || 0;
    if (hand > 0 && spd > 0.5) {
      const vrx = vx, vry = vy - c.w * s.b, vr = Math.hypot(vrx, vry) || 1, k = muR * 0.7 * Nr;
      FxR = U.lerp(FxR, -k * vrx / vr, hand); FyR = U.lerp(FyR, -k * vry / vr, hand);
    }
    const cst = Math.cos(steer), snt = Math.sin(steer);
    let Fx = FxR + FxF * cst - FyF * snt;
    let Fy = FyR + FxF * snt + FyF * cst;
    Fx -= s.cd * vx * Math.abs(vx) + m * surf.drag * vx + (Math.abs(vx) > 0.2 ? sgn * m * 0.12 : 0);
    Fy -= s.cd * 2 * vy * Math.abs(vy) + m * surf.drag * vy;
    const torque = s.a * (FyF * cst + FxF * snt) - s.b * FyR;
    const axl = Fx / m, ayl = Fy / m;
    c.axl += (U.clamp(axl, -12, 12) - c.axl) * Math.min(1, dt * 8);
    c.vx += (cs * axl - sn * ayl) * dt; c.vy += (sn * axl + cs * ayl) * dt;
    c.w += torque / s.I * dt;
    c.w *= 1 - 0.4 * dt;
    // малая скорость — кинематическая модель (без дрожания)
    if (spd < 3) {
      const k = (1 - spd / 3);
      const wt = vx * Math.tan(steer) / s.L;
      c.w += (wt - c.w) * Math.min(1, k * dt * 12);
      const lvx = cs * c.vx + sn * c.vy, lvy = (-sn * c.vx + cs * c.vy) * (1 - Math.min(1, k * dt * 10));
      c.vx = cs * lvx - sn * lvy; c.vy = sn * lvx + cs * lvy;
      if (thr === 0 && brk === 0 && spd < 0.35) { c.vx *= 0.85; c.vy *= 0.85; c.w *= 0.85; }
    }
    c.h += c.w * dt;
    c.x += c.vx * dt; c.y += c.vy * dt;
    // телеметрия
    c.vxl = vx; c.vyl = vy; c.spd = spd; c.spinR = spinR; c.slipR = sr; c.brakeAmt = brakeAmt;
    const slideR = Math.abs(vy - c.w * s.b);
    c.skid = Math.min(1.5, Math.max(slideR / 5.5, spinR > 1 && thr > 0 ? 0.45 + (spinR - 1) * 0.6 : 0, hand > 0 && spd > 2 ? 0.8 : 0, brakeAmt > 0.8 && spd > 8 && spinF > 1 ? 0.6 : 0));
  }

  // Коробка передач и обороты (для звука и тахометра)
  function gearbox(c, dt) {
    const s = c.spec, v = Math.abs(c.vxl || 0), thr = c.input.throttle;
    if (c.shiftT > 0) c.shiftT -= dt;
    const gi = c.gear - 1, ratio = v / s.gears[gi];
    let spin = 0;
    if (thr > 0 && c.spinR > 1) spin = Math.min(0.5, (c.spinR - 1) * 0.4) + 0.12;
    if (c.input.hand && thr > 0) spin = Math.max(spin, 0.35);
    let target = s.idle + (s.redline - s.idle) * Math.min(1.04, ratio + spin);
    if (v < 2 && thr > 0) target = Math.max(target, s.idle + thr * (s.redline - s.idle) * 0.65);
    if ((c.vxl || 0) < -0.5) target = s.idle + (s.redline - s.idle) * Math.min(1, v / s.gears[0]);
    c.rpm += (target - c.rpm) * Math.min(1, dt * 10);
    if (c.rpm > s.redline) c.rpm = s.redline - Math.random() * 250; // отсечка
    if (c.shiftT <= 0) {
      if (ratio > 0.96 && c.gear < s.gears.length && spin < 0.3) { c.gear++; c.shiftT = 0.16; if (c.isPlayer) AUDIO.shift(); }
      else if (c.gear > 1 && v / s.gears[c.gear - 2] < 0.7) { c.gear--; c.shiftT = 0.06; }
    }
  }

  return { spec, step, gearbox };
})();
