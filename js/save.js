'use strict';
// Сохранение прогресса: машины, обвесы, деньги, открытые карты, настройки.
// Гость хранится в localStorage, аккаунт — в Firestore (+ локальный кэш).
const SAVE = {
  data: null,
  uid: null,           // uid аккаунта или null для гостя
  GUEST_KEY: 'dod_save_guest',

  defaultSettings() {
    return {
      master: 0.9, musicOn: true, music: 0.45, track: 0, sfx: 0.8, engine: 0.75, amb: 0.5, tire: 0.7,
      scheme: 'joystick', layout: {}, touchAlpha: 1, vibrate: true,
      orient: 'landscape', camera: 'fixed', assist: true, quality: 'high', units: 'kmh'
    };
  },
  newCarCfg(carId) {
    const kit = {}; DATA.KITS.forEach(k => kit[k.id] = 0);
    const r = U.rng(U.hash(carId || 'x'));
    return {
      up: { engine: 0, turbo: 0, tires: 0, weight: 0, brakes: 0 },
      tune: Object.assign({}, DATA.TUNE_DEFAULT),
      kit,
      kitsOwned: DATA.KITS.map(k => k.id + ':0'),
      paint: { body: DATA.PALETTE[Math.floor(r() * 12)], finish: 'gloss', wheel: '#c8ccd2', light: '#fff6d5', neon: '', vinyl: 0, v1: '#ffffff', v2: '#111111' }
    };
  },
  defaults() {
    const d = {
      v: 1, nick: 'Игрок' + (100 + Math.floor(Math.random() * 900)), money: 5000, cars: {}, current: DATA.STARTER,
      unlocked: { drift: 3, race: 3 }, best: {}, settings: this.defaultSettings(),
      stats: { races: 0, wins: 0, drifts: 0, bestDrift: 0 }
    };
    d.cars[DATA.STARTER] = this.newCarCfg(DATA.STARTER);
    d.cars[DATA.STARTER].paint.body = '#e63946';
    return d;
  },
  // Дополнить сохранение недостающими полями (после обновлений игры)
  normalize(d) {
    const def = this.defaults();
    if (!d || typeof d !== 'object') return def;
    for (const k in def) if (d[k] === undefined) d[k] = def[k];
    d.settings = Object.assign(this.defaultSettings(), d.settings || {});
    d.unlocked = Object.assign({ drift: 3, race: 3 }, d.unlocked || {});
    d.stats = Object.assign(def.stats, d.stats || {});
    if (!d.cars || typeof d.cars !== 'object') d.cars = {};
    for (const id in d.cars) {
      if (!DATA.CAR[id]) { delete d.cars[id]; continue; }
      const base = this.newCarCfg(id), c = d.cars[id];
      c.up = Object.assign(base.up, c.up || {}); c.tune = Object.assign(base.tune, c.tune || {});
      c.kit = Object.assign(base.kit, c.kit || {}); c.paint = Object.assign(base.paint, c.paint || {});
      if (!Array.isArray(c.kitsOwned)) c.kitsOwned = base.kitsOwned;
    }
    if (!d.cars[DATA.STARTER] && !Object.keys(d.cars).length) d.cars[DATA.STARTER] = this.newCarCfg(DATA.STARTER);
    if (!d.cars[d.current]) d.current = Object.keys(d.cars)[0];
    if (typeof d.money !== 'number' || !isFinite(d.money)) d.money = 5000;
    return d;
  },
  readLocal(key) { try { const t = localStorage.getItem(key); return t ? JSON.parse(t) : null; } catch (e) { return null; } },
  writeLocal(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { } },

  load() {
    this.uid = null;
    this.data = this.normalize(this.readLocal(this.GUEST_KEY));
    this.writeLocal(this.GUEST_KEY, this.data);
  },
  key() { return this.uid ? 'dod_save_' + this.uid : this.GUEST_KEY; },

  // Вход в аккаунт: remote — сохранение из облака (или null, тогда берём локальный кэш / гостевой прогресс)
  useAccount(uid, remote, carry) {
    const keepSettings = this.data ? this.data.settings : null;
    this.uid = uid;
    let d = remote || this.readLocal(this.key()) || carry || null;
    d = this.normalize(d ? JSON.parse(JSON.stringify(d)) : null);
    if (keepSettings && !remote) d.settings = keepSettings;
    this.data = d;
    this.writeLocal(this.key(), d);
    if (typeof AUDIO !== 'undefined') AUDIO.apply();
  },
  useGuest() {
    this.uid = null;
    this.data = this.normalize(this.readLocal(this.GUEST_KEY));
    if (typeof AUDIO !== 'undefined') AUDIO.apply();
  },

  save() {
    this.writeLocal(this.key(), this.data);
    if (typeof NET !== 'undefined') NET.queueSync();
    if (typeof UI !== 'undefined') UI.refreshTop();
  },

  s() { return this.data.settings; },
  owns(id) { return !!this.data.cars[id]; },
  cfg(id) { return this.data.cars[id || this.data.current]; },
  curCfg() { return this.cfg(this.data.current); },
  curLook() { const c = this.curCfg(); return { car: this.data.current, kit: c.kit, paint: c.paint }; },
  addMoney(n) { this.data.money = Math.max(0, Math.round(this.data.money + n)); this.save(); },
  spend(n) { if (this.data.money < n) return false; this.data.money -= n; this.save(); return true; },
};
