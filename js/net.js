'use strict';
// Firebase: аккаунты, облачные сохранения, мультиплеер
const NET = (() => {
  const N = { ok: false, auth: null, db: null, rtdb: null, user: null, nick: null, ready: false };
  let syncTimer = null, pendingNick = null, carry = null;

  N.pid = (() => {
    let p = null; try { p = localStorage.getItem('dod_pid'); } catch (e) { }
    if (!p) { p = 'p' + Math.random().toString(36).slice(2, 10); try { localStorage.setItem('dod_pid', p); } catch (e) { } }
    return p;
  })();

  N.init = function () {
    try {
      if (!window.firebase || !window.FIREBASE_CONFIG) throw new Error('SDK не загружен');
      firebase.initializeApp(window.FIREBASE_CONFIG);
      N.auth = firebase.auth();
      N.db = firebase.firestore();
      if (window.FIREBASE_CONFIG.databaseURL && firebase.database) N.rtdb = firebase.database();
      try { if (/^https?:/.test(location.protocol) && firebase.analytics) firebase.analytics(); } catch (e) { }
      N.ok = true;
      N.auth.onAuthStateChanged(u => onAuth(u));
    } catch (e) {
      console.warn('Firebase недоступен — игра работает офлайн:', e.message);
      N.ready = true;
    }
  };

  async function onAuth(u) {
    if (u && !u.isAnonymous) {
      N.user = u;
      try {
        const snap = await N.db.collection('users').doc(u.uid).get();
        if (snap.exists) {
          const d = snap.data();
          N.nick = d.nick || u.displayName || 'Гонщик';
          SAVE.useAccount(u.uid, d.save || null, null);
          if (!d.save) N.syncNow();
        } else {
          N.nick = pendingNick || u.displayName || 'Гонщик';
          SAVE.useAccount(u.uid, null, carry);
          await N.db.collection('users').doc(u.uid).set({
            nick: N.nick, email: u.email || '', save: SAVE.data,
            created: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
        }
      } catch (e) {
        console.warn(e);
        N.nick = u.displayName || 'Гонщик';
        SAVE.useAccount(u.uid, null, carry);
        UI.toast('Не удалось загрузить облачное сохранение. Проверь правила Firestore.', 'bad');
      }
      pendingNick = null; carry = null;
    } else {
      N.user = null; N.nick = null;
      if (SAVE.uid) SAVE.useGuest();
    }
    N.ready = true;
    if (typeof UI !== 'undefined') { UI.refreshTop(); UI.onAuthChanged(); }
  }

  N.displayNick = function () { return (N.user && N.nick) ? N.nick : SAVE.data.nick; };
  N.loggedIn = function () { return !!N.user; };

  const ERR = {
    'auth/email-already-in-use': 'Этот email уже зарегистрирован',
    'auth/invalid-email': 'Неверный формат email',
    'auth/weak-password': 'Пароль слишком простой (минимум 6 символов)',
    'auth/user-not-found': 'Пользователь не найден',
    'auth/wrong-password': 'Неверный пароль',
    'auth/invalid-credential': 'Неверный email или пароль',
    'auth/invalid-login-credentials': 'Неверный email или пароль',
    'auth/too-many-requests': 'Слишком много попыток. Подожди немного',
    'auth/network-request-failed': 'Нет соединения с интернетом',
    'auth/requires-recent-login': 'Для этого действия нужно заново войти',
    'auth/operation-not-allowed': 'Вход по email не включён в консоли Firebase (Authentication → Sign-in method)',
    'auth/missing-password': 'Введи пароль',
    'permission-denied': 'Нет доступа к базе данных — проверь правила Firestore',
  };
  N.err = function (e) { return ERR[e && e.code] || (e && e.message) || 'Ошибка'; };
  function need() { if (!N.ok) throw { message: 'Firebase недоступен (нет интернета или сайт открыт как файл)' }; }

  N.register = async function (nick, email, pass) {
    need();
    pendingNick = nick; carry = JSON.parse(JSON.stringify(SAVE.data));
    const cred = await N.auth.createUserWithEmailAndPassword(email, pass);
    try { await cred.user.updateProfile({ displayName: nick }); } catch (e) { }
    N.nick = nick;
    await N.db.collection('users').doc(cred.user.uid).set({ nick, email, save: carry }, { merge: true }).catch(() => { });
  };
  N.login = async function (email, pass) { need(); await N.auth.signInWithEmailAndPassword(email, pass); };
  N.logout = async function () { need(); await N.syncNow(); await N.auth.signOut(); };
  N.resetPassword = async function (email) { need(); await N.auth.sendPasswordResetEmail(email); };
  N.changePassword = async function (oldP, newP) {
    need(); const u = N.auth.currentUser; if (!u) throw { message: 'Сначала войди в аккаунт' };
    const cred = firebase.auth.EmailAuthProvider.credential(u.email, oldP);
    await u.reauthenticateWithCredential(cred);
    await u.updatePassword(newP);
  };
  N.changeNick = async function (nick) {
    if (N.user) {
      await N.user.updateProfile({ displayName: nick }).catch(() => { });
      await N.db.collection('users').doc(N.user.uid).set({ nick }, { merge: true });
      N.nick = nick;
    } else { SAVE.data.nick = nick; SAVE.save(); }
    UI.refreshTop();
  };

  N.queueSync = function () {
    if (!N.user || !N.ok) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => N.syncNow(), 2500);
  };
  N.syncNow = async function () {
    clearTimeout(syncTimer);
    if (!N.user || !N.ok) return;
    try {
      await N.db.collection('users').doc(N.user.uid).set({
        nick: N.nick, save: JSON.parse(JSON.stringify(SAVE.data)),
        updated: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (e) { console.warn('sync', e); }
  };

  // ---------- Мультиплеер ----------
  // Адаптер Firestore
  const FS = {
    interval: 200,
    room: id => N.db.collection('rooms').doc(id),
    setRoom: (id, r) => FS.room(id).set(r),
    getRoom: async id => { const s = await FS.room(id).get(); return s.exists ? s.data() : null; },
    updateRoom: (id, f) => FS.room(id).update(f),
    setPlayer: (id, pid, d) => FS.room(id).collection('players').doc(pid).set(d),
    updatePlayer: (id, pid, d) => FS.room(id).collection('players').doc(pid).set(d, { merge: true }),
    removePlayer: (id, pid) => FS.room(id).collection('players').doc(pid).delete(),
    onRoom: (id, cb) => FS.room(id).onSnapshot(s => cb(s.exists ? s.data() : null), e => console.warn(e)),
    onPlayers: (id, cb) => FS.room(id).collection('players').onSnapshot(qs => { const o = {}; qs.forEach(d => o[d.id] = d.data()); cb(o); }, e => console.warn(e)),
  };
  // Адаптер Realtime Database (если указан databaseURL)
  const RT = {
    interval: 80,
    ref: p => N.rtdb.ref(p),
    setRoom: (id, r) => RT.ref('rooms/' + id + '/info').set(r),
    getRoom: async id => (await RT.ref('rooms/' + id + '/info').get()).val(),
    updateRoom: (id, f) => RT.ref('rooms/' + id + '/info').update(f),
    setPlayer: (id, pid, d) => { const r = RT.ref('rooms/' + id + '/players/' + pid); r.onDisconnect().remove(); return r.set(d); },
    updatePlayer: (id, pid, d) => RT.ref('rooms/' + id + '/players/' + pid).update(d),
    removePlayer: (id, pid) => RT.ref('rooms/' + id + '/players/' + pid).remove(),
    onRoom: (id, cb) => { const r = RT.ref('rooms/' + id + '/info'); const f = s => cb(s.val()); r.on('value', f); return () => r.off('value', f); },
    onPlayers: (id, cb) => { const r = RT.ref('rooms/' + id + '/players'); const f = s => cb(s.val() || {}); r.on('value', f); return () => r.off('value', f); },
  };
  const ad = () => N.rtdb ? RT : FS;

  const MP = { id: null, room: null, players: {}, unsub: [], last: 0, sending: false, onRoom: null, onPlayers: null };
  N.mp = MP;
  MP.isHost = () => MP.room && MP.room.host === N.pid;
  MP.create = async function (mode, mapIdx) {
    need();
    const id = U.code(6);
    await ad().setRoom(id, { mode, map: mapIdx, host: N.pid, state: 'lobby', startT: 0, round: 0, created: Date.now() });
    return id;
  };
  MP.get = async function (id) { need(); return ad().getRoom(id); };
  MP.enter = async function (id) {
    need();
    await MP.leave();
    MP.id = id; MP.players = {};
    const look = SAVE.curLook();
    await ad().setPlayer(id, N.pid, {
      nick: N.displayNick(), look: { car: look.car, kit: look.kit, paint: look.paint },
      s: [0, 0, 0, 0, 0, 0], score: 0, dist: 0, fin: 0, t: Date.now(), joined: Date.now()
    });
    MP.unsub.push(ad().onRoom(id, r => { MP.room = r; if (MP.onRoom) MP.onRoom(r); }));
    MP.unsub.push(ad().onPlayers(id, p => { MP.players = p || {}; if (MP.onPlayers) MP.onPlayers(MP.players); }));
  };
  MP.updateLook = function () {
    if (!MP.id) return;
    const look = SAVE.curLook();
    ad().updatePlayer(MP.id, N.pid, { nick: N.displayNick(), look: { car: look.car, kit: look.kit, paint: look.paint } }).catch(() => { });
  };
  MP.send = function (data, force) {
    if (!MP.id || MP.sending) return;
    const now = performance.now();
    if (!force && now - MP.last < ad().interval) return;
    MP.last = now; MP.sending = true; data.t = Date.now();
    Promise.resolve(ad().updatePlayer(MP.id, N.pid, data)).catch(() => { }).finally(() => { MP.sending = false; });
  };
  MP.setRoom = function (f) { if (MP.id) return ad().updateRoom(MP.id, f); };
  MP.leave = async function () {
    MP.unsub.forEach(u => { try { u(); } catch (e) { } }); MP.unsub = [];
    const id = MP.id; MP.id = null; MP.room = null; MP.players = {};
    if (id) { try { await ad().removePlayer(id, N.pid); } catch (e) { } }
  };
  window.addEventListener('beforeunload', () => { if (MP.id) { try { ad().removePlayer(MP.id, N.pid); } catch (e) { } } N.syncNow(); });

  return N;
})();
